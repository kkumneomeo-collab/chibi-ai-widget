/* ============================================================
   NOOKI PET TOUCH + FLOATING PET (added 2026-11-26)

   - Clicking her gives a small reaction (giggle, shy tilt, surprise,
     nod) with little hearts / sparkles. No whole-body jumping.
   - The speech bubble no longer opens on every click: only now and
     then, plus reminders and a short tip from time to time.
   - The round handle at her lower right resizes the floating pet.

   Nothing in script.js is changed: this file replaces handlePoke
   while it is loaded. Remove its <script> tag to go back.
   ============================================================ */
(function () {
  'use strict';
  if (!window.NOOKI_SINGLE_CHARACTER) return;

  var isPet = false;
  try {
    isPet = new URLSearchParams(window.location.search).get('window') === 'pet' ||
      window.location.hash.indexOf('pet') !== -1;
  } catch (_) {}

  function $(id) { return document.getElementById(id); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function rigs() { return [$('chibiRig'), $('floatingChibiRig')].filter(Boolean); }

  /* ---------- 1. Touch reactions ---------- */
  var REACTIONS = {
    giggle:   { ms: 900,  eyes: true,  laugh: true,  bits: ['\u2728', '\uD83C\uDFB5', '\u2728'] },
    shy:      { ms: 1100, eyes: true,  laugh: false, bits: ['\uD83D\uDC96', '\uD83D\uDC97'] },
    surprise: { ms: 700,  eyes: false, laugh: false, bits: ['\u2757', '\u2728'] },
    nod:      { ms: 800,  eyes: false, laugh: false, bits: ['\uD83C\uDF38', '\u2728'] },
    tickle:   { ms: 1400, eyes: true,  laugh: true,  bits: ['\uD83D\uDC96', '\u2728', '\uD83D\uDC95', '\u2728'] }
  };
  var current = null, lastKind = '';

  // Called every frame by nooki-single-character.js: extra head angle (deg) and lift (%)
  window.nookiTouchOffset = function (t) {
    if (!current) return null;
    var p = (t - current.start) / current.ms;
    if (p >= 1) { current = null; return null; }
    if (p < 0) p = 0;
    var fade = 1 - p, k = current.kind;
    if (k === 'giggle') return { rot: 4 * Math.sin(p * Math.PI * 8) * fade, y: 0 };
    if (k === 'tickle') return { rot: 5.5 * Math.sin(p * Math.PI * 12) * fade, y: 0 };
    if (k === 'shy') return { rot: 7 * current.dir * Math.sin(p * Math.PI), y: 0 };
    if (k === 'surprise') return { rot: -2 * current.dir * fade, y: -1.1 * Math.sin(p * Math.PI) };
    if (k === 'nod') return { rot: 0, y: 0.9 * Math.abs(Math.sin(p * Math.PI * 2)) };
    return null;
  };

  function floatBits(rig, bits) {
    var host = rig.parentElement || rig;
    bits.forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'nooki-touch-bit';
      s.textContent = ch;
      s.style.left = (32 + Math.random() * 36) + '%';
      s.style.animationDelay = (i * 90) + 'ms';
      s.style.setProperty('--drift', (Math.random() * 30 - 15).toFixed(0) + 'px');
      host.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1500 + i * 90);
    });
  }

  function react(kind) {
    var r = REACTIONS[kind];
    current = { kind: kind, start: performance.now(), ms: r.ms, dir: Math.random() < 0.5 ? -1 : 1 };
    rigs().forEach(function (rig) {
      if (r.eyes) {
        rig.classList.add('nooki-happy-eyes');
        setTimeout(function () { rig.classList.remove('nooki-happy-eyes'); }, r.ms - 120);
      }
      if (r.laugh) {
        rig.classList.add('talking');
        setTimeout(function () {
          var bubble = $('floatingPetBubble'), b2 = $('floatingBubble');
          var showing = (bubble && bubble.classList.contains('show')) || (b2 && b2.classList.contains('show'));
          if (!showing) rig.classList.remove('talking');
        }, r.ms);
      }
      floatBits(rig, r.bits);
    });
  }

  var CLICK_LINES = [
    'Hehe, that tickles!',
    'Boop!',
    'Hi hi! I am here with you.',
    'You found my tickle spot!',
    'One more? Okay, one more.',
    'I like it when you say hello.',
    'You are doing great today.'
  ];
  var TICKLE_LINES = ['Hahaha, stop, stop!', 'Too many tickles!', 'Okay okay, you win!'];

  var lastPoke = 0, clickTimes = [], lastBubbleAt = 0, clicksSinceBubble = 0;

  function say(text, ms) {
    lastBubbleAt = Date.now();
    clicksSinceBubble = 0;
    try { if (typeof window.showBubbleMessage === 'function') window.showBubbleMessage(text, ms || 2600); } catch (_) {}
  }

  function newPoke() {
    var n = Date.now();
    if (n - lastPoke < 180) return;
    lastPoke = n;
    try { if (typeof getAudioContext === 'function') getAudioContext(); } catch (_) {}
    try { if (typeof wakeUp === 'function') wakeUp(); } catch (_) {}
    try { if (typeof playPokeSound === 'function') playPokeSound(); } catch (_) {}

    clickTimes = clickTimes.filter(function (t) { return n - t < 2500; });
    clickTimes.push(n);
    clicksSinceBubble++;

    if (clickTimes.length >= 4) {
      clickTimes = [];
      react('tickle');
      say(pick(TICKLE_LINES), 2400);
      return;
    }
    var kinds = ['giggle', 'shy', 'surprise', 'nod'].filter(function (k) { return k !== lastKind; });
    lastKind = pick(kinds);
    react(lastKind);

    // A few words only now and then, never on every click
    if (clicksSinceBubble >= 4 && n - lastBubbleAt > 15000 && Math.random() < 0.6) say(pick(CLICK_LINES), 2600);
  }
  window.__nookiOriginalHandlePoke = window.handlePoke;
  window.handlePoke = newPoke;
  try { handlePoke = newPoke; } catch (_) {}

  /* ---------- 2. Tips and greetings from time to time (floating pet only) ---------- */
  var TIPS = [
    'Tip: do the smallest quest first. It gets you moving.',
    'Tip: sit back and relax your shoulders.',
    'Tip: a sip of water helps you focus.',
    'Tip: look far away for 20 seconds. Your eyes will thank you.',
    'Tip: one thing at a time is enough.',
    'Tip: stretch your hands and wrists for a moment.',
    'Tip: save your work. Just in case.'
  ];
  function greeting(h) {
    if (h < 12) return 'Good morning! Ready when you are.';
    if (h < 17) return 'Good afternoon! How is it going?';
    return 'Good evening! Nice work today.';
  }
  var greetedPart = '';
  function timeBubble() {
    var d = new Date(), h = d.getHours();
    if (h < 7 || h >= 22) return;                        // quiet at night
    try { if (state.isSleeping) return; } catch (_) {}
    var bubble = $('floatingPetBubble');
    if (bubble && bubble.classList.contains('show')) return;   // a reminder is on screen
    if (Date.now() - lastBubbleAt < 5 * 60000) return;
    var part = h < 12 ? 'am' : (h < 17 ? 'pm' : 'eve');
    if (part !== greetedPart) { greetedPart = part; say(greeting(h), 6000); return; }
    say(pick(TIPS), 7000);
  }
  if (isPet) {
    setTimeout(timeBubble, 20000);
    setInterval(timeBubble, 30 * 60000);                 // about every 30 minutes
  }

  /* ---------- 3. Resize handle on the floating pet (lower right circle) ---------- */
  function initResize() {
    var handle = $('floatingResizeHandle');
    if (!handle || handle.__nookiResize) return;
    handle.__nookiResize = true;
    var active = false, sx = 0, sy = 0, startScale = 1, pending = null, raf = 0;

    function scaleNow() { try { return Number(state.scale) || 1; } catch (_) { return 1; } }
    function apply() {
      raf = 0;
      if (pending === null) return;
      try { if (typeof setScale === 'function') setScale(pending); } catch (_) {}
      pending = null;
    }
    // Screen coordinates are used because the pet window itself changes size while dragging
    handle.addEventListener('pointerdown', function (e) {
      e.stopImmediatePropagation(); e.preventDefault();
      active = true; sx = e.screenX; sy = e.screenY; startScale = scaleNow();
      window._isPetPotentialDrag = true;                 // keeps the pet window catching the mouse
      try { handle.closest('.floating-screen-pet').classList.add('nooki-resizing'); } catch (_) {}
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    }, true);
    handle.addEventListener('pointermove', function (e) {
      if (!active) return;
      e.stopImmediatePropagation();
      var d = ((e.screenX - sx) + (e.screenY - sy)) / 220;
      pending = Math.max(0.5, Math.min(2.3, startScale + d));
      if (!raf) raf = requestAnimationFrame(apply);
    }, true);
    function stop(e) {
      if (!active) return;
      e.stopImmediatePropagation();
      active = false;
      window._isPetPotentialDrag = false;
      try { handle.closest('.floating-screen-pet').classList.remove('nooki-resizing'); } catch (_) {}
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    handle.addEventListener('pointerup', stop, true);
    handle.addEventListener('pointercancel', stop, true);
    handle.addEventListener('click', function (e) { e.stopPropagation(); }, true);
    handle.title = 'Drag to make me bigger or smaller';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initResize);
  else initResize();

  /* ---------- 4. Key count on / off (Settings > Keystroke Counter switch) ---------- */
  // When the switch is off, the little count badge is hidden on the dashboard and the floating pet.
  function applyKeyCountVisibility() {
    var off = false;
    try { off = localStorage.getItem('bongo_count_enabled') === 'false'; } catch (_) {}
    document.documentElement.classList.toggle('nooki-hide-keycount', off);
  }
  function initKeyCount() {
    applyKeyCountVisibility();
    var t = $('counterToggle');
    if (t) {
      t.addEventListener('change', function () { setTimeout(applyKeyCountVisibility, 0); });
      var row = t.closest ? t.closest('.settings-switch-row') : null;
      var sub = row ? row.querySelector('.switch-row-sub') : null;
      if (sub) sub.textContent = 'Count my typing and show the number under Nooki';
    }
    window.addEventListener('storage', function (e) {
      if (e.key === 'bongo_count_enabled') applyKeyCountVisibility();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initKeyCount);
  else initKeyCount();
})();
