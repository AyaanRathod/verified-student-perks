import datetime as dt
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_links  # noqa: E402
import check_sources  # noqa: E402
import validate_deals  # noqa: E402


def deal(**overrides):
    base = {
        "id": "sample-deal",
        "brand": "Sample",
        "title": "Free for students",
        "category": "dev-tools",
        "price_type": "free",
        "countries": ["CA", "US"],
        "ca_school_email": "accepted",
        "verification": "school-email",
        "email_rules": "Any school email",
        "how_to_claim": ["Open the page", "Verify your school email", "Accept the plan"],
        "official_url": "https://brand.test/students",
        "source_note": "sourced: https://brand.test/students",
        "last_verified": dt.date(2026, 10, 22),
        "status": "active",
        "banner_color": "#112233",
        "logo": None,
        "ca_school_email_source": "https://brand.test/students",
    }
    base.update(overrides)
    return base


class ValidateDealsTest(unittest.TestCase):
    def test_published_file(self):
        deals = validate_deals.load_yaml(ROOT / "data" / "deals.yaml")
        self.assertEqual(validate_deals.validate_deals(deals, today=dt.date(2026, 10, 22)), [])

    def test_active_unknown_email_rule_fails(self):
        errors = validate_deals.validate_deals(
            [deal(ca_school_email="unknown")],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("ca_school_email" in error for error in errors))

    def test_canada_cannot_be_listed_and_excluded(self):
        errors = validate_deals.validate_deals(
            [deal(not_available_in=[{"country": "CA", "source": "https://brand.example/no-ca"}])],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("both include" in error for error in errors))

    def test_rejected_canada_needs_that_status(self):
        errors = validate_deals.validate_deals(
            [
                deal(
                    countries=["US"],
                    ca_school_email="accepted",
                    not_available_in=[{"country": "CA", "source": "https://brand.example/no-ca"}],
                )
            ],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("must be rejected" in error for error in errors))

    def test_global_country_passes(self):
        self.assertEqual(
            validate_deals.validate_deals([deal(countries=["GLOBAL"])], today=dt.date(2026, 10, 22)),
            [],
        )

    def test_global_mixed_with_a_code_fails(self):
        errors = validate_deals.validate_deals(
            [deal(countries=["GLOBAL", "CA"])],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("GLOBAL" in error for error in errors))

    def test_country_name_fails(self):
        errors = validate_deals.validate_deals(
            [deal(countries=["Canada"])],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("countries" in error for error in errors))

    def test_bad_banner_color_fails(self):
        errors = validate_deals.validate_deals(
            [deal(banner_color="red")],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("banner_color" in error for error in errors))

    def test_missing_logo_file_fails(self):
        errors = validate_deals.validate_deals(
            [deal(logo="not-a-real-logo.svg")],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("does not exist" in error for error in errors))

    def test_null_logo_passes(self):
        self.assertEqual(
            validate_deals.validate_deals([deal(logo=None)], today=dt.date(2026, 10, 22)),
            [],
        )

    def test_banking_category_fails(self):
        errors = validate_deals.validate_deals(
            [deal(category="banking")],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("category" in error for error in errors))

    def test_accepted_without_source_fails(self):
        errors = validate_deals.validate_deals(
            [deal(ca_school_email_source=None)],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("ca_school_email_source" in error for error in errors))

    def test_duplicate_id(self):
        errors = validate_deals.validate_deals(
            [deal(), deal()],
            today=dt.date(2026, 10, 22),
        )
        self.assertTrue(any("duplicate" in error for error in errors))

    def test_empty_candidates_are_valid(self):
        self.assertEqual(validate_deals.validate_candidates([]), [])

    def test_candidate_cannot_be_published(self):
        errors = validate_deals.validate_candidates(
            [
                {
                    "brand": "Sample",
                    "title": "A perk",
                    "official_url": "https://brand.example/students",
                    "found_on": "https://freestudents.org/post",
                    "note": "Check the official page.",
                    "status": "active",
                }
            ]
        )
        self.assertTrue(any("needs-review" in error for error in errors))


class CheckLinksTest(unittest.TestCase):
    def test_missing_watch_text_is_a_failure(self):
        reason = check_links.judge_response(
            {"id": "sample-deal", "watch_text": "Student pack"},
            200,
            "<html>nothing here</html>",
        )
        self.assertIn("watch_text", reason)

    def test_http_error(self):
        reason = check_links.judge_response({"id": "sample-deal"}, 404, "")
        self.assertIn("HTTP 404", reason)

    def test_match_is_clean(self):
        reason = check_links.judge_response(
            {"id": "sample-deal", "watch_text": "Student pack"},
            200,
            "The Student Pack is here",
        )
        self.assertIsNone(reason)


class CheckSourcesTest(unittest.TestCase):
    def test_extract_and_first_watch(self):
        html = '<a href="/new">New</a><a href="https://facebook.com/share">Skip</a><a href="https://brand.example/a.png">Skip</a>'
        links = check_sources.extract_links(html, "https://freestudents.org/list")
        self.assertEqual(links, ["https://freestudents.org/new"])
        added = check_sources.compare_source(None, links)
        self.assertEqual(added, [])

    def test_second_watch_reports_only_new_links(self):
        added = check_sources.compare_source(
            {"links": ["https://brand.example/old"]},
            ["https://brand.example/old", "https://brand.example/new"],
        )
        self.assertEqual(added, ["https://brand.example/new"])

    def test_run_writes_a_first_watch_report(self):
        updated, report, noteworthy = check_sources.run(
            [{"id": "free", "name": "FreeStudents", "url": "https://freestudents.org/"}],
            {"sources": {}},
            lambda url: '<a href="https://brand.example/deal">Deal</a>',
        )
        self.assertTrue(noteworthy)
        self.assertIn("Started watching", report)
        self.assertIn("https://brand.example/deal", updated["sources"]["free"]["links"])
        self.assertNotIn("brand.example/deal", report)


if __name__ == "__main__":
    unittest.main()
