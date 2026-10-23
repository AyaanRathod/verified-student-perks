#!/usr/bin/env python3
"""Open every published deal page and report broken ones.

Does not edit deals.yaml. GitHub Actions turns a failure report into an issue.
"""

from __future__ import annotations

import argparse
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


def judge_response(deal: dict, status_code: int | None, body: str, error: str | None = None) -> str | None:
    deal_id = deal.get("id", "(missing id)")
    if error:
        return f"{deal_id}: request failed ({error})"
    if status_code is None or status_code >= 400:
        return f"{deal_id}: HTTP {status_code}"
    watch = deal.get("watch_text")
    if isinstance(watch, str) and watch.strip() and watch.lower() not in body.lower():
        return f"{deal_id}: watch_text not found: {watch}"
    return None


def check_deals(deals: list[dict], fetch, pause_seconds: float = 0) -> list[str]:
    failures: list[str] = []
    for index, deal in enumerate(deals):
        if deal.get("status") == "expired":
            continue
        if index and pause_seconds:
            time.sleep(pause_seconds)
        try:
            status_code, body = fetch(deal["official_url"])
            reason = judge_response(deal, status_code, body)
        except Exception as exc:  # network and unexpected parse errors become a flag
            reason = judge_response(deal, None, "", error=str(exc))
        if reason:
            failures.append(reason)
    return failures


def default_fetch(url: str) -> tuple[int, str]:
    response = requests.get(
        url,
        timeout=20,
        headers=REQUEST_HEADERS,
        allow_redirects=True,
    )
    response.encoding = response.encoding or "utf-8"
    return response.status_code, response.text


def write_report(path: Path, failures: list[str], checked: int) -> None:
    if failures:
        lines = [
            f"Nightly check looked at {checked} deal page(s). {len(failures)} need a look.",
            "",
            "The deal file was not changed. Open the official page, then set `status: needs-review` if the perk changed.",
            "",
            *[f"- {failure}" for failure in failures],
        ]
    else:
        lines = [f"Nightly check looked at {checked} deal page(s). All of them still match."]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.with_suffix(".json").write_text(
        json.dumps({"checked": checked, "failures": failures}, indent=2) + "\n",
        encoding="utf-8",
    )


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
    failures = check_deals(checked, default_fetch, pause_seconds=args.pause)
    write_report(Path(args.report), failures, len(checked))
    set_output("failed", str(len(failures)))
    print("\n".join(failures) if failures else f"{len(checked)} pages ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
