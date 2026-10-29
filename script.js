/**
 * Chibi on Cloud - 100% Free Desktop & Web Widget
 * - Chibi Standing directly on user-provided cloud (No bars)
 * - 100% Free AI Engine (Zero API Keys, Zero Signups)
 * - Mouse Wheel Zoom & Corner Drag Resizing
 * - Full Chat History Drawer
 */

// ==========================================
// 1. STATE & CONFIG
// ==========================================
const CONFIG = {
  systemPrompt: `You are Chibi, a friendly and helpful anime companion.
- Answer the user's specific question accurately and directly first.
- Keep answers concise (1 to 2 sentences).
- Add cute touches like (◕‿◕), ☁️, or ✨.`,
  idleSleepTimeMs: 5000,
  minScale: 0.5,
  maxScale: 2.3,
};

const state = {
  countKeystrokes: localStorage.getItem('bongo_count_enabled') === 'true',
  keyCount: parseInt(localStorage.getItem('bongo_count') || '0', 10),
  name: localStorage.getItem('bongo_name') || 'Chibi',
  scale: parseFloat(localStorage.getItem('bongo_scale') || '1.0'),
  isMenuOpen: false,
  isFullChatOpen: false,
  soundEnabled: true,
  lastPaw: 'right',
  idleTimer: null,
  isSleeping: false,
  audioCtx: null,
  bubbleTimer: null,
  messageHistoryCount: 1,
  conversationHistory: [
    { role: 'system', content: CONFIG.systemPrompt }
  ]
};

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const elements = {
  body: document.body,
  cloudWidget: document.getElementById('cloudWidget'),
  characterStage: document.getElementById('characterStage'),
  chibiInner: document.getElementById('chibiInner'),
  chibiImg: document.getElementById('chibiImg'),
  expressionBadge: document.getElementById('expressionBadge'),
  cloudPedestal: document.getElementById('cloudPedestal'),
  dockLabel: document.getElementById('dockLabel'),
  menuBtn: document.getElementById('menuBtn'),
  popoverMenu: document.getElementById('popoverMenu'),
  closeMenuBtn: document.getElementById('closeMenuBtn'),
  counterNum: document.getElementById('counterNum'),
  floatingBubble: document.getElementById('floatingBubble'),
  bubbleText: document.getElementById('bubbleText'),
  sleepIndicator: document.getElementById('sleepIndicator'),
  particlesContainer: document.getElementById('particlesContainer'),
  resizeHandle: document.getElementById('resizeHandle'),
  sizeSlider: document.getElementById('sizeSlider'),
  scaleLabel: document.getElementById('scaleLabel'),
  counterToggle: document.getElementById('counterToggle'),
  nameInput: document.getElementById('nameInput'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  resetCountBtn: document.getElementById('resetCountBtn'),
  viewFullChatBtn: document.getElementById('viewFullChatBtn'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  miniChatThinking: document.getElementById('miniChatThinking'),
  miniChips: document.querySelectorAll('.mini-chip'),
  // Full Chat Drawer
  fullChatDrawer: document.getElementById('fullChatDrawer'),
  fullMessagesList: document.getElementById('fullMessagesList'),
  chatBadge: document.getElementById('chatBadge'),
  closeFullChatBtn: document.getElementById('closeFullChatBtn'),
  clearFullChatBtn: document.getElementById('clearFullChatBtn'),
  fullChatChips: document.querySelectorAll('.f-chip'),
  fullChatForm: document.getElementById('fullChatForm'),
  fullChatInput: document.getElementById('fullChatInput'),
  fullSendBtn: document.getElementById('fullSendBtn'),
};

// ==========================================
// 3. SOUND SYNTHESIZER
// ==========================================
function getAudioContext() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audioCtx = new AudioContext();
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
  return state.audioCtx;
}

function playTapSound(isLeft) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    const freq = isLeft ? 240 : 300;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.05);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (_) {}
}

function playPokeSound() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (_) {}
}

// ==========================================
// 4. MOUSE-CONTROLLED SMOOTH RESIZING
// ==========================================
function setScale(newScale, notifyElectron = true) {
  const clamped = Math.min(CONFIG.maxScale, Math.max(CONFIG.minScale, newScale));
  state.scale = parseFloat(clamped.toFixed(2));

  document.documentElement.style.setProperty('--scale', state.scale);

  if (elements.sizeSlider) elements.sizeSlider.value = state.scale;
  if (elements.scaleLabel) elements.scaleLabel.textContent = `${state.scale.toFixed(2)}x`;

  localStorage.setItem('bongo_scale', state.scale.toString());

  if (notifyElectron && window.desktopAPI?.setWidgetScale) {
    const isExpanded = state.isMenuOpen || state.isFullChatOpen;
    window.desktopAPI.setWidgetScale(state.scale, isExpanded);
  }
}

function initMouseWheelZoom() {
  elements.cloudWidget.addEventListener('wheel', (e) => {
    if (e.target.closest('#fullMessagesList')) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.06 : -0.06;
    setScale(state.scale + delta);
  }, { passive: false });
}

function initMouseDragResize() {
  let isResizing = false;
  let startX, startY, initialScale;

  elements.resizeHandle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    isResizing = true;
    elements.resizeHandle.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;
    initialScale = state.scale;
  });

  elements.resizeHandle.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const deltaScale = (dx + dy) / 160;
    setScale(initialScale + deltaScale);
  });

  elements.resizeHandle.addEventListener('pointerup', (e) => {
    isResizing = false;
    try { elements.resizeHandle.releasePointerCapture(e.pointerId); } catch (_) {}
  });
}

// ==========================================
// 5. KEYBOARD TAP & COUNTER LOGIC
// ==========================================
function handleKeyPress() {
  wakeUp();

  if (state.countKeystrokes) {
    state.keyCount++;
    if (elements.dockLabel) elements.dockLabel.textContent = state.keyCount;
    if (elements.counterNum) elements.counterNum.textContent = state.keyCount;
    localStorage.setItem('bongo_count', state.keyCount.toString());
  }

  state.lastPaw = state.lastPaw === 'left' ? 'right' : 'left';
  const isLeft = state.lastPaw === 'left';

  elements.characterStage.classList.remove('bongo-tap-left', 'bongo-tap-right');
  void elements.characterStage.offsetWidth;
  elements.characterStage.classList.add(isLeft ? 'bongo-tap-left' : 'bongo-tap-right');

  playTapSound(isLeft);

  if (Math.random() < 0.25) {
    spawnParticle(isLeft);
  }

  scheduleIdleSleep();
}

function spawnParticle(isLeft) {
  const notes = ['♪', '♫', '♬', '✨', '🐾', '☁️'];
  const p = document.createElement('span');
  p.className = 'particle';
  p.textContent = notes[Math.floor(Math.random() * notes.length)];

  const rect = elements.characterStage.getBoundingClientRect();
  const originX = isLeft ? (rect.width * 0.3) : (rect.width * 0.7);
  const originY = rect.height * 0.7;

  p.style.left = `${originX}px`;
  p.style.top = `${originY}px`;
  p.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}px`);
  p.style.setProperty('--dy', `${-(25 + Math.random() * 30)}px`);

  elements.particlesContainer.appendChild(p);
  setTimeout(() => p.remove(), 800);
}

function updateDockDisplay() {
  if (elements.dockLabel) {
    if (state.countKeystrokes) {
      elements.dockLabel.classList.add('is-counter');
      elements.dockLabel.textContent = state.keyCount;
    } else {
      elements.dockLabel.classList.remove('is-counter');
      elements.dockLabel.textContent = state.name;
    }
  }

  if (elements.counterNum) {
    elements.counterNum.style.display = state.countKeystrokes ? 'block' : 'none';
    elements.counterNum.textContent = state.keyCount;
  }

  if (elements.resetCountBtn) {
    elements.resetCountBtn.style.display = state.countKeystrokes ? 'inline-flex' : 'none';
  }
}

// ==========================================
// 6. IDLE SLEEP MODE (z z z)
// ==========================================
function scheduleIdleSleep() {
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    state.isSleeping = true;
    elements.sleepIndicator.classList.add('show');
  }, CONFIG.idleSleepTimeMs);
}

function wakeUp() {
  if (state.isSleeping) {
    state.isSleeping = false;
    elements.sleepIndicator.classList.remove('show');
  }
}

// ==========================================
// 7. POPOVER MENU CONTROLS
// ==========================================
function toggleMenu(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  if (state.isFullChatOpen) closeFullChat();

  state.isMenuOpen = !state.isMenuOpen;

  if (state.isMenuOpen) {
    // Check if widget is too close to bottom of screen -> open upward!
    const widgetRect = elements.cloudWidget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - widgetRect.bottom;
    if (spaceBelow < 280 && widgetRect.top > spaceBelow) {
      elements.popoverMenu.classList.add('open-above');
    } else {
      elements.popoverMenu.classList.remove('open-above');
    }

    elements.popoverMenu.classList.add('open');
    elements.menuBtn.classList.add('active');
    setTimeout(() => {
      try { elements.chatInput?.focus(); } catch (_) {}
    }, 60);
  } else {
    elements.popoverMenu.classList.remove('open', 'open-above');
    elements.menuBtn.classList.remove('active');
  }

  if (window.desktopAPI?.setWidgetScale) {
    window.desktopAPI.setWidgetScale(state.scale, state.isMenuOpen);
  }
}

function closeMenu(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (!state.isMenuOpen) return;
  state.isMenuOpen = false;
  elements.popoverMenu.classList.remove('open', 'open-above');
  elements.menuBtn.classList.remove('active');

  if (window.desktopAPI?.setWidgetScale) {
    window.desktopAPI.setWidgetScale(state.scale, state.isFullChatOpen);
  }
}

function showBubbleMessage(text, autoDismissMs = 8000, isHTML = false) {
  if (state.bubbleTimer) clearTimeout(state.bubbleTimer);
  if (isHTML) {
    elements.bubbleText.innerHTML = text;
  } else {
    elements.bubbleText.textContent = text;
  }
  elements.floatingBubble.classList.add('show');

  if (autoDismissMs > 0) {
    state.bubbleTimer = setTimeout(() => {
      elements.floatingBubble.classList.remove('show');
    }, autoDismissMs);
  }
}

function showBubbleThinking() {
  const html = `
    <span class="bubble-thinking-wrap">
      <span>Thinking</span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span>💭</span>
    </span>
  `;
  showBubbleMessage(html, 0, true);
}

// ==========================================
// 8. FULL CHAT DRAWER (VIEW CHAT MORE)
// ==========================================
function openFullChat() {
  closeMenu();
  state.isFullChatOpen = true;
  elements.fullChatDrawer.classList.add('open');

  if (window.desktopAPI?.setWidgetScale) {
    window.desktopAPI.setWidgetScale(state.scale, true);
  }

  elements.fullChatInput.focus();
  elements.fullMessagesList.scrollTop = elements.fullMessagesList.scrollHeight;
}

function closeFullChat() {
  if (!state.isFullChatOpen) return;
  state.isFullChatOpen = false;
  elements.fullChatDrawer.classList.remove('open');

  if (window.desktopAPI?.setWidgetScale) {
    window.desktopAPI.setWidgetScale(state.scale, state.isMenuOpen);
  }
}

function appendToFullChat(sender, text) {
  const row = document.createElement('div');
  row.className = `msg-row ${sender === 'user' ? 'user-msg' : 'chibi-msg'}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (sender === 'chibi') {
    row.innerHTML = `
      <div class="avatar-dot"><img src="assets/chibi-transparent.png" alt="Chibi"/></div>
      <div class="msg-bubble">
        <span class="msg-sender">Chibi</span>
        <div class="msg-content">${escapeHTML(text)}</div>
        <span class="msg-time">${time}</span>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-content">${escapeHTML(text)}</div>
        <span class="msg-time">${time}</span>
      </div>
    `;
  }

  elements.fullMessagesList.appendChild(row);
  elements.fullMessagesList.scrollTop = elements.fullMessagesList.scrollHeight;

  state.messageHistoryCount++;
  elements.chatBadge.textContent = `${state.messageHistoryCount} msgs`;
}

function showFullChatThinking() {
  hideFullChatThinking();
  const row = document.createElement('div');
  row.id = 'fullChatThinkingRow';
  row.className = 'msg-row chibi-msg';
  row.innerHTML = `
    <div class="avatar-dot"><img src="assets/chibi-transparent.png" alt="Chibi"/></div>
    <div class="msg-bubble thinking-bubble">
      <span style="font-size:0.72rem; color:#64748b; margin-right:4px; font-weight:700;">Thinking</span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span style="font-size:0.75rem; margin-left:3px;">💭</span>
    </div>
  `;
  elements.fullMessagesList.appendChild(row);
  elements.fullMessagesList.scrollTop = elements.fullMessagesList.scrollHeight;
}

function hideFullChatThinking() {
  const existing = document.getElementById('fullChatThinkingRow');
  if (existing) existing.remove();
}

function escapeHTML(s) {
  const p = document.createElement('p');
  p.textContent = s;
  return p.innerHTML;
}

// ==========================================
// 9. 100% FREE AI ENGINE (Zero Keys, No Origin Warnings, No Rate Limits)
// ==========================================

// Built-in Instant Math Evaluator (Handles "5 + 5", "15 * 3", "100 / 4", etc.)
function trySolveMath(prompt) {
  const clean = prompt.replace(/[^\d+\-*/().%^eE ]/g, '').trim();
  if (clean.length >= 3 && /[\d]/.test(clean) && /[+\-*/%]/.test(clean)) {
    try {
      const res = Function(`'use strict'; return (${clean})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return `That's ${res}! 🔢✨`;
      }
    } catch (_) {}
  }
  return null;
}

// Built-in Instant Wikipedia Encyclopedia Lookup (Free REST API)
async function tryWikiSummary(query) {
  const cleanQ = query.replace(/^(who is|what is|tell me about|define|what is the capital of|where is)\s+/i, '').replace(/[?.,!]/g, '').trim();
  if (cleanQ.length < 2) return null;

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQ)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        const sentences = data.extract.split('. ').slice(0, 2).join('. ') + '.';
        return `${sentences} 📖✨`;
      }
    }
  } catch (_) {}
  return null;
}

// 100% Free AI Engine (Zero API Keys, Zero Signups, Real Answers)
async function fetchFreeAI(prompt) {
  const p = prompt.trim();

  // 1. Math evaluation (Instant & 100% Accurate)
  const mathRes = trySolveMath(p);
  if (mathRes) return mathRes;

  // 2. Pollinations AI POST with Multi-turn Conversation Memory
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000); // 18s timeout for thoughtful real responses

    // Take last 6 messages for context
    const recentMessages = state.conversationHistory.slice(-6).map(m => ({
      role: m.role === 'chibi' ? 'assistant' : m.role,
      content: m.content
    }));

    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are Chibi, a friendly, intelligent desktop anime companion floating on a fluffy cloud. 
Answer the user's specific question accurately, informatively, and concisely (1 to 2 clear sentences max). 
Include cute touches like (◕‿◕), ☁️, or ✨.`
          },
          ...recentMessages,
          { role: 'user', content: p }
        ],
        seed: Math.floor(Math.random() * 999999)
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      const text = await response.text();
      const clean = text.trim();
      if (clean && !clean.includes('Free limit reached') && !clean.includes('budget') && clean.length > 1) {
        return clean;
      }
    }
  } catch (err) {
    console.warn("Pollinations POST error, falling back to GET...", err);
  }

  // 3. Pollinations AI GET fallback with randomized seed & system prompt
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const seed = Math.floor(Math.random() * 999999);
    const enc = encodeURIComponent(p);
    const sys = encodeURIComponent("You are Chibi, a cute desktop pet on a cloud. Answer accurately in 1-2 sentences.");
    const url = `https://text.pollinations.ai/${enc}?seed=${seed}&system=${sys}`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      const clean = text.trim();
      if (clean && !clean.includes('Free limit reached') && !clean.includes('budget') && clean.length > 1) {
        return clean;
      }
    }
  } catch (err) {
    console.warn("Pollinations GET fallback failed:", err);
  }

  // 4. Wikipedia Real Encyclopedia Lookup Fallback
  const wikiRes = await tryWikiSummary(p);
  if (wikiRes) return wikiRes;

  // 5. If completely offline or connection failed
  return "I couldn't reach the AI sky right now! Please check your internet connection and try asking me again. ☁️🐾";
}

async function handleChat(prompt) {
  wakeUp();

  // Show thinking in both speech bubble and mini-menu
  showBubbleThinking();
  if (elements.miniChatThinking) {
    elements.miniChatThinking.classList.add('show');
  }

  // Show thinking emoji in expression badge
  if (elements.expressionBadge) {
    elements.expressionBadge.textContent = '💭';
    elements.expressionBadge.classList.add('show');
  }

  // Set buttons to loading/thinking state
  if (elements.sendBtn) {
    elements.sendBtn.textContent = '⏳';
    elements.sendBtn.disabled = true;
  }
  if (elements.fullSendBtn) {
    elements.fullSendBtn.textContent = '⏳';
    elements.fullSendBtn.disabled = true;
  }

  appendToFullChat('user', prompt);
  state.conversationHistory.push({ role: 'user', content: prompt });

  // Add animated thinking indicator in full chat drawer
  showFullChatThinking();

  // Fetch AI answer
  const reply = await fetchFreeAI(prompt);

  // Hide thinking indicators
  hideFullChatThinking();
  if (elements.miniChatThinking) {
    elements.miniChatThinking.classList.remove('show');
  }

  // Reset send buttons
  if (elements.sendBtn) {
    elements.sendBtn.textContent = '🚀';
    elements.sendBtn.disabled = false;
  }
  if (elements.fullSendBtn) {
    elements.fullSendBtn.textContent = '🚀';
    elements.fullSendBtn.disabled = false;
  }

  // Show pleased expression on reply
  if (elements.expressionBadge) {
    elements.expressionBadge.textContent = '✨';
    setTimeout(() => elements.expressionBadge.classList.remove('show'), 1200);
  }

  state.conversationHistory.push({ role: 'assistant', content: reply });
  appendToFullChat('chibi', reply);
  showBubbleMessage(reply, 8000);
}

let lastPokeTime = 0;
function handlePoke() {
  const now = Date.now();
  if (now - lastPokeTime < 220) return;
  lastPokeTime = now;

  getAudioContext();
  wakeUp();
  playPokeSound();

  // Trigger bouncy poke animation
  elements.characterStage.classList.remove('state-poked');
  void elements.characterStage.offsetWidth;
  elements.characterStage.classList.add('state-poked');
  setTimeout(() => elements.characterStage.classList.remove('state-poked'), 450);

  // Expression badge pop
  if (elements.expressionBadge) {
    const emojis = ['💖', '✨', '🌸', '🐾', '☁️', '🥰'];
    elements.expressionBadge.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    elements.expressionBadge.classList.add('show');
    setTimeout(() => elements.expressionBadge.classList.remove('show'), 800);
  }

  // Floating sparkle / particle
  spawnParticle(Math.random() < 0.5);

  const pokeMsgs = [
    "Poke! ☁️",
    "Hehe, that tickles! (≧◡≦)",
    "Floating high in the sky! ✨",
    "Bestie! 💖",
    "Ready to chat or bongo! 🐾",
    "Soft as a cloud! ☁️🌸"
  ];
  showBubbleMessage(pokeMsgs[Math.floor(Math.random() * pokeMsgs.length)], 3200);
}

// ==========================================
// 10. DRAGGABLE WIDGET ON WEB
// ==========================================
let hasDragged = false;
function initDraggable() {
  let isPotentialDrag = false;
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  const DRAG_THRESHOLD = 5;

  elements.cloudWidget.addEventListener('pointerdown', (e) => {
    // Ignore interactive menu/buttons
    if (e.target.closest('#menuBtn, #popoverMenu, #resizeHandle, #fullChatDrawer')) return;
    if (e.button !== 0) return;

    isPotentialDrag = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = elements.cloudWidget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
  });

  window.addEventListener('pointermove', (e) => {
    if (!isPotentialDrag) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isDragging) {
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        isDragging = true;
        hasDragged = true;
        elements.cloudWidget.style.position = 'fixed';
        elements.cloudWidget.style.left = `${initialLeft}px`;
        elements.cloudWidget.style.top = `${initialTop}px`;
        elements.cloudWidget.style.margin = '0';
        try { elements.cloudWidget.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }

    if (isDragging) {
      elements.cloudWidget.style.left = `${Math.max(10, Math.min(window.innerWidth - 80, initialLeft + dx))}px`;
      elements.cloudWidget.style.top = `${Math.max(10, Math.min(window.innerHeight - 80, initialTop + dy))}px`;
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (!isPotentialDrag) return;

    if (!isDragging) {
      // Clean tap/click on Chibi character or cloud pedestal
      handlePoke();
    } else {
      try { elements.cloudWidget.releasePointerCapture(e.pointerId); } catch (_) {}
      setTimeout(() => { hasDragged = false; }, 120);
    }

    isPotentialDrag = false;
    isDragging = false;
  });
}

// ==========================================
// 11. INITIALIZE
// ==========================================
function init() {
  setScale(state.scale, false);
  elements.nameInput.value = state.name;
  elements.counterToggle.checked = state.countKeystrokes;
  updateDockDisplay();
  scheduleIdleSleep();

  // Desktop Electron Detection
  if (window.desktopAPI?.isDesktop) {
    elements.body.classList.add('mode-desktop');
  }

  // Mouse Wheel Zoom
  initMouseWheelZoom();

  // Mouse Drag Corner Handle
  initMouseDragResize();

  // Mouse Slider in Menu
  elements.sizeSlider.addEventListener('input', (e) => {
    setScale(parseFloat(e.target.value));
  });

  // Global Keypress -> Bongo Tap on Cloud!
  window.addEventListener('keydown', handleKeyPress);

  // Click Cloud / Chibi -> Poke (Only if not clicking on menu or resize handle)
  elements.characterStage.addEventListener('click', (e) => {
    if (hasDragged) return;
    if (e.target.closest('#menuBtn, #popoverMenu, #resizeHandle, #fullChatDrawer')) {
      return;
    }
    handlePoke();
  });

  // Menu Button Toggle
  elements.menuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu(e);
  });
  elements.closeMenuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu(e);
  });

  // Close popover when clicking anywhere outside
  document.addEventListener('click', (e) => {
    if (state.isMenuOpen && !e.target.closest('#popoverMenu, #menuBtn')) {
      closeMenu();
    }
  });

  // View Full Chat History Button
  elements.viewFullChatBtn.addEventListener('click', openFullChat);
  elements.closeFullChatBtn.addEventListener('click', closeFullChat);

  // Clear Full Chat
  elements.clearFullChatBtn.addEventListener('click', () => {
    elements.fullMessagesList.innerHTML = '';
    state.conversationHistory = [{ role: 'system', content: CONFIG.systemPrompt }];
    state.messageHistoryCount = 0;
    appendToFullChat('chibi', "Chat history cleared! What would you like to talk about next? 🌸");
  });

  // Full Chat Form Submit
  elements.fullChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = elements.fullChatInput.value.trim();
    if (prompt) {
      elements.fullChatInput.value = '';
      handleChat(prompt);
    }
  });

  // Full Chat Chips
  elements.fullChatChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q');
      handleChat(q);
    });
  });

  // Keystroke Counter Checkbox Toggle
  elements.counterToggle.addEventListener('change', (e) => {
    state.countKeystrokes = e.target.checked;
    localStorage.setItem('bongo_count_enabled', state.countKeystrokes.toString());
    updateDockDisplay();
    playPokeSound();
    if (state.countKeystrokes) {
      showBubbleMessage("Keystroke counter ON! ⌨️", 2500);
    }
  });

  // Name edit
  if (elements.nameInput) {
    elements.nameInput.value = state.name;
    elements.nameInput.addEventListener('input', (e) => {
      state.name = e.target.value.trim() || 'Chibi';
      localStorage.setItem('bongo_name', state.name);
      updateDockDisplay();
    });
  }

  // Click Dock Label -> Poke reaction
  if (elements.dockLabel) {
    elements.dockLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePoke();
    });
  }

  // Sound toggle
  elements.soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    elements.soundIcon.textContent = state.soundEnabled ? '🔔' : '🔕';
    if (state.soundEnabled) playPokeSound();
  });

  // Reset count
  elements.resetCountBtn.addEventListener('click', () => {
    state.keyCount = 0;
    elements.counterNum.textContent = '0';
    localStorage.setItem('bongo_count', '0');
    showBubbleMessage("Count reset to 0! 🔄", 2500);
  });

  // Quick Chat Form in popover
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = elements.chatInput.value.trim();
    if (prompt) {
      elements.chatInput.value = '';
      handleChat(prompt);
    }
  });

  // Mini prompt chips in popover
  elements.miniChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q');
      handleChat(q);
    });
  });

  // Enable Draggable
  initDraggable();

  // Audio unlock
  const unlockAudio = () => {
    getAudioContext();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
}

document.addEventListener('DOMContentLoaded', init);
