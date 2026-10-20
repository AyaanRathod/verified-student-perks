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

## Ground rules

- Facts come from official brand pages only. Please don't copy data from UNiDAYS, Student Beans or other aggregators.
- Brand names as text only. No logos.
- Any affiliate link goes in `affiliate_url` and is always shown with a "Paid link" label.
- Be kind in issues and reviews.
