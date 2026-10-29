# The Zadik Hall: wedding and celebration venue site

A standalone, single-page website for a wedding and celebration venue. It is built from scratch in plain HTML, CSS and JavaScript, with no framework and no build step, and it has no connection to the Chabad Oakland site's design.

## Open it

Open `index.html` in a browser. Or upload the whole `wedding-hall/` folder to any static host.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | All the content and structure |
| `css/styles.css` | Colours, type and layout. The colour and font tokens are at the top, in `:root` |
| `js/main.js` | Slideshow, photo strip, photo viewer and reveal-on-scroll |
| `js/booking-rules.js` | Scheduling rules and pricing (no page code). Tested in `tests/` |
| `js/availability.js` | Calendar, Hebcal times and the booking request form |
| `tests/booking-rules.test.js` | Tests for the rules. Run with `node --test tests/booking-rules.test.js` |
| `images/` | The hall's photographs, resized for the web |

## Before launch

1. **Venue name.** The name is "The Zadik Hall". It appears in the page title, meta description, header, hero, and footer in `index.html`, and in the comments at the top of `css/styles.css` and `js/main.js`. If the name changes, update all of them.
2. **Photos.** The `images/` folder holds the hall photographs (`hall-01.jpg` to `hall-09.jpg`), resized to 2400px wide. To change them, add the new files and update the `src` and `alt` values in `index.html`. The hero uses four photos and the strip uses all nine.
3. **Copy.** Review every paragraph, especially the planning steps and the three celebration cards, and make sure they describe what the venue actually offers.
4. **Enquiry inbox.** The form opens an email to the address set in `ENQUIRY_EMAIL` at the top of `js/main.js`. Change it to the venue's own inbox. The page does not store or send anything itself. For a form that saves enquiries, connect a form service and point the form's `submit` handler at it.
5. **Contact details.** Check the address, phone, WhatsApp and email in the Visit section and the footer.
6. **Proposal and pricing.** The page says "request your proposal" rather than publishing prices. Add rates if you want them shown.

## Motion and accessibility

- The hero slideshow changes slowly and the photo strip drifts continuously. Both can be paused with the **Pause motion** button at the bottom left.
- Visitors who have asked their device to reduce motion see a still page and the motion button starts in the paused state.
- Photos can be opened full size with the mouse, keyboard or touch. Use the arrow keys to move between them and Escape to close.

## Calendar and bookings

- **Calendar:** shows each day's Hebrew date. Fridays show candle lighting and Saturdays show the parashah and havdalah. Times and the parashah come from the Hebcal API, using Oakland's location, and are fetched in the visitor's browser.
- **Approval:** Saturdays and Yom Tov days show "Approval needed", because the policy requires advance approval for Shabbat and holiday use. Friday events that run past candle lighting also need approval.
- **Rules:** `js/booking-rules.js` holds the rules, in one `CONFIG` block at the top:
  - At least 6 hours between events on the same day, measured from the end of one reserved period (including cleanup) to the start of the next.
  - An event that ends after 6:00 PM is an evening event. Nothing starts before noon the next day after an evening event.
  - Events run between 8:00 AM and 11:00 PM, start on the half hour, and last at least 2 hours.
- **Pricing:** Weekday (Monday to Thursday), Weekend (Friday and Sunday, assumed) and Extended packages, with additional hours billed per started hour.
- **Reserved dates:** `loadReservations()` in `js/availability.js` is not yet connected to a shared booking store. Until it is, no date is marked reserved, and the overlap and 6-hour checks run only against reservations that page has loaded.

Before launch, decide where bookings are stored and connect `loadReservations()` to it. Confirm the assumptions in `CONFIG`, especially the weekend days and the 6:00 PM evening cut-off.
