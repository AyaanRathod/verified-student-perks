#!/usr/bin/env python3
"""Write docs/deals.js from data/deals.yaml so GitHub Pages can show the deals."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def json_ready(value):
    if isinstance(value, dt.datetime):
        return value.date().isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, list):
        return [json_ready(item) for item in value]
    if isinstance(value, dict):
        return {key: json_ready(item) for key, item in value.items()}
    return value


def main() -> None:
    deals = yaml.safe_load((ROOT / "data" / "deals.yaml").read_text(encoding="utf-8"))
    payload = json.dumps(json_ready(deals), indent=2)
    target = ROOT / "docs" / "deals.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("window.PERKCHECK_DEALS = " + payload + ";\n", encoding="utf-8")
    print(f"{target}: {len(deals)} deals")


if __name__ == "__main__":
    main()
