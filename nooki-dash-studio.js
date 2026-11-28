/* ============================================================
   NOOKI DASHBOARD STUDIO SUMMARY (new file — self-contained)
   The Dashboard's "Styling Studio" card still showed the OLD
   wardrobe quick carousel (hats/outfits with Equip buttons),
   but the Studio itself is now characters + animation sets
   unlocked with XP. This script repurposes that one card:
   it injects a small Studio summary (Nooki's mini character,
   level/XP, animations unlocked, next unlock) and — ONLY after
   the summary has been built successfully — adds the class
   'ns-dash-studio-on' to the card, which hides the carousel
   via a scoped rule in nooki-app-theme.css.

   The carousel's DOM nodes are never touched, moved or
   emptied, so script.js keeps rendering and wiring it exactly
   as before (its buttons simply sit inside a display:none
   container). The card header and its "Open studio ›" button
   are untouched and keep their existing behaviour.

   Data comes from the same source the Studio uses:
   localStorage 'nooki_xp', level = floor(xp/100)+1, with the
   Studio's own fallback (missing/invalid value -> 0 XP).

   Fail-safe: if the card or carousel cannot be found, or
   anything throws while building, nothing is changed at all
   and the card renders exactly as it always did.
   No popup/toast messages anywhere.
   ============================================================ */
(function () {
  'use strict';

  var XP_KEY = 'nooki_xp';
  var ON_CLASS = 'ns-dash-studio-on';
  var ANIMS = [
    { name: 'Idle',             xp: 0   },
    { name: 'Mouse follow',     xp: 25  },
    { name: 'Click reaction',   xp: 50  },
    { name: 'Typing companion', xp: 100 },
    { name: 'Wave hello',       xp: 150 },
    { name: 'Sleepy',           xp: 250 }
  ];

  function readXp() {
    try {
      var v = parseInt(localStorage.getItem(XP_KEY) || '0', 10);
      return isNaN(v) || v < 0 ? 0 : v;
    } catch (e) { return 0; }
  }
  function levelFromXp(xp) { return Math.floor(xp / 100) + 1; }
  function unlockedCount(xp) {
    var n = 0;
    ANIMS.forEach(function (a) { if (a.xp <= xp) n++; });
    return n;
  }
  function nextUnlock(xp) {
    for (var i = 0; i < ANIMS.length; i++) if (ANIMS[i].xp > xp) return ANIMS[i];
    return null;
  }

  var parts = null; // dynamic elements inside the summary, once built

  function buildSummary() {
    var root = document.createElement('div');
    root.className = 'ns-dash-summary';
    root.innerHTML =
      '<div class="ns-dash-char" aria-hidden="true">' +
        '<span class="ns-dash-rig">' +
          '<img src="assets/base-rig/muse_girl_body.png" alt="" draggable="false" />' +
          '<img src="assets/base-rig/muse_girl_eyerish.png" alt="" draggable="false" />' +
          '<img src="assets/base-rig/muse_girl_head.png" alt="" draggable="false" />' +
        '</span>' +
        '<span class="ns-dash-shadow"></span>' +
      '</div>' +
      '<div class="ns-dash-info">' +
        '<div class="ns-dash-namerow">' +
          '<span class="ns-dash-name">Nooki Blue</span>' +
          '<span class="ns-dash-lv" data-role="lv">Lv. 1</span>' +
          '<span class="ns-dash-xp" data-role="xp">0 XP</span>' +
        '</div>' +
        '<div class="ns-dash-animrow">' +
          '<span class="ns-dash-animlabel">Animations unlocked</span>' +
          '<span class="ns-dash-animcount" data-role="count">1 / 6</span>' +
        '</div>' +
        '<div class="ns-dash-bar"><span class="ns-dash-bar-fill" data-role="fill"></span></div>' +
        '<p class="ns-dash-next" data-role="next"></p>' +
      '</div>';
    return root;
  }

  function refresh() {
    if (!parts) return;
    var xp = readXp();
    var unlocked = unlockedCount(xp);
    var next = nextUnlock(xp);
    parts.lv.textContent = 'Lv. ' + levelFromXp(xp);
    parts.xp.textContent = xp + ' XP';
    parts.count.textContent = unlocked + ' / ' + ANIMS.length;
    parts.fill.style.width = Math.round((unlocked / ANIMS.length) * 100) + '%';
    if (next) {
      parts.next.innerHTML = 'Next unlock: <strong>' + next.name + '</strong> — ' +
        next.xp + ' XP (' + (next.xp - xp) + ' XP to go)';
    } else {
      parts.next.textContent = 'All animations unlocked';
    }
  }

  function init() {
    try {
      var carousel = document.getElementById('dashWardrobeCarousel');
      if (!carousel) return;
      var card = carousel.closest ? carousel.closest('.clay-card') : null;
      if (!card) return;

      if (!parts) {
        var summary = buildSummary();
        var header = card.querySelector('.clay-card-header');
        if (header && header.nextSibling) card.insertBefore(summary, header.nextSibling);
        else if (header) card.appendChild(summary);
        else card.insertBefore(summary, carousel);
        parts = {
          lv: summary.querySelector('[data-role="lv"]'),
          xp: summary.querySelector('[data-role="xp"]'),
          count: summary.querySelector('[data-role="count"]'),
          fill: summary.querySelector('[data-role="fill"]'),
          next: summary.querySelector('[data-role="next"]')
        };
        if (!parts.lv || !parts.xp || !parts.count || !parts.fill || !parts.next) {
          parts = null;
          if (summary.parentNode) summary.parentNode.removeChild(summary);
          return; // leave the card exactly as it was
        }
      }
      refresh();
      // Only now — summary built and filled — hide the old carousel.
      card.classList.add(ON_CLASS);
    } catch (e) {
      /* Fail-safe: leave the card exactly as it was. */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Keep the numbers fresh when the user returns to the Dashboard,
  // and if XP changes in another window (e.g. the floating pet).
  var dashTab = document.querySelector('.sidebar-tab[data-tab="tabDashboard"]');
  if (dashTab) dashTab.addEventListener('click', function () { init(); });
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === XP_KEY) init();
  });
})();
