/* ============================================================
   NOOKI GENTLE REMINDERS (added 2026-11-26)

   Reminders for QUESTS and WATER only. Rules:
   - A quest reminds only if the user gave it a time (bell on the quest).
   - Water reminds only if no glass was logged for the chosen interval,
     and stops for the day once the daily goal is reached.
   - Nothing fires inside quiet hours.
   - Style: sound, silent, or Nooki bubble only.
   - Every reminder has Snooze and Done. Only one shows at a time.
   - One master switch turns everything off.
   SCREEN TIME (healthy work), added the same day:
   - Eye rest after 20 minutes of active use, and a break nudge after a
     chosen stretch of continuous use (default 50 minutes).
   - Always gentle: Nooki's speech bubble only, no sound, no card.
   - A small XP thank-you when the user confirms the pause, once per
     reminder. Same quiet hours and master switch.
   Everything is saved on this computer (localStorage). No network.

   Nothing in script.js was changed. To remove the feature, delete the
   two nooki-reminders tags from index.html.

   FUTURE: add more reminder kinds by adding a function to SOURCES
   that returns { id, kind, icon, text } when something is due.
   ============================================================ */
(function () {
  'use strict';

  var isPet = false;
  try {
    isPet = new URLSearchParams(window.location.search).get('window') === 'pet' ||
      window.location.hash.indexOf('pet') !== -1;
  } catch (_) {}

  var LS = window.localStorage;
  var KEY = {
    master: 'nooki_reminders_enabled',     // 'false' = everything off
    water: 'nooki_water_reminder',         // existing key
    interval: 'nooki_water_interval',      // existing key, minutes
    quiet: 'nooki_quiet_hours',            // existing key
    quietStart: 'nooki_quiet_start',       // 'HH:MM'
    quietEnd: 'nooki_quiet_end',           // 'HH:MM'
    style: 'nooki_reminder_style',         // 'sound' | 'silent' | 'bubble'
    snooze: 'nooki_reminder_snooze',       // minutes
    eye: 'nooki_eye_rest',                 // 'false' = off
    eyeMin: 'nooki_eye_minutes',           // minutes of active use
    brk: 'nooki_break_nudge',              // 'false' = off
    brkMin: 'nooki_break_minutes',         // minutes of continuous use
    activity: 'nooki_activity_at',         // last time the user moved or typed (shared by both windows)
    runtime: 'nooki_reminder_runtime',     // small bookkeeping object
    now: 'nooki_reminder_now',             // the reminder on screen (shared with the pet window)
    action: 'nooki_reminder_action'        // Snooze / Done pressed in the pet window
  };
  var DEFAULTS = { interval: 90, quietStart: '22:00', quietEnd: '08:00', style: 'sound', snooze: 10, eyeMin: 20, brkMin: 50 };
  var PAUSE_XP = 2;               // small thank-you for confirming an eye rest or a break
  var ACTIVE_GAP_MS = 120000;     // no mouse or keys for this long = not using the computer
  var BREAK_RESET_MS = 300000;    // away this long = the user already took a break
  var TICK_MS = 20000;            // how often we look
  var TASK_GRACE_MIN = 30;        // a quest reminder older than this is skipped, not fired late
  var AUTO_HIDE_MS = 120000;      // an ignored reminder goes away quietly

  /* ---------- settings ---------- */
  function get(k) { try { return LS.getItem(k); } catch (_) { return null; } }
  function set(k, v) { try { LS.setItem(k, String(v)); } catch (_) {} }
  function del(k) { try { LS.removeItem(k); } catch (_) {} }
  function validTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }

  function settings() {
    var interval = parseInt(get(KEY.interval), 10);
    var snooze = parseInt(get(KEY.snooze), 10);
    var style = get(KEY.style);
    var eyeMin = parseInt(get(KEY.eyeMin), 10), brkMin = parseInt(get(KEY.brkMin), 10);
    return {
      eye: get(KEY.eye) !== 'false',
      eyeMin: eyeMin >= 1 ? eyeMin : DEFAULTS.eyeMin,
      brk: get(KEY.brk) !== 'false',
      brkMin: brkMin >= 1 ? brkMin : DEFAULTS.brkMin,
      master: get(KEY.master) !== 'false',
      water: get(KEY.water) !== 'false',
      interval: interval >= 5 ? interval : DEFAULTS.interval,
      quiet: get(KEY.quiet) !== 'false',
      quietStart: validTime(get(KEY.quietStart)) ? get(KEY.quietStart) : DEFAULTS.quietStart,
      quietEnd: validTime(get(KEY.quietEnd)) ? get(KEY.quietEnd) : DEFAULTS.quietEnd,
      style: (style === 'silent' || style === 'bubble' || style === 'sound') ? style : DEFAULTS.style,
      snooze: snooze >= 1 ? snooze : DEFAULTS.snooze
    };
  }

  /* ---------- small helpers ---------- */
  var api = { _nowFn: function () { return new Date(); } };
  function now() { return api._nowFn(); }
  function dayKey(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function minutesOf(hhmm) { var p = hhmm.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function nowMinutes(d) { return d.getHours() * 60 + d.getMinutes(); }
  function niceTime(hhmm) {
    var m = minutesOf(hhmm), h = Math.floor(m / 60), mm = m % 60;
    var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + ('0' + mm).slice(-2) + ' ' + ap;
  }
  function inQuietHours(d, s) {
    if (!s.quiet) return false;
    var a = minutesOf(s.quietStart), b = minutesOf(s.quietEnd), n = nowMinutes(d);
    if (a === b) return false;
    return a < b ? (n >= a && n < b) : (n >= a || n < b);   // second case crosses midnight
  }
  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function prod() { return window.nookiProductivityState || null; }
  function saveProd() { try { if (typeof window.saveProductivityState === 'function') window.saveProductivityState(); } catch (_) {} }

  function runtime() {
    try { return JSON.parse(get(KEY.runtime) || '{}') || {}; } catch (_) { return {}; }
  }
  function saveRuntime(r) { set(KEY.runtime, JSON.stringify(r)); }

  /* ---------- activity: is the user at the computer? ----------
     Both windows note mouse movement (the app already receives the pointer
     position from anywhere on the screen) and keys typed inside Nooki. */
  var lastActivity = 0, lastActivitySaved = 0;
  function noteActivity() {
    var t = Date.now();
    lastActivity = t;
    if (t - lastActivitySaved > 15000) { lastActivitySaved = t; set(KEY.activity, t); }
  }
  ['mousemove', 'keydown', 'mousedown', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, noteActivity, { passive: true, capture: true });
  });
  try {
    if (window.desktopAPI && typeof window.desktopAPI.onCursorPos === 'function') window.desktopAPI.onCursorPos(noteActivity);
  } catch (_) {}

  /* ============================================================
     PET WINDOW: only mirrors the reminder as a speech bubble.
     The main window decides when a reminder is due.
     ============================================================ */
  function bubbleHtml(rem) {
    return '<span class="nooki-rem-bubble">' + escapeHtml(rem.icon + ' ' + rem.text) +
      '<span class="nooki-rem-bubble-actions">' +
      '<button type="button" class="nooki-rem-btn nooki-rem-btn-soft" data-nooki-rem="snooze">Snooze</button>' +
      '<button type="button" class="nooki-rem-btn" data-nooki-rem="done">' + escapeHtml(rem.doneLabel || 'Done') + '</button>' +
      '</span></span>';
  }
  function showBubble(rem, withButtons) {
    if (typeof window.showBubbleMessage !== 'function') return;
    try {
      if (withButtons) window.showBubbleMessage(bubbleHtml(rem), AUTO_HIDE_MS, true);
      else window.showBubbleMessage(rem.icon + ' ' + rem.text, 9000);
    } catch (_) {}
  }
  function hideBubble() {
    try {
      document.querySelectorAll('.nooki-rem-bubble').forEach(function (el) {
        var holder = el.parentElement;
        if (holder) holder.textContent = '';
      });
      var b1 = document.getElementById('floatingBubble'), b2 = document.getElementById('floatingPetBubble');
      if (b1) b1.classList.remove('show');
      if (b2) b2.classList.remove('show');
      if (typeof window.setCharacterTalking === 'function') window.setCharacterTalking(false);
    } catch (_) {}
  }

  if (isPet) {
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY.now) return;
      if (!e.newValue) { hideBubble(); return; }
      try { showBubble(JSON.parse(e.newValue), true); } catch (_) {}
    });
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-nooki-rem]') : null;
      if (!btn) return;
      e.stopPropagation();
      set(KEY.action, JSON.stringify({ action: btn.getAttribute('data-nooki-rem'), ts: Date.now() }));
      hideBubble();
    }, true);
    return;   // the pet window stops here
  }

  /* ============================================================
     MAIN WINDOW: the reminder engine
     ============================================================ */
  var current = null;         // reminder on screen
  var hideTimer = null;
  var sessionStart = now().getTime();
  var lastGlasses = null;

  /* ----- sources: each returns a reminder that is due, or null ----- */
  function dueTask(d, s, rt) {
    var p = prod();
    if (!p || !Array.isArray(p.tasks)) return null;
    var today = dayKey(d), n = nowMinutes(d);
    for (var i = 0; i < p.tasks.length; i++) {
      var t = p.tasks[i];
      if (!t || t.completed || !validTime(t.remindAt)) continue;
      if (t.remindedOn === today) continue;
      var snoozedUntil = rt.snooze && rt.snooze['task:' + t.id];
      if (snoozedUntil) {
        if (d.getTime() < snoozedUntil) continue;
        return { id: 'task:' + t.id, kind: 'task', icon: '📝', text: 'Quest time: ' + t.text };
      }
      var at = minutesOf(t.remindAt);
      if (n < at) continue;
      if (n - at > TASK_GRACE_MIN) continue;      // too late: stay quiet instead of nagging
      return { id: 'task:' + t.id, kind: 'task', icon: '📝', text: 'Quest time: ' + t.text };
    }
    return null;
  }

  function dueWater(d, s, rt) {
    if (!s.water) return null;
    var p = prod();
    if (!p || !p.hydration) return null;
    var target = p.hydration.targetGlasses || 8;
    var cur = p.hydration.currentGlasses || 0;
    if (cur >= target) return null;               // daily goal reached: no more today
    var base = Math.max(sessionStart, rt.lastWaterAt || 0, rt.lastWaterReminderAt || 0);
    var snoozedUntil = rt.snooze && rt.snooze.water;
    if (snoozedUntil) {
      if (d.getTime() < snoozedUntil) return null;
    } else if (d.getTime() - base < s.interval * 60000) {
      return null;
    }
    return { id: 'water', kind: 'water', icon: '💧', text: 'Time for a glass of water? (' + cur + '/' + target + ' today)' };
  }
  /* ----- screen time: counts minutes of active use ----- */
  var use = { eyeMs: 0, brkMs: 0, lastTick: 0 };
  function lastSeen() {
    if (api._activityAt != null) return api._activityAt;      // tests only
    var shared = parseInt(get(KEY.activity), 10) || 0;
    return Math.max(lastActivity, shared);
  }
  function trackUse(d, s) {
    var t = d.getTime();
    var delta = use.lastTick ? Math.max(0, Math.min(t - use.lastTick, BREAK_RESET_MS)) : 0;
    use.lastTick = t;
    var idle = t - lastSeen();
    if (!s.master || inQuietHours(d, s)) { use.eyeMs = 0; use.brkMs = 0; return; }
    if (idle <= ACTIVE_GAP_MS) { use.eyeMs += delta; use.brkMs += delta; return; }
    use.eyeMs = 0;                                   // eyes already rested while away
    if (idle >= BREAK_RESET_MS) use.brkMs = 0;       // a real break was taken
  }
  function snoozed(d, rt, id) {
    var until = rt.snooze && rt.snooze[id];
    return until ? (d.getTime() < until ? 'wait' : 'due') : '';
  }
  function dueBreak(d, s, rt) {
    if (!s.brk) return null;
    var z = snoozed(d, rt, 'break');
    if (z === 'wait') return null;
    if (z !== 'due' && use.brkMs < s.brkMin * 60000) return null;
    return { id: 'break', kind: 'break', icon: '🌿', bubbleOnly: true, doneLabel: 'I took a break',
      text: 'You have been working for a while. Stand up and stretch for a moment?' };
  }
  function dueEye(d, s, rt) {
    if (!s.eye) return null;
    var z = snoozed(d, rt, 'eye');
    if (z === 'wait') return null;
    if (z !== 'due' && use.eyeMs < s.eyeMin * 60000) return null;
    return { id: 'eye', kind: 'eye', icon: '👀', bubbleOnly: true, doneLabel: 'I rested my eyes',
      text: 'Eye rest: look at something far away for 20 seconds.' };
  }
  var SOURCES = [dueTask, dueWater, dueBreak, dueEye];

  function trackWater(d, rt) {
    var p = prod();
    if (!p || !p.hydration) return false;
    var cur = p.hydration.currentGlasses || 0;
    var changed = false;
    if (lastGlasses !== null && cur > lastGlasses) {
      rt.lastWaterAt = d.getTime();
      if (rt.snooze) delete rt.snooze.water;
      changed = true;
      if (current && current.kind === 'water') close(false);   // she drank: reminder no longer needed
    }
    lastGlasses = cur;
    return changed;
  }

  /* ----- one look at the clock ----- */
  function tick() {
    var d = now(), s = settings(), rt = runtime();
    if (trackWater(d, rt)) saveRuntime(rt);
    trackUse(d, s);
    if (!s.master) { if (current) close(false); return null; }
    if (current && current.kind === 'water' && !s.water) close(true);   // water reminders were just switched off
    if (current && ((current.kind === 'eye' && !s.eye) || (current.kind === 'break' && !s.brk))) close(true);
    if (current) return current;                  // only one at a time
    if (inQuietHours(d, s)) return null;
    for (var i = 0; i < SOURCES.length; i++) {
      var rem = SOURCES[i](d, s, rt);
      if (rem) { show(rem, s); return rem; }
    }
    return null;
  }

  /* ----- showing and closing ----- */
  function card() {
    var el = document.getElementById('nookiReminderCard');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'nookiReminderCard';
    el.className = 'nooki-rem-card';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="nooki-rem-icon" id="nookiReminderIcon"></span>' +
      '<div class="nooki-rem-body"><div class="nooki-rem-title">Gentle reminder</div>' +
      '<div class="nooki-rem-text" id="nookiReminderText"></div></div>' +
      '<div class="nooki-rem-actions">' +
      '<button type="button" class="nooki-rem-btn nooki-rem-btn-soft" data-nooki-rem="snooze" id="nookiReminderSnooze">Snooze</button>' +
      '<button type="button" class="nooki-rem-btn" data-nooki-rem="done" id="nookiReminderDone">Done</button>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function chime() {
    try {
      var st = window.chibiState;
      if (st && st.soundEnabled === false) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!api._ctx) api._ctx = new AC();
      var ctx = api._ctx;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var vol = Math.max(0, Math.min(100, parseInt(get('nooki_sound_volume') || '80', 10))) / 100;
      var t0 = ctx.currentTime;
      [[660, 0], [880, 0.18]].forEach(function (n) {
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n[0], t0 + n[1]);
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.linearRampToValueAtTime(0.12 * vol + 0.0001, t0 + n[1] + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.45);
        osc.start(t0 + n[1]); osc.stop(t0 + n[1] + 0.5);
      });
      api._chimes = (api._chimes || 0) + 1;
    } catch (_) {}
  }

  function show(rem, s) {
    current = rem;
    var snoozeLabel = 'Snooze ' + s.snooze + ' min';
    if (s.style === 'bubble' || rem.bubbleOnly) {      // screen-time reminders are always bubble only, no sound
      showBubble(rem, true);
    } else {
      var el = card();
      document.getElementById('nookiReminderIcon').textContent = rem.icon;
      document.getElementById('nookiReminderText').textContent = rem.text;
      document.getElementById('nookiReminderSnooze').textContent = snoozeLabel;
      el.classList.add('show');
      showBubble(rem, false);
      if (s.style === 'sound') chime();
    }
    set(KEY.now, JSON.stringify({ id: rem.id, kind: rem.kind, icon: rem.icon, text: rem.text, doneLabel: rem.doneLabel, ts: Date.now() }));
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (current && current.id === rem.id) finish('ignored'); }, AUTO_HIDE_MS);
  }

  function close(clearBubble) {
    current = null;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    var el = document.getElementById('nookiReminderCard');
    if (el) el.classList.remove('show');
    if (clearBubble !== false || document.querySelector('.nooki-rem-bubble')) hideBubble();
    del(KEY.now);
  }

  function thankForPause(rem) {
    var p = prod();
    if (!p) return;
    p.exp = Math.max(0, (p.exp || 0) + PAUSE_XP);
    saveProd();
    try { if (typeof window.updateProductivityUI === 'function') window.updateProductivityUI(); } catch (_) {}
    setTimeout(function () {
      try {
        if (!current && typeof window.showBubbleMessage === 'function') {
          window.showBubbleMessage((rem.kind === 'eye' ? 'Thank you for resting your eyes!' : 'Nice break!') + ' +' + PAUSE_XP + ' XP ⭐', 3500);
        }
      } catch (_) {}
    }, 50);
  }

  // how = 'done' | 'snooze' | 'ignored'
  function finish(how) {
    if (!current) return;
    var rem = current, d = now(), s = settings(), rt = runtime();
    rt.snooze = rt.snooze || {};
    if (how === 'snooze') {
      rt.snooze[rem.id] = d.getTime() + s.snooze * 60000;
    } else {
      delete rt.snooze[rem.id];
      if (rem.kind === 'water') {
        rt.lastWaterReminderAt = d.getTime();       // next one only after a full interval
      } else if (rem.kind === 'eye' || rem.kind === 'break') {
        use.eyeMs = 0;                              // counting starts again from zero
        if (rem.kind === 'break') use.brkMs = 0;
        if (how === 'done') thankForPause(rem);     // once per reminder: it is closed right after
      } else if (rem.kind === 'task') {
        var p = prod(), id = rem.id.slice(5);
        var t = p && p.tasks && p.tasks.filter(function (x) { return String(x.id) === id; })[0];
        if (t) { t.remindedOn = dayKey(d); saveProd(); }   // once a day, never repeated
      }
    }
    saveRuntime(rt);
    close(true);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-nooki-rem]') : null;
    if (!btn) return;
    e.stopPropagation();
    finish(btn.getAttribute('data-nooki-rem') === 'snooze' ? 'snooze' : 'done');
  }, true);

  window.addEventListener('storage', function (e) {
    if (e.key !== KEY.action || !e.newValue) return;
    try { finish(JSON.parse(e.newValue).action === 'snooze' ? 'snooze' : 'done'); } catch (_) {}
  });

  /* ============================================================
     QUEST BELL: optional reminder time on each quest
     ============================================================ */
  function sortedTasks() {
    var p = prod();
    if (!p || !Array.isArray(p.tasks)) return [];
    return p.tasks.slice().sort(function (a, b) {       // same order script.js draws them in
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });
  }

  function setTaskTime(id, value) {
    var p = prod();
    var t = p && p.tasks.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!t) return;
    if (validTime(value)) t.remindAt = value; else delete t.remindAt;
    delete t.remindedOn;
    var rt = runtime();
    if (rt.snooze) { delete rt.snooze['task:' + id]; saveRuntime(rt); }
    saveProd();
    if (current && current.id === 'task:' + id) close(true);
    if (typeof window.updateProductivityUI === 'function') window.updateProductivityUI();
  }

  function decorateQuests() {
    var tasks = sortedTasks();
    ['tasksList', 'fullTasksList'].forEach(function (listId) {
      var list = document.getElementById(listId);
      if (!list) return;
      var items = list.querySelectorAll('li.task-item');
      for (var i = 0; i < items.length && i < tasks.length; i++) {
        var li = items[i], t = tasks[i];
        if (li.querySelector('.nooki-rem-bell')) continue;
        var bell = document.createElement('button');
        bell.type = 'button';
        bell.className = 'nooki-rem-bell' + (validTime(t.remindAt) ? ' is-set' : '');
        bell.setAttribute('data-task-id', t.id);
        bell.title = validTime(t.remindAt) ? 'Reminder at ' + niceTime(t.remindAt) + ' (click to change)' : 'Add a reminder time (optional)';
        bell.textContent = validTime(t.remindAt) ? '🔔 ' + niceTime(t.remindAt) : '🔔';
        if (t.completed) bell.disabled = true;
        var delBtn = li.querySelector('.task-delete-btn');
        if (delBtn) li.insertBefore(bell, delBtn); else li.appendChild(bell);
      }
    });
  }

  function closePicker() {
    var old = document.getElementById('nookiReminderPicker');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }
  function openPicker(bell) {
    closePicker();
    var id = bell.getAttribute('data-task-id');
    var p = prod();
    var t = p && p.tasks.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!t) return;
    var box = document.createElement('div');
    box.id = 'nookiReminderPicker';
    box.className = 'nooki-rem-picker';
    box.innerHTML =
      '<label class="nooki-rem-picker-label" for="nookiReminderPickerTime">Remind me at</label>' +
      '<input type="time" id="nookiReminderPickerTime" class="nooki-rem-time" />' +
      '<button type="button" class="nooki-rem-btn" id="nookiReminderPickerSave">Save</button>' +
      '<button type="button" class="nooki-rem-btn nooki-rem-btn-soft" id="nookiReminderPickerClear">No reminder</button>';
    bell.parentNode.appendChild(box);
    var input = box.querySelector('#nookiReminderPickerTime');
    input.value = validTime(t.remindAt) ? t.remindAt : '';
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    box.querySelector('#nookiReminderPickerSave').addEventListener('click', function () {
      if (!validTime(input.value)) { input.focus(); return; }
      setTaskTime(id, input.value);
    });
    box.querySelector('#nookiReminderPickerClear').addEventListener('click', function () { setTaskTime(id, ''); });
    try { input.focus(); } catch (_) {}
  }
  document.addEventListener('click', function (e) {
    var bell = e.target && e.target.closest ? e.target.closest('.nooki-rem-bell') : null;
    if (bell) { e.stopPropagation(); e.preventDefault(); openPicker(bell); return; }
    if (!(e.target && e.target.closest && e.target.closest('#nookiReminderPicker'))) closePicker();
  }, true);

  // redraw the bells every time script.js redraws the quest list
  var originalUpdate = window.updateProductivityUI;
  if (typeof originalUpdate === 'function') {
    window.updateProductivityUI = function () {
      var r = originalUpdate.apply(this, arguments);
      try { decorateQuests(); } catch (_) {}
      return r;
    };
  }

  /* ============================================================
     SETTINGS: extra rows inside the "Sound & Reminders" card
     ============================================================ */
  function row(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  function buildSettings() {
    var waterSwitch = document.getElementById('settingsWaterReminderToggle');
    var intervalSel = document.getElementById('waterIntervalSelect');
    var quietSwitch = document.getElementById('settingsQuietHoursToggle');
    if (!waterSwitch || document.getElementById('settingsRemindersMasterToggle')) return;
    var s = settings();
    var waterRow = waterSwitch.closest('.settings-switch-row');
    var quietRow = quietSwitch ? quietSwitch.closest('.settings-switch-row') : null;
    var cardEl = waterRow.parentNode;

    // 1. master switch, above the water switch
    var master = row(
      '<div class="settings-switch-row nooki-rem-master-row">' +
      '<div class="switch-row-info"><span class="switch-row-label">Reminders</span>' +
      '<span class="switch-row-sub">One switch for all quest and water reminders</span></div>' +
      '<label class="switch-control"><input type="checkbox" id="settingsRemindersMasterToggle" />' +
      '<span class="switch-slider"></span></label></div>');
    cardEl.insertBefore(master, waterRow);
    var group = document.createElement('div');
    group.id = 'nookiReminderOptions';
    group.className = 'nooki-rem-options';
    cardEl.insertBefore(group, waterRow);
    // move the existing rows into the group so the master switch can dim them together
    var intervalRow = intervalSel ? intervalSel.closest('.settings-input-group') : null;
    group.appendChild(waterRow);
    if (intervalRow) group.appendChild(intervalRow);
    if (quietRow) group.appendChild(quietRow);

    // 2. water wording + interval choices (default 90 minutes)
    var waterSub = waterRow.querySelector('.switch-row-sub');
    if (waterSub) waterSub.textContent = 'Only if you have not logged water for a while. Stops at your daily goal.';
    if (intervalSel) {
      var label = intervalRow && intervalRow.querySelector('label');
      if (label) label.textContent = 'Water reminder after';
      var choices = [[30, '30 minutes without water'], [45, '45 minutes without water'], [60, '1 hour without water'],
        [90, '1.5 hours without water'], [120, '2 hours without water'], [180, '3 hours without water']];
      intervalSel.innerHTML = '';
      choices.forEach(function (c) {
        var o = document.createElement('option'); o.value = String(c[0]); o.textContent = c[1]; intervalSel.appendChild(o);
      });
      if (!choices.some(function (c) { return c[0] === s.interval; })) {
        var extra = document.createElement('option'); extra.value = String(s.interval); extra.textContent = s.interval + ' minutes without water';
        intervalSel.appendChild(extra);
      }
      intervalSel.value = String(s.interval);
      intervalSel.addEventListener('change', function () { set(KEY.interval, intervalSel.value); });
    }

    // 3. quiet hours: start and end
    if (quietRow) {
      quietSwitch.checked = s.quiet;
      var times = row(
        '<div class="settings-input-group nooki-rem-quiet-times">' +
        '<label class="switch-row-label" for="quietStartInput">Quiet from</label>' +
        '<div class="nooki-rem-time-pair">' +
        '<input type="time" id="quietStartInput" class="settings-text-field nooki-rem-time" />' +
        '<span class="nooki-rem-to">to</span>' +
        '<input type="time" id="quietEndInput" class="settings-text-field nooki-rem-time" /></div></div>');
      group.appendChild(times);
      var qs = times.querySelector('#quietStartInput'), qe = times.querySelector('#quietEndInput');
      qs.value = s.quietStart; qe.value = s.quietEnd;
      var quietSub = quietRow.querySelector('.switch-row-sub');
      var paint = function () {
        var cur = settings();
        if (quietSub) quietSub.textContent = 'No reminders between ' + niceTime(cur.quietStart) + ' and ' + niceTime(cur.quietEnd);
        times.classList.toggle('is-off', !quietSwitch.checked);
      };
      qs.addEventListener('change', function () { if (validTime(qs.value)) { set(KEY.quietStart, qs.value); paint(); } });
      qe.addEventListener('change', function () { if (validTime(qe.value)) { set(KEY.quietEnd, qe.value); paint(); } });
      quietSwitch.addEventListener('change', function () { set(KEY.quiet, quietSwitch.checked); paint(); });
      paint();
    }

    // 4. style + snooze length
    var style = row(
      '<div class="settings-input-group"><label class="switch-row-label" for="reminderStyleSelect">Reminder style</label>' +
      '<select id="reminderStyleSelect" class="settings-select-field">' +
      '<option value="sound">Soft chime + small card</option>' +
      '<option value="silent">Silent small card</option>' +
      '<option value="bubble">Nooki speech bubble only</option></select></div>');
    group.appendChild(style);
    var styleSel = style.querySelector('select');
    styleSel.value = s.style;
    styleSel.addEventListener('change', function () { set(KEY.style, styleSel.value); });

    var snooze = row(
      '<div class="settings-input-group"><label class="switch-row-label" for="reminderSnoozeSelect">Snooze for</label>' +
      '<select id="reminderSnoozeSelect" class="settings-select-field">' +
      '<option value="5">5 minutes</option><option value="10">10 minutes</option>' +
      '<option value="15">15 minutes</option><option value="30">30 minutes</option></select></div>');
    group.appendChild(snooze);
    var snoozeSel = snooze.querySelector('select');
    snoozeSel.value = String(s.snooze);
    if (snoozeSel.value !== String(s.snooze)) snoozeSel.value = '10';
    snoozeSel.addEventListener('change', function () { set(KEY.snooze, snoozeSel.value); });

    // 5. screen time (healthy work)
    var minuteSelect = function (id, list, value) {
      var html = '<select id="' + id + '" class="settings-select-field nooki-rem-mini-select">';
      if (list.indexOf(value) === -1) list = list.concat([value]).sort(function (a, b) { return a - b; });
      list.forEach(function (m) { html += '<option value="' + m + '"' + (m === value ? ' selected' : '') + '>' + m + ' minutes</option>'; });
      return html + '</select>';
    };
    var healthRows = [
      { sw: 'settingsEyeRestToggle', sel: 'eyeRestMinutesSelect', on: s.eye, val: s.eyeMin, kOn: KEY.eye, kMin: KEY.eyeMin,
        list: [15, 20, 30, 40], label: 'Eye rest', sub: 'Look far away for 20 seconds. Bubble only, no sound.', after: 'After active use of' },
      { sw: 'settingsBreakNudgeToggle', sel: 'breakNudgeMinutesSelect', on: s.brk, val: s.brkMin, kOn: KEY.brk, kMin: KEY.brkMin,
        list: [30, 45, 50, 60, 90, 120], label: 'Break nudge', sub: 'A gentle "stand up and stretch". Bubble only, no sound.', after: 'After working without a break for' }
    ];
    healthRows.forEach(function (h) {
      var sw = row('<div class="settings-switch-row"><div class="switch-row-info"><span class="switch-row-label">' + h.label + '</span>' +
        '<span class="switch-row-sub">' + h.sub + '</span></div><label class="switch-control"><input type="checkbox" id="' + h.sw + '" />' +
        '<span class="switch-slider"></span></label></div>');
      var mins = row('<div class="settings-input-group"><label class="switch-row-label" for="' + h.sel + '">' + h.after + '</label>' +
        minuteSelect(h.sel, h.list, h.val) + '</div>');
      group.appendChild(sw); group.appendChild(mins);
      var box = sw.querySelector('input'), sel = mins.querySelector('select');
      box.checked = h.on;
      mins.classList.toggle('nooki-rem-dim', !h.on);
      box.addEventListener('change', function () { set(h.kOn, box.checked); mins.classList.toggle('nooki-rem-dim', !box.checked); });
      sel.addEventListener('change', function () { set(h.kMin, sel.value); });
    });
    group.appendChild(row('<p class="settings-card-desc nooki-rem-hint">Confirming a pause gives +' + PAUSE_XP + ' XP, once per reminder.</p>'));

    var hint = row('<p class="settings-card-desc nooki-rem-hint">Quest reminders: tap the 🔔 on a quest to give it a time. No time, no reminder.</p>');
    group.appendChild(hint);

    // master switch behaviour
    var masterSwitch = document.getElementById('settingsRemindersMasterToggle');
    masterSwitch.checked = s.master;
    var paintMaster = function () { group.classList.toggle('is-off', !masterSwitch.checked); };
    masterSwitch.addEventListener('change', function () {
      set(KEY.master, masterSwitch.checked);
      paintMaster();
      if (!masterSwitch.checked && current) close(true);
    });
    paintMaster();
  }

  /* ---------- start ---------- */
  function start() {
    try { buildSettings(); } catch (e) { if (window.console) console.warn('Nooki reminders: settings not built', e); }
    try { decorateQuests(); } catch (_) {}
    del(KEY.now);                                 // nothing is on screen at startup
    var p = prod();
    lastGlasses = p && p.hydration ? (p.hydration.currentGlasses || 0) : 0;
    api._timer = setInterval(function () { try { tick(); } catch (_) {} }, TICK_MS);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // small surface for testing and for future reminder kinds
  api.tick = tick;
  api.settings = settings;
  api.current = function () { return current; };
  api.finish = finish;
  api.SOURCES = SOURCES;
  api._resetSession = function () { sessionStart = now().getTime(); use.eyeMs = 0; use.brkMs = 0; use.lastTick = 0; };
  api._use = use;
  window.NookiReminders = api;
})();
