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

## 2026-10-24: precise results

**Work**

- I removed the category `banking` from the validator and from the results filters.
- I added the verification value `github-education`.
- The deals `github-copilot-student` and `jetbrains-pack` use that value.
- An active deal must have `banner_color`.
- The color must be six hex digits, for example `#181717`.
- `logo_color` is optional. When it is present, it uses the same color rule.
- `logo` can be null.
- When `logo` is text, it must be a `.svg` file name in `docs/logos`.
- An active deal that accepts a Canadian school email must have an https page in `ca_school_email_source`.
- `schools` is optional.
- When `schools` is present, it is a list of lowercase domains.
- A deal with a `schools` list shows only for that domain, or for a subdomain of that domain.
- The Brock campus deals stay in `data/schools/brocku.yaml`.
- Those rows are not in the public deal file.
- I added tests for the new rules.
- The test run has 18 tests. All 18 tests pass.
- The validator accepts the 13 deals in `data/deals.yaml`.
- The results page does not say "likely eligible".
- Each result card has one status line.
- A deal with `ca_school_email` set to `unknown` does not show for Canada.
- The school list is Hipo/university-domains-list at commit `603e10f51b67c6553b9bca9aecc0db4c2417ed10`.
- If that list does not load, the page uses a short list of Canadian schools and MIT.
- The home page shows the school name while the student types.
- The country name comes from the school code.
- If the domain is not in the list, the student picks Canada or the United States.
- The email is not in the page address.
- The browser keeps the email for this tab in `sessionStorage`.
- The key name is `perkcheck-email`.
- The results page reads that stored email.
- An old link with `?email=` still works.
- The results page uses the country from the school.
- The page uses `?country=` only when the student picked the country by hand.
- The header fits a screen that is 360 pixels wide.
- At 480 pixels, the header hides the words Perks and About.
- The word Home stays on the results page.
- The GitHub control and the theme control are 44 pixels by 44 pixels.
- The README has the live site address `https://ayaanrathod.github.io/verified-student-perks/`.
- The README does not say that the site uses Next.js, Tailwind, Netlify, or the swot school list.
- The home page counts the active deals. The count is 13.

**Result**

- `python scripts/validate_deals.py data/deals.yaml` prints `13 deals ok`.
- `python tests/test_phase1.py` prints `OK` for 18 tests.
- The address `name@brocku.ca` shows Brock University and 12 perks.
- The Google deal stays in the section "Not for this email".
- The page address for that check is `results.html`. The email is not in the address.
- An unknown domain with United States selected shows 9 perks.
- That page address is `results.html?country=US`.
- The old address `results.html?email=name@yorku.ca` shows York University.

**Next**

- Check more deals on the official pages.
- The goal is 30 to 50 checked deals. The file has 13 deals today.
