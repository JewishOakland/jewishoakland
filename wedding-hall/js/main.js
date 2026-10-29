/* Lakeshore Zadik Hall: behaviour. No dependencies. */
(function () {
  'use strict';

  // Where enquiries are sent. Change this to the venue's own inbox.
  var ENQUIRY_EMAIL = 'info@jewishoakland.org';
  var SLIDE_SECONDS = 7;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  // Footer year
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Header becomes solid once the page scrolls
  var header = document.querySelector('.site-header');
  function onScroll() {
    header.classList.toggle('solid', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var menuButton = document.querySelector('.menu-toggle');
  var nav = document.getElementById('nav');
  menuButton.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  // Motion control: one switch pauses the hero slideshow and the photo strip together.
  var motionButton = document.getElementById('motion-toggle');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var current = 0;
  var timer = null;
  var moving = !reduceMotion;

  function showSlide(n) {
    slides[current].classList.remove('is-active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('is-active');
  }

  function applyMotion() {
    clearInterval(timer);
    timer = moving ? setInterval(function () { showSlide(current + 1); }, SLIDE_SECONDS * 1000) : null;
    document.body.classList.toggle('paused', !moving);
    motionButton.textContent = moving ? 'Pause motion' : 'Play motion';
    motionButton.setAttribute('aria-pressed', String(!moving));
  }

  motionButton.addEventListener('click', function () {
    moving = !moving;
    applyMotion();
  });
  applyMotion();

  // Photo viewer (uses the visible, non-duplicate photos in the strip)
  var dialog = document.getElementById('lightbox');
  var viewerImage = dialog.querySelector('img');
  var photos = Array.prototype.slice.call(
    document.querySelectorAll('.track figure:not([aria-hidden]) img')
  );
  var viewing = 0;

  function openPhoto(n) {
    viewing = (n + photos.length) % photos.length;
    viewerImage.src = photos[viewing].src;
    viewerImage.alt = photos[viewing].alt;
    if (!dialog.open) dialog.showModal();
  }

  document.querySelectorAll('.track button[data-index]').forEach(function (button) {
    button.addEventListener('click', function () {
      openPhoto(parseInt(button.getAttribute('data-index'), 10));
    });
  });

  dialog.querySelector('.lb-close').addEventListener('click', function () { dialog.close(); });
  dialog.querySelector('.lb-prev').addEventListener('click', function () { openPhoto(viewing - 1); });
  dialog.querySelector('.lb-next').addEventListener('click', function () { openPhoto(viewing + 1); });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') openPhoto(viewing - 1);
    if (e.key === 'ArrowRight') openPhoto(viewing + 1);
  });

  // Gentle reveal as sections scroll into view (skipped for reduced motion)
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var revealTargets = document.querySelectorAll(
      '.intro-text, .section-head, .card, .steps li, .proposal, .enquire-intro, .enquiry, .visit-item'
    );
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealTargets.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 3) * 0.12 + 's';
      observer.observe(el);
    });
  }

  // Enquiry: opens a pre-filled email to the venue. Nothing is stored or sent by the page itself.
  document.getElementById('enquiry').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(e.target);
    var body = [
      'Names: ' + data.get('names'),
      'Email: ' + data.get('email'),
      'Phone: ' + (data.get('phone') || '-'),
      'Celebration: ' + data.get('celebration'),
      'Wedding date: ' + (data.get('date') || 'Flexible'),
      'Expected guests: ' + (data.get('guests') || '-'),
      'Would like to start with: ' + data.get('visit'),
      '',
      data.get('message') || ''
    ].join('\n');
    var subject = 'Wedding enquiry: ' + data.get('names');
    window.location.href = 'mailto:' + ENQUIRY_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  });
})();
