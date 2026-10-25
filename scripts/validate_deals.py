#!/usr/bin/env python3
"""Validate PerkCheck deal and candidate files.

Usage:
  python scripts/validate_deals.py
  python scripts/validate_deals.py data/deals.yaml
  python scripts/validate_deals.py --candidates data/inbox/candidates.yaml
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = {
    "github-pack",
    "ai",
    "coding",
    "cloud",
    "design",
    "notes",
    "learning",
    "shopping",
}
PRICE_TYPES = {"free", "discount"}
VERIFICATIONS = {
    "school-email",
    "sheerid",
    "unidays",
    "student-beans",
    "id-upload",
    "github-education",
    "other",
}
HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
LOGO_FILE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.svg$")
STATUSES = {"active", "needs-review", "expired"}
SCHOOL_EMAIL = {"accepted", "rejected", "unknown"}
REQUIRED = (
    "id",
    "brand",
    "title",
    "category",
    "price_type",
    "countries",
    "ca_school_email",
    "verification",
    "how_to_claim",
    "official_url",
    "source_note",
    "last_verified",
    "status",
)


class ValidationError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


def load_yaml(path: Path):
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def as_date(value) -> dt.date:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, str):
        return dt.date.fromisoformat(value)
    raise ValueError(f"not a date: {value!r}")


def is_https(value) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme == "https" and bool(parsed.netloc)


def host_of(value: str) -> str:
    return urlparse(value.strip()).netloc.lower().removeprefix("www.")


def validate_deals(deals, *, today: dt.date | None = None) -> list[str]:
    today = today or dt.date.today()
    errors: list[str] = []
    if not isinstance(deals, list) or not deals:
        return ["deals file must be a non-empty list"]

    seen: set[str] = set()
    featured_count = 0
    for index, deal in enumerate(deals, start=1):
        label = f"deal #{index}"
        if not isinstance(deal, dict):
            errors.append(f"{label}: must be a mapping")
            continue
        deal_id = deal.get("id")
        if isinstance(deal_id, str) and deal_id.strip():
            label = deal_id
        errors.extend(_deal_errors(deal, label, seen, today))
        if isinstance(deal, dict) and deal.get("featured") is True:
            featured_count += 1
    if featured_count > 4:
        errors.append("more than 4 deals have featured: true")
    return errors


def _deal_errors(deal: dict, label: str, seen: set[str], today: dt.date) -> list[str]:
    errors: list[str] = []

    def err(message: str) -> None:
        errors.append(f"{label}: {message}")

    for field in REQUIRED:
        if field not in deal or deal[field] in (None, "", []):
            err(f"missing {field}")

    deal_id = deal.get("id")
    if isinstance(deal_id, str):
        if deal_id in seen:
            err("duplicate id")
        seen.add(deal_id)
        if not deal_id.replace("-", "").isalnum() or deal_id != deal_id.lower():
            err("id must be a lowercase slug")

    if deal.get("category") not in CATEGORIES:
        err(f"category must be one of {sorted(CATEGORIES)}")
    if deal.get("price_type") not in PRICE_TYPES:
        err("price_type must be free or discount")
    if deal.get("verification") not in VERIFICATIONS:
        err(f"verification must be one of {sorted(VERIFICATIONS)}")
    if deal.get("status") not in STATUSES:
        err("status must be active, needs-review, or expired")
    if deal.get("ca_school_email") not in SCHOOL_EMAIL:
        err("ca_school_email must be accepted, rejected, or unknown")

    status = deal.get("status")
    countries = deal.get("countries")
    if not isinstance(countries, list) or not all(_is_country_entry(code) for code in countries):
        err("countries must be a list of two-letter ISO codes or GLOBAL")
        countries = []
    elif "GLOBAL" in countries and any(code != "GLOBAL" for code in countries):
        err("GLOBAL cannot be combined with country codes")

    if "countries_scope" in deal and deal.get("countries_scope") is not None and deal.get("countries_scope") != "global":
        err('countries_scope must be "global"')

    excluded = []
    if "not_available_in" in deal and deal["not_available_in"] is not None:
        entries = deal["not_available_in"]
        if not isinstance(entries, list):
            err("not_available_in must be a list")
        else:
            for entry in entries:
                if not isinstance(entry, dict) or not isinstance(entry.get("country"), str):
                    err("not_available_in entries need a country")
                    continue
                excluded.append(entry["country"])
                if not is_https(entry.get("source")):
                    err(f"not_available_in {entry['country']} needs an https source")

    overlap = sorted(set(countries) & set(excluded))
    if overlap:
        err(f"countries and not_available_in both include {', '.join(overlap)}")

    school = deal.get("ca_school_email")
    if status == "active" and school == "unknown":
        err("active deals need ca_school_email accepted or rejected")
    if school == "accepted" and "CA" not in countries and "GLOBAL" not in countries:
        err("ca_school_email accepted requires CA in countries")
    if "CA" in excluded and school != "rejected":
        err("Canada is excluded, so ca_school_email must be rejected")
    if school == "rejected" and "CA" in countries and not str(deal.get("email_rules") or "").strip():
        err("email_rules must explain why a Canadian school email is rejected")

    if deal.get("price_type") == "discount" and not str(deal.get("discount") or "").strip():
        err("discount deals need a discount")
    if "free_months" in deal and deal["free_months"] is not None and not isinstance(deal["free_months"], int):
        err("free_months must be a whole number or null")

    steps = deal.get("how_to_claim")
    if not isinstance(steps, list) or not all(isinstance(step, str) and step.strip() for step in steps or []):
        err("how_to_claim must be a list of steps")
    elif status == "active" and not 3 <= len(steps) <= 5:
        err("active deals need 3 to 5 how_to_claim steps")

    official = deal.get("official_url")
    if not is_https(official):
        err("official_url must be https")
    elif status == "active" and host_of(official) == "example.com":
        err("official_url cannot be example.com")

    affiliate = deal.get("affiliate_url")
    if affiliate not in (None, "") and not is_https(affiliate):
        err("affiliate_url must be https or null")

    try:
        verified = as_date(deal.get("last_verified"))
    except (TypeError, ValueError):
        err("last_verified must be YYYY-MM-DD")
    else:
        if verified > today:
            err("last_verified is in the future")

    source_note = deal.get("source_note")
    if not isinstance(source_note, str) or not source_note.strip():
        err("source_note is required")
    elif status == "active" and "EXAMPLE" in source_note.upper():
        err("active deals cannot use a placeholder source_note")

    if status == "active":
        blob = " ".join(str(deal.get(key) or "") for key in ("title", "email_rules", "source_note"))
        blob += " " + " ".join(steps if isinstance(steps, list) else [])
        if "EXAMPLE" in blob.upper():
            err("active deals cannot contain EXAMPLE placeholder text")

    watch = deal.get("watch_text")
    if watch is not None and (not isinstance(watch, str) or not watch.strip()):
        err("watch_text must be a phrase or omitted")

    if status == "active":
        banner = deal.get("banner_color")
        if not isinstance(banner, str) or not HEX_COLOR.fullmatch(banner):
            err("banner_color is required for active deals and must be a #RRGGBB color")

    if "logo_color" in deal and deal.get("logo_color") is not None:
        paint = deal.get("logo_color")
        if not isinstance(paint, str) or not HEX_COLOR.fullmatch(paint):
            err("logo_color must be a #RRGGBB color")

    logo = deal.get("logo", None)
    if logo is not None:
        if not isinstance(logo, str) or not LOGO_FILE.fullmatch(logo):
            err("logo must be a file name ending in .svg, with no slashes")
        elif not (ROOT / "docs" / "logos" / logo).is_file():
            err(f"logo file docs/logos/{logo} does not exist")

    if status == "active" and school == "accepted" and not is_https(deal.get("ca_school_email_source")):
        err("ca_school_email_source must be an https URL when a Canadian school email is accepted")

    if "schools" in deal and deal.get("schools") is not None:
        domains = deal.get("schools")
        if not isinstance(domains, list) or not domains or not all(_is_domain(item) for item in domains):
            err("schools must be a list of lowercase domains")

    if "featured" in deal and deal.get("featured") is not None and deal.get("featured") not in (True, False):
        err("featured must be true or false")

    # Optional. Marks a perk that comes from the GitHub Student Developer Pack,
    # even when its category is coding, cloud, or something else.
    # Missing is fine. "yes" is not a bool, so it fails.
    if "github_pack" in deal and deal.get("github_pack") is not None and not isinstance(deal.get("github_pack"), bool):
        err("github_pack must be true or false")

    rank = deal.get("featured_rank")
    if "featured_rank" in deal and rank is not None:
        if isinstance(rank, bool) or not isinstance(rank, int) or rank < 1:
            err("featured_rank must be a positive whole number")
        elif deal.get("featured") is not True:
            err("featured_rank is only allowed when featured is true")

    return errors


def _is_country_entry(value) -> bool:
    if value == "GLOBAL":
        return True
    return isinstance(value, str) and len(value) == 2 and value.isalpha() and value.isupper()


def _is_domain(value) -> bool:
    return (
        isinstance(value, str)
        and value == value.lower()
        and "." in value
        and "/" not in value
        and "\\" not in value
        and " " not in value
        and not value.startswith(".")
        and not value.endswith(".")
    )


def validate_candidates(candidates) -> list[str]:
    if candidates is None:
        return []
    if not isinstance(candidates, list):
        return ["candidates file must be a list"]
    errors: list[str] = []
    for index, item in enumerate(candidates, start=1):
        label = f"candidate #{index}"
        if not isinstance(item, dict):
            errors.append(f"{label}: must be a mapping")
            continue
        brand = item.get("brand")
        if isinstance(brand, str) and brand.strip():
            label = brand
        for field in ("brand", "title", "official_url", "found_on", "note"):
            if not str(item.get(field) or "").strip():
                errors.append(f"{label}: missing {field}")
        if not is_https(item.get("official_url")):
            errors.append(f"{label}: official_url must be https")
        if not is_https(item.get("found_on")):
            errors.append(f"{label}: found_on must be https")
        guess = item.get("ca_school_email_guess")
        if guess is not None and guess not in SCHOOL_EMAIL:
            errors.append(f"{label}: ca_school_email_guess must be accepted, rejected, or unknown")
        if item.get("status") not in (None, "needs-review"):
            errors.append(f"{label}: candidates stay needs-review until the official page is checked")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate PerkCheck YAML files.")
    parser.add_argument("path", nargs="?", default=str(ROOT / "data" / "deals.yaml"))
    parser.add_argument("--candidates", action="store_true", help="validate a Grok candidate file")
    args = parser.parse_args(argv)
    path = Path(args.path)
    if not path.is_file():
        print(f"{path}: file not found", file=sys.stderr)
        return 1
    data = load_yaml(path)
    errors = validate_candidates(data) if args.candidates else validate_deals(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    kind = "candidates" if args.candidates else "deals"
    count = len(data or [])
    print(f"{path}: {count} {kind} ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
