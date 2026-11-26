/* ============================================================
   NOOKI SINGLE CHARACTER MODE (added 2026-11-26)

   One character for now: the blue-haired girl. All movement and
   modes are built for her only. Nothing in script.js was changed:
   this file wraps three of its functions while the flag is on.

   To go back to the old boy/girl wardrobe rig, set the flag below
   to false (or remove the two nooki-single-character tags from
   index.html).

   FUTURE (levels unlock rewards): add entries to NOOKI_CHARACTER.modes
   for new animations, or more objects like NOOKI_CHARACTER for new
   characters, each with its own layers and modes.
   ============================================================ */
(function () {
  'use strict';

  window.NOOKI_SINGLE_CHARACTER = true;
  if (!window.NOOKI_SINGLE_CHARACTER) return;

  var BASE = 'assets/base-rig/';
  var CHARACTER = {
    id: 'muse_girl',
    label: 'Nooki girl',
    layers: {
      body: BASE + 'muse_girl_body.png',
      head: BASE + 'muse_girl_head.png',
      iris: BASE + 'muse_girl_eyerish.png',
      eyesClosed: BASE + 'muse_girl_eyes_closed.png'
    },
    // Eyes slide by a percent of the picture, so they never leave the eye holes
    eye: { x: 1.3, y: 1.2 },
    // Gentle head sway in degrees (two slow waves)
    sway: { a: 1.5, pa: 2300, b: 0.8, pb: 1370 },
    modes: {
      // Ready-made clip shown while typing
      working: { type: 'video', src: BASE + 'muse_girl_working.webm', keysToStart: 4, withinMs: 2500, lingerMs: 4000 },
      // Ready-made picture shown for a moment when the XP level goes up
      levelup: { type: 'image', src: BASE + 'muse_girl_levelup.png', showMs: 4000 }
    }
  };
  window.NOOKI_CHARACTER = CHARACTER;

  document.documentElement.classList.add('nooki-single');

  // The three places the character is drawn: dashboard, Styling Studio mirror, floating pet
  var RIGS = [
    { rig: 'chibiRig', body: 'rigBody', head: 'rigHead', iris: 'rigIris', closed: 'rigEyesClosed', hat: 'chibiHat', badge: 'chibiOutfitBadge', modes: true },
    { rig: 'wardrobeChibiRig', body: 'wardrobeRigBody', head: 'wardrobeRigHead', iris: 'wardrobeRigIris', closed: 'wardrobeRigEyesClosed', hat: 'wardrobeChibiHat', badge: 'wardrobeChibiOutfitBadge', modes: false },
    { rig: 'floatingChibiRig', body: 'floatingRigBody', head: 'floatingRigHead', iris: 'floatingRigIris', closed: 'floatingRigEyesClosed', hat: 'floatingChibiHat', badge: 'floatingChibiOutfitBadge', modes: true }
  ];
  function $(id) { return document.getElementById(id); }
  function setSrc(el, src) { if (el && el.getAttribute('src') !== src) el.setAttribute('src', src); }

  // Old functions are kept here so they are easy to restore
  var original = {
    applyWardrobe: window.applyWardrobe,
    updateEyeGaze: window.updateEyeGaze,
    updateProductivityUI: window.updateProductivityUI
  };
  window.__nookiOriginal = original;

  // ---------- 1. Draw only this character (wardrobe sprites are ignored) ----------
  function buildRig(r) {
    var rig = $(r.rig);
    if (!rig) return;
    setSrc($(r.body), CHARACTER.layers.body);
    setSrc($(r.head), CHARACTER.layers.head);
    setSrc($(r.iris), CHARACTER.layers.iris);
    setSrc($(r.closed), CHARACTER.layers.eyesClosed);
    var hat = $(r.hat); if (hat) hat.textContent = '';
    var badge = $(r.badge); if (badge) badge.textContent = '';

    if (!rig.querySelector('.nooki-mouth-wrap')) {
      var wrap = document.createElement('div');
      wrap.className = 'nooki-mouth-wrap';
      var mouth = document.createElement('div');
      mouth.className = 'nooki-mouth';
      wrap.appendChild(mouth);
      rig.appendChild(wrap);
    }
    if (r.modes && !rig.querySelector('.nooki-mode-working')) {
      var w = document.createElement('div');
      w.className = 'nooki-mode-layer nooki-mode-working';
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.preload = 'none';
      v.src = CHARACTER.modes.working.src;
      w.appendChild(v);
      rig.appendChild(w);

      var l = document.createElement('div');
      l.className = 'nooki-mode-layer nooki-mode-levelup';
      var img = document.createElement('img');
      img.alt = 'Level up';
      img.draggable = false;
      img.setAttribute('data-src', CHARACTER.modes.levelup.src);
      l.appendChild(img);
      rig.appendChild(l);
    }
    rig.classList.add('nooki-char-ready');
  }

  function applySingleCharacter() {
    RIGS.forEach(buildRig);
    var summary = $('wardrobeEquippedSummary');
    if (summary) summary.textContent = '\u2728 ' + CHARACTER.label;
    try { if (typeof window.updateSavedLooksUI === 'function') window.updateSavedLooksUI(); } catch (_) {}
  }
  window.applyWardrobe = applySingleCharacter;

  // ---------- 2. Idle movement: head sway, eyes-only follow, talking mouth ----------
  var eyeX = 0, eyeY = 0, mouthOpen = 0, mouthTarget = 0, mouthNext = 0;

  function readTarget() {
    // script.js keeps the pointer target in px-like units (x up to 5.5, y up to 3.5)
    var tx = 0, ty = 0;
    try { tx = targetEyeX / 5.5; ty = targetEyeY / 3.5; } catch (_) {}
    return { x: Math.max(-1, Math.min(1, tx)), y: Math.max(-1, Math.min(1, ty)) };
  }
  function isSleeping() { try { return !!state.isSleeping; } catch (_) { return false; } }

  function singleFrame(now) {
    var t = typeof now === 'number' ? now : performance.now();
    var tgt = readTarget();
    eyeX += (tgt.x - eyeX) * 0.14;
    eyeY += (tgt.y - eyeY) * 0.14;

    var s = CHARACTER.sway;
    var rot = s.a * Math.sin(t / s.pa) + s.b * Math.sin(t / s.pb + 1.3);
    if (isSleeping()) rot = rot * 0.4 + 1.5;
    // Touch reactions (nooki-pet-touch.js) add a small head wiggle / tilt / nod
    var touch = typeof window.nookiTouchOffset === 'function' ? window.nookiTouchOffset(t) : null;
    if (touch) rot += touch.rot;
    var headT = 'rotate(' + rot.toFixed(3) + 'deg)' + (touch && touch.y ? ' translateY(' + touch.y.toFixed(3) + '%)' : '');
    var eyeT = headT + ' translate(' + (eyeX * CHARACTER.eye.x).toFixed(3) + '%,' + (eyeY * CHARACTER.eye.y).toFixed(3) + '%)';

    var anyTalking = false;
    for (var i = 0; i < RIGS.length; i++) {
      var r = RIGS[i], rig = $(r.rig);
      if (!rig) continue;
      var iris = $(r.iris), head = $(r.head), closed = $(r.closed);
      if (iris) iris.style.transform = eyeT;
      if (head) head.style.transform = headT;
      if (closed) closed.style.transform = headT;
      var mw = rig.querySelector('.nooki-mouth-wrap');
      if (mw) mw.style.transform = headT;
      if (rig.classList.contains('talking')) anyTalking = true;
    }

    // Talking mouth: opens and closes at random while the app marks her as talking
    if (anyTalking) {
      if (t > mouthNext) {
        mouthTarget = Math.random() < 0.2 ? 0 : 0.25 + Math.random() * 0.75;
        mouthNext = t + 90 + Math.random() * 90;
      }
    } else {
      mouthTarget = 0;
    }
    mouthOpen += (mouthTarget - mouthOpen) * 0.35;
    for (var j = 0; j < RIGS.length; j++) {
      var rg = $(RIGS[j].rig);
      var m = rg && rg.querySelector('.nooki-mouth');
      if (!m) continue;
      var on = rg.classList.contains('talking') && mouthOpen > 0.04;
      m.style.opacity = on ? '1' : '0';
      m.style.transform = 'scaleY(' + (on ? mouthOpen : 0).toFixed(3) + ')';
    }

    window.__nookiRigState = { rot: rot, eyeXPercent: eyeX * CHARACTER.eye.x, eyeYPercent: eyeY * CHARACTER.eye.y, mouth: mouthOpen };
    try { eyeAnimFrame = requestAnimationFrame(window.updateEyeGaze); }
    catch (_) { requestAnimationFrame(window.updateEyeGaze); }
  }
  window.updateEyeGaze = singleFrame;

  // ---------- 3. Modes: Working (typing) and Level up ----------
  var modeRigs = function () { return RIGS.filter(function (r) { return r.modes; }).map(function (r) { return $(r.rig); }).filter(Boolean); };
  var working = false, workingTimer = null, levelTimer = null, keyTimes = [];

  function setWorking(on) {
    if (working === on) return;
    working = on;
    modeRigs().forEach(function (rig) {
      rig.classList.toggle('nooki-mode-on-working', on);
      var v = rig.querySelector('.nooki-mode-working video');
      if (!v) return;
      try {
        if (on) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else { v.pause(); }
      } catch (_) {}
    });
    window.__nookiMode = on ? 'working' : (levelTimer ? 'levelup' : 'idle');
  }

  function typingPulse() {
    var cfg = CHARACTER.modes.working, n = Date.now();
    keyTimes = keyTimes.filter(function (t) { return n - t < cfg.withinMs; });
    keyTimes.push(n);
    if (!working && keyTimes.length >= cfg.keysToStart) setWorking(true);
    if (working) {
      if (workingTimer) clearTimeout(workingTimer);
      workingTimer = setTimeout(function () { keyTimes = []; setWorking(false); }, cfg.lingerMs);
    }
  }
  window.nookiTypingPulse = typingPulse;

  window.addEventListener('keydown', function () {
    try { if (state.mode === 'mobile') return; } catch (_) {}
    typingPulse();
  });

  function showLevelUp() {
    var cfg = CHARACTER.modes.levelup;
    modeRigs().forEach(function (rig) {
      var img = rig.querySelector('.nooki-mode-levelup img');
      if (img && !img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src'));
      rig.classList.add('nooki-mode-on-levelup');
    });
    window.__nookiMode = 'levelup';
    if (levelTimer) clearTimeout(levelTimer);
    levelTimer = setTimeout(function () {
      levelTimer = null;
      modeRigs().forEach(function (rig) { rig.classList.remove('nooki-mode-on-levelup'); });
      window.__nookiMode = working ? 'working' : 'idle';
    }, cfg.showMs);
  }
  window.nookiShowLevelUp = showLevelUp;

  // Level rule is the app's own: level = floor(XP / 100) + 1. XP logic is not touched.
  var lastLevel = null;
  function levelFromXp(xp) { return Math.floor((Number(xp) || 0) / 100) + 1; }
  function checkLevel(xp) {
    var lvl = levelFromXp(xp);
    if (lastLevel !== null && lvl > lastLevel) showLevelUp();
    lastLevel = lvl;
  }
  if (typeof original.updateProductivityUI === 'function') {
    window.updateProductivityUI = function () {
      var out = original.updateProductivityUI.apply(this, arguments);
      try { checkLevel(nookiProductivityState.exp); } catch (_) {}
      return out;
    };
  }

  // The floating pet is a separate window: it hears about typing and XP through shared storage
  window.addEventListener('storage', function (e) {
    if (e.key === 'bongo_count') {
      typingPulse();
    } else if (e.key === 'nooki_productivity_state' && e.newValue) {
      try { checkLevel(JSON.parse(e.newValue).exp); } catch (_) {}
    }
  });

  // ---------- Start ----------
  function start() {
    applySingleCharacter();
    try { if (lastLevel === null) lastLevel = levelFromXp(nookiProductivityState.exp); } catch (_) {}
    try { if (!eyeAnimFrame) eyeAnimFrame = requestAnimationFrame(window.updateEyeGaze); }
    catch (_) { requestAnimationFrame(window.updateEyeGaze); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
