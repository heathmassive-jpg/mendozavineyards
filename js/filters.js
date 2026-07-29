// Progressive enhancement: mobile nav, home-page table sorting, and filtering +
// sorting of the property list. Every control has a no-JS fallback in the markup —
// without this file the full listing set is still rendered and readable.
(function () {
  'use strict';

  /* ============================================================ mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  var mq = window.matchMedia('(min-width: 900px)');

  if (toggle && nav) {
    var syncNav = function () {
      nav.hidden = mq.matches ? false : toggle.getAttribute('aria-expanded') !== 'true';
    };
    var closeNav = function () {
      toggle.setAttribute('aria-expanded', 'false');
      syncNav();
    };

    syncNav();
    toggle.addEventListener('click', function () {
      toggle.setAttribute('aria-expanded',
        String(toggle.getAttribute('aria-expanded') !== 'true'));
      syncNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeNav();
        toggle.focus();
      }
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && !mq.matches) closeNav();
    });
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(syncNav);
  }

  /* ============================================================ helpers */
  function num(text) {
    var m = String(text).replace(/,/g, '').match(/([\d.]+)\s*([MK])?/i);
    if (!m) return null;
    var v = parseFloat(m[1]);
    if (isNaN(v)) return null;
    var s = (m[2] || '').toUpperCase();
    if (s === 'M') v *= 1e6;
    else if (s === 'K') v *= 1e3;
    return v;
  }

  // Nulls always sink, whichever direction we're sorting.
  function cmp(a, b, dir) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * dir;
  }

  function parseRange(v) {
    if (!v) return null;
    var p = v.split('-');
    return {
      min: p[0] === '' ? -Infinity : parseFloat(p[0]),
      max: (p.length < 2 || p[1] === '') ? Infinity : parseFloat(p[1])
    };
  }

  var params = new URLSearchParams(window.location.search);

  /* ============================================================ home page table */
  var table = document.querySelector('.inventory');
  var homeSort = table ? document.getElementById('sort') : null;

  if (table && homeSort) {
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);

    rows.forEach(function (row) {
      var priceCell = row.cells[row.cells.length - 1];
      var main = priceCell.querySelector('.price-main');
      var ppa = priceCell.querySelector('.price-ppa');
      var ha = row.cells[1] ? num(row.cells[1].textContent) : null;
      row._price = main ? num(main.textContent) : null;
      row._ppa = ppa ? num(ppa.textContent) : null;
      row._size = ha === null ? null : ha * 2.47105;
    });

    var TABLE_SORTS = {
      'ppa-asc': function (a, b) { return cmp(a._ppa, b._ppa, 1); },
      'ppa-desc': function (a, b) { return cmp(a._ppa, b._ppa, -1); },
      'price-asc': function (a, b) { return cmp(a._price, b._price, 1); },
      'price-desc': function (a, b) { return cmp(a._price, b._price, -1); },
      'size-desc': function (a, b) { return cmp(a._size, b._size, -1); }
    };

    var tableStatus = document.getElementById('result-count');
    var applyTableSort = function () {
      var fn = TABLE_SORTS[homeSort.value];
      if (!fn) return;
      var frag = document.createDocumentFragment();
      rows.slice().sort(fn).forEach(function (r) { frag.appendChild(r); });
      tbody.appendChild(frag);
      if (tableStatus) {
        tableStatus.textContent = 'Showing ' + rows.length + ' of 46 · sorted by ' +
          homeSort.options[homeSort.selectedIndex].text.trim().toLowerCase();
      }
    };

    homeSort.addEventListener('change', applyTableSort);
    if (params.get('sort') && TABLE_SORTS[params.get('sort')]) {
      homeSort.value = params.get('sort');
      applyTableSort();
    }
  }

  /* ============================================================ property list */
  var form = document.getElementById('filter-form');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-status]'));
  if (!form || !cards.length) return;

  var countEl = document.getElementById('result-count');
  var emptyEl = document.getElementById('empty-state');
  var clearBtn = document.getElementById('clear-filters');
  var chips = Array.prototype.slice.call(document.querySelectorAll('#filter-chips .chip'));
  var sortSel = form.querySelector('[name="sort"]');
  // Count whatever this page holds — the for-sale list and the sold archive are
  // separate pages, so this must not assume one status.
  var total = cards.length;
  var noun = (countEl && countEl.dataset.noun) || 'properties';

  cards.forEach(function (c) {
    c._types = (c.dataset.types || '').split(/\s+/).filter(Boolean);
    c._price = c.dataset.price ? parseFloat(c.dataset.price) : null;
    c._acres = c.dataset.acres ? parseFloat(c.dataset.acres) : null;
    c._ppa = c.dataset.ppa ? parseFloat(c.dataset.ppa) : null;
  });

  var CARD_SORTS = {
    'ppa-asc': function (a, b) { return cmp(a._ppa, b._ppa, 1); },
    'ppa-desc': function (a, b) { return cmp(a._ppa, b._ppa, -1); },
    'price-asc': function (a, b) { return cmp(a._price, b._price, 1); },
    'price-desc': function (a, b) { return cmp(a._price, b._price, -1); },
    'size-desc': function (a, b) { return cmp(a._acres, b._acres, -1); }
  };

  // Which query keys count as an active filter (sort doesn't narrow anything).
  var FILTER_KEYS = ['type', 'region', 'price', 'size', 'water', 'income', 'home', 'pay', 'video'];

  function currentFilters() {
    var f = {};
    FILTER_KEYS.forEach(function (k) {
      var el = form.elements[k];
      var v = el ? el.value : (params.get(k) || '');
      if (v) f[k] = v;
    });
    // These have no select — they come from chips and the URL only.
    ['income', 'home', 'pay', 'video'].forEach(function (k) {
      var v = params.get(k);
      if (v) f[k] = v; else delete f[k];
    });
    return f;
  }

  function matches(card, f) {
    if (f.type && card._types.indexOf(f.type) === -1) return false;
    if (f.region && card.dataset.region !== f.region) return false;
    if (f.water && card.dataset.water !== f.water) return false;
    if (f.income === 'yes' && card.dataset.income !== '1') return false;
    if (f.home === 'yes' && card.dataset.home !== '1') return false;
    if (f.pay === 'bitcoin' && card.dataset.bitcoin !== '1') return false;
    if (f.video === 'yes' && card.dataset.video !== '1') return false;

    var pr = parseRange(f.price);
    if (pr) {
      // A listing with no published price can't satisfy a price range.
      if (card._price === null) return false;
      if (card._price < pr.min || card._price >= pr.max) return false;
    }
    var sr = parseRange(f.size);
    if (sr) {
      if (card._acres === null) return false;
      if (card._acres < sr.min || card._acres >= sr.max) return false;
    }
    return true;
  }

  function apply(pushUrl) {
    var f = currentFilters();
    var active = FILTER_KEYS.some(function (k) { return f[k]; });
    var shown = 0;

    cards.forEach(function (c) {
      var ok = matches(c, f);
      c.hidden = !ok;
      if (ok) shown++;
    });

    // Re-order what's left, within each list.
    var fn = CARD_SORTS[sortSel && sortSel.value];
    if (fn) {
      var lists = {};
      cards.forEach(function (c) {
        var ul = c.parentNode;
        (lists[ul.className + (ul.id || '')] = lists[ul.className + (ul.id || '')] || { ul: ul, items: [] })
          .items.push(c);
      });
      Object.keys(lists).forEach(function (k) {
        var frag = document.createDocumentFragment();
        lists[k].items.slice().sort(fn).forEach(function (c) { frag.appendChild(c); });
        lists[k].ul.appendChild(frag);
      });
    }

    // Hide a whole section when nothing in it survived.
    Array.prototype.forEach.call(document.querySelectorAll('.section'), function (sec) {
      var own = sec.querySelectorAll('.card[data-status]');
      if (!own.length) return;
      var vis = Array.prototype.filter.call(own, function (c) { return !c.hidden; });
      sec.hidden = vis.length === 0;
      var h = sec.querySelector('.section__head h2');
      if (h && h.dataset.label === undefined) h.dataset.label = h.textContent.replace(/\s*\(\d+\)\s*$/, '');
      if (h) h.textContent = h.dataset.label + ' (' + vis.length + ')';
    });

    if (countEl) {
      countEl.textContent = active
        ? 'Showing ' + shown + ' of ' + total + ' ' + noun
        : 'Showing all ' + total + ' ' + noun;
    }
    if (emptyEl) emptyEl.hidden = shown !== 0;
    if (clearBtn) clearBtn.hidden = !active;

    chips.forEach(function (chip) {
      var k = chip.dataset.key, v = chip.dataset.value;
      chip.setAttribute('aria-pressed', String(f[k] === v));
    });

    if (pushUrl) {
      var qs = new URLSearchParams();
      FILTER_KEYS.forEach(function (k) { if (f[k]) qs.set(k, f[k]); });
      if (sortSel && sortSel.value && sortSel.value !== 'ppa-asc') qs.set('sort', sortSel.value);
      var url = window.location.pathname + (qs.toString() ? '?' + qs : '');
      window.history.replaceState(null, '', url);
      params = qs;
    }
  }

  // Seed the controls from the URL so a shared link reproduces the view.
  // An unrecognised value (stale link, typo, someone editing the query by hand)
  // is deliberately ignored rather than matching nothing — showing the full list
  // is more useful than an empty page the visitor can't explain.
  FILTER_KEYS.concat(['sort']).forEach(function (k) {
    var el = form.elements[k];
    var v = params.get(k);
    if (!el || v === null) return;
    var known = Array.prototype.some.call(el.options || [], function (o) { return o.value === v; });
    el.value = known ? v : '';
    if (!known) params.delete(k);
  });

  form.addEventListener('change', function () { apply(true); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    apply(true);
  });

  chips.forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      var k = chip.dataset.key, v = chip.dataset.value;
      var on = chip.getAttribute('aria-pressed') === 'true';
      if (form.elements[k]) {
        form.elements[k].value = on ? '' : v;
      } else if (on) {
        params.delete(k);
      } else {
        params.set(k, v);
      }
      apply(true);
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      FILTER_KEYS.forEach(function (k) {
        if (form.elements[k]) form.elements[k].value = '';
        params.delete(k);
      });
      apply(true);
      if (typeof form.scrollIntoView === 'function') {
        form.scrollIntoView({ block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  }

  apply(false);
})();
