/* Chabad Oakland TV: settings. This is the only file you should need to edit.
   Day-to-day slides and videos are managed on the WordPress page named in slidesPage (see README.md). */
window.TV_SETTINGS = {
  site: 'https://www.jewishoakland.org',
  timeZone: 'America/Los_Angeles',
  latitude: 37.8107,
  longitude: -122.2437,
  candleMinutes: 18,                       // candle lighting this many minutes before sunset

  // Where the screen gets its information. Paths are on the site above.
  eventsFeed: '/civicrm/event/ical/?reset=1&list=1',
  kiddushBoard: '/wp-json/kiddush/v1/board',
  kiddushPage: 'https://www.jewishoakland.org/shul/kiddush-sponsorship/',
  kiddushShort: 'jewishoakland.org/shul/kiddush-sponsorship', // printed under the QR code
  slidesPage: 'tv-slides',                 // slug of the WordPress page whose pictures and videos are the slides; '' to turn off

  // Extra slides, shown after the WordPress page's slides (or on their own if there is no page).
  // For a 4K TV, use pictures at least 2560 × 1440 so they stay sharp.
  // { type: 'image', src: 'https://…/photo.jpg', seconds: 12 }
  // { type: 'video', src: 'https://…/clip.mp4' }               plays to the end, muted
  // { type: 'youtube', id: 'dQw4w9WgXcQ' }                       plays to the end, muted
  // { type: 'page', src: 'https://docs.google.com/…/embed', seconds: 60 }   any web page, e.g. published Google Slides
  // { type: 'text', title: 'Welcome', text: 'A line or two', background: 'https://…/photo.jpg', seconds: 10 }
  slides: [
    {
      type: 'text',
      title: 'Welcome to Chabad of Oakland',
      text: 'Come as you are. Every Jew is family here.',
      background: 'https://www.jewishoakland.org/wp-content/uploads/2018/12/gallery2-1-768x512.jpg'
    }
  ],

  secondsPerSlide: 12,
  maxVideoMinutes: 10,                     // move on after this even if a video hasn't ended

  // Upcoming events list on the right
  eventDays: 14,                           // how far ahead to list
  hideFromList: ['Shacharis'],             // daily services that would crowd the list
  dailyNote: 'Shacharis Monday–Friday at 7:30 AM',

  // Full-screen slides made from the events feed: one-off events (not weekly classes) in the next few weeks
  eventSlides: { days: 45, max: 6, maxRepeats: 3 },
  kiddushSlide: true,                      // a slide of the coming Kiddush weeks, with a QR code to sponsor
  kiddushPrices: 'Shabbat day Kiddush $500 · Friday night Kiddush $180',
  generatedEvery: 2,                       // one generated slide after every 2 of your own

  // On Shabbat and Yom Tov, from candle lighting to havdalah:
  //   'static'  a still "Shabbat Shalom" screen with the times and Kiddush sponsor. No clock, slides or video
  //   'normal'  keep running as usual
  shabbat: 'static',

  refreshMinutes: 10,                      // check the website for changes this often
  reloadAt: '03:30'                        // reload the whole page daily at this time to pick up changes to this app
};
