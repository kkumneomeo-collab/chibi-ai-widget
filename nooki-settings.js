/*
 * Nooki Settings — merged top tabs (nooki-settings.js)
 * -----------------------------------------------------
 * The user asked for the Settings tabs to be SMALLER, all in
 * ONE row on top, and more organised — with categories added
 * together ("two together or three together") instead of
 * seven big tabs wrapping into rows. So the seven settings
 * cards are grouped into FIVE tabs:
 *
 *   🐾 Companion & Modules — Companion + Dashboard Modules
 *   🔔 Sound & Reminders   — Sound & Reminders
 *   🎯 Daily Goals         — Daily Goals
 *   📱 Devices & Data      — Trusted Devices + App & Data
 *   ✨ What's New          — the What's New card
 *
 * A merged tab's panel shows its cards together (side by
 * side on wide windows, stacked when narrow — styled by
 * nooki-settings-theme.css).
 *
 * How it works, safely:
 *   - Everything is validated BEFORE the DOM is touched:
 *     #tabSettings, .settings-cards-grid, the #nsSettingsTabs
 *     mount, and at least 2 .settings-card elements, each
 *     with a .card-title. Cards are matched to groups by
 *     their .card-title text. Any card that matches no group
 *     gets its OWN extra tab at the end — no card can ever
 *     be lost. If fewer than 2 tabs can be formed, nothing
 *     changes at all.
 *   - Each existing card is then MOVED (appendChild — never
 *     cloned, never copied via markup strings) into a panel
 *     element created here, so every card and control keeps
 *     its node identity, id, value/state and listeners.
 *   - The first tab is active by default; clicking a tab
 *     activates it and shows only its panel.
 *   - Fail-safe: the whole init is wrapped in try/catch. If
 *     the move throws midway, all cards are rolled back into
 *     the grid in their original order and the tab bar and
 *     panels are removed, leaving Settings exactly as before.
 *
 * No app state is read or written, no storage is touched, and
 * no toast/popup is ever shown.
 */
(function () {
  'use strict';

  /* Group definitions, in tab order. Cards are matched by
     their normalised .card-title text (or the What's New
     card's class). */
  var GROUPS = [
    { label: 'Companion & Modules', icon: '🐾', titles: ['Companion', 'Dashboard Modules'] },
    { label: 'Sound & Reminders',   icon: '🔔', titles: ['Sound & Reminders'] },
    { label: 'Daily Goals',         icon: '🎯', titles: ['Daily Goals'] },
    { label: 'Devices & Data',      icon: '📱', titles: ['Trusted Devices', 'App & Data'] },
    { label: "What's New",          icon: '✨', titles: [], whatsNew: true }
  ];

  function normalise(text) {
    return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function init() {
    var settings = document.getElementById('tabSettings');
    if (!settings) return;

    var grid = settings.querySelector('.settings-cards-grid');
    if (!grid) return;

    var mount = settings.querySelector('#nsSettingsTabs');
    if (!mount) return;
    if (mount.getAttribute('data-ns-ready') === '1') return; // already built

    /* ---- Collect the existing top-level settings cards, in order ---- */
    var cards = [];
    for (var i = 0; i < grid.children.length; i++) {
      var child = grid.children[i];
      if (child.classList && child.classList.contains('settings-card')) {
        cards.push(child);
      }
    }
    if (cards.length < 2) return; // unexpected structure — fail safe

    /* ---- Validate + read titles/icons BEFORE touching the DOM ---- */
    var infos = [];
    for (var j = 0; j < cards.length; j++) {
      var card = cards[j];
      var titleEl = card.querySelector('.card-title');
      if (!titleEl) return; // a card without a title — fail safe, change nothing
      var title = (titleEl.textContent || '').replace(/\s+/g, ' ').trim();
      if (!title) return;
      var iconEl = card.querySelector('.card-icon-pill');
      var icon = iconEl ? (iconEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (!icon) icon = '◆';
      infos.push({
        card: card,
        title: title,
        key: normalise(title),
        icon: icon,
        isWhatsNew: card.classList.contains('ns-whatsnew-card') ||
                    normalise(title).indexOf("what's new") === 0
      });
    }

    /* ---- Plan the tabs: groups first (in GROUPS order), then
       one extra tab per unmatched card, in markup order ---- */
    var used = {};
    var plan = []; // { label, icon, cards: [info, ...] }

    GROUPS.forEach(function (group) {
      var members = [];
      infos.forEach(function (info, idx) {
        if (used[idx]) return;
        var match = group.whatsNew
          ? info.isWhatsNew
          : group.titles.some(function (t) { return normalise(t) === info.key; });
        if (match) { members.push(info); used[idx] = true; }
      });
      if (members.length) {
        plan.push({ label: group.label, icon: group.icon, cards: members });
      }
    });

    infos.forEach(function (info, idx) {
      if (used[idx]) return;
      used[idx] = true;
      var label = info.isWhatsNew ? "What's New" : info.title;
      plan.push({ label: label, icon: info.icon, cards: [info] });
    });

    if (plan.length < 2) return; // fewer than 2 tabs — fail safe, change nothing

    /* ---- Build the tab bar and panels (still detached) ---- */
    var bar = document.createElement('div');
    bar.className = 'ns-set-tabbar';
    bar.setAttribute('role', 'tablist');

    var panelsWrap = document.createElement('div');
    panelsWrap.className = 'ns-set-panels';

    var tabs = [];
    var panels = [];

    function activate(index) {
      for (var k = 0; k < plan.length; k++) {
        var on = k === index;
        tabs[k].classList.toggle('ns-active', on);
        tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
        panels[k].classList.toggle('ns-active', on);
      }
    }

    plan.forEach(function (item, index) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'ns-set-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

      var chip = document.createElement('span');
      chip.className = 'ns-set-tab-chip';
      chip.setAttribute('aria-hidden', 'true');
      chip.textContent = item.icon;
      tab.appendChild(chip);

      var text = document.createElement('span');
      text.className = 'ns-set-tab-label';
      text.textContent = item.label;
      tab.appendChild(text);

      tab.addEventListener('click', function () { activate(index); });
      bar.appendChild(tab);
      tabs.push(tab);

      var panel = document.createElement('div');
      panel.className = 'ns-set-panel' + (item.cards.length > 1 ? ' ns-set-panel-multi' : '');
      panel.setAttribute('role', 'tabpanel');
      panelsWrap.appendChild(panel);
      panels.push(panel);
    });

    /* ---- Apply: mount the bar, add the panels wrapper, MOVE cards ---- */
    try {
      mount.appendChild(bar);
      grid.appendChild(panelsWrap);
      plan.forEach(function (item, index) {
        item.cards.forEach(function (info) {
          panels[index].appendChild(info.card); // move — identity & listeners kept
        });
      });
      grid.classList.add('ns-settings-tabs-on');
      mount.setAttribute('data-ns-ready', '1');
      activate(0);
    } catch (err) {
      /* Roll back: cards home in original order, our chrome removed,
         Settings exactly as it was before this script ran. */
      try {
        infos.forEach(function (info) { grid.appendChild(info.card); });
        if (panelsWrap.parentNode) panelsWrap.parentNode.removeChild(panelsWrap);
        if (bar.parentNode) bar.parentNode.removeChild(bar);
        grid.classList.remove('ns-settings-tabs-on');
        mount.removeAttribute('data-ns-ready');
      } catch (ignore) { /* nothing more can be done */ }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    try { init(); } catch (err) { /* fail safe: original Settings untouched */ }
  });
})();
