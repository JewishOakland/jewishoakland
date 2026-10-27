# jewishoakland.org front page redesign

`index.html` is a redesigned home page for the Chabad Jewish Center of Oakland site. It's one self-contained file. Open it in a browser to preview it. All images and links point to the live jewishoakland.org site.

## What's on the page

1. **Header**: Hebrew date (updates automatically), a shorter main menu and a Donate button. On phones the menu collapses.
2. **Hero**: Lake Merritt photo, mission line, and two buttons: "See what's coming up" and "First time? What to expect".
3. **Info strip**: this week's Shabbat candle lighting time (pulled live from Hebcal for the center's location, 18 minutes before sunset), Shacharis time and the address.
4. **Featured**: Chanukah 2026 banner and event cards. Update this section each season.
5. **Find your place**: six program cards (Shul, Adult Learning, YJP, Women's Circle, Hebrew School, Kids & Teens) with links to their pages.
6. **Come as you are**: mission statement and values.
7. **Learn more**: Our Space, Jewish Learning & Practice, Ask the Rabbi, Photo Gallery.
8. **Partner with us**: Donate, Capital Campaign, Security Campaign, Kiddush sponsorship.
9. **Visit**: address, phone/WhatsApp, email, newsletter. Then the footer.

## Putting it on WordPress

The live site runs WordPress with the Unos Premium theme. Two ways to use this design there:

- **Quickest**: create a page with a blank or full-width template, add a *Custom HTML* block, and paste in everything from `<style>` through the closing `</script>`. Leave out the `<header>`, top bar and `<footer>` if you're keeping the theme's own. Then set that page as the home page under *Settings → Reading*.
- **Cleaner**: have your web developer build it as a child-theme `front-page.php` template, and swap the static "Featured" cards for the CiviCRM upcoming-events listing so events update themselves.

The Google Fonts link (Fraunces and Source Sans 3) belongs in the page `<head>`. In WordPress it can be enqueued or added with a header-scripts plugin.
