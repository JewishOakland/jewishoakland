# Lakeshore Hall: wedding and celebration venue site

A standalone, single-page website for a wedding and celebration venue. It is built from scratch in plain HTML, CSS and JavaScript, with no framework and no build step, and it has no connection to the Chabad Oakland site's design.

## Open it

Open `index.html` in a browser. Or upload the whole `wedding-hall/` folder to any static host.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | All the content and structure |
| `css/styles.css` | Colours, type and layout. The colour and font tokens are at the top, in `:root` |
| `js/main.js` | Slideshow, photo strip, photo viewer, reveal-on-scroll and enquiry form |
| `images/` | The hall's photographs, resized for the web |

## Before launch

1. **Venue name.** "Lakeshore Hall" is a working name. Search for it in `index.html` and `README` and replace it everywhere it appears (header, hero, footer, page title).
2. **Photos.** The `images/` folder holds the hall photographs (`hall-01.jpg` to `hall-09.jpg`), resized to 2400px wide. To change them, add the new files and update the `src` and `alt` values in `index.html`. The hero uses four photos and the strip uses all nine.
3. **Copy.** Review every paragraph, especially the planning steps and the three celebration cards, and make sure they describe what the venue actually offers.
4. **Enquiry inbox.** The form opens an email to the address set in `ENQUIRY_EMAIL` at the top of `js/main.js`. Change it to the venue's own inbox. The page does not store or send anything itself. For a form that saves enquiries, connect a form service and point the form's `submit` handler at it.
5. **Contact details.** Check the address, phone, WhatsApp and email in the Visit section and the footer.
6. **Proposal and pricing.** The page says "request your proposal" rather than publishing prices. Add rates if you want them shown.

## Motion and accessibility

- The hero slideshow changes slowly and the photo strip drifts continuously. Both can be paused with the **Pause motion** button at the bottom left.
- Visitors who have asked their device to reduce motion see a still page and the motion button starts in the paused state.
- Photos can be opened full size with the mouse, keyboard or touch. Use the arrow keys to move between them and Escape to close.
