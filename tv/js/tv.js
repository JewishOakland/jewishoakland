/* Chabad Oakland TV: puts the slides, videos, events, Shabbat times and Kiddush board on the screen.
   Add ?now=2026-11-14T11:00:00-08:00 to the address to preview the screen at another time. */
(function () {
  'use strict';

  var S = window.TV_SETTINGS, F = window.Feeds, TZ = S.timeZone;
  var data = { events: [], board: {}, hebcal: [], pageSlides: [] };
  var playlist = [], index = 0, timer = null, current = null, showing = 0, failures = 0, resting = false;
  var startedAt = Date.now();

  function $(id) { return document.getElementById(id); }
  function noop() {}

  var offset = 0, preview = new URLSearchParams(location.search).get('now');
  if (preview && !isNaN(new Date(preview))) offset = new Date(preview) - Date.now();
  function now() { return new Date(Date.now() + offset); }
  function nowStamp() { return F.stampOf(now(), TZ); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clockOf(date) { return F.formatTime(F.stampOf(date, TZ)); }
  function weekdayShort(date) { return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(date); }
  function shortDate(day) {
    return new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)))
      .toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  }

  /* ---------- fit the 1920 × 1080 canvas to the screen ---------- */

  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    $('screen').style.transform = 'translate(' + (innerWidth - 1920 * s) / 2 + 'px,' + (innerHeight - 1080 * s) / 2 + 'px) scale(' + s + ')';
  }
  addEventListener('resize', fit);
  fit();

  /* ---------- loading, with the last good copy kept for when the internet drops ---------- */

  // The events feed only answers pages on jewishoakland.org, so use the page's own origin there
  function siteUrl(path) {
    if (/^https?:/.test(path)) return path;
    return /(^|\.)jewishoakland\.org$/.test(location.hostname) ? path : S.site + path;
  }

  function remember(key, value) { try { localStorage.setItem('tv:' + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ } }
  function recall(key) { try { return JSON.parse(localStorage.getItem('tv:' + key)); } catch (e) { return null; } }

  function get(key, address, json, transform) {
    return fetch(address, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return json ? r.json() : r.text();
    }).then(function (v) {
      v = transform ? transform(v) : v;
      remember(key, v);
      return v;
    }).catch(function () { return recall(key); });
  }

  function hebcalUrl() {
    var day = F.dayOf(nowStamp());
    return 'https://www.hebcal.com/hebcal?v=1&cfg=json&c=on&s=on&maj=on&min=off&mod=off&nx=off&ss=off&mf=off&i=off&M=on' +
      '&b=' + S.candleMinutes + '&latitude=' + S.latitude + '&longitude=' + S.longitude + '&tzid=' + encodeURIComponent(TZ) +
      '&start=' + F.isoDay(F.addDays(day, -1)) + '&end=' + F.isoDay(F.addDays(day, 42));
  }

  function refresh() {
    return Promise.all([
      get('events', siteUrl(S.eventsFeed), false, function (t) { return F.parseICal(t, TZ); }),
      get('board', siteUrl(S.kiddushBoard), true),
      get('hebcal', hebcalUrl(), true, function (j) { return j.items || []; }),
      S.slidesPage
        ? get('slides', siteUrl('/wp-json/wp/v2/pages?slug=' + encodeURIComponent(S.slidesPage) + '&_fields=content'), true, function (j) {
          return j && j[0] ? F.slidesFromHtml(j[0].content.rendered) : [];
        })
        : Promise.resolve([])
    ]).then(function (r) {
      data.events = r[0] || [];
      data.board = r[1] || {};
      data.hebcal = r[2] || [];
      data.pageSlides = r[3] || [];
      renderSide();
      checkRest();
    });
  }

  /* ---------- QR codes ---------- */

  function qr(text, cell) {
    if (!window.qrcode || !text) return '';
    var q;
    try {
      q = window.qrcode(0, 'M');
      q.addData(text);
      q.make();
    } catch (e) {
      return '';
    }
    var n = q.getModuleCount(), d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    return '<span class="qr"><svg width="' + n * cell + '" height="' + n * cell + '" viewBox="0 0 ' + n + ' ' + n +
      '" shape-rendering="crispEdges"><path d="' + d + '" fill="#0b1a3a"/></svg></span>';
  }

  /* ---------- header clock ---------- */

  function tick() {
    var date = now(), t = clockOf(date).split(' ');
    $('clock').innerHTML = esc(t[0]) + '<small>' + esc(t[1]) + '</small>';
    $('today').textContent = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' }).format(date);
    $('hebdate').textContent = F.hebrewDate(date, TZ);
    checkRest();
    if (nowStamp().slice(9, 13) === S.reloadAt.replace(':', '') && Date.now() - startedAt > 3600000) location.reload();
  }

  /* ---------- right column and bottom cards ---------- */

  function place(e) {
    if (!e.location || /3014 Lakeshore/i.test(e.location)) return '';
    return e.location.split(',')[0];
  }

  function renderEvents() {
    var stamp = nowStamp(), today = F.dayOf(stamp), box = $('event-list');
    var list = F.upcoming(data.events, stamp, S.eventDays, S.hideFromList).slice(0, 40);
    if (!list.length) {
      box.innerHTML = '<p class="empty">' + (data.events.length
        ? 'Nothing else is on the calendar for the next two weeks.'
        : 'Events will appear here once the screen can reach jewishoakland.org.') + '</p>';
      return;
    }
    box.innerHTML = F.groupByDay(list, today).map(function (g) {
      return '<section class="day"><h4>' + esc(F.formatDay(g.day, today)) + '</h4>' + g.events.map(function (e) {
        var live = !e.allDay && e.start <= stamp && stamp < e.end;
        var note = [F.multiDay(e) ? 'Until ' + F.shortDay(F.dayOf(e.end)) : '', place(e)].filter(Boolean).join(' · ');
        return '<div class="ev' + (live ? ' now' : '') + '"><time>' + (e.allDay ? 'All day' : F.formatTime(e.start)) + '</time><div><b>' +
          esc(e.title) + '</b>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div></div>';
      }).join('') + '</section>';
    }).join('');
    trimEvents();
  }

  // Drop whatever runs past the bottom of the list, and any day left without events
  function trimEvents() {
    var box = $('event-list'), bottom = box.getBoundingClientRect().bottom + 1;
    Array.prototype.forEach.call(box.querySelectorAll('.ev'), function (ev, i) {
      if (i > 0 && ev.getBoundingClientRect().bottom > bottom) ev.parentNode.removeChild(ev);
    });
    Array.prototype.forEach.call(box.querySelectorAll('.day'), function (day) {
      if (!day.querySelector('.ev')) day.parentNode.removeChild(day);
    });
  }

  function isYomTov(p) { return p.holiday && F.weekdayOf(p.day) !== 6; }

  function renderShabbat() {
    var p = F.currentOrNext(F.holyDays(data.hebcal, TZ), now()), card = $('shabbat-card');
    if (!p) {
      card.innerHTML = '<div class="eyebrow">Shabbat</div><h3>Shabbat Shalom</h3>';
      return;
    }
    card.innerHTML = '<div class="eyebrow">' + (isYomTov(p) ? 'Yom Tov' : 'This Shabbat') + '</div><h3>' + esc(p.name) + '</h3>' +
      '<div class="times"><div><span>Candles</span> <b>' + weekdayShort(p.candles) + ' ' + clockOf(p.candles) + '</b></div>' +
      '<div><span>' + (isYomTov(p) ? 'Ends' : 'Havdalah') + '</span> <b>' + weekdayShort(p.havdalah) + ' ' + clockOf(p.havdalah) + '</b></div></div>';
  }

  function sponsorText(list) {
    return list.map(function (s) {
      return '<b>' + esc(s.name) + '</b>' + (s.dedication ? ' <em>· ' + esc(s.dedication) + '</em>' : '');
    }).join(' and ');
  }

  function renderKiddush() {
    var w = F.kiddushWeeks(data.hebcal, data.board, nowStamp(), 1)[0];
    $('kiddush-card').innerHTML = '<div class="txt"><div class="eyebrow">Kiddush · ' + esc(shortDate(w.day)) + '</div>' +
      (w.sponsors.length
        ? '<div class="sponsor">This week’s Kiddush is sponsored by ' + sponsorText(w.sponsors) + '</div>'
        : '<div class="open">Open for sponsorship<span>Scan to sponsor this week’s Kiddush</span></div>') +
      '</div>' + qr(S.kiddushPage, 3);
  }

  function renderSide() {
    $('daily').textContent = S.dailyNote || ''; // first, since it takes room from the events list
    renderEvents();
    renderShabbat();
    renderKiddush();
  }

  /* ---------- Shabbat and Yom Tov ---------- */

  function checkRest() {
    var p = null;
    if (S.shabbat === 'static') {
      var date = now();
      p = F.holyDays(data.hebcal, TZ).filter(function (x) { return x.start <= date && date < x.end; })[0] || null;
    }
    if (!!p === resting) return;
    resting = !!p;
    if (resting) {
      clearTimeout(timer);
      showing++;
      if (current) { stopMedia(current); current.parentNode.removeChild(current); current = null; }
      progress(0);
      renderRest(p);
      $('rest').hidden = false;
    } else {
      $('rest').hidden = true;
      index = playlist.length;
      nextSlide();
    }
  }

  function renderRest(p) {
    var yt = isYomTov(p), w = F.kiddushWeeks(data.hebcal, data.board, nowStamp(), 1)[0];
    var kid = !yt && w.sponsors.length ? '<p class="kid">Kiddush is sponsored by ' + sponsorText(w.sponsors) + '</p>' : '';
    $('rest').innerHTML = '<div class="he">' + (yt ? 'חג שמח' : 'שבת שלום') + '</div>' +
      '<h1>' + (yt ? 'Good Yom Tov' : 'Shabbat Shalom') + '</h1>' +
      '<h2>' + esc(p.name) + '</h2>' +
      '<div class="times"><div><span>Candle lighting</span><b>' + weekdayShort(p.candles) + ' ' + clockOf(p.candles) + '</b></div>' +
      '<div><span>' + (yt ? 'Yom Tov ends' : 'Shabbat ends') + '</span><b>' + weekdayShort(p.havdalah) + ' ' + clockOf(p.havdalah) + '</b></div></div>' +
      kid + '<div class="foot">Chabad Jewish Center of Oakland</div>';
  }

  /* ---------- slides ---------- */

  function buildPlaylist() {
    var own = data.pageSlides.concat(S.slides || []), made = [];
    F.featured(data.events, nowStamp(), {
      days: S.eventSlides.days, max: S.eventSlides.max, maxRepeats: S.eventSlides.maxRepeats, hide: S.hideFromList
    }).forEach(function (e) { made.push({ type: 'event', event: e }); });
    if (S.kiddushSlide) made.splice(Math.min(1, made.length), 0, { type: 'kiddush' });
    playlist = F.interleave(own, made, S.generatedEvery);
    if (!playlist.length) playlist = [{ type: 'text', title: 'Chabad Jewish Center of Oakland', text: 'jewishoakland.org' }];
  }

  function progress(seconds) {
    var bar = $('progress');
    bar.style.transition = 'none';
    bar.style.width = '0';
    void bar.offsetWidth;
    if (seconds) {
      bar.style.transition = 'width ' + seconds + 's linear';
      bar.style.width = '100%';
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = resolve;
      img.onerror = reject;
      setTimeout(reject, 15000);
      img.src = src;
    });
  }

  var youTube = null;
  function loadYouTube() {
    if (!youTube) {
      youTube = new Promise(function (resolve, reject) {
        if (window.YT && window.YT.Player) return resolve();
        window.onYouTubeIframeAPIReady = resolve;
        var s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = reject;
        document.head.appendChild(s);
        setTimeout(reject, 15000);
      }).catch(function (e) { youTube = null; throw e; });
    }
    return youTube;
  }

  function stopMedia(el) {
    var v = el.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    if (el.player) try { el.player.destroy(); } catch (e) { /* already gone */ }
  }

  function bg(src) { return 'background-image:url(&quot;' + esc(src) + '&quot;)'; }

  function eventHtml(e, pic) {
    var when = F.whenText(e, F.dayOf(nowStamp()));
    var scan = e.url ? '<div class="scan">' + qr(e.url, pic ? 4 : 6) + '<div><b>Scan for details</b>and to sign up</div></div>' : '';
    var where = e.location ? (/3014 Lakeshore/i.test(e.location) ? 'At the Chabad Center, 3014 Lakeshore Ave' : e.location) : '';
    return (pic ? '<div class="pic"><div class="blur" style="' + bg(e.image) + '"></div><img src="' + esc(e.image) + '" alt=""></div>' : '') +
      '<div class="info"><div class="eyebrow">Coming up</div><h1>' + esc(e.title) + '</h1><div class="when">' + esc(when) + '</div>' +
      (where ? '<div class="where">' + esc(where) + '</div>' : '') +
      (e.description ? '<p class="about">' + esc(e.description) + '</p>' : '') +
      (pic ? scan : '') + '</div>' + (pic ? '' : '<div class="side">' + scan + '</div>');
  }

  function kiddushSlideHtml() {
    var weeks = F.kiddushWeeks(data.hebcal, data.board, nowStamp(), 4);
    return '<div><div class="eyebrow">Kiddush board</div><h1>Sponsor a Kiddush</h1>' +
      '<p class="lead">Dedicate a Kiddush in honor or in loving memory of someone dear, or to celebrate a birthday, anniversary, yahrzeit or simcha.</p>' +
      '<div class="weeks">' + weeks.map(function (w) {
        return '<div class="week"><div class="d">' + esc(shortDate(w.day)) + '</div><div class="who">' + esc(w.name) + ' · ' +
          (w.sponsors.length ? sponsorText(w.sponsors) : '<span class="open">Open for sponsorship</span>') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="side">' + qr(S.kiddushPage, 7) + '<p>Scan to sponsor</p><small>' + esc(S.kiddushShort) + '</small>' +
      (S.kiddushPrices ? '<small class="prices">' + esc(S.kiddushPrices) + '</small>' : '') + '</div>';
  }

  // Build the slide off screen, wait until it can show, then fade it in over the last one
  function show(slide) {
    var token = ++showing, el = document.createElement('div'), seconds = slide.seconds || S.secondsPerSlide, ready;
    var done = function () { if (token === showing) nextSlide(); };
    el.className = 'slide';

    if (slide.type === 'image') {
      ready = loadImage(slide.src).then(function () {
        el.innerHTML = '<div class="blur" style="' + bg(slide.src) + '"></div><img class="fit" src="' + esc(slide.src) + '" alt="">';
      });
    } else if (slide.type === 'text') {
      el.className += ' text-slide';
      el.innerHTML = '<div class="copy"><h1>' + esc(slide.title) + '</h1>' + (slide.text ? '<p>' + esc(slide.text) + '</p>' : '') + '</div>';
      ready = slide.background ? loadImage(slide.background).then(function () { el.setAttribute('style', bg(slide.background).replace(/&quot;/g, '"')); }, noop) : Promise.resolve();
    } else if (slide.type === 'event') {
      var e = slide.event;
      ready = (e.image ? loadImage(e.image).then(function () { return true; }, function () { return false; }) : Promise.resolve(false)).then(function (pic) {
        el.className += ' event-slide' + (pic ? '' : ' no-image');
        el.innerHTML = eventHtml(e, pic);
      });
    } else if (slide.type === 'kiddush') {
      el.className += ' kiddush-slide';
      el.innerHTML = kiddushSlideHtml();
      ready = Promise.resolve();
    } else if (slide.type === 'video') {
      var v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.onended = done;
      v.src = slide.src;
      el.appendChild(v);
      seconds = null;
      ready = new Promise(function (resolve, reject) {
        v.oncanplay = resolve;
        v.onerror = reject;
        setTimeout(reject, 20000);
      }).then(function () { return v.play(); }).then(function () {
        if (isFinite(v.duration)) seconds = Math.min(v.duration, S.maxVideoMinutes * 60);
      });
    } else if (slide.type === 'youtube') {
      el.className += ' youtube';
      var holder = document.createElement('div');
      el.appendChild(holder);
      seconds = null;
      ready = loadYouTube().then(function () {
        return new Promise(function (resolve, reject) {
          el.player = new window.YT.Player(holder, {
            videoId: slide.id, width: '100%', height: '100%',
            playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, disablekb: 1, origin: location.origin },
            events: {
              onReady: function (ev) { ev.target.mute(); ev.target.playVideo(); },
              onStateChange: function (ev) {
                if (ev.data === window.YT.PlayerState.PLAYING) {
                  var d = ev.target.getDuration();
                  if (d && !seconds) seconds = Math.min(d, S.maxVideoMinutes * 60);
                  resolve();
                }
                if (ev.data === window.YT.PlayerState.ENDED) done();
              },
              onError: reject
            }
          });
          setTimeout(reject, 25000);
        });
      });
    } else if (slide.type === 'page') {
      var f = document.createElement('iframe');
      f.src = slide.src;
      f.setAttribute('allow', 'autoplay');
      el.appendChild(f);
      ready = new Promise(function (resolve) { f.onload = resolve; setTimeout(resolve, 10000); });
    } else {
      ready = Promise.reject(new Error('Unknown slide type ' + slide.type));
    }

    $('stage').appendChild(el);
    ready.then(function () {
      if (token !== showing) { stopMedia(el); el.parentNode && el.parentNode.removeChild(el); return; }
      failures = 0;
      // Fade the last slide out, then this one in, so two slides' text never overlaps
      var old = current;
      current = el;
      if (old) {
        old.classList.remove('in');
        setTimeout(function () { stopMedia(old); old.parentNode && old.parentNode.removeChild(old); }, 900);
      }
      setTimeout(function () { el.classList.add('in'); }, old ? 500 : 0);
      progress(seconds);
      timer = setTimeout(done, (seconds || S.maxVideoMinutes * 60) * 1000);
    }).catch(function () {
      stopMedia(el);
      if (el.parentNode) el.parentNode.removeChild(el);
      failures++;
      // Skip a slide that won't load; if nothing loads (no internet), slow down instead of spinning
      if (token === showing) timer = setTimeout(done, failures > playlist.length ? 30000 : 300);
    });
  }

  function nextSlide() {
    clearTimeout(timer);
    if (resting) return;
    if (index >= playlist.length) {
      buildPlaylist();
      index = 0;
    }
    show(playlist[index++]);
  }

  /* ---------- start ---------- */

  tick();
  setInterval(tick, 5000);
  // The list is trimmed to fit, so trim again once the web fonts have arrived
  if (document.fonts) document.fonts.addEventListener('loadingdone', function () { renderEvents(); });
  addEventListener('load', renderEvents);
  setInterval(refresh, S.refreshMinutes * 60000);
  setInterval(renderEvents, 60000);
  refresh().then(function () { if (!resting) nextSlide(); });
})();
