/* The Zadik Hall: behaviour shared by every page. No dependencies. */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');

  // Footer year
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Home page: the header sits over the photo, then becomes solid once the page scrolls
  if (document.body.classList.contains('has-hero')) {
    var onScroll = function () { header.classList.toggle('solid', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Phone menu
  var menuButton = document.querySelector('.menu-toggle');
  var nav = document.getElementById('nav');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Close' : 'Menu';
  }
  menuButton.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuButton.focus(); }
  });

  // Photo viewer, used on the gallery page
  var dialog = document.getElementById('lightbox');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-photo]'));
  if (dialog && buttons.length) {
    var image = dialog.querySelector('img');
    var caption = dialog.querySelector('figcaption');
    var current = 0;

    var open = function (n) {
      current = (n + buttons.length) % buttons.length;
      var img = buttons[current].querySelector('img');
      var figure = buttons[current].closest('figure');
      image.src = img.src;
      image.alt = img.alt;
      caption.textContent = figure && figure.querySelector('figcaption') ? figure.querySelector('figcaption').textContent : '';
      if (!dialog.open) dialog.showModal();
    };

    buttons.forEach(function (button, n) {
      button.addEventListener('click', function () { open(n); });
    });
    dialog.querySelector('.lb-close').addEventListener('click', function () { dialog.close(); });
    dialog.querySelector('.lb-prev').addEventListener('click', function () { open(current - 1); });
    dialog.querySelector('.lb-next').addEventListener('click', function () { open(current + 1); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') open(current - 1);
      if (e.key === 'ArrowRight') open(current + 1);
    });
  }
})();
