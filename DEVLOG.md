# Devlog

This file has the weekly project notes.
The notes use Simplified Technical English (ASD-STE100).
Put a number in a note only when the number is real.

## Week 0 (2026-10-20): plan

**Work**

- I wrote the project plan.
- The first users are students in Canada.
- A student will enter a school email on the website.
- Each deal will show the countries where the deal works.
- Each deal will show the date of the last check.
- I looked at other student deal websites.
- Many websites do not say if a deal works in Canada.
- Many websites do not show the date of the last check.
- I made a home page prototype in Lovable.
- I made HTML examples of the home page and the results page.
- I wrote the deal format in `data/deals.example.yaml`.
- That file has two checked deals and one example deal.
- I wrote the README, the MIT license, and the contribution notes.

**Result**

- The Google help page says that the free AI Pro student deal does not work in Canada.
- Country facts must come from the official page.

**Next**

- Make the real data files.
- Check 30 to 50 deals on the official pages.
- Write a script that checks the deal file.

## Week 1 (2026-10-22): checks

**Work**

- I added `data/deals.yaml`.
- The file has three deals.
- I checked each deal on the official page on 2026-10-22.
- The three deals are the GitHub Student Developer Pack, the Google AI Pro student trial, and Amazon.ca Prime for Young Adults.
- I added the field `ca_school_email`.
- This field says if a Canadian school email works.
- The permitted values are `accepted`, `rejected`, and `unknown`.
- I wrote a validator and 13 tests.
- The tests pass on this PC.
- I wrote three GitHub Actions.
- The validate Action checks the deal file and runs the tests.
- The night Action opens each official page.
- The Monday Action reads the source list and reports new links.
- The Grok bot does the web search.
- The bot files a candidate deal.
- A candidate deal is not a published deal.
- The Action files are on this PC.
- The Action files are not on GitHub yet.

**Result**

- The free 12-month Google AI Pro trial is for students in the United States.
- Canada is on the Google exclusion list.
- The student must use SheerID and a school email.
- From this network, the Google help page returns HTTP 404.
- The night Action will run on a GitHub computer.
- The first GitHub run will show if that page is available there.
- Amazon.ca asks for an email from a Canadian college, university, or CEGEP.
- The Amazon terms page does not give the number of free months.

**Next**

- Check more deals on the official pages.
- Point the Monday Grok bot at the Deal candidate issue.

## Week 1, same day: preview website

**Work**

- I added a static website in the `docs/` folder.
- The home page has a school email field.
- The results page has filters for country, price, free period, category, and verification.
- Each deal has its own page with the claim steps and a link to the official page.
- A link can show the label “Paid link”. This list has no paid link yet.
- The email check runs in the browser.
- The site does not store the email.
- `scripts/build_site.py` copies `data/deals.yaml` into `docs/deals.js`.
- GitHub Pages can serve the `docs/` folder. You must turn Pages on in the repository settings.

**Result**

- The preview shows the three checked deals.
- A Canadian school email still shows the Google deal in the section “Not for this email”.

**Next**

- Turn on GitHub Pages for the `main` branch and the `/docs` folder.
- Open the Pages address and enter `name@brocku.ca`.
