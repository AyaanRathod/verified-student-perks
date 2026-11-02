#!/usr/bin/env python3
"""Open every published deal page and report broken ones.

Does not edit deals.yaml. GitHub Actions turns a failure report into an issue.
Pages that block bots are listed for a hand check, not reported as broken.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
# A plain browser string. Amazon and similar pages return 403 to a custom bot name.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-CA,en;q=0.9",
}
MANUAL_RECHECK_DAYS = 30
RETRY_PAUSE_SECONDS = 3
BOT_WALL_STATUSES = {401, 403, 429, 503}
EMPTY_REPORT = {"broken": [], "changed": [], "manual": [], "manual_overdue": []}


def _deal_id(deal: dict) -> str:
    return str(deal.get("id", "(missing id)"))


def _header_map(headers: dict | None) -> dict[str, str]:
    return {str(key).lower(): str(value) for key, value in (headers or {}).items()}


def _verified_on(deal: dict) -> dt.date | None:
    value = deal.get("last_verified")
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, str):
        try:
            return dt.date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def is_bot_wall(status_code: int | None, body: str, headers: dict | None) -> bool:
    if status_code not in BOT_WALL_STATUSES:
        return False
    lowered = _header_map(headers)
    server = lowered.get("server", "")
    if lowered.get("cf-mitigated", "").strip().lower() == "challenge":
        return True
    if "cloudflare" in server.lower() or "akamai" in server.lower():
        return True
    text = body or ""
    return any(phrase in text for phrase in ("Just a moment...", "Attention Required", "Access Denied"))


def _is_timeout(error: BaseException | str) -> bool:
    if isinstance(error, requests.Timeout):
        return True
    name = type(error).__name__.lower() if isinstance(error, BaseException) else ""
    text = str(error).lower()
    return "timeout" in name or "timed out" in text


def _is_connection_reset(error: BaseException | str) -> bool:
    if isinstance(error, ConnectionResetError):
        return True
    text = str(error).lower()
    return "connection reset" in text or "connectionreset" in text


def _manual_kind(deal: dict, today: dt.date) -> str:
    verified = _verified_on(deal)
    if verified is not None and (today - verified).days > MANUAL_RECHECK_DAYS:
        return "manual_overdue"
    return "manual"


def _manual_result(deal: dict, detail: str, today: dt.date) -> tuple[str, str]:
    verified = _verified_on(deal)
    shown = verified.isoformat() if verified else "unknown"
    kind = _manual_kind(deal, today)
    message = f"{_deal_id(deal)}: blocks automated checks ({detail}); last checked by hand {shown}"
    if kind == "manual_overdue":
        message += ", due for a hand check"
    return kind, message


def _bot_wall_detail(status_code: int, body: str, headers: dict | None) -> str:
    lowered = _header_map(headers)
    server = lowered.get("server", "").lower()
    if "cloudflare" in server:
        label = "cloudflare"
    elif "akamai" in server:
        label = "akamai"
    elif lowered.get("cf-mitigated", "").strip().lower() == "challenge":
        label = "challenge"
    elif "Just a moment..." in (body or ""):
        label = "Just a moment..."
    elif "Attention Required" in (body or ""):
        label = "Attention Required"
    elif "Access Denied" in (body or ""):
        label = "Access Denied"
    else:
        label = "blocked"
    return f"HTTP {status_code}, {label}"


def classify(
    deal: dict,
    status_code: int | None,
    body: str,
    headers: dict | None,
    error: BaseException | str | None = None,
    today: dt.date | None = None,
) -> tuple[str, str] | None:
    today = today or dt.date.today()
    if error:
        if _is_timeout(error) or _is_connection_reset(error):
            label = "timeout" if _is_timeout(error) else "connection reset"
            return _manual_result(deal, label, today)
        return "broken", f"{_deal_id(deal)}: request failed ({error})"
    if is_bot_wall(status_code, body or "", headers):
        return _manual_result(deal, _bot_wall_detail(status_code or 0, body or "", headers), today)
    if status_code is None or status_code >= 400:
        return "broken", f"{_deal_id(deal)}: HTTP {status_code}"
    watch = deal.get("watch_text")
    if isinstance(watch, str) and watch.strip() and watch.lower() not in (body or "").lower():
        return "changed", f"{_deal_id(deal)}: watch_text not found: {watch}"
    return None


def judge_response(
    deal: dict,
    status_code: int | None,
    body: str,
    error: str | None = None,
) -> str | None:
    """Old name. Returns the message, or None when the page is fine."""
    result = classify(deal, status_code, body, {}, error=error)
    if result is None:
        return None
    return result[1]


def _fetch_with_retry(fetch, url: str) -> tuple[int, str, dict]:
    try:
        return fetch(url)
    except (requests.Timeout, requests.ConnectionError):
        time.sleep(RETRY_PAUSE_SECONDS)
        return fetch(url)


def check_deals(
    deals: list[dict],
    fetch,
    pause_seconds: float = 0,
    today: dt.date | None = None,
) -> dict[str, list[str]]:
    today = today or dt.date.today()
    grouped = {key: [] for key in EMPTY_REPORT}
    for index, deal in enumerate(deals):
        if deal.get("status") == "expired":
            continue
        if index and pause_seconds:
            time.sleep(pause_seconds)
        try:
            status_code, body, headers = _fetch_with_retry(fetch, deal["official_url"])
            result = classify(deal, status_code, body, headers, today=today)
        except Exception as exc:  # network and unexpected parse errors become a flag
            result = classify(deal, None, "", {}, error=exc, today=today)
        if result:
            kind, message = result
            grouped[kind].append(message)
    return grouped


def default_fetch(url: str) -> tuple[int, str, dict]:
    response = requests.get(
        url,
        timeout=30,
        headers=REQUEST_HEADERS,
        allow_redirects=True,
    )
    response.encoding = response.encoding or "utf-8"
    headers = {str(key).lower(): str(value) for key, value in response.headers.items()}
    return response.status_code, response.text, headers


def _ids(messages: list[str]) -> list[str]:
    return [message.split(":", 1)[0].strip() for message in messages]


def fingerprint_for(grouped: dict[str, list[str]]) -> str:
    ids = []
    for key in ("broken", "changed", "manual_overdue"):
        ids.extend(_ids(grouped.get(key, [])))
    payload = "\n".join(sorted(ids))
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _section(title: str, messages: list[str], intro: str | None = None) -> list[str]:
    if not messages:
        return []
    lines = ["", f"## {title}", ""]
    if intro:
        lines.extend([intro, ""])
    lines.extend(f"- {message}" for message in messages)
    return lines


def write_report(path: Path, grouped: dict[str, list[str]], checked: int) -> str:
    broken = list(grouped.get("broken", []))
    changed = list(grouped.get("changed", []))
    manual = list(grouped.get("manual", []))
    overdue = list(grouped.get("manual_overdue", []))
    need = len(broken) + len(changed) + len(overdue)
    fingerprint = fingerprint_for(grouped)
    lines = [f"Nightly check looked at {checked} deal page(s). {need} need a look."]
    lines.extend(_section("Broken links", broken))
    lines.extend(_section("Page text changed", changed))
    lines.extend(
        _section(
            "Check these by hand",
            overdue + manual,
            "These sites block automated checks. Open each one in a browser, then update last_verified.",
        )
    )
    lines.extend(["", f"<!-- fingerprint: {fingerprint} -->"])
    text = "\n".join(lines) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    path.with_suffix(".json").write_text(
        json.dumps(
            {
                "checked": checked,
                "broken": broken,
                "changed": changed,
                "manual": manual,
                "manual_overdue": overdue,
                "fingerprint": fingerprint,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return text


def set_output(name: str, value: str) -> None:
    output = os.environ.get("GITHUB_OUTPUT")
    if not output:
        return
    with open(output, "a", encoding="utf-8") as handle:
        handle.write(f"{name}={value}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check official deal URLs.")
    parser.add_argument("path", nargs="?", default=str(ROOT / "data" / "deals.yaml"))
    parser.add_argument("--report", default=str(ROOT / "data" / "inbox" / "link-report.md"))
    parser.add_argument("--pause", type=float, default=1.0)
    args = parser.parse_args(argv)
    with Path(args.path).open(encoding="utf-8") as handle:
        deals = yaml.safe_load(handle)
    if not isinstance(deals, list):
        print("deals file must be a list", file=sys.stderr)
        return 1
    checked = [deal for deal in deals if deal.get("status") != "expired"]
    grouped = check_deals(checked, default_fetch, pause_seconds=args.pause)
    text = write_report(Path(args.report), grouped, len(checked))
    need = len(grouped["broken"]) + len(grouped["changed"]) + len(grouped["manual_overdue"])
    set_output("failed", str(need))
    set_output("fingerprint", fingerprint_for(grouped))
    print(text, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
