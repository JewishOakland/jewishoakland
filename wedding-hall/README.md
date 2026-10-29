# The Zadik Hall: venue website

A standalone five-page website for The Zadik Hall. It is plain HTML, CSS and JavaScript, with no framework and no build step, and it has no connection to the Chabad Oakland site's design.

## Open it

Open `index.html` in a browser, or upload the whole `wedding-hall/` folder to any static host.

## Pages

Every page has the same menu (Home, The Space, Gallery, Plan Your Event, Contact), an "Ask About a Date" button that goes to the enquiry form, and a small footer. On phones the menu collapses behind a Menu button.

| Page | What it has |
| --- | --- |
| `index.html` | Home: one hall photo, a short introduction, "Explore the Space" and "Ask About a Date" buttons, and a three-photo preview |
| `space.html` | The Space: the room, layout and capacity, what's included, facilities, accessibility, parking and arrival, and the celebrations hosted |
| `gallery.html` | Gallery: photos grouped as the room, dinner setups and details, with captions and a photo viewer |
| `plan.html` | Plan Your Event: how an enquiry works, what to tell the office, the calendar, the enquiry form, rates, and catering, rental and cleanup rules |
| `contact.html` | Contact: phone, email, address, map and directions |

## Other files

| Path | What it is |
| --- | --- |
| `css/styles.css` | Colours, type and layout. The colour and font tokens are at the top, in `:root` |
| `js/main.js` | Shared by every page: phone menu, the home header over the photo, and the gallery photo viewer |
| `js/availability.js` | Plan Your Event only: the calendar and the enquiry form |
| `js/hebrew-calendar.js` | Our own Hebrew calendar: Hebrew dates, holidays, parashah, and candle-lighting and havdalah times for Oakland. No outside service |
| `js/booking-rules.js` | Opening hours on Shabbat and Yom Tov, plus the scheduling and pricing rules |
| `tests/` | Tests for the calendar and the rules. Run with `node --test tests/*.test.js` |
| `images/` | The hall's photographs, resized for the web |

The header and footer are repeated in each page. If you change one, change all five.

## Before launch

1. **Accessibility, parking and entrance.** The Space and Contact pages ask people to call the office about these, because the details weren't available. Add the step-free route, accessible restroom, parking and entrance information when you have it.
2. **Photos.** The home photo (`hall-08.jpg`) has one person standing in the background near the buffet. Replace or crop it if you prefer an empty room.
3. **Copy.** Read every page against the rental policy, especially the summaries on Plan Your Event.
4. **Enquiry inbox.** The form opens an email to `ENQUIRY_EMAIL` at the top of `js/availability.js`. The page does not store or send anything itself. For a form that saves enquiries, connect a form service.
5. **Contact details.** Check the phone, WhatsApp, email and address on the Contact page and in the footer of every page.
6. **Map.** The Contact page embeds a Google map of the address. It needs an internet connection to show.

## Calendar

- Each day shows its Hebrew date. Fridays and the day before Yom Tov show candle lighting, and Saturdays show the parashah and when Shabbat ends. All of this is calculated by `js/hebrew-calendar.js`. Candle lighting is 18 minutes before sunset and havdalah is 42 minutes after, both set in its `CONFIG`.
- Yom Tov (Rosh Hashanah, Yom Kippur, the Yom Tov days of Sukkot, Shmini Atzeret, Simchat Torah, and the Yom Tov days of Pesach and Shavuot) is shown as closed. Saturdays open at 6:00 PM or when Shabbat ends, whichever is later. The day before Yom Tov ends at candle lighting. Friday events may run into Shabbat. These rules are `windowFor()` in `js/booking-rules.js`.
- The calendar is a guide. The site says throughout that Shabbat and Yom Tov availability is confirmed by the office, and that a date is not reserved until the office confirms it.
- Choosing a day fills in the preferred date on the form.
- Reserved dates are not marked yet. `loadReservations()` in `js/availability.js` needs to be connected to wherever bookings are kept.

## Known limits of the Hebrew calendar

- Hebrew dates match the browser's Hebrew calendar for every day from 1990 to 2100, except the years 5806 and 5807 (2045 to 2046), where they differ by one day.
- In about one year in ten there are 54 Shabbat readings. The calendar then reads all 54 portions in order, with Vezot Haberakhah last. Check one such year against a printed calendar.
- When portions are combined, they are combined in a fixed order. A printed calendar may combine different pairs in some years.

## Accessibility

- All pages use real headings, labelled form fields and visible focus outlines.
- Photos in the gallery open full size with the mouse, keyboard or touch. Use the arrow keys to move between them and Escape to close.
