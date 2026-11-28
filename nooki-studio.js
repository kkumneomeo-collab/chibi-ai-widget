/* ============================================================
   NOOKI STYLING STUDIO (new file — self-contained)
   Powers ONLY the new Studio UI inside #tabWardrobe and nothing
   else. It does not touch, override, or depend on script.js or
   any other existing script. It only READS the app's XP from
   localStorage key 'nooki_xp' (level = floor(xp/100)+1, the
   app's own formula) and keeps its own animation on/off state
   under the new key 'nooki_studio_anim_v1'.
   No popup/toast messages anywhere.
   ============================================================ */
(function () {
  'use strict';

  var XP_KEY = 'nooki_xp';
  var STATE_KEY = 'nooki_studio_anim_v1';
  var CHAR_IMG = 'assets/base-rig/muse_girl_body.png';

  var ANIMS = [
    { id: 'idle',   name: 'Idle',            xp: 0,   frames: 12, art: 'orbPearl',
      desc: 'Blink, head sway and gentle breathing while she sits on your desktop.' },
    { id: 'mouse',  name: 'Mouse follow',    xp: 25,  frames: 8,  art: 'gemCyan',
      desc: 'Her eyes follow your cursor around the screen.' },
    { id: 'click',  name: 'Click reaction',  xp: 50,  frames: 10, art: 'gemPink',
      desc: 'Giggles, tilts shyly and shows hearts when clicked.' },
    { id: 'typing', name: 'Typing companion', xp: 100, frames: 10, art: 'coins',
      desc: 'Types along with your keystrokes.' },
    { id: 'wave',   name: 'Wave hello',      xp: 150, frames: 10, art: 'shield',
      desc: 'A happy wave hello when she arrives.' },
    { id: 'sleepy', name: 'Sleepy',          xp: 250, frames: 10, art: 'orbDeep',
      desc: 'Eyes droop and lights dim once quiet hours begin.' }
  ];
  var LOCKED_XP = [150, 200, 250];

  /* Glossy game-item illustrations (inline SVG, one per animation) */
  var ART = {
    orbPearl: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="nsA1" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#ffe9f4"/><stop offset="70%" stop-color="#c9b8ff"/><stop offset="100%" stop-color="#7d6fe8"/></radialGradient></defs><circle cx="50" cy="50" r="34" fill="url(#nsA1)"/><circle cx="38" cy="36" r="10" fill="#ffffff" opacity="0.85"/><path d="M62 22l2.4 6 6 2.4-6 2.4L62 39l-2.4-6.2-6-2.4 6-2.4z" fill="#fff"/><circle cx="66" cy="62" r="3" fill="#bfe9ff"/></svg>',
    gemCyan: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nsA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c9f6ff"/><stop offset="55%" stop-color="#3fc3ef"/><stop offset="100%" stop-color="#1668c9"/></linearGradient></defs><path d="M50 8 88 38 50 94 12 38z" fill="url(#nsA2)"/><path d="M50 8 66 38 50 94 34 38z" fill="#ffffff" opacity="0.28"/><path d="M12 38h76M50 8 34 38l16 56M50 8l16 30-16 56" stroke="#eafcff" stroke-width="2" fill="none" opacity="0.7"/><path d="M30 24l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#fff"/></svg>',
    gemPink: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nsA3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd7f2"/><stop offset="50%" stop-color="#f06bd8"/><stop offset="100%" stop-color="#8b2fd6"/></linearGradient></defs><path d="M50 8 88 38 50 94 12 38z" fill="url(#nsA3)"/><path d="M50 8 66 38 50 94 34 38z" fill="#ffffff" opacity="0.3"/><path d="M12 38h76M50 8 34 38l16 56M50 8l16 30-16 56" stroke="#ffeafd" stroke-width="2" fill="none" opacity="0.75"/><path d="M68 18l2.4 5.4 5.4 2.4-5.4 2.4L68 34l-2.4-5.8-5.4-2.4 5.4-2.4z" fill="#fff"/></svg>',
    coins: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="nsA4" cx="38%" cy="32%" r="85%"><stop offset="0%" stop-color="#fff3b0"/><stop offset="55%" stop-color="#ffc93c"/><stop offset="100%" stop-color="#d98a06"/></radialGradient></defs><ellipse cx="38" cy="66" rx="24" ry="10" fill="#c77f04"/><ellipse cx="38" cy="60" rx="24" ry="10" fill="url(#nsA4)"/><ellipse cx="62" cy="76" rx="24" ry="10" fill="#c77f04"/><ellipse cx="62" cy="70" rx="24" ry="10" fill="url(#nsA4)"/><ellipse cx="52" cy="46" rx="25" ry="11" fill="#c77f04"/><ellipse cx="52" cy="39" rx="25" ry="11" fill="url(#nsA4)"/><text x="52" y="45" text-anchor="middle" font-size="15" font-weight="900" fill="#a86e00" font-family="sans-serif">★</text></svg>',
    shield: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nsA5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe9a8"/><stop offset="55%" stop-color="#e8a83c"/><stop offset="100%" stop-color="#9c6410"/></linearGradient></defs><path d="M50 6 86 18v30c0 26-15 38-36 46C29 86 14 74 14 48V18z" fill="url(#nsA5)"/><path d="M50 15 77 24v25c0 20-11 29-27 36-16-7-27-16-27-36V24z" fill="#3d8bd8"/><path d="M50 28 63 46 50 74 37 46z" fill="#f06bd8"/><path d="M50 28 63 46H37z" fill="#ffd7f2"/><path d="M28 22l2.4 5.4 5.4 2.4-5.4 2.4L28 38l-2.4-5.8-5.4-2.4 5.4-2.4z" fill="#fff"/></svg>',
    orbDeep: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="nsA6" cx="35%" cy="30%" r="85%"><stop offset="0%" stop-color="#cfd8ff"/><stop offset="40%" stop-color="#7d6fe8"/><stop offset="75%" stop-color="#4b2fa6"/><stop offset="100%" stop-color="#241257"/></radialGradient></defs><circle cx="50" cy="50" r="34" fill="url(#nsA6)"/><path d="M30 62c10-4 12-14 22-16" stroke="#9be8ff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/><circle cx="38" cy="36" r="8" fill="#ffffff" opacity="0.75"/><path d="M64 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffe37a"/><circle cx="62" cy="64" r="2.6" fill="#ffb3cd"/></svg>'
  };
  var TICK = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M14 55 40 80 88 22" fill="none" stroke="#fff3cf" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 55 40 80 88 22" fill="none" stroke="#f7b731" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/></svg>';

  function $(id) { return document.getElementById(id); }
  function readXp() {
    var v = parseInt(localStorage.getItem(XP_KEY) || '0', 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function levelFromXp(xp) { return Math.floor(xp / 100) + 1; }
  function unlockedCount(xp) {
    var n = 0;
    ANIMS.forEach(function (a) { if (a.xp <= xp) n++; });
    return n;
  }
  function loadToggles() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }
  function saveToggles() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(toggles)); } catch (e) {}
  }

  var toggles = loadToggles();
  var selectedId = 'idle';
  var currentTab = 'animations';

  function isOn(anim) { return toggles[anim.id] !== false; }

  /* ---------- Build: locked future cards (View 1) ---------- */
  /* Each locked card shows a dummy MYSTERY character until the real
     future art arrives: Nooki's rig (layer order body → eyerish →
     head, same as everywhere else) darkened into a silhouette inside
     a dreamy tinted scene — gradient backdrop, glowing halo, pedestal
     shadow and sparkles, styled in nooki-studio-theme.css. */
  var MYSTERY_HUES = ['ns-hue-rose', 'ns-hue-lav', 'ns-hue-mint'];
  function buildLockedCards() {
    var wrap = $('nsCards');
    if (!wrap) return;
    LOCKED_XP.forEach(function (need, idx) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'ns-card ns-card-locked';
      card.setAttribute('data-unlock', String(need));
      card.innerHTML =
        '<span class="ns-card-tag ns-tag-locked">LOCKED</span>' +
        '<span class="ns-card-art ns-art-mystery ' + MYSTERY_HUES[idx % MYSTERY_HUES.length] + '">' +
          '<span class="ns-halo"></span>' +
          '<span class="ns-pedestal"></span>' +
          '<span class="ns-silhouette' + (idx === 1 ? ' ns-flip' : '') + '">' +
            '<img src="assets/base-rig/muse_girl_body.png" alt="" draggable="false" />' +
            '<img src="assets/base-rig/muse_girl_eyerish.png" alt="" draggable="false" />' +
            '<img src="assets/base-rig/muse_girl_head.png" alt="" draggable="false" />' +
          '</span>' +
          '<span class="ns-sparkles"><i class="sp1">✦</i><i class="sp2">✦</i><i class="sp3">✧</i><i class="sp4">✦</i><i class="sp5">✧</i></span>' +
          '<span class="ns-lock-badge">🔒</span>' +
        '</span>' +
        '<span class="ns-lock-info"><span class="ns-lock-title">🔒 Unlock at ' + need + ' XP</span>' +
        '<span class="ns-bar"><span class="ns-bar-fill ns-lock-fill" style="width:0%"></span></span>' +
        '<span class="ns-lock-sub"></span></span>' +
        '<span class="ns-card-namebar"><span class="ns-card-name">???</span><span class="ns-name-stripes"><i></i><i></i></span></span>' +
        '<span class="ns-card-strip"><span class="ns-strip-lv">◆ Locked</span><span class="ns-strip-xp">' + need + ' XP</span></span>';
      card.addEventListener('click', function () {
        card.classList.remove('ns-shake');
        void card.offsetWidth;
        card.classList.add('ns-shake');
      });
      wrap.appendChild(card);
    });
  }

  /* ---------- Build: hexagon tiles (Animations tab) ---------- */
  function buildHexGrid() {
    var grid = $('nsHexGrid');
    if (!grid) return;
    var rows = [document.createElement('div'), document.createElement('div')];
    rows[0].className = 'ns-hex-row row-1';
    rows[1].className = 'ns-hex-row row-2';
    ANIMS.forEach(function (anim, i) {
      var cell = document.createElement('div');
      cell.className = 'ns-hex-cell';
      var frame = document.createElement('div');
      frame.className = 'ns-hex-frame';
      frame.setAttribute('data-anim-frame', anim.id);
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'ns-hex-tile';
      tile.setAttribute('data-anim', anim.id);
      tile.setAttribute('aria-label', anim.name + ' — unlocks at ' + anim.xp + ' XP');
      tile.innerHTML =
        '<span class="ns-hex-art">' + ART[anim.art] + '</span>' +
        '<span class="ns-hex-tick ns-hide">' + TICK + '</span>' +
        '<span class="ns-hex-lock ns-hide">🔒</span>' +
        '<span class="ns-hex-num">' + anim.xp + '</span>';
      tile.addEventListener('click', function () { selectAnim(anim.id, true); });
      frame.appendChild(tile);
      cell.appendChild(frame);
      var label = document.createElement('span');
      label.className = 'ns-hex-label';
      label.textContent = anim.name;
      cell.appendChild(label);
      if (i < ANIMS.length - 1) {
        var link = document.createElement('span');
        link.className = 'ns-hex-link';
        cell.appendChild(link);
      }
      rows[i < 3 ? 0 : 1].appendChild(cell);
    });
    grid.appendChild(rows[0]);
    grid.appendChild(rows[1]);
  }

  /* ---------- Rendering ---------- */
  function starsHtml(lit, total) {
    var out = '';
    for (var i = 0; i < total; i++) out += '<span class="' + (i < lit ? 'lit' : '') + '">★</span>';
    return out;
  }
  function heartsHtml(lit, total) {
    var out = '';
    for (var i = 0; i < total; i++) out += '<span class="' + (i < lit ? 'lit' : '') + '">♥</span>';
    return out;
  }

  function renderStrip() {
    var xp = readXp();
    var anim = null;
    ANIMS.forEach(function (a) { if (a.id === selectedId) anim = a; });
    if (!anim) return;
    var unlocked = anim.xp <= xp;
    $('nsStripName').textContent = anim.name;
    $('nsStripFrames').textContent = 'Loop · ' + anim.frames + ' frames';
    $('nsStripDesc').textContent = anim.desc;
    var lockBox = $('nsStripLock');
    var switchWrap = $('nsStripSwitchWrap');
    if (unlocked) {
      lockBox.classList.add('ns-hide');
      switchWrap.classList.remove('ns-hide');
      var sw = $('nsStripSwitch');
      sw.checked = isOn(anim);
      $('nsStripSwitchText').textContent = sw.checked ? 'On' : 'Off';
    } else {
      switchWrap.classList.add('ns-hide');
      lockBox.classList.remove('ns-hide');
      $('nsStripLockText').textContent = '🔒 Locked · Unlocks at ' + anim.xp + ' XP';
      $('nsStripLockFill').style.width = Math.min(100, Math.round((xp / anim.xp) * 100)) + '%';
      $('nsStripLockXp').textContent = xp + ' / ' + anim.xp + ' XP';
    }
  }

  function selectAnim(id, refreshStrip) {
    selectedId = id;
    var frames = document.querySelectorAll('[data-anim-frame]');
    Array.prototype.forEach.call(frames, function (f) {
      f.classList.toggle('selected', f.getAttribute('data-anim-frame') === id);
    });
    if (refreshStrip) renderStrip();
  }

  function refreshXp() {
    var xp = readXp();
    var lv = levelFromXp(xp);
    var unlocked = unlockedCount(xp);

    ['nsLvVal', 'nsLvVal2'].forEach(function (id) { var el = $(id); if (el) el.textContent = String(lv); });
    ['nsXpVal', 'nsXpVal2'].forEach(function (id) { var el = $(id); if (el) el.textContent = String(xp); });

    var cardLv = document.querySelector('#nsCardMain .ns-card-lv');
    if (cardLv) cardLv.textContent = String(lv);
    var cardXp = document.querySelector('#nsCardMain .ns-card-xp');
    if (cardXp) cardXp.textContent = String(xp);

    Array.prototype.forEach.call(document.querySelectorAll('.ns-card-locked'), function (card) {
      var need = parseInt(card.getAttribute('data-unlock') || '0', 10);
      var fill = card.querySelector('.ns-lock-fill');
      if (fill) fill.style.width = Math.min(100, Math.round((xp / need) * 100)) + '%';
      var sub = card.querySelector('.ns-lock-sub');
      if (sub) sub.textContent = xp + ' / ' + need + ' XP · ' + Math.max(0, need - xp) + ' XP to go';
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-anim]'), function (tile) {
      var id = tile.getAttribute('data-anim');
      var anim = null;
      ANIMS.forEach(function (a) { if (a.id === id) anim = a; });
      if (!anim) return;
      var isUnlocked = anim.xp <= xp;
      tile.classList.toggle('locked', !isUnlocked);
      var tick = tile.querySelector('.ns-hex-tick');
      if (tick) tick.classList.toggle('ns-hide', !isUnlocked);
      var lock = tile.querySelector('.ns-hex-lock');
      if (lock) lock.classList.toggle('ns-hide', isUnlocked);
    });

    var heroLv = document.querySelector('.ns-hero-lv-val');
    if (heroLv) heroLv.textContent = String(lv);
    var slotLv = document.querySelector('.ns-slot-lv');
    if (slotLv) slotLv.textContent = String(lv);
    var intoLevel = xp % 100;
    $('nsStatXpText').textContent = intoLevel + ' / 100 XP to next level';
    $('nsStatXpFill').style.width = intoLevel + '%';
    $('nsStatAnimText').textContent = unlocked + ' / ' + ANIMS.length;
    $('nsStatAnimFill').style.width = Math.round((unlocked / ANIMS.length) * 100) + '%';
    $('nsUnderStars').innerHTML = starsHtml(unlocked, ANIMS.length);
    $('nsHeroStars').innerHTML = starsHtml(unlocked, ANIMS.length);

    /* Details pane extras: bond hearts, set completion, next unlock */
    var bondHearts = $('nsBondHearts');
    if (bondHearts) bondHearts.innerHTML = heartsHtml(Math.min(lv, 5), 5);
    var bondText = $('nsBondText');
    if (bondText) bondText.textContent = 'Bond Lv. ' + lv;
    var setPct = Math.round((unlocked / ANIMS.length) * 100);
    var setText = $('nsStatSetText');
    if (setText) setText.textContent = setPct + '% complete';
    var setFill = $('nsStatSetFill');
    if (setFill) setFill.style.width = setPct + '%';
    var nextEl = $('nsNextUnlockText');
    if (nextEl) {
      var next = null;
      ANIMS.forEach(function (a) { if (!next && a.xp > xp) next = a; });
      nextEl.innerHTML = next
        ? '<strong>' + next.name + '</strong> · unlocks at ' + next.xp + ' XP · ' + (next.xp - xp) + ' XP to go'
        : 'All animations unlocked';
    }

    renderStrip();
  }

  /* ---------- Tabs & views ---------- */
  function setTab(tab) {
    currentTab = tab;
    var sheet = $('nsSheet');
    sheet.classList.remove('tab-details', 'tab-animations', 'tab-story');
    sheet.classList.add('tab-' + tab);
    $('nsPaneDetails').classList.toggle('ns-hide', tab !== 'details');
    $('nsPaneAnimations').classList.toggle('ns-hide', tab !== 'animations');
    $('nsPaneStory').classList.toggle('ns-hide', tab !== 'story');
    Array.prototype.forEach.call(document.querySelectorAll('#nsMenu .ns-menu-btn'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-nstab') === tab);
    });
    /* Main title is the character name only, on every tab — the number and
       word spans in the markup stay empty (hidden by CSS while empty);
       per-tab wording lives in each pane's chevron bar instead. */
    $('nsTitleNum').textContent = '';
    $('nsTitleWord').textContent = '';
    if (tab === 'animations') renderStrip();
  }

  function openDetail() {
    refreshXp();
    $('nsViewSelect').classList.add('ns-hide');
    $('nsViewDetail').classList.remove('ns-hide');
    setTab('animations');
  }
  function closeDetail() {
    $('nsViewDetail').classList.add('ns-hide');
    $('nsViewSelect').classList.remove('ns-hide');
    refreshXp();
  }

  /* ---------- Wiring ---------- */
  function init() {
    if (!$('nsStudio')) return;
    buildLockedCards();
    buildHexGrid();

    $('nsCardMain').addEventListener('click', openDetail);
    $('nsBackBtn').addEventListener('click', closeDetail);
    $('nsCloseBtn').addEventListener('click', closeDetail);
    Array.prototype.forEach.call(document.querySelectorAll('#nsMenu .ns-menu-btn'), function (btn) {
      btn.addEventListener('click', function () { setTab(btn.getAttribute('data-nstab')); });
    });
    $('nsStripSwitch').addEventListener('change', function () {
      toggles[selectedId] = this.checked;
      saveToggles();
      $('nsStripSwitchText').textContent = this.checked ? 'On' : 'Off';
    });

    selectAnim('idle', false);
    refreshXp();
    setTab('animations');

    /* Re-read XP whenever the Wardrobe screen becomes active */
    var section = $('tabWardrobe');
    if (section && typeof MutationObserver !== 'undefined') {
      var pending = false;
      var obs = new MutationObserver(function () {
        if (pending) return;
        pending = true;
        setTimeout(function () {
          pending = false;
          if (section.classList.contains('active')) refreshXp();
        }, 60);
      });
      obs.observe(section, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('storage', function (e) {
      if (e.key === XP_KEY) refreshXp();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
