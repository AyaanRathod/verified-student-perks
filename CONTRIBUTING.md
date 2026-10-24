# Contributing to PerkCheck

Thanks for helping. PerkCheck is in early development, so the process is simple for now.

## Suggest a deal

Open a new issue titled `Suggest: <brand> <benefit>` and include:

- Brand name and what students get
- Free period in months, or the discount
- Countries it works in (CA, US), and any countries it excludes
- How students verify (school email, SheerID, UNiDAYS, Student Beans, ID upload, other)
- A link to the brand's **official** page (not a deal aggregator)

## Report a broken or expired deal

Open an issue titled `Broken: <deal id>` with what changed and a link that shows it. Once the site is live, each deal's "Report broken deal" button will open this issue for you.

## Edit the data

1. Fork the repo and edit `data/deals.yaml` (see `data/deals.example.yaml` for the format).
2. Fill in every required field, and set `last_verified` to the date you checked the official page.
3. Put the source of any eligibility claim in `source_note`.
4. Open a pull request.

## Monday search

The Grok bot does the web search. File what it finds with the **Deal candidate** issue, or append a row to `data/inbox/candidates.yaml` using `data/candidates.example.yaml` as the shape.

A candidate is not a published perk. Copy it into `data/deals.yaml` only after you have opened the brand's own page and filled in the countries, `ca_school_email`, and `last_verified`.

GitHub Actions does the scheduled half:

- Every night, the link check opens each `official_url` and opens an issue if the page is down or `watch_text` is missing.
- Every Monday, the source watch reads `data/sources.yaml` and opens an issue when a watched page gains new links. Aggregator links are leads, not facts.

## Ground rules

- Facts come from official brand pages only. Please don't copy data from UNiDAYS, Student Beans or other aggregators.
- Official logos may be shown unaltered, only to identify the deal. No endorsement is implied. Logos belong to their owners.
- Any affiliate link goes in `affiliate_url` and is always shown with a "Paid link" label.
- Be kind in issues and reviews.
