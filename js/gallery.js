// Media behaviour for property pages: a photo lightbox and click-to-play video.
// Both are progressive enhancements — without this file the thumbnails are plain
// links to full-size images and the videos fall back to a <noscript> player.

/* ================================================================== lightbox */
(function () {
  'use strict';

  var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));
  if (!shots.length) return;

  var items = shots.map(function (a) {
    var img = a.querySelector('img');
    return { href: a.getAttribute('href'), alt: img ? img.alt : '' };
  });

  var index = 0;
  var lastFocused = null;

  /* ------------------------------------------------------------ build */
  var box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Property photographs');

  var pic = document.createElement('img');
  pic.decoding = 'async';

  var bar = document.createElement('div');
  bar.className = 'lightbox__bar';

  var prev = button('← Previous');
  var count = document.createElement('p');
  count.setAttribute('aria-live', 'polite');
  var next = button('Next →');
  var close = button('Close ✕');

  bar.appendChild(prev);
  bar.appendChild(count);
  bar.appendChild(next);
  bar.appendChild(close);
  box.appendChild(pic);
  box.appendChild(bar);
  document.body.appendChild(box);

  function button(label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lightbox__btn';
    b.textContent = label;
    return b;
  }

  /* ------------------------------------------------------------ show */
  function show(i) {
    index = (i + items.length) % items.length;
    var it = items[index];
    pic.src = it.href;
    pic.alt = it.alt;
    count.textContent = (index + 1) + ' of ' + items.length;
  }

  function open(i) {
    lastFocused = document.activeElement;
    show(i);
    box.hidden = false;
    // Stop the page behind the dialog from scrolling.
    document.body.style.overflow = 'hidden';
    close.focus();
  }

  function shut() {
    box.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  shots.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      open(i);
    });
  });

  prev.addEventListener('click', function () { show(index - 1); });
  next.addEventListener('click', function () { show(index + 1); });
  close.addEventListener('click', shut);

  // Clicking the backdrop (but not the image or the controls) closes.
  box.addEventListener('click', function (e) {
    if (e.target === box) shut();
  });

  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') { shut(); return; }
    if (e.key === 'ArrowLeft') { show(index - 1); return; }
    if (e.key === 'ArrowRight') { show(index + 1); return; }
    if (e.key !== 'Tab') return;

    // Keep focus inside the dialog while it's open.
    var focusable = [prev, next, close];
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();

/* ============================================================= video facade */
// The poster is rendered as a button; the YouTube iframe is only created when it
// is pressed. Until then the page has made no request to Google — no cookies, no
// tracking, and none of the ~1MB the embed normally costs on load.
(function () {
  'use strict';

  var buttons = Array.prototype.slice.call(document.querySelectorAll('.video__play'));
  if (!buttons.length) return;

  // YouTube's player refuses to configure when the embedding page has no real
  // origin — opening the HTML straight off disk gives `file://`, and the player
  // fails with "Video player configuration error (153)". Nothing in the markup can
  // fix that, so say so plainly rather than showing YouTube's opaque error.
  var isFile = window.location.protocol === 'file:';

  function explainLocalFile(btn) {
    var note = document.createElement('div');
    note.className = 'video__note';
    note.setAttribute('role', 'status');

    var p = document.createElement('p');
    p.innerHTML = '<strong>Video can’t play from a local file.</strong> ' +
      'YouTube blocks playback when a page is opened directly off disk ' +
      '(that’s error 153). Serve the folder over http instead:';
    var pre = document.createElement('pre');
    pre.textContent = 'py -m http.server 8000';
    var p2 = document.createElement('p');
    p2.className = 'video__note-sub';
    p2.textContent = 'then open http://localhost:8000/ — it plays normally there, and on the live site.';

    note.appendChild(p);
    note.appendChild(pre);
    note.appendChild(p2);

    var watch = btn.dataset.watch;
    if (watch) {
      var a = document.createElement('a');
      a.className = 'btn btn--outline';
      a.href = watch;
      a.rel = 'noopener';
      a.target = '_blank';
      a.textContent = 'Watch on YouTube instead';
      note.appendChild(a);
    }
    btn.parentNode.insertBefore(note, btn.nextSibling);
    btn.disabled = true;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.dataset.embed;
      if (!src) return;

      if (isFile) {
        if (!btn.parentNode.querySelector('.video__note')) explainLocalFile(btn);
        return;
      }

      var params = [
        'autoplay=1',       // the user just pressed play; don't make them press twice
        'rel=0',            // keep related videos to this channel
        'playsinline=1',    // iOS plays inline instead of hijacking fullscreen
        'modestbranding=1'
      ];
      // Passing the embedding origin is what YouTube expects; its absence is a
      // common cause of player configuration errors.
      if (window.location.origin && window.location.origin !== 'null') {
        params.push('origin=' + encodeURIComponent(window.location.origin));
      }

      var frame = document.createElement('iframe');
      frame.src = src + (src.indexOf('?') === -1 ? '?' : '&') + params.join('&');
      frame.className = 'video__frame';
      frame.title = btn.getAttribute('aria-label') || 'Property video';
      frame.setAttribute('allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.setAttribute('allowfullscreen', '');

      btn.replaceWith(frame);
      // Move focus into the player so keyboard users aren't dumped at the top.
      frame.setAttribute('tabindex', '-1');
      frame.focus({ preventScroll: true });
    });
  });
})();
