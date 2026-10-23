#!/usr/bin/env python3
"""Fetch the Monday source list and report links that were not there last time.

The first run records each page and does not treat every existing link as new.
Later runs report links added since that snapshot. Aggregator pages are leads only.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag

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
SKIP_HOSTS = {
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "pinterest.com",
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "schema.org",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
}
SKIP_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".css",
    ".js",
    ".woff",
    ".woff2",
    ".ico",
    ".pdf",
}


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.hrefs.append(href)


def extract_links(html: str, base_url: str, limit: int = 500) -> list[str]:
    parser = LinkParser()
    parser.feed(html)
    found: list[str] = []
    seen: set[str] = set()
    for href in parser.hrefs:
        absolute = urljoin(base_url, href.strip())
        absolute, _fragment = urldefrag(absolute)
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            continue
        host = parsed.netloc.lower().removeprefix("www.")
        if host in SKIP_HOSTS or host.endswith(".schema.org"):
            continue
        if Path(parsed.path).suffix.lower() in SKIP_EXTENSIONS:
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        found.append(absolute)
        if len(found) >= limit:
            break
    return found


def compare_source(previous: dict | None, links: list[str]) -> list[str]:
    """Return human lines. An empty previous snapshot means this is the first watch."""
    if not previous:
        return []
    old = set(previous.get("links") or [])
    added = [link for link in links if link not in old]
    return added


def render_report(started: list[str], added: dict[str, list[str]], failed: list[str]) -> str:
    lines = ["Monday source watch.", ""]
    if not started and not added and not failed:
        lines.append("No new links on the source list.")
        return "\n".join(lines) + "\n"
    if started:
        lines.append("Started watching these pages. Existing links were recorded and not treated as new.")
        lines.extend(f"- {item}" for item in started)
        lines.append("")
    if added:
        lines.append("New links since the last snapshot. These are leads, not published deals.")
        for name, links in added.items():
            lines.append(f"### {name}")
            shown = links[:40]
            lines.extend(f"- {link}" for link in shown)
            extra = len(links) - len(shown)
            if extra:
                lines.append(f"- {extra} more")
        lines.append("")
    if failed:
        lines.append("Pages that could not be fetched:")
        lines.extend(f"- {item}" for item in failed)
    lines.append("")
    lines.append("The Grok bot still does the open-web search. File those finds as deal candidates.")
    return "\n".join(lines).rstrip() + "\n"


def fetch(url: str) -> str:
    response = requests.get(url, timeout=25, headers=REQUEST_HEADERS, allow_redirects=True)
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"
    return response.text


def set_output(name: str, value: str) -> None:
    output = os.environ.get("GITHUB_OUTPUT")
    if not output:
        return
    with open(output, "a", encoding="utf-8") as handle:
        handle.write(f"{name}={value}\n")


def run(sources: list[dict], snapshot: dict, fetch_page, pause_seconds: float = 0) -> tuple[dict, str, bool]:
    stored = dict(snapshot.get("sources") or {})
    started: list[str] = []
    added: dict[str, list[str]] = {}
    failed: list[str] = []
    for index, source in enumerate(sources):
        if index and pause_seconds:
            time.sleep(pause_seconds)
        source_id = source["id"]
        name = source.get("name") or source_id
        previous = stored.get(source_id)
        try:
            html = fetch_page(source["url"])
            links = extract_links(html, source["url"])
        except Exception as exc:
            failed.append(f"{name}: {exc}")
            continue
        new_links = compare_source(previous, links)
        if previous is None:
            started.append(f"{name} ({len(links)} links)")
        elif new_links:
            added[name] = new_links
        stored[source_id] = {"url": source["url"], "links": links}
    report = render_report(started, added, failed)
    noteworthy = bool(started or added or failed)
    return {"sources": stored}, report, noteworthy


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Watch known student-deal source pages.")
    parser.add_argument("--sources", default=str(ROOT / "data" / "sources.yaml"))
    parser.add_argument("--snapshot", default=str(ROOT / "data" / "inbox" / "source-snapshot.json"))
    parser.add_argument("--report", default=str(ROOT / "data" / "inbox" / "monday-report.md"))
    parser.add_argument("--pause", type=float, default=1.0)
    args = parser.parse_args(argv)

    with Path(args.sources).open(encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)
    snapshot_path = Path(args.snapshot)
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8")) if snapshot_path.is_file() else {"sources": {}}
    updated, report, noteworthy = run(sources, snapshot, fetch, pause_seconds=args.pause)
    snapshot_path.write_text(json.dumps(updated, indent=2) + "\n", encoding="utf-8")
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")
    set_output("report", "true" if noteworthy else "false")
    set_output("changed", "true" if updated != snapshot else "false")
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
