# Chabad Oakland TV screen

A full-screen page for the 75-inch 4K TV at the Chabad Center. It is plain HTML, CSS and JavaScript, with no build step. It keeps itself up to date from jewishoakland.org, so day to day nobody has to touch it.

## What's on the screen

| Area | What it shows | Where it comes from |
| --- | --- | --- |
| Top bar | Clock, today's date and the Hebrew date | The TV's clock, always shown in Oakland time |
| Big picture (left) | Your slides and videos, plus slides made automatically for upcoming one-off events (with a QR code to sign up) and a "Sponsor a Kiddush" slide | The **TV Slides** page in WordPress, `js/settings.js`, the events calendar and the Kiddush board |
| Coming up (right) | The next two weeks of events, grouped by day. Daily Shacharis is left out and mentioned once at the bottom | The CiviCRM events calendar |
| This Shabbat | Parsha, candle lighting and havdalah (18 minutes) | Hebcal |
| Kiddush | This week's sponsor and dedication, or "Open for sponsorship" with a QR code to the sponsorship page | The Kiddush board on the sponsorship page |

From candle lighting until havdalah on Shabbat and Yom Tov, the screen switches to a still "Shabbat Shalom" (or "Good Yom Tov") page with the times and the Kiddush sponsor. Nothing moves or changes on it: no clock, slides or video. To keep the screen running as usual instead, set `shabbat: 'normal'` in `js/settings.js`. Many shuls also put the TV on a power timer for Shabbat. Check with the Rabbi which is preferred.

The screen checks the website every 10 minutes. It reloads itself at 3:30 AM each day. If the internet drops, it keeps showing the last information it had.

## Putting it on the website

The events calendar only shares its data with pages on jewishoakland.org, so the screen must be served from the site itself. Upload the whole `tv/` folder (without `tests/`) to the site's web root, so it opens at:

**https://www.jewishoakland.org/tv/**

It doesn't interfere with WordPress. The page is marked `noindex` so search engines leave it alone.

## Adding slides and videos

Make a WordPress **page** with the slug `tv-slides`. Title it "TV Slides" and publish it; it doesn't need to be in any menu. Whatever you put in it becomes the slides, in order:

- **Image** or **Gallery** block: each picture is one slide, shown for 12 seconds. To show one picture longer or shorter, put the number of seconds in its alt text, for example `20s`.
- **Video** block (an MP4 uploaded to the Media Library): plays to the end, muted.
- **YouTube** embed block, or a YouTube link: plays to the end, muted. Some videos have embedding turned off by their owner. Those are skipped.
- **Custom HTML** block with an `<iframe>`: shows that page for 12 seconds. This works for a published Google Slides deck.

Changes appear on the TV within 10 minutes. For a 4K TV, use pictures at least 2560 × 1440 pixels, in 16:9 shape. Other shapes are shown whole, on a blurred copy of themselves.

Slides that should always be there can also go in `slides` in `js/settings.js`. The file explains each kind, including a text slide with a headline over a photo.

Event slides are made automatically for events in the next 45 days that aren't weekly (titles that appear at most 3 times on the calendar). Their picture is the first image in the event's description in CiviCRM, so add an image there for a better slide.

## Settings

Everything adjustable is in `js/settings.js`, with a comment on each line: slide timing, how many days of events to list, which events to leave out of the list, the daily-minyan note, Kiddush prices, and the Shabbat behaviour.

## Setting up the TV

Most TVs' built-in browsers are slow and fall asleep. A small streaming stick or mini PC on the TV's HDMI works better:

- **Android TV, Google TV or Fire TV stick (4K model)**: install **Fully Kiosk Browser**. Set the start URL to `https://www.jewishoakland.org/tv/`, turn on *Autoplay videos*, *Keep screen on* and *Launch on boot*, and hide the status and navigation bars.
- **Mini PC or old laptop with Chrome**: start Chrome full screen with
  `chrome --kiosk --autoplay-policy=no-user-gesture-required https://www.jewishoakland.org/tv/`
  and add that to the computer's start-up programs.

Set the device to 4K output (3840 × 2160) and turn off screen savers and sleep. The page is drawn at 1920 × 1080 and scaled to fit exactly, so it looks the same at any resolution and stays sharp in 4K. Turn off the TV's own overscan ("Just Scan", "Screen Fit" or "Full Pixel") so the edges aren't cut off.

## Previewing

Open the page in any browser on a computer. Press F11 for full screen. To see how it will look at another time, add `?now=` with a date and time, for example:

- `https://www.jewishoakland.org/tv/?now=2026-11-14T11:00:00-08:00` shows Shabbat morning.
- `https://www.jewishoakland.org/tv/?now=2026-12-08T15:00:00-08:00` shows a Chanukah afternoon.

Opened from anywhere other than jewishoakland.org, the page can't read the events calendar, so the events list and event slides stay empty there.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `css/tv.css` | Colours, type and layout. Colours are at the top, in `:root` |
| `js/settings.js` | The settings above |
| `js/feeds.js` | Reads the events calendar, Kiddush board, Hebcal and the slides page. No screen code, so it can be tested |
| `js/tv.js` | Runs the screen: slides, videos, the side panels and the Shabbat page |
| `tests/feeds.test.js` | Tests for `feeds.js`. Run `node --test tv/tests/*.test.js` |

QR codes are drawn with [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), loaded from cdnjs.
