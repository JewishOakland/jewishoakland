# The Weekly Letter

The weekly newsletter for Chabad Jewish Center of Oakland. Each issue is one self-contained HTML file, and the design follows the look of the center's site (`index.html`) in a quieter, more formal style.

## Files

| File | What it is |
| --- | --- |
| `2026-10-30.html` | The first issue: Parashat Vayera, with the rabbi's essay as a draft |

## Making a new issue each week

1. Copy the latest issue to `newsletter/YYYY-MM-DD.html`, using the Friday the issue goes out.
2. Update the **issue line** (date and parashah) in the masthead.
3. Replace the **essay** with the rabbi's text, and set the byline. Remove the "Draft for Rabbi's review" label once he has approved it.
4. Update **This Shabbat** with that week's Kabbalat Shabbat and Shabbat Services links. Get the candle-lighting link from the Hebcal link, which is already set for Oakland (18 minutes before sunset).
5. Update **On the calendar** with the next four weeks of events. Copy each event's link from the event's page on jewishoakland.org, or from the calendar feed at `https://www.jewishoakland.org/civicrm/event/ical/?reset=1&list=1&html=1`.
6. Change the **joke of the week**.
7. Remove the Chanukah feature section once Chanukah has passed.

## Design

Colours and type are tokens in `:root` at the top of each file:

- Ivory page, warm white paper, ink text
- Deep red (`--red`) for small accents and the drop cap, and a muted gold (`--gold`) for hairline rules and frames
- Cormorant Garamond for the wordmark and headings, and Montserrat for the small capitals and body text

The page is one column, about 640px wide, and it works on phones with a 16px side gutter.

## Before sending by email

This is a web page. Email apps such as Gmail and Outlook support CSS less fully than browsers do. Before sending it through an email service (for example, Mailchimp or Constant Contact), check the layout in a test email. The grid and web-font styles may need to be changed to a table-based layout.

The sign-up form is on the site's newsletter page, `https://www.jewishoakland.org/main/newsletter/`. It collects name, email and an optional zip code. The footer's unsubscribe line sends a request to `info@jewishoakland.org`. Replace that with the email service's own unsubscribe link once one is set up.
