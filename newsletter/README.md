# The Weekly Letter

The weekly newsletter for Chabad Jewish Center of Oakland. Each issue is one HTML file. It uses tables and inline styles, so it can be opened in a browser or pasted into an email service.

## Making each week's issue

1. Copy the latest issue to `newsletter/YYYY-MM-DD.html`, using the Friday it goes out.
2. Update the masthead date and Hebrew date.
3. Update the parashah band (name and Torah reading).
4. Run `python3 newsletter/tools/shabbat_times.py YYYY-MM-DD YYYY-MM-DD` with the issue's Friday and the date four weeks on. It prints candle lighting, sunset and havdalah for each Shabbat, calculated for Oakland from the NOAA solar equations. Candles are 18 minutes before sunset and havdalah is 42 minutes after. Fill in this week's two times, then the coming weeks.
5. Replace the essay with the rabbi's own words, and remove the "Draft for review" label once he has approved it.
6. Check the weekly services against the schedule page: https://www.jewishoakland.org/shul/schedule-of-services/
7. Update the calendar with the next few weeks of events, using each event's link from jewishoakland.org.
8. Change the joke.
9. Change the photos if you like. They are linked from jewishoakland.org, because email apps can only show pictures that are online. To use a new photo, upload it to the site's media library and paste its address into the `src` of the `<img>`. Give each photo a short `alt` description.

## Before sending by email

Check the layout in a test email first. Some email apps change fonts and table spacing. The footer's unsubscribe line sends a request to `info@jewishoakland.org`. Swap in the email service's own unsubscribe link once it is set up.
