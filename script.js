/**
 * Chibi on Cloud - Desktop & Web Screen Companion
 * - Chibi Standing directly on user-provided cloud (No bars)
 * - Keystroke Counter & Typing Bongo Sounds
 * - Nooki Productivity (Tasks, Habits & Water Tracker)
 * - Nooki Wardrobe (Custom Outfits, Hats & Emotes)
 * - Mouse Wheel Zoom & Corner Drag Resizing
 */

// ==========================================
// DESKTOP COMPANION BRIDGE (TAURI & ELECTRON)
// Enables native transparent floating window
// ==========================================
if (typeof window !== 'undefined') {
  const isTauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('mode-desktop');
    if (isTauri) {
      document.body.classList.add('is-tauri');
      document.documentElement.classList.add('is-tauri');
    }
  });

  if (isTauri) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke || window.__TAURI__?.invoke;
    window.desktopAPI = {
      isDesktop: true,
      isTauri: true,
      minimizeWindow: () => tauriInvoke?.('minimize_window'),
      closeWindow: () => tauriInvoke?.('close_window'),
      setWidgetScale: (scale, isExpanded) => {
        const w = isExpanded ? Math.max(390, Math.round(390 * scale)) : Math.max(200, Math.round(240 * scale));
        const h = isExpanded ? Math.max(540, Math.round(540 * scale)) : Math.max(260, Math.round(310 * scale));
        tauriInvoke?.('set_window_size', { width: w, height: h });
      }
    };
  }
}

// ==========================================
// 1. STATE & CONFIG
// ==========================================
const CONFIG = {
  idleSleepTimeMs: 180000,
  minScale: 0.5,
  maxScale: 2.3,
};

const isMobileUA = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isAndroidApp = typeof window !== 'undefined' && Boolean(window.AndroidBridge);
const isPetWindow = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('window') === 'pet' || window.location.hash.includes('pet'));
const defaultMode = (isAndroidApp || isMobileUA) ? 'mobile' : 'desktop';
const savedDeviceMode = localStorage.getItem('nooki_device_mode');
const initialMode = savedDeviceMode || defaultMode;

const state = {
  mode: initialMode,
  countKeystrokes: initialMode === 'desktop'
    ? (localStorage.getItem('bongo_count_enabled') !== null ? localStorage.getItem('bongo_count_enabled') === 'true' : true)
    : false,
  keyCount: parseInt(localStorage.getItem('bongo_count') || '0', 10),
  name: localStorage.getItem('bongo_name') || 'Chibi',
  scale: parseFloat(localStorage.getItem('bongo_scale') || '1.0'),
  isMenuOpen: false,
  isProductivityOpen: false,
  isWardrobeOpen: false,
  soundEnabled: true,
  lastPaw: 'right',
  idleTimer: null,
  isSleeping: false,
  audioCtx: null,
  bubbleTimer: null,
  showFloatingPet: localStorage.getItem('nooki_show_floating_pet') !== 'false'
};
if (typeof window !== 'undefined') window.chibiState = state;

// ==========================================
// NOOKI PRODUCTIVITY STATE (Local-First Schema)
// ==========================================
function loadProductivityState() {
  try {
    const raw = localStorage.getItem('nooki_productivity_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version || "1.0.0",
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        streak: {
          currentCount: parsed.streak?.currentCount || 0,
          lastCompletedDate: parsed.streak?.lastCompletedDate || "",
          history: parsed.streak?.history || {},
          shields: parsed.streak?.shields || 0
        },
        hydration: {
          currentGlasses: parsed.hydration?.currentGlasses || 0,
          xpCredited: parsed.hydration?.xpCredited || 0,
          targetGlasses: parsed.hydration?.targetGlasses || 8
        },
        exp: typeof parsed.exp === 'number' ? parsed.exp : (parseInt(localStorage.getItem('nooki_xp') || '0', 10)),
        lastResetDate: parsed.lastResetDate || "",
        modules: parsed.modules || JSON.parse(localStorage.getItem('nooki_prod_modules') || '{"water":true,"streak":true,"tasks":true}')
      };
    }
  } catch (err) {
    console.warn("Failed to parse nooki_productivity_state:", err);
  }

  // Fallback migration
  return {
    version: "1.0.0",
    tasks: JSON.parse(localStorage.getItem('nooki_tasks') || '[]'),
    streak: {
      currentCount: parseInt(localStorage.getItem('nooki_streak') || '0', 10),
      lastCompletedDate: "",
      history: JSON.parse(localStorage.getItem('nooki_streak_days') || '{}'),
      shields: 0
    },
    hydration: {
      currentGlasses: parseInt(localStorage.getItem('nooki_water') || '0', 10),
      targetGlasses: 8
    },
    exp: parseInt(localStorage.getItem('nooki_xp') || '0', 10),
    lastResetDate: localStorage.getItem('nooki_reset_date') || '',
    modules: JSON.parse(localStorage.getItem('nooki_prod_modules') || '{"water":true,"streak":true,"tasks":true}')
  };
}

const nookiProductivityState = loadProductivityState();
if (typeof window !== 'undefined') window.nookiProductivityState = nookiProductivityState;

// ==========================================
// NOOKI WARDROBE & CHARACTER CUSTOMIZATION
// ==========================================
const WARDROBE_CATALOG = {
  male: {
    hats: [
      { id: 'none', name: 'None', icon: '❌', cost: 0, text: '' },
      { id: 'cap_m', name: 'Urban Cap', icon: '🧢', cost: 15, text: '🧢' },
      { id: 'beanie_m', name: 'Street Beanie', icon: '🧶', cost: 20, text: '🧶' },
      { id: 'bandana_m', name: 'Shinobi Band', icon: '🥷', cost: 30, text: '🥷' },
      { id: 'crown_m', name: 'Royal Crown', icon: '👑', cost: 45, text: '👑' },
      { id: 'ninja_m', name: 'Kitsune Mask', icon: '🦊', cost: 60, text: '🦊' },
      { id: 'headphones_m', name: 'DJ Headset', icon: '🎧', cost: 80, text: '🎧' },
      { id: 'halo_m', name: 'Angel Halo', icon: '👼', cost: 100, text: '👼' }
    ],
    hair: [
      { id: 'hair_black', name: 'Raven Black Hair', icon: '🖤', cost: 0, thumb: 'assets/base-rig/hair_black.png', sprite: 'assets/base-rig/hair_black.png' },
      { id: 'hair_default', name: 'Classic Spiky Hair', icon: '🤎', cost: 0, thumb: 'assets/base-rig/hair.png', sprite: 'assets/base-rig/hair.png' },
      { id: 'hair_blue', name: 'Azure Blue Hair', icon: '💙', cost: 15, thumb: 'assets/base-rig/hair_blue.png', sprite: 'assets/base-rig/hair_blue.png' },
      { id: 'hair_red', name: 'Crimson Red Hair', icon: '❤️', cost: 25, thumb: 'assets/base-rig/hair_red.png', sprite: 'assets/base-rig/hair_red.png' }
    ],
    outfits: [
      { id: 'sport_jacket', name: 'Sport Jacket & Shorts', icon: '🥋', cost: 0, badge: '🥋', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } },
      { id: 'shorts_only', name: 'Athletic Shorts', icon: '🩳', cost: 0, badge: '🩳', thumb: 'assets/base-rig/short.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: false, short: true } },
      { id: 'jacket_only', name: 'Jacket Only', icon: '🧥', cost: 15, badge: '🧥', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: false } },
      { id: 'hoodie_m', name: 'Street Hoodie', icon: '👕', cost: 25, badge: '👕', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } },
      { id: 'jacket_m', name: 'Varsity Bomber', icon: '🥋', cost: 40, badge: '🥋', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } },
      { id: 'suit_m', name: 'Cyber Suit', icon: '👔', cost: 60, badge: '👔', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } },
      { id: 'kimono_m', name: 'Samurai Haori', icon: '👘', cost: 80, badge: '👘', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } },
      { id: 'denim_m', name: 'Denim Dungarees', icon: '👖', cost: 80, badge: '👖', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } },
      { id: 'pilot_m', name: 'Flight Aviator', icon: '🛩️', cost: 100, badge: '🛩️', thumb: 'assets/base-rig/sport_jacket.png', sprite: 'assets/base-rig/sport_jacket.png', clothes: { jacket: true, short: true } }
    ]
  },
  female: {
    hats: [
      { id: 'none', name: 'None', icon: '❌', cost: 0, text: '' },
      { id: 'ribbon_f', name: 'Silk Ribbon', icon: '🎀', cost: 0, text: '🎀' },
      { id: 'sakura_f', name: 'Sakura Pin', icon: '🌸', cost: 15, text: '🌸' },
      { id: 'beret_f', name: 'Pastel Beret', icon: '🎨', cost: 30, text: '🎨' },
      { id: 'tiara_f', name: 'Crystal Tiara', icon: '👑', cost: 45, text: '👑' },
      { id: 'cat_ears_f', name: 'Neko Ears', icon: '🐱', cost: 60, text: '🐱' },
      { id: 'witch_f', name: 'Witch Hat', icon: '🧙‍♀️', cost: 80, text: '🧙‍♀️' },
      { id: 'halo_f', name: 'Angel Halo', icon: '👼', cost: 100, text: '👼' }
    ],
    hair: [
      { id: 'hair_twintails', name: 'Cute Twintails', icon: '👧', cost: 0, thumb: 'assets/base-rig/female_hair_twintails.png', sprite: 'assets/base-rig/girl_hair_1.png' },
      { id: 'hair_ponytail', name: 'High Ponytail', icon: '👱‍♀️', cost: 15, thumb: 'assets/base-rig/girl_hair_2.png', sprite: 'assets/base-rig/girl_hair_2.png' },
      { id: 'hair_braid', name: 'Side Braid', icon: '💇‍♀️', cost: 25, thumb: 'assets/base-rig/girl_hair_3.png', sprite: 'assets/base-rig/girl_hair_3.png' },
      { id: 'hair_bob', name: 'Pastel Bob', icon: '👩', cost: 35, thumb: 'assets/base-rig/girl_hair_4.png', sprite: 'assets/base-rig/girl_hair_4.png' }
    ],
    outfits: [
      { id: 'sundress_f', name: 'Summer Sundress', icon: '👗', cost: 0, badge: '👗', thumb: 'assets/base-rig/girl_outfit_sundress.png', sprite: 'assets/base-rig/girl_outfit_sundress.png' },
      { id: 'cardigan_f', name: 'Oversized Knit', icon: '🧥', cost: 0, badge: '🧥', thumb: 'assets/base-rig/female_dress.png', sprite: 'assets/base-rig/female_dress.png' },
      { id: 'dress_f', name: 'Floral Dress', icon: '👗', cost: 20, badge: '👗', thumb: 'assets/base-rig/female_dress.png', sprite: 'assets/base-rig/female_dress.png' },
      { id: 'sailor_f', name: 'Sailor Uniform', icon: '🎀', cost: 40, badge: '🎀', thumb: 'assets/base-rig/girl_outfit_sundress.png', sprite: 'assets/base-rig/girl_outfit_sundress.png' },
      { id: 'yukata_f', name: 'Festival Yukata', icon: '👘', cost: 60, badge: '👘', thumb: 'assets/base-rig/girl_outfit_sundress.png', sprite: 'assets/base-rig/girl_outfit_sundress.png' },
      { id: 'idol_f', name: 'Stage Dress', icon: '🎤', cost: 80, badge: '🎤', thumb: 'assets/base-rig/girl_outfit_sundress.png', sprite: 'assets/base-rig/girl_outfit_sundress.png' },
      { id: 'gothic_f', name: 'Lolita Dress', icon: '🖤', cost: 100, badge: '🖤', thumb: 'assets/base-rig/girl_outfit_sundress.png', sprite: 'assets/base-rig/girl_outfit_sundress.png' }
    ]
  }
};

function loadWardrobeState() {
  try {
    const raw = localStorage.getItem('nooki_wardrobe_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      const gender = (parsed.gender === 'female') ? 'female' : 'male';
      return {
        gender,
        equippedHat: parsed.equippedHat || 'none',
        equippedHair: parsed.equippedHair || (gender === 'female' ? 'hair_twintails' : 'hair_black'),
        equippedOutfit: parsed.equippedOutfit || (gender === 'female' ? 'sundress_f' : 'sport_jacket'),
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        unlockedItems: Array.isArray(parsed.unlockedItems) ? parsed.unlockedItems : ['none', 'hair_black', 'hair_default', 'hair_twintails', 'sport_jacket', 'shorts_only', 'cap_m', 'ribbon_f', 'cardigan_f', 'sundress_f']
      };
    }
  } catch (err) {
    console.warn("Failed to parse nooki_wardrobe_state:", err);
  }
  return {
    gender: 'male',
    equippedHat: 'none',
    equippedHair: 'hair_black',
    equippedOutfit: 'sport_jacket',
    favorites: [],
    unlockedItems: ['none', 'hair_black', 'hair_default', 'hair_twintails', 'sport_jacket', 'shorts_only', 'cap_m', 'ribbon_f', 'cardigan_f', 'sundress_f']
  };
}

let nookiWardrobeState = loadWardrobeState();
if (typeof window !== 'undefined') window.nookiWardrobeState = nookiWardrobeState;

function saveWardrobeState() {
  localStorage.setItem('nooki_wardrobe_state', JSON.stringify(nookiWardrobeState));
}

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const elements = {
  body: document.body,
  cloudWidget: document.getElementById('cloudWidget'),
  characterStage: document.getElementById('characterStage'),
  chibiInner: document.getElementById('chibiInner'),
  chibiRig: document.getElementById('chibiRig'),
  chibiImg: document.getElementById('chibiImg'),
  rigHead: document.getElementById('rigHead'),
  rigIris: document.getElementById('rigIris'),
  rigEyes: document.getElementById('rigEyes'),
  rigEyesClosed: document.getElementById('rigEyesClosed'),
  rigHair: document.getElementById('rigHair'),
  rigJacket: document.getElementById('rigJacket'),
  rigShort: document.getElementById('rigShort'),
  rigBrows: document.getElementById('rigBrows'),
  rigMouth: document.getElementById('rigMouth'),
  handLeft: document.getElementById('handLeft'),
  handRight: document.getElementById('handRight'),
  floatingRigHead: document.getElementById('floatingRigHead'),
  floatingRigIris: document.getElementById('floatingRigIris'),
  floatingRigEyesClosed: document.getElementById('floatingRigEyesClosed'),
  floatingRigHair: document.getElementById('floatingRigHair'),
  floatingRigJacket: document.getElementById('floatingRigJacket'),
  floatingRigShort: document.getElementById('floatingRigShort'),
  expressionBadge: document.getElementById('expressionBadge'),
  cloudPedestal: document.getElementById('cloudPedestal'),
  dockLabel: document.getElementById('dockLabel'),
  menuBtn: document.getElementById('menuBtn'),
  popoverMenu: document.getElementById('popoverMenu'),
  closeMenuBtn: document.getElementById('closeMenuBtn'),
  keystrokeBadge: document.getElementById('keystrokeBadge'),
  counterNum: document.getElementById('counterNum'),
  floatingBubble: document.getElementById('floatingBubble'),
  bubbleText: document.getElementById('bubbleText'),
  sleepIndicator: document.getElementById('sleepIndicator'),
  particlesContainer: document.getElementById('particlesContainer'),
  resizeHandle: document.getElementById('resizeHandle'),
  sizeSlider: document.getElementById('sizeSlider'),
  scaleLabel: document.getElementById('scaleLabel'),
  counterToggle: document.getElementById('counterToggle'),
  counterToggleRow: document.getElementById('counterToggleRow'),
  modeDesktopBtn: document.getElementById('modeDesktopBtn'),
  modeMobileBtn: document.getElementById('modeMobileBtn'),
  mobileActionsRow: document.getElementById('mobileActionsRow'),
  nameInput: document.getElementById('nameInput'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  resetCountBtn: document.getElementById('resetCountBtn'),
  // Nooki Productivity Module Elements
  prodBtn: document.getElementById('prodBtn'),
  viewProductivityBtn: document.getElementById('viewProductivityBtn'),
  productivityDrawer: document.getElementById('productivityDrawer'),
  closeProdBtn: document.getElementById('closeProdBtn'),
  prodXpBadge: document.getElementById('prodXpBadge'),
  sectionWater: document.getElementById('sectionWater'),
  waterCountText: document.getElementById('waterCountText'),
  waterDropletsRow: document.getElementById('waterDropletsRow'),
  waterSubBtn: document.getElementById('waterSubBtn'),
  waterAddBtn: document.getElementById('waterAddBtn'),
  waterResetBtn: document.getElementById('waterResetBtn'),
  sectionStreak: document.getElementById('sectionStreak'),
  streakCountText: document.getElementById('streakCountText'),
  streakDaysRow: document.getElementById('streakDaysRow'),
  shieldBadge: document.getElementById('shieldBadge'),
  buyShieldBtn: document.getElementById('buyShieldBtn'),
  sectionTasks: document.getElementById('sectionTasks'),
  tasksCountText: document.getElementById('tasksCountText'),
  clearDoneTasksBtn: document.getElementById('clearDoneTasksBtn'),
  taskAddForm: document.getElementById('taskAddForm'),
  taskInput: document.getElementById('taskInput'),
  tasksList: document.getElementById('tasksList'),
  fullTaskAddForm: document.getElementById('fullTaskAddForm'),
  fullTaskInput: document.getElementById('fullTaskInput'),
  fullTaskAddBtn: document.getElementById('fullTaskAddBtn'),
  fullTasksList: document.getElementById('fullTasksList'),
  fullTasksCountText: document.getElementById('fullTasksCountText'),
  fullStreakCountText: document.getElementById('fullStreakCountText'),
  fullShieldBadge: document.getElementById('fullShieldBadge'),
  fullStreakDaysRow: document.getElementById('fullStreakDaysRow'),
  fullBuyShieldBtn: document.getElementById('fullBuyShieldBtn'),
  toggleShowWater: document.getElementById('toggleShowWater'),
  toggleShowStreak: document.getElementById('toggleShowStreak'),
  toggleShowTasks: document.getElementById('toggleShowTasks'),
  // Nooki Wardrobe & Character Customization Elements
  chibiHat: document.getElementById('chibiHat'),
  chibiOutfitBadge: document.getElementById('chibiOutfitBadge'),
  genderMaleBtn: document.getElementById('genderMaleBtn'),
  genderFemaleBtn: document.getElementById('genderFemaleBtn'),
  viewWardrobeBtn: document.getElementById('viewWardrobeBtn'),
  wardrobeDrawer: document.getElementById('wardrobeDrawer'),
  closeWardrobeBtn: document.getElementById('closeWardrobeBtn'),
  wardrobeXpBadge: document.getElementById('wardrobeXpBadge'),
  wardrobeTabs: document.getElementById('wardrobeTabs'),
  wardrobeGrid: document.getElementById('wardrobeGrid'),
  // Floating Screen Pet Elements
  floatingScreenPet: document.getElementById('floatingScreenPet'),
  floatingPetBubble: document.getElementById('floatingPetBubble'),
  floatingBubbleText: document.getElementById('floatingBubbleText'),
  floatingPetSleep: document.getElementById('floatingPetSleep'),
  floatingPetTasksBtn: document.getElementById('floatingPetTasksBtn'),
  floatingPetDropBtn: document.getElementById('floatingPetDropBtn'),
  floatingPetSettingsBtn: document.getElementById('floatingPetSettingsBtn'),
  floatingPetStage: document.getElementById('floatingPetStage'),
  floatingChibiInner: document.getElementById('floatingChibiInner'),
  floatingChibiHat: document.getElementById('floatingChibiHat'),
  floatingChibiOutfitBadge: document.getElementById('floatingChibiOutfitBadge'),
  floatingChibiRig: document.getElementById('floatingChibiRig'),
  floatingRigHead: document.getElementById('floatingRigHead'),
  floatingRigIris: document.getElementById('floatingRigIris'),
  floatingRigEyes: document.getElementById('floatingRigEyes'),
  floatingRigEyesClosed: document.getElementById('floatingRigEyesClosed'),
  floatingRigBrows: document.getElementById('floatingRigBrows'),
  floatingRigMouth: document.getElementById('floatingRigMouth'),
  floatingHandLeft: document.getElementById('floatingHandLeft'),
  floatingHandRight: document.getElementById('floatingHandRight'),
  floatingExpressionBadge: document.getElementById('floatingExpressionBadge'),
  floatingCloudPedestal: document.getElementById('floatingCloudPedestal'),
  floatingKeystrokeBadge: document.getElementById('floatingKeystrokeBadge'),
  floatingCounterNum: document.getElementById('floatingCounterNum'),
  floatingPetCloseBtn: document.getElementById('floatingPetCloseBtn'),
  floatingResizeHandle: document.getElementById('floatingResizeHandle'),
  headerTogglePetBtn: document.getElementById('headerTogglePetBtn'),
  headerTogglePetText: document.getElementById('headerTogglePetText'),
  dashTogglePetBtn: document.getElementById('dashTogglePetBtn'),
  dashTogglePetText: document.getElementById('dashTogglePetText'),
  dashHeroTogglePetBtn: document.getElementById('dashHeroTogglePetBtn'),
  toggleFloatingPetCheckbox: document.getElementById('toggleFloatingPetCheckbox')
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

function playWaterSound() {
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
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (_) {}
}

function playPoseSound() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Ascending melodic glockenspiel fashion chord (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.08, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.22);
    });
  } catch (_) {}
}

// ==========================================
// 4. MOUSE-CONTROLLED SMOOTH RESIZING
// ==========================================
function setScale(newScale, notifyElectron = true) {
  const clamped = Math.min(CONFIG.maxScale, Math.max(CONFIG.minScale, newScale));
  state.scale = parseFloat(clamped.toFixed(2));

  // Only scale the floating screen chibi pet! Dashboard chibi remains the same (1.0).
  const floatingPet = elements.floatingScreenPet || document.getElementById('floatingScreenPet');
  if (floatingPet) {
    floatingPet.style.setProperty('--scale', state.scale);
  }

  if (elements.sizeSlider) elements.sizeSlider.value = state.scale;
  if (elements.scaleLabel) elements.scaleLabel.textContent = `${state.scale.toFixed(2)}x`;

  // Sync Quick Scale Preset Buttons in Settings
  document.querySelectorAll('.scale-preset-btn').forEach(btn => {
    const val = parseFloat(btn.getAttribute('data-scale'));
    btn.classList.toggle('active', Math.abs(val - state.scale) < 0.06);
  });

  localStorage.setItem('bongo_scale', state.scale.toString());

  if (notifyElectron && window.desktopAPI?.setWidgetScale) {
    const isExpanded = state.isMenuOpen || state.isProductivityOpen || state.isWardrobeOpen;
    window.desktopAPI.setWidgetScale(state.scale, isExpanded);
  }
}

function initMouseWheelZoom() {
  elements.cloudWidget.addEventListener('wheel', (e) => {
    if (e.target.closest('#productivityDrawer, #wardrobeDrawer, #popoverMenu')) return;
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
function handleKeyPress(e) {
  if (state.mode === 'mobile') return;
  wakeUp();

  if (state.countKeystrokes) {
    state.keyCount++;
    if (elements.counterNum) elements.counterNum.textContent = state.keyCount;
    if (elements.floatingCounterNum) elements.floatingCounterNum.textContent = state.keyCount;
    const dashKey = document.getElementById('dashKeyCount');
    if (dashKey) dashKey.textContent = state.keyCount.toLocaleString();

    if (elements.keystrokeBadge) {
      elements.keystrokeBadge.classList.remove('tap-pulse');
      void elements.keystrokeBadge.offsetWidth;
      elements.keystrokeBadge.classList.add('tap-pulse');
      setTimeout(() => elements.keystrokeBadge?.classList.remove('tap-pulse'), 120);
    }
    if (elements.floatingKeystrokeBadge) {
      elements.floatingKeystrokeBadge.classList.remove('tap-pulse');
      void elements.floatingKeystrokeBadge.offsetWidth;
      elements.floatingKeystrokeBadge.classList.add('tap-pulse');
      setTimeout(() => elements.floatingKeystrokeBadge?.classList.remove('tap-pulse'), 120);
    }
    localStorage.setItem('bongo_count', state.keyCount.toString());
  }

  state.lastPaw = state.lastPaw === 'left' ? 'right' : 'left';
  const isLeft = state.lastPaw === 'left';

  if (elements.characterStage) {
    elements.characterStage.classList.remove('bongo-tap-left', 'bongo-tap-right');
    void elements.characterStage.offsetWidth;
    elements.characterStage.classList.add(isLeft ? 'bongo-tap-left' : 'bongo-tap-right');
  }
  if (elements.floatingPetStage) {
    elements.floatingPetStage.classList.remove('bongo-tap-left', 'bongo-tap-right');
    void elements.floatingPetStage.offsetWidth;
    elements.floatingPetStage.classList.add(isLeft ? 'bongo-tap-left' : 'bongo-tap-right');
  }

  if (typeof animateBongoPaw === 'function') animateBongoPaw(isLeft);

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
  if (state.mode === 'mobile') {
    if (elements.keystrokeBadge) {
      elements.keystrokeBadge.classList.remove('show');
      elements.keystrokeBadge.style.display = 'none';
    }
    if (elements.floatingKeystrokeBadge) {
      elements.floatingKeystrokeBadge.classList.remove('show');
      elements.floatingKeystrokeBadge.style.display = 'none';
    }
    if (elements.resetCountBtn) {
      elements.resetCountBtn.style.display = 'none';
    }
    return;
  }

  // Desktop Mode: Centered directly on fluffy cloud pedestal
  if (elements.keystrokeBadge) {
    elements.keystrokeBadge.style.display = '';
    if (state.countKeystrokes) {
      elements.keystrokeBadge.classList.add('show');
    } else {
      elements.keystrokeBadge.classList.remove('show');
    }
  }

  // Live Keystroke Counter directly ON FLOATING PET CLOUD (Always Visible)
  if (elements.floatingKeystrokeBadge) {
    if (state.countKeystrokes) {
      elements.floatingKeystrokeBadge.classList.add('show');
      elements.floatingKeystrokeBadge.style.display = 'inline-flex';
    } else {
      elements.floatingKeystrokeBadge.classList.remove('show');
      elements.floatingKeystrokeBadge.style.display = 'none';
    }
  }

  if (elements.counterNum) {
    elements.counterNum.textContent = state.keyCount;
  }
  if (elements.floatingCounterNum) {
    elements.floatingCounterNum.textContent = state.keyCount;
  }
  const dashKey = document.getElementById('dashKeyCount');
  if (dashKey) {
    dashKey.textContent = state.keyCount.toLocaleString();
  }

  if (elements.resetCountBtn) {
    elements.resetCountBtn.style.display = state.countKeystrokes ? 'inline-flex' : 'none';
  }
}

function applyMode(mode, save = true) {
  state.mode = mode;
  if (save) {
    localStorage.setItem('nooki_device_mode', mode);
  }

  if (mode === 'mobile') {
    elements.body.classList.remove('mode-desktop');
    elements.body.classList.add('mode-mobile');
    state.countKeystrokes = false;
    if (elements.modeMobileBtn) elements.modeMobileBtn.classList.add('active');
    if (elements.modeDesktopBtn) elements.modeDesktopBtn.classList.remove('active');
    if (elements.counterToggleRow) elements.counterToggleRow.style.display = 'none';
    if (elements.resetCountBtn) elements.resetCountBtn.style.display = 'none';
    if (elements.mobileActionsRow) elements.mobileActionsRow.style.display = 'flex';
  } else {
    // Desktop Mode
    elements.body.classList.remove('mode-mobile');
    elements.body.classList.add('mode-desktop');
    if (elements.modeDesktopBtn) elements.modeDesktopBtn.classList.add('active');
    if (elements.modeMobileBtn) elements.modeMobileBtn.classList.remove('active');
    if (elements.counterToggleRow) elements.counterToggleRow.style.display = 'flex';
    if (elements.mobileActionsRow) elements.mobileActionsRow.style.display = 'none';

    // On desktop, default to true unless user explicitly set to false
    const saved = localStorage.getItem('bongo_count_enabled');
    state.countKeystrokes = saved !== null ? saved === 'true' : true;
    if (elements.counterToggle) elements.counterToggle.checked = state.countKeystrokes;
  }

  const mSetDesk = document.getElementById('mSettingDesktopBtn');
  const mSetMob = document.getElementById('mSettingMobileBtn');
  if (mSetDesk) mSetDesk.classList.toggle('active', mode === 'desktop');
  if (mSetMob) mSetMob.classList.toggle('active', mode === 'mobile');

  updateDockDisplay();
  if (typeof updateMobileAppUI === 'function') {
    updateMobileAppUI();
  }

  // Sync All-in-One Desktop Dashboard
  try {
    const tasks = nookiProductivityState.tasks || [];
    const completedCount = tasks.filter(t => t.completed).length;
    const dashTasks = document.getElementById('dashTasksCount');
    if (dashTasks) dashTasks.textContent = `${completedCount}/${tasks.length}`;

    const streak = nookiProductivityState.streak.currentCount || 0;
    const dashStreak = document.getElementById('dashStreakCount');
    if (dashStreak) dashStreak.textContent = `${streak} Days`;
    const headerStreak = document.getElementById('headerStreakCount');
    if (headerStreak) headerStreak.textContent = `${streak} Days`;

    const water = nookiProductivityState.hydration?.currentGlasses || 0;
    const waterTarget = nookiProductivityState.hydration?.targetGlasses || 8;
    const dashWater = document.getElementById('dashWaterCount');
    if (dashWater) dashWater.textContent = `${Math.min(waterTarget, water)}/${waterTarget}`;

    const dashKey = document.getElementById('dashKeyCount');
    if (dashKey) dashKey.textContent = (state.keyCount || 0).toLocaleString();

    const exp = nookiProductivityState.exp || 0;
    const headerExp = document.getElementById('headerExpCount');
    if (headerExp) headerExp.textContent = `${exp} XP`;

    const dashExpLabel = document.getElementById('dashExpLabel');
    if (dashExpLabel) dashExpLabel.textContent = `${exp} XP (Lv. ${Math.floor(exp / 100) + 1})`;

    const dashExpFill = document.getElementById('dashExpBarFill');
    if (dashExpFill) dashExpFill.style.width = `${Math.min(100, Math.max(8, exp % 100))}%`;

    const compName = state.name || 'Chibi';
    const dashName = document.getElementById('dashCompanionName');
    if (dashName) dashName.textContent = compName;
    const sideName = document.getElementById('sidebarCompanionName');
    if (sideName) sideName.textContent = compName;
    const dashGreeting = document.getElementById('dashGreetingTitle');
    if (dashGreeting) dashGreeting.textContent = `Good Day, ${compName}! ☀️`;

    if (window.NookiDrop?.state?.roomPin) {
      const sPin = document.getElementById('sidebarRoomPin');
      if (sPin) sPin.textContent = window.NookiDrop.state.roomPin;
      const dPin = document.getElementById('nookiDropPin');
      if (dPin) dPin.textContent = window.NookiDrop.state.roomPin;
    }
  } catch (_) {}
}

// ==========================================
// 5B. NOOKI LIVE 2D RIG ANIMATION SYSTEM
// Natural blinking, gaze tracking, lip-sync & paw bongo
// ==========================================
let blinkTimer = null;
let talkTimer = null;
let targetEyeX = 0, targetEyeY = 0;
let currentEyeX = 0, currentEyeY = 0;
let targetHeadRot = 0, currentHeadRot = 0;
let eyeAnimFrame = null;

function triggerBlink() {
  if (state.isSleeping) return;

  const rigs = [elements.chibiRig, elements.floatingChibiRig, document.getElementById('wardrobeChibiRig')].filter(Boolean);
  if (!rigs.length) return;

  rigs.forEach(r => r.classList.add('blink'));
  setTimeout(() => {
    rigs.forEach(r => r.classList.remove('blink'));
    if (Math.random() < 0.22) {
      setTimeout(() => {
        if (!state.isSleeping) {
          rigs.forEach(r => r.classList.add('blink'));
          setTimeout(() => rigs.forEach(r => r.classList.remove('blink')), 110);
        }
      }, 150);
    }
  }, 130);
  scheduleNextBlink();
}

function scheduleNextBlink() {
  if (blinkTimer) clearTimeout(blinkTimer);
  const nextDelay = Math.random() * 3200 + 2200;
  blinkTimer = setTimeout(triggerBlink, nextDelay);
}

// Idle head sway runs all the time, on its own. The mouse moves the EYES only.
const NOOKI_SWAY = { amp: 1.7, speed: 0.0011, amp2: 0.6, speed2: 0.00043 };
let nookiLastPointerWake = 0;

function updateEyeGaze(now) {
  const t = typeof now === 'number' ? now : performance.now();
  currentEyeX += (targetEyeX - currentEyeX) * 0.18;
  currentEyeY += (targetEyeY - currentEyeY) * 0.18;
  currentHeadRot += (targetHeadRot - currentHeadRot) * 0.12;

  const sway = Math.sin(t * NOOKI_SWAY.speed) * NOOKI_SWAY.amp + Math.sin(t * NOOKI_SWAY.speed2 + 1.3) * NOOKI_SWAY.amp2;
  const rot = (sway + currentHeadRot).toFixed(2);
  const headTransform = `rotate(${rot}deg)`;
  // Eyes tilt together with the head, then slide toward the pointer
  const eyeTransform = `rotate(${rot}deg) translate(${currentEyeX.toFixed(2)}px, ${currentEyeY.toFixed(2)}px)`;

  if (!state.isSleeping) {
    [elements.rigIris, elements.floatingRigIris, document.getElementById('wardrobeRigIris')].forEach(el => {
      if (!el) return;
      el.style.transformOrigin = '50% 36%';
      el.style.transform = eyeTransform;
    });
    [
      elements.rigHead, elements.floatingRigHead, document.getElementById('wardrobeRigHead'),
      elements.rigEyesClosed, elements.floatingRigEyesClosed, document.getElementById('wardrobeRigEyesClosed'),
      elements.rigHair, elements.floatingRigHair, document.getElementById('wardrobeRigHair')
    ].forEach(el => { if (el) el.style.transform = headTransform; });
  }

  // Keep running: the idle sway never stops (the browser pauses it by itself when the window is hidden)
  eyeAnimFrame = requestAnimationFrame(updateEyeGaze);
}

function handlePointerMove(e) {
  // Moving the mouse keeps the companion awake
  const nowMs = Date.now();
  if (nowMs - nookiLastPointerWake > 1000) {
    nookiLastPointerWake = nowMs;
    wakeUp();
    scheduleIdleSleep();
  }
  if (state.isSleeping) return;

  const candidates = isPetWindow
    ? [elements.floatingPetStage, elements.characterStage, elements.chibiInner]
    : [elements.characterStage, document.getElementById('wardrobeChibiInner'), elements.floatingPetStage, elements.chibiInner];
  let rect = null;
  for (const el of candidates) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) { rect = r; break; }
  }
  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const centerY = rect ? rect.top + rect.height * 0.38 : window.innerHeight * 0.38;

  const span = Math.max(window.innerWidth / 2, 420);
  const dx = (e.clientX - centerX) / span;
  const dy = (e.clientY - centerY) / span;

  targetEyeX = Math.max(-5.5, Math.min(5.5, dx * 6));
  targetEyeY = Math.max(-3.5, Math.min(3.5, dy * 4));
  targetHeadRot = 0; // eyes only: the head does not chase the mouse

  if (!eyeAnimFrame) {
    eyeAnimFrame = requestAnimationFrame(updateEyeGaze);
  }
}

function autonomousSaccade() {
  if (!state.isSleeping && Math.random() < 0.6) {
    const saccades = [
      { x: 0, y: 0, rot: 0 },
      { x: -3.5, y: -1, rot: -1.2 },
      { x: 3.5, y: -1, rot: 1.2 },
      { x: 0, y: 1.5, rot: 0 }
    ];
    const pick = saccades[Math.floor(Math.random() * saccades.length)];
    targetEyeX = pick.x;
    targetEyeY = pick.y;
    targetHeadRot = pick.rot;
    if (!eyeAnimFrame) eyeAnimFrame = requestAnimationFrame(updateEyeGaze);
  }
  setTimeout(autonomousSaccade, Math.random() * 4500 + 3500);
}

function animateBongoPaw(isLeft) {
  const paw = isLeft ? elements.handLeft : elements.handRight;
  if (paw) {
    paw.classList.remove('tap');
    void paw.offsetWidth;
    paw.classList.add('tap');
    setTimeout(() => paw.classList.remove('tap'), 120);
  }

  const floatPaw = isLeft ? elements.floatingHandLeft : elements.floatingHandRight;
  if (floatPaw) {
    floatPaw.classList.remove('tap');
    void floatPaw.offsetWidth;
    floatPaw.classList.add('tap');
    setTimeout(() => floatPaw.classList.remove('tap'), 120);
  }

  const rot = `translateY(1.5px) rotate(${isLeft ? '-1.5deg' : '1.5deg'})`;
  if (elements.rigBrows) {
    elements.rigBrows.style.transform = rot;
    setTimeout(() => { if (elements.rigBrows) elements.rigBrows.style.transform = ''; }, 140);
  }
  if (elements.floatingRigBrows) {
    elements.floatingRigBrows.style.transform = rot;
    setTimeout(() => { if (elements.floatingRigBrows) elements.floatingRigBrows.style.transform = ''; }, 140);
  }
}

function setCharacterTalking(isTalking) {
  if (elements.chibiRig) elements.chibiRig.classList.toggle('talking', isTalking);
  if (elements.floatingChibiRig) elements.floatingChibiRig.classList.toggle('talking', isTalking);
}

function triggerPokeRig() {
  const rigs = [elements.chibiRig, elements.floatingChibiRig, document.getElementById('wardrobeChibiRig')].filter(Boolean);
  rigs.forEach(r => {
    r.classList.remove('poked');
    void r.offsetWidth;
    r.classList.add('poked');
    setTimeout(() => r?.classList.remove('poked'), 460);
  });

  if (elements.rigBrows) {
    elements.rigBrows.style.transform = 'translateY(-4px)';
    setTimeout(() => { if (elements.rigBrows) elements.rigBrows.style.transform = ''; }, 450);
  }
  if (elements.floatingRigBrows) {
    elements.floatingRigBrows.style.transform = 'translateY(-4px)';
    setTimeout(() => { if (elements.floatingRigBrows) elements.floatingRigBrows.style.transform = ''; }, 450);
  }
  const wBrows = document.getElementById('wardrobeRigBrows');
  if (wBrows) {
    wBrows.style.transform = 'translateY(-4px)';
    setTimeout(() => { if (wBrows) wBrows.style.transform = ''; }, 450);
  }
}

// ==========================================
// 6. IDLE SLEEP MODE (z z z)
// ==========================================
function scheduleIdleSleep() {
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    state.isSleeping = true;
    elements.sleepIndicator?.classList.add('show');
    elements.floatingPetSleep?.classList.add('show');
    elements.chibiRig?.classList.add('sleeping');
    elements.floatingChibiRig?.classList.add('sleeping');
  }, CONFIG.idleSleepTimeMs);
}

function wakeUp() {
  if (state.isSleeping) {
    state.isSleeping = false;
    elements.sleepIndicator?.classList.remove('show');
    elements.floatingPetSleep?.classList.remove('show');
    elements.chibiRig?.classList.remove('sleeping');
    elements.floatingChibiRig?.classList.remove('sleeping');
    scheduleNextBlink();
  }
}

// ==========================================
// 7. POPOVER & MOBILE BOTTOM SHEET CONTROLS
// ==========================================
function syncSheetState() {
  const isAnyOpen = state.isMenuOpen || state.isProductivityOpen || state.isWardrobeOpen || !!(window.NookiDrop?.state?.isDrawerOpen);
  document.body.classList.toggle('sheet-open', isAnyOpen);

  if (window.desktopAPI?.setWidgetScale) {
    window.desktopAPI.setWidgetScale(state.scale, isAnyOpen);
  }
}

function toggleMenu(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  if (state.isProductivityOpen) closeProductivityDrawer();
  if (state.isWardrobeOpen) closeWardrobeDrawer();
  if (window.NookiDrop?.state?.isDrawerOpen) window.NookiDrop.toggleDrawer();

  state.isMenuOpen = !state.isMenuOpen;

  if (state.isMenuOpen) {
    const widgetRect = elements.cloudWidget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - widgetRect.bottom;
    if (spaceBelow < 280 && widgetRect.top > spaceBelow && !document.body.classList.contains('mode-mobile')) {
      elements.popoverMenu.classList.add('open-above');
    } else {
      elements.popoverMenu.classList.remove('open-above');
    }

    elements.popoverMenu.classList.add('open');
    elements.menuBtn.classList.add('active');
  } else {
    elements.popoverMenu.classList.remove('open', 'open-above');
    elements.menuBtn.classList.remove('active');
  }

  syncSheetState();

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

  syncSheetState();

  if (window.desktopAPI?.setWidgetScale) {
    const isExpanded = state.isProductivityOpen || state.isWardrobeOpen;
    window.desktopAPI.setWidgetScale(state.scale, isExpanded);
  }
}

function showBubbleMessage(text, autoDismissMs = 8000, isHTML = false) {
  if (state.bubbleTimer) clearTimeout(state.bubbleTimer);
  if (isHTML) {
    if (elements.bubbleText) elements.bubbleText.innerHTML = text;
    if (elements.floatingBubbleText) elements.floatingBubbleText.innerHTML = text;
  } else {
    if (elements.bubbleText) elements.bubbleText.textContent = text;
    if (elements.floatingBubbleText) elements.floatingBubbleText.textContent = text;
  }
  const wBubbleText = document.getElementById('wardrobeBubbleText');
  if (wBubbleText) {
    if (isHTML) wBubbleText.innerHTML = text;
    else wBubbleText.textContent = text;
  }
  elements.floatingBubble?.classList.add('show');
  elements.floatingPetBubble?.classList.add('show');

  const mBubbleText = document.getElementById('mBubbleText');
  if (mBubbleText) {
    if (isHTML) mBubbleText.innerHTML = text;
    else mBubbleText.textContent = text;
  }

  if (autoDismissMs > 0) {
    state.bubbleTimer = setTimeout(() => {
      elements.floatingBubble?.classList.remove('show');
      elements.floatingPetBubble?.classList.remove('show');
      setCharacterTalking(false);
    }, autoDismissMs);
  }

  // Trigger natural talking lip-sync animation
  setCharacterTalking(true);
  const talkDurationMs = Math.min(autoDismissMs > 0 ? autoDismissMs : 4500, Math.max(1200, (text || '').length * 55));
  if (talkTimer) clearTimeout(talkTimer);
  talkTimer = setTimeout(() => setCharacterTalking(false), talkDurationMs);
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
// 8. NOOKI PRODUCTIVITY MODULE
// Daily Micro-Tasks, Habits & Streak Shields, Hydration
// ==========================================
// Water XP (2026-11-26): +5 XP per glass, +30 XP bonus once at the daily goal.
// XP is always re-calculated from today's glass count, so removing a glass or
// pressing Reset takes the XP back, and a glass can never be counted twice.
const NOOKI_XP_PER_GLASS = 5;
const NOOKI_XP_WATER_GOAL_BONUS = 30;
const NOOKI_XP_PER_TASK = 15;
function nookiWaterXpFor(glasses) {
  const target = nookiProductivityState.hydration?.targetGlasses || 8;
  const g = Math.max(0, Math.min(target, glasses || 0));
  return g * NOOKI_XP_PER_GLASS + (g >= target ? NOOKI_XP_WATER_GOAL_BONUS : 0);
}
function syncWaterXp() {
  const h = nookiProductivityState.hydration;
  if (!h) return;
  const want = nookiWaterXpFor(h.currentGlasses);
  const delta = want - (h.xpCredited || 0);
  if (delta !== 0) {
    nookiProductivityState.exp = Math.max(0, (nookiProductivityState.exp || 0) + delta);
    h.xpCredited = want;
  }
}

function checkMidnightReset() {
  const today = new Date().toLocaleDateString('en-CA');
  if (nookiProductivityState.lastResetDate && nookiProductivityState.lastResetDate !== today) {
    // 1. Midnight Hydration Reset (yesterday's water XP is kept)
    nookiProductivityState.hydration.currentGlasses = 0;
    nookiProductivityState.hydration.xpCredited = 0;

    // 2. Streak Continuity Check
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    const didYesterday = !!nookiProductivityState.streak.history[yesterdayStr];

    if (!didYesterday && nookiProductivityState.streak.currentCount > 0) {
      if (nookiProductivityState.streak.shields > 0) {
        nookiProductivityState.streak.shields--;
        nookiProductivityState.streak.history[yesterdayStr] = true;
        showBubbleMessage("🛡️ Streak Shield saved your habit streak from yesterday's miss!", 4500);
      } else {
        nookiProductivityState.streak.currentCount = 0;
      }
    }

    nookiProductivityState.lastResetDate = today;
    saveProductivityState();
  } else if (!nookiProductivityState.lastResetDate) {
    nookiProductivityState.lastResetDate = today;
    saveProductivityState();
  }
}

function saveProductivityState() {
  syncWaterXp();
  localStorage.setItem('nooki_productivity_state', JSON.stringify(nookiProductivityState));
  // Backwards compatibility legacy mirrors
  localStorage.setItem('nooki_tasks', JSON.stringify(nookiProductivityState.tasks));
  localStorage.setItem('nooki_streak', nookiProductivityState.streak.currentCount.toString());
  localStorage.setItem('nooki_streak_days', JSON.stringify(nookiProductivityState.streak.history));
  localStorage.setItem('nooki_water', nookiProductivityState.hydration.currentGlasses.toString());
  localStorage.setItem('nooki_reset_date', nookiProductivityState.lastResetDate);
  localStorage.setItem('nooki_xp', nookiProductivityState.exp.toString());
  localStorage.setItem('nooki_prod_modules', JSON.stringify(nookiProductivityState.modules));
}

function updateProductivityUI() {
  checkMidnightReset();

  if (elements.prodXpBadge) {
    elements.prodXpBadge.textContent = `⭐ ${nookiProductivityState.exp} XP`;
  }
  if (elements.wardrobeXpBadge) {
    elements.wardrobeXpBadge.textContent = `⭐ ${nookiProductivityState.exp} XP`;
  }

  const currentExp = nookiProductivityState.exp || 0;
  const headerExp = document.getElementById('headerExpCount');
  if (headerExp) headerExp.textContent = `${currentExp} XP`;

  const dashExpLabel = document.getElementById('dashExpLabel');
  if (dashExpLabel) dashExpLabel.textContent = `${currentExp} XP (Lv. ${Math.floor(currentExp / 100) + 1})`;

  const dashExpFill = document.getElementById('dashExpBarFill');
  if (dashExpFill) dashExpFill.style.width = `${Math.min(100, Math.max(8, currentExp % 100))}%`;

  const targetW = nookiProductivityState.hydration?.targetGlasses || 8;
  const curW = Math.min(targetW, Math.max(0, nookiProductivityState.hydration?.currentGlasses || 0));
  nookiProductivityState.hydration.currentGlasses = curW;
  const glassMl = 250;
  const goalMl = targetW * glassMl;
  const curMl = curW * glassMl;

  const dashWater = document.getElementById('dashWaterCount');
  if (dashWater) dashWater.textContent = `${curW}/${targetW}`;

  // 1. Hydration Display
  if (elements.waterCountText) {
    elements.waterCountText.textContent = `${curMl.toLocaleString()} / ${goalMl.toLocaleString()} ml`;
  }

  // Dashboard Water Well Card
  const dashWaterWellStatus = document.getElementById('dashWaterWellStatus');
  if (dashWaterWellStatus) {
    dashWaterWellStatus.textContent = `${curMl.toLocaleString()} / ${goalMl.toLocaleString()} ml`;
  }
  const dashWaterGoalBadge = document.getElementById('dashWaterGoalBadge');
  if (dashWaterGoalBadge) {
    dashWaterGoalBadge.textContent = `Goal: ${goalMl.toLocaleString()} ml (${targetW} glasses)`;
  }

  const dashGlassesRow = document.getElementById('dashWaterGlassesRow');
  if (dashGlassesRow) {
    dashGlassesRow.innerHTML = '';
    for (let i = 1; i <= targetW; i++) {
      const gBtn = document.createElement('button');
      gBtn.type = 'button';
      gBtn.className = `dash-glass-btn ${i <= curW ? 'filled' : ''}`;
      gBtn.title = `Glass ${i} (250 ml) - Click to ${i === curW ? 'undo' : 'drink'}`;
      gBtn.innerHTML = `<span class="dash-glass-icon">🥛</span><span class="dash-glass-label">${i * glassMl}ml</span>`;
      gBtn.addEventListener('click', () => {
        if (nookiProductivityState.hydration.currentGlasses === i) {
          nookiProductivityState.hydration.currentGlasses = i - 1;
        } else {
          nookiProductivityState.hydration.currentGlasses = Math.min(targetW, i);
          celebrateHydration(nookiProductivityState.hydration.currentGlasses);
        }
        saveProductivityState();
        updateProductivityUI();
      });
      dashGlassesRow.appendChild(gBtn);
    }
  }

  if (elements.waterDropletsRow) {
    elements.waterDropletsRow.innerHTML = '';
    for (let i = 1; i <= targetW; i++) {
      const drop = document.createElement('span');
      drop.className = `water-drop ${i <= curW ? 'filled' : ''}`;
      drop.textContent = '💧';
      drop.title = `Glass ${i} (Click to set)`;
      drop.addEventListener('click', () => {
        nookiProductivityState.hydration.currentGlasses = (nookiProductivityState.hydration.currentGlasses === i) ? i - 1 : Math.min(targetW, i);
        saveProductivityState();
        celebrateHydration(nookiProductivityState.hydration.currentGlasses);
        updateProductivityUI();
      });
      elements.waterDropletsRow.appendChild(drop);
    }
  }

  // 2. Habit Streak & Shields (Sync across Dashboard & Productivity Center)
  const streakText = `${nookiProductivityState.streak.currentCount} Day${nookiProductivityState.streak.currentCount === 1 ? '' : 's'}`;
  if (elements.streakCountText) elements.streakCountText.textContent = streakText;
  const fullStreakCount = document.getElementById('fullStreakCountText');
  if (fullStreakCount) fullStreakCount.textContent = streakText;

  const dashStreak = document.getElementById('dashStreakCount');
  if (dashStreak) dashStreak.textContent = streakText;
  const headerStreak = document.getElementById('headerStreakCount');
  if (headerStreak) headerStreak.textContent = streakText;

  const shieldText = `🛡️ ${nookiProductivityState.streak.shields} Shield${nookiProductivityState.streak.shields === 1 ? '' : 's'}`;
  if (elements.shieldBadge) elements.shieldBadge.textContent = shieldText;
  const fullShieldBadge = document.getElementById('fullShieldBadge');
  if (fullShieldBadge) fullShieldBadge.textContent = shieldText;

  const streakContainers = [elements.streakDaysRow, document.getElementById('fullStreakDaysRow')].filter(Boolean);
  if (streakContainers.length > 0) {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = (currentDay === 0 ? -6 : 1) - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const todayStr = now.toLocaleDateString('en-CA');

    streakContainers.forEach(container => {
      container.innerHTML = '';
      for (let d = 0; d < 7; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + d);
        const dateStr = date.toLocaleDateString('en-CA');
        const isToday = dateStr === todayStr;
        const isCompleted = !!nookiProductivityState.streak.history[dateStr];

        const item = document.createElement('div');
        item.className = `streak-day-item ${isToday ? 'today' : ''} ${isCompleted ? 'completed' : ''}`;
        item.title = `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${isCompleted ? 'Completed! 🔥' : 'Tap to mark done'}`;

        const name = document.createElement('span');
        name.className = 'streak-day-name';
        name.textContent = dayLabels[d];

        const dot = document.createElement('div');
        dot.className = 'streak-day-dot';
        dot.textContent = isCompleted ? '💖' : (isToday ? '●' : '○');

        item.appendChild(name);
        item.appendChild(dot);

        item.addEventListener('click', () => {
          const nextState = !nookiProductivityState.streak.history[dateStr];
          if (nextState) {
            nookiProductivityState.streak.history[dateStr] = true;
            nookiProductivityState.streak.currentCount++;
            nookiProductivityState.streak.lastCompletedDate = dateStr;
            nookiProductivityState.exp += 5;
            celebrateStreak(nookiProductivityState.streak.currentCount);
          } else {
            delete nookiProductivityState.streak.history[dateStr];
            nookiProductivityState.streak.currentCount = Math.max(0, nookiProductivityState.streak.currentCount - 1);
          }
          saveProductivityState();
          updateProductivityUI();
        });

        container.appendChild(item);
      }
    });
  }

  // 3. Unlimited Scrollable Tasks List (Sync across Dashboard & Productivity Center)
  const completedTasks = nookiProductivityState.tasks.filter(t => t.completed).length;
  const countStr = `${completedTasks}/${nookiProductivityState.tasks.length}`;
  if (elements.tasksCountText) elements.tasksCountText.textContent = countStr;
  const fullTasksCount = document.getElementById('fullTasksCountText');
  if (fullTasksCount) fullTasksCount.textContent = `${countStr} Done`;
  const dashTasks = document.getElementById('dashTasksCount');
  if (dashTasks) dashTasks.textContent = countStr;

  const taskContainers = [elements.tasksList, document.getElementById('fullTasksList')].filter(Boolean);
  taskContainers.forEach(container => {
    container.innerHTML = '';
    if (nookiProductivityState.tasks.length === 0) {
      const empty = document.createElement('li');
      empty.style.fontSize = '0.78rem';
      empty.style.color = '#94a3b8';
      empty.style.textAlign = 'center';
      empty.style.padding = '14px 8px';
      empty.textContent = 'No tasks or habits yet. Add one above! ✨';
      container.appendChild(empty);
    } else {
      // Sort: uncompleted on top, completed at bottom
      const sortedTasks = [...nookiProductivityState.tasks].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
      });

      sortedTasks.forEach((task) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;

        const chk = document.createElement('div');
        chk.className = 'task-checkbox';
        chk.textContent = '✓';
        chk.title = task.completed ? 'Mark incomplete' : 'Mark done (+15 XP)';
        chk.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetTask = nookiProductivityState.tasks.find(t => t.id === task.id);
          if (targetTask) {
            targetTask.completed = !targetTask.completed;
            if (targetTask.completed) {
              celebrateTaskCompletion(targetTask.text);
            } else {
              // Unticking takes the quest XP back
              nookiProductivityState.exp = Math.max(0, (nookiProductivityState.exp || 0) - NOOKI_XP_PER_TASK);
            }
            saveProductivityState();
            updateProductivityUI();
          }
        });

        const txt = document.createElement('span');
        txt.className = 'task-text';
        txt.textContent = task.text;

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'task-delete-btn';
        del.textContent = '✕';
        del.title = 'Delete';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          const doomed = nookiProductivityState.tasks.find(t => t.id === task.id);
          if (doomed && doomed.completed) {
            // Deleting a finished quest takes its XP back
            nookiProductivityState.exp = Math.max(0, (nookiProductivityState.exp || 0) - NOOKI_XP_PER_TASK);
          }
          nookiProductivityState.tasks = nookiProductivityState.tasks.filter(t => t.id !== task.id);
          saveProductivityState();
          updateProductivityUI();
          playPokeSound();
        });

        li.appendChild(chk);
        li.appendChild(txt);
        li.appendChild(del);
        container.appendChild(li);
      });
    }
  });

  // Modular visibility toggles
  if (elements.sectionWater) {
    elements.sectionWater.style.display = nookiProductivityState.modules.water ? 'flex' : 'none';
  }
  if (elements.sectionStreak) {
    elements.sectionStreak.style.display = nookiProductivityState.modules.streak ? 'flex' : 'none';
  }
  const fullStreakSec = document.getElementById('fullSectionStreak');
  if (fullStreakSec) {
    fullStreakSec.style.display = nookiProductivityState.modules.streak ? 'flex' : 'none';
  }
  if (elements.sectionTasks) {
    elements.sectionTasks.style.display = nookiProductivityState.modules.tasks ? 'flex' : 'none';
  }

  if (typeof updateMobileAppUI === 'function') {
    updateMobileAppUI();
  }
}

function celebrateTaskCompletion(taskText) {
  nookiProductivityState.exp += 15; // +15 XP per spec
  saveProductivityState();

  elements.characterStage.classList.remove('state-poked');
  void elements.characterStage.offsetWidth;
  elements.characterStage.classList.add('state-poked');

  playPokeSound();
  spawnParticle(true);
  spawnParticle(false);

  if (elements.expressionBadge) {
    elements.expressionBadge.textContent = '⭐';
    elements.expressionBadge.classList.add('show');
    setTimeout(() => elements.expressionBadge.classList.remove('show'), 1200);
  }

  const msgs = [
    `Awesome! "${taskText}" completed! 🎉 (+15 XP)`,
    `Priority checked off! Keep crushing it! ⭐ (+15 XP)`,
    `Great discipline! Proud of you! 💖 (+15 XP)`
  ];
  showBubbleMessage(msgs[Math.floor(Math.random() * msgs.length)], 3500);
}

function celebrateHydration(count) {
  playPokeSound();
  spawnParticle(true);

  if (elements.expressionBadge) {
    elements.expressionBadge.textContent = '💧';
    elements.expressionBadge.classList.add('show');
    setTimeout(() => elements.expressionBadge.classList.remove('show'), 1000);
  }

  const cheer = count >= 8
    ? `Goal reached! 8/8 glasses! Fully hydrated! 💧🎉 (+${NOOKI_XP_PER_GLASS} XP, +${NOOKI_XP_WATER_GOAL_BONUS} bonus)`
    : `Glug glug! Stay hydrated! 💧 (${count}/8 glasses, +${NOOKI_XP_PER_GLASS} XP)`;
  showBubbleMessage(cheer, 3200);
}

function celebrateStreak(streak) {
  playPokeSound();
  spawnParticle(false);

  if (elements.expressionBadge) {
    elements.expressionBadge.textContent = '🔥';
    elements.expressionBadge.classList.add('show');
    setTimeout(() => elements.expressionBadge.classList.remove('show'), 1000);
  }

  showBubbleMessage(`Streak updated! 🔥 ${streak} day streak! Keep it up! ✨`, 3200);
}

function toggleProductivityDrawer(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  if (state.isMenuOpen) closeMenu();
  if (state.isWardrobeOpen) closeWardrobeDrawer();
  if (window.NookiDrop?.state?.isDrawerOpen) window.NookiDrop.toggleDrawer();

  state.isProductivityOpen = !state.isProductivityOpen;

  if (state.isProductivityOpen) {
    const widgetRect = elements.cloudWidget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - widgetRect.bottom;
    if (spaceBelow < 320 && widgetRect.top > spaceBelow && !document.body.classList.contains('mode-mobile')) {
      elements.productivityDrawer.classList.add('open-above');
    } else {
      elements.productivityDrawer.classList.remove('open-above');
    }

    elements.productivityDrawer.classList.add('open');
    elements.prodBtn?.classList.add('active');
    updateProductivityUI();
  } else {
    closeProductivityDrawer();
  }
  syncSheetState();
}

function closeProductivityDrawer(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (!state.isProductivityOpen) return;
  state.isProductivityOpen = false;
  elements.productivityDrawer.classList.remove('open', 'open-above');
  elements.prodBtn?.classList.remove('active');
  syncSheetState();
}

// ==========================================
// WARDROBE LOGIC & ADVANCED DRESS-UP STUDIO
// ==========================================
let currentWardrobeTab = 'hats';
let currentWardrobeFilter = 'all'; // 'all', 'unlocked', 'shop'
let wardrobeSearchQuery = '';

// Dedicated Fashion Runway Poses (Never poke/squish chibi in wardrobe!)
const WARDROBE_POSES = [
  { id: 'spin', name: 'Spin', icon: '💃', quote: "360° runway spin! 💃 Look at this silhouette!" },
  { id: 'peace', name: 'Peace', icon: '✌️', quote: "Double peace! ✌️ Feeling so cute today!" },
  { id: 'model', name: 'Model', icon: '🌟', quote: "Strike a pose! 🌟 Supermodel runway energy!" },
  { id: 'heart', name: 'Heart', icon: '💖', quote: "Sending lots of love in this outfit! 💖" },
  { id: 'bow', name: 'Bow', icon: '🙇', quote: "Thank you for styling me so elegantly! 🙇✨" },
  { id: 'wave', name: 'Wave', icon: '👋', quote: "Hiiii! 👋 You have the best fashion taste!" }
];
let currentPoseIndex = 0;
let lastPoseTime = 0;

let wardrobeBubbleTimer = null;
function showWardrobeBubbleMessage(msg, duration = 3000) {
  const bubble = document.getElementById('wardrobeBubble');
  const bubbleText = document.getElementById('wardrobeBubbleText');
  if (!bubble || !bubbleText) return;

  bubbleText.textContent = msg;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');

  if (wardrobeBubbleTimer) clearTimeout(wardrobeBubbleTimer);
  wardrobeBubbleTimer = setTimeout(() => {
    bubble.classList.remove('show');
  }, duration);
}

function playWardrobePose(poseId = 'next', rewardExp = false) {
  const now = Date.now();
  if (now - lastPoseTime < 220) return;
  lastPoseTime = now;

  let pose;
  if (poseId === 'next') {
    currentPoseIndex = (currentPoseIndex + 1) % WARDROBE_POSES.length;
    pose = WARDROBE_POSES[currentPoseIndex];
  } else {
    pose = WARDROBE_POSES.find(p => p.id === poseId) || WARDROBE_POSES[0];
    currentPoseIndex = WARDROBE_POSES.indexOf(pose);
  }

  const wardrobeChibi = document.getElementById('wardrobeChibiInner');
  if (wardrobeChibi) {
    // Clear previous pose classes and remove any poke squish
    WARDROBE_POSES.forEach(p => wardrobeChibi.classList.remove(`pose-${p.id}`));
    wardrobeChibi.classList.remove('state-poked');
    void wardrobeChibi.offsetWidth;
    wardrobeChibi.classList.add(`pose-${pose.id}`);

    setTimeout(() => {
      wardrobeChibi.classList.remove(`pose-${pose.id}`);
    }, 850);
  }

  // Update active pose pill button in pose bar
  document.querySelectorAll('#wardrobePoseBar .pose-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-pose') === pose.id);
  });

  // Melodic audio chime and sparkles
  playPoseSound();
  spawnParticle(pose.id === 'heart');

  // Expression Badge Pop
  const badge = document.getElementById('wardrobeExpressionBadge');
  if (badge) {
    badge.textContent = pose.icon;
    badge.classList.remove('show');
    void badge.offsetWidth;
    badge.classList.add('show');
    setTimeout(() => badge?.classList.remove('show'), 900);
  }

  // Runway speech bubble dialogue
  showWardrobeBubbleMessage(pose.quote, 2800);

  // Optional XP reward
  if (rewardExp) {
    nookiProductivityState.exp += 5;
    saveProductivityState();
    updateProductivityUI();
  }
}

function cycleNextWardrobePose() {
  playWardrobePose('next');
}

// -------------------------------------------------------------
// Saved Looks & Presets Manager
// -------------------------------------------------------------
const DEFAULT_SAVED_LOOKS = [
  {
    id: 'look_starter_1',
    name: 'Streetwear Cool',
    gender: 'male',
    hat: 'cap_m',
    outfit: 'hoodie_m',
    emote: 'sparkle',
    icon: '🧢🥋',
    date: 'Starter Style'
  },
  {
    id: 'look_starter_2',
    name: 'Cozy Ribbon',
    gender: 'female',
    hat: 'ribbon_f',
    outfit: 'cardigan_f',
    emote: 'hearts',
    icon: '🎀🧥',
    date: 'Starter Style'
  }
];

function getSavedLooks() {
  try {
    const raw = localStorage.getItem('nooki_saved_looks');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed parsing nooki_saved_looks:", e);
  }
  return [...DEFAULT_SAVED_LOOKS];
}

function saveSavedLooks(looks) {
  try {
    localStorage.setItem('nooki_saved_looks', JSON.stringify(looks));
  } catch (e) {
    console.warn("Failed saving nooki_saved_looks:", e);
  }
}

function saveCurrentLook(customName) {
  const looks = getSavedLooks();
  const gender = nookiWardrobeState.gender || 'male';
  const hatId = nookiWardrobeState.equippedHat || 'none';
  const outfitId = nookiWardrobeState.equippedOutfit;
  const emoteId = nookiWardrobeState.equippedEmote || 'sparkle';

  const hats = WARDROBE_CATALOG[gender]?.hats || [];
  const outfits = WARDROBE_CATALOG[gender]?.outfits || [];
  const hatObj = hats.find(h => h.id === hatId);
  const outfitObj = outfits.find(o => o.id === outfitId);
  const emoteObj = WARDROBE_CATALOG.emotes.find(e => e.id === emoteId);

  const defaultName = (customName && customName.trim())
    ? customName.trim()
    : `${outfitObj ? outfitObj.name : 'Fashion'} Look #${looks.length + 1}`;

  const iconComposite = `${(hatObj && hatObj.icon !== '❌') ? hatObj.icon : '✨'} ${(outfitObj && outfitObj.icon) ? outfitObj.icon : '🧥'}`;

  const newLook = {
    id: `look_${Date.now()}`,
    name: defaultName,
    gender,
    hat: hatId,
    outfit: outfitId,
    emote: emoteId,
    icon: iconComposite,
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  };

  looks.unshift(newLook);
  saveSavedLooks(looks);

  playWardrobePose('model');
  showWardrobeBubbleMessage(`Saved look "${defaultName}" to your collection! 💾✨`, 3200);

  updateSavedLooksUI();
}

function loadSavedLook(lookId) {
  const looks = getSavedLooks();
  const look = looks.find(l => l.id === lookId);
  if (!look) return;

  nookiWardrobeState.gender = look.gender || 'male';
  nookiWardrobeState.equippedHat = look.hat || 'none';
  nookiWardrobeState.equippedOutfit = look.outfit;
  nookiWardrobeState.equippedEmote = look.emote || 'sparkle';

  saveWardrobeState();
  applyWardrobe();
  updateWardrobeUI();
  playWardrobePose('spin');
  showWardrobeBubbleMessage(`Equipped saved look: "${look.name}"! 👗✨`, 2800);
}

function deleteSavedLook(lookId) {
  let looks = getSavedLooks();
  const target = looks.find(l => l.id === lookId);
  looks = looks.filter(l => l.id !== lookId);
  saveSavedLooks(looks);
  updateSavedLooksUI();
  showWardrobeBubbleMessage(`Removed preset "${target ? target.name : 'look'}" from rack.`, 2200);
}

function updateSavedLooksUI() {
  const looks = getSavedLooks();

  // Update badge count on Saved Looks tab
  const countBadge = document.getElementById('savedLooksCountBadge');
  if (countBadge) countBadge.textContent = looks.length;

  // 1. Render Mini Rack in Mirror Card
  const rack = document.getElementById('mirrorSavedRack');
  if (rack) {
    rack.innerHTML = '';
    if (looks.length === 0) {
      rack.innerHTML = `<span style="font-size:0.68rem; color:#8b7fad; padding:4px 0;">No saved looks yet! Click "+ Save Look"</span>`;
    } else {
      looks.forEach(look => {
        const isCurrent = (
          nookiWardrobeState.gender === look.gender &&
          nookiWardrobeState.equippedHat === look.hat &&
          nookiWardrobeState.equippedOutfit === look.outfit
        );
        const chip = document.createElement('div');
        chip.className = `saved-look-chip ${isCurrent ? 'active' : ''}`;
        chip.title = `Wear "${look.name}"`;
        chip.innerHTML = `<span>${look.icon}</span> <span>${escapeHtml(look.name)}</span>`;
        chip.addEventListener('click', () => loadSavedLook(look.id));
        rack.appendChild(chip);
      });
    }
  }

  // 2. If Saved tab is currently active, render catalog grid
  if (currentWardrobeTab === 'saved') {
    renderSavedLooksGrid();
  }
}

function renderSavedLooksGrid() {
  const grid = elements.wardrobeGrid || document.getElementById('wardrobeGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const looks = getSavedLooks();
  if (looks.length === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'saved-looks-empty';
    emptyBox.innerHTML = `
      <span class="empty-icon">👗</span>
      <span class="empty-title">No Saved Looks Yet!</span>
      <span class="empty-sub">Style Chibi with your favorite headwear, outfits, and hair, then tap <strong>"Save Look"</strong> to build your collection!</span>
    `;
    grid.appendChild(emptyBox);
    return;
  }

  looks.forEach(look => {
    const isCurrent = (
      nookiWardrobeState.gender === look.gender &&
      nookiWardrobeState.equippedHat === look.hat &&
      nookiWardrobeState.equippedOutfit === look.outfit &&
      nookiWardrobeState.equippedHair === look.hair
    );

    const card = document.createElement('div');
    card.className = `saved-look-card ${isCurrent ? 'active' : ''}`;
    card.style.cursor = 'pointer';

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'saved-look-delete-btn';
    delBtn.textContent = '✕';
    delBtn.title = `Delete "${look.name}"`;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSavedLook(look.id);
    });

    const icons = document.createElement('div');
    icons.className = 'saved-look-preview-icons';
    icons.textContent = look.icon || '✨';

    // Editable Rename Field on Each Saved Look
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'saved-look-rename-input';
    nameInput.value = look.name;
    nameInput.maxLength = 24;
    nameInput.title = 'Click to rename look';
    nameInput.addEventListener('click', (e) => e.stopPropagation());
    nameInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (val) {
        look.name = val;
        saveSavedLooks(looks);
        showWardrobeBubbleMessage(`Renamed look to "${val}"! 🏷️`, 1800);
      } else {
        e.target.value = look.name;
      }
    });

    const desc = document.createElement('div');
    desc.className = 'saved-look-desc';
    desc.textContent = `${look.gender === 'female' ? '👧 Girl' : '👦 Boy'} • ${look.date || 'Saved'}`;

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = `saved-look-apply-btn ${isCurrent ? 'active' : ''}`;
    applyBtn.textContent = isCurrent ? '✓ Wearing Now' : 'Wear Look ✨';

    // Dressing mirror updates at once when tapped
    card.addEventListener('click', () => {
      loadSavedLook(look.id);
    });

    card.appendChild(delBtn);
    card.appendChild(icons);
    card.appendChild(nameInput);
    card.appendChild(desc);
    card.appendChild(applyBtn);

    grid.appendChild(card);
  });
}

function openSaveLookDialog() {
  const dialog = document.getElementById('saveLookDialog');
  const input = document.getElementById('saveLookNameInput');
  const previewIcons = document.getElementById('saveLookPreviewIcons');
  const previewDesc = document.getElementById('saveLookPreviewDesc');

  const gender = nookiWardrobeState.gender || 'male';
  const hats = WARDROBE_CATALOG[gender]?.hats || [];
  const outfits = WARDROBE_CATALOG[gender]?.outfits || [];
  const hatObj = hats.find(h => h.id === nookiWardrobeState.equippedHat);
  const outfitObj = outfits.find(o => o.id === nookiWardrobeState.equippedOutfit);

  if (previewIcons) {
    previewIcons.textContent = `${(hatObj && hatObj.icon !== '❌') ? hatObj.icon : '✨'} ${(outfitObj && outfitObj.icon) ? outfitObj.icon : '🧥'}`;
  }
  if (previewDesc) {
    const hatName = (hatObj && hatObj.name !== 'None') ? hatObj.name : 'No Hat';
    const outfitName = outfitObj ? outfitObj.name : 'Basic Outfit';
    previewDesc.textContent = `${hatName} + ${outfitName}`;
  }

  if (input) {
    const looks = getSavedLooks();
    input.value = `${outfitObj ? outfitObj.name : 'Fashion'} Look #${looks.length + 1}`;
  }

  if (dialog) {
    dialog.style.display = 'flex';
    setTimeout(() => input?.focus(), 50);
  }
}

function closeSaveLookDialog() {
  const dialog = document.getElementById('saveLookDialog');
  if (dialog) dialog.style.display = 'none';
}

function randomizeLook() {
  const gender = nookiWardrobeState.gender || 'male';
  const hats = (WARDROBE_CATALOG[gender]?.hats || []).filter(h => h.cost === 0 || nookiWardrobeState.unlockedItems.includes(h.id));
  const outfits = (WARDROBE_CATALOG[gender]?.outfits || []).filter(o => o.cost === 0 || nookiWardrobeState.unlockedItems.includes(o.id));
  const emotes = WARDROBE_CATALOG.emotes.filter(e => e.cost === 0 || nookiWardrobeState.unlockedItems.includes(e.id));

  if (hats.length > 0) {
    const randomHat = hats[Math.floor(Math.random() * hats.length)];
    nookiWardrobeState.equippedHat = randomHat.id;
  }
  if (outfits.length > 0) {
    const randomOutfit = outfits[Math.floor(Math.random() * outfits.length)];
    nookiWardrobeState.equippedOutfit = randomOutfit.id;
  }
  if (emotes.length > 0) {
    const randomEmote = emotes[Math.floor(Math.random() * emotes.length)];
    nookiWardrobeState.equippedEmote = randomEmote.id;
  }

  saveWardrobeState();
  applyWardrobe();
  updateWardrobeUI();
  playWardrobePose('spin');
  showWardrobeBubbleMessage("Surprise styling! 🎲 Looking extraordinary! ✨", 2800);
}

function resetLook() {
  const gender = nookiWardrobeState.gender || 'male';
  nookiWardrobeState.equippedHat = 'none';
  nookiWardrobeState.equippedOutfit = (gender === 'female' ? 'cardigan_f' : 'hoodie_m');
  nookiWardrobeState.equippedEmote = 'sparkle';

  saveWardrobeState();
  applyWardrobe();
  updateWardrobeUI();
  playWardrobePose('bow');
  showWardrobeBubbleMessage("Back to cozy basic outfit! 🔄", 2400);
}

function setWardrobeAmbience(theme, save = true) {
  const card = document.getElementById('wardrobeMirrorCard');
  if (!card) return;
  const themes = ['lavender', 'cloud', 'sunset', 'cyber', 'matcha'];
  themes.forEach(t => card.classList.remove(`theme-${t}`));
  card.classList.add(`theme-${theme}`);

  document.querySelectorAll('#wardrobeAmbienceBar .ambience-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-theme') === theme);
  });

  if (save) {
    try {
      localStorage.setItem('nooki_wardrobe_theme', theme);
    } catch (_) {}
  }
}

function setWardrobeFilter(filter) {
  currentWardrobeFilter = filter || 'all';
  document.querySelectorAll('#wardrobeFilterPills .w-filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-filter') === currentWardrobeFilter);
  });
  updateWardrobeUI(currentWardrobeTab);
}

function setWardrobeSearch(query) {
  wardrobeSearchQuery = (query || '').trim().toLowerCase();
  const clearBtn = document.getElementById('wardrobeSearchClearBtn');
  if (clearBtn) clearBtn.style.display = wardrobeSearchQuery ? 'block' : 'none';
  updateWardrobeUI(currentWardrobeTab);
}

function applyWardrobe() {
  const gender = nookiWardrobeState.gender || 'male';
  const isGirl = (gender === 'female');

  // 1. Swap base body & head rig sprites between Boy and Girl (FIX GIRL IN MIRROR BUG)
  const bodySrc = isGirl ? 'assets/base-rig/girl_body.png' : 'assets/base-rig/body.png';
  const headSrc = isGirl ? 'assets/base-rig/girl_head.png' : 'assets/base-rig/head.png';
  const irisSrc = isGirl ? 'assets/base-rig/girl_eyerish.png' : 'assets/base-rig/eyerish.png';
  const eyesClosedSrc = isGirl ? 'assets/base-rig/girl_eyes_closed.png' : 'assets/base-rig/eyes_closed.png';

  // Apply to main dashboard stage
  if (elements.rigBody) elements.rigBody.src = bodySrc;
  if (elements.rigHead) elements.rigHead.src = headSrc;
  if (elements.rigIris) elements.rigIris.src = irisSrc;
  if (elements.rigEyesClosed) elements.rigEyesClosed.src = eyesClosedSrc;

  // Apply to dressing mirror stage
  const wBody = document.getElementById('wardrobeRigBody');
  if (wBody) wBody.src = bodySrc;
  const wHead = document.getElementById('wardrobeRigHead');
  if (wHead) wHead.src = headSrc;
  const wIris = document.getElementById('wardrobeRigIris');
  if (wIris) wIris.src = irisSrc;
  const wEyesClosed = document.getElementById('wardrobeRigEyesClosed');
  if (wEyesClosed) wEyesClosed.src = eyesClosedSrc;

  // Apply to floating pet window
  if (elements.floatingRigBody) elements.floatingRigBody.src = bodySrc;
  if (elements.floatingRigHead) elements.floatingRigHead.src = headSrc;
  if (elements.floatingRigIris) elements.floatingRigIris.src = irisSrc;
  if (elements.floatingRigEyesClosed) elements.floatingRigEyesClosed.src = eyesClosedSrc;

  // 2. Real Sprite Hair Layer
  const genderHairList = WARDROBE_CATALOG[gender]?.hair || [];
  const hairItem = genderHairList.find(h => h.id === nookiWardrobeState.equippedHair) || genderHairList[0];
  const hairSrc = hairItem?.sprite || hairItem?.thumb || (isGirl ? 'assets/base-rig/girl_hair_1.png' : 'assets/base-rig/hair.png');

  if (elements.rigHair) elements.rigHair.src = hairSrc;
  if (elements.floatingRigHair) elements.floatingRigHair.src = hairSrc;
  const wRigHair = document.getElementById('wardrobeRigHair');
  if (wRigHair) wRigHair.src = hairSrc;

  // 3. Hat / Headwear
  const genderHats = WARDROBE_CATALOG[gender]?.hats || [];
  const hat = genderHats.find(h => h.id === nookiWardrobeState.equippedHat);
  const hatText = (hat && hat.text) ? hat.text : '';
  if (elements.chibiHat) elements.chibiHat.textContent = hatText;
  if (elements.floatingChibiHat) elements.floatingChibiHat.textContent = hatText;
  const wHat = document.getElementById('wardrobeChibiHat');
  if (wHat) wHat.textContent = hatText;

  // 4. Outfits & Clothes
  const genderOutfits = WARDROBE_CATALOG[gender]?.outfits || [];
  const outfit = genderOutfits.find(o => o.id === nookiWardrobeState.equippedOutfit) || genderOutfits[0];
  const outfitBadge = (outfit && outfit.badge) ? outfit.badge : '';
  if (elements.chibiOutfitBadge) elements.chibiOutfitBadge.textContent = outfitBadge;
  if (elements.floatingChibiOutfitBadge) elements.floatingChibiOutfitBadge.textContent = outfitBadge;
  const wOutfit = document.getElementById('wardrobeChibiOutfitBadge');
  if (wOutfit) wOutfit.textContent = outfitBadge;

  const wJacket = document.getElementById('wardrobeRigJacket');
  const wShort = document.getElementById('wardrobeRigShort');

  if (isGirl) {
    const outfitSprite = outfit?.sprite || 'assets/base-rig/girl_outfit_sundress.png';
    if (elements.rigJacket) {
      elements.rigJacket.src = outfitSprite;
      elements.rigJacket.style.display = 'block';
    }
    if (wJacket) {
      wJacket.src = outfitSprite;
      wJacket.style.display = 'block';
    }
    if (elements.floatingRigJacket) {
      elements.floatingRigJacket.src = outfitSprite;
      elements.floatingRigJacket.style.display = 'block';
    }
    if (elements.rigShort) elements.rigShort.style.display = 'none';
    if (wShort) wShort.style.display = 'none';
    if (elements.floatingRigShort) elements.floatingRigShort.style.display = 'none';
  } else {
    const showJacket = (outfit && outfit.clothes) ? outfit.clothes.jacket : true;
    const showShort = (outfit && outfit.clothes) ? outfit.clothes.short : true;
    const boyJacketSrc = outfit?.sprite || 'assets/base-rig/sport_jacket.png';
    const boyShortSrc = 'assets/base-rig/short.png';

    if (elements.rigJacket) {
      elements.rigJacket.src = boyJacketSrc;
      elements.rigJacket.style.display = showJacket ? 'block' : 'none';
    }
    if (wJacket) {
      wJacket.src = boyJacketSrc;
      wJacket.style.display = showJacket ? 'block' : 'none';
    }
    if (elements.floatingRigJacket) {
      elements.floatingRigJacket.src = boyJacketSrc;
      elements.floatingRigJacket.style.display = showJacket ? 'block' : 'none';
    }

    if (elements.rigShort) {
      elements.rigShort.src = boyShortSrc;
      elements.rigShort.style.display = showShort ? 'block' : 'none';
    }
    if (wShort) {
      wShort.src = boyShortSrc;
      wShort.style.display = showShort ? 'block' : 'none';
    }
    if (elements.floatingRigShort) {
      elements.floatingRigShort.src = boyShortSrc;
      elements.floatingRigShort.style.display = showShort ? 'block' : 'none';
    }
  }

  // 5. Equipped Summary in Mirror
  const summaryEl = document.getElementById('wardrobeEquippedSummary');
  if (summaryEl) {
    const hatName = (hat && hat.id !== 'none') ? hat.name : '';
    const outfitName = outfit ? outfit.name : 'Default Outfit';
    const hairName = hairItem ? hairItem.name : '';
    const parts = [hairName, hatName, outfitName].filter(Boolean);
    summaryEl.textContent = `✨ Equipped: ${parts.join(' • ') || 'Default Look'}`;
  }

  // Ensure skin tone and rigs have proper classes
  if (elements.chibiRig && !elements.chibiRig.classList.contains('chibi-rig')) {
    elements.chibiRig.classList.add('chibi-rig');
  }
  if (elements.floatingChibiRig && !elements.floatingChibiRig.classList.contains('chibi-rig')) {
    elements.floatingChibiRig.classList.add('chibi-rig');
  }
  const wRig = document.getElementById('wardrobeChibiRig');
  if (wRig && !wRig.classList.contains('chibi-rig')) {
    wRig.classList.add('chibi-rig');
  }

  updateSavedLooksUI();
}

function updateWardrobeUI(activeCat = currentWardrobeTab) {
  currentWardrobeTab = activeCat;
  const gender = nookiWardrobeState.gender || 'male';

  // Update gender pill buttons
  if (elements.genderMaleBtn) elements.genderMaleBtn.classList.toggle('active', gender === 'male');
  if (elements.genderFemaleBtn) elements.genderFemaleBtn.classList.toggle('active', gender === 'female');

  if (elements.wardrobeXpBadge) {
    elements.wardrobeXpBadge.textContent = `⭐ ${nookiProductivityState.exp} XP`;
  }

  // Update category tabs
  const tabsContainer = elements.wardrobeTabs || document.getElementById('wardrobeTabs');
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.w-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-cat') === activeCat);
    });
  }

  // Toggle filter row visibility if in saved tab
  const filterRow = document.getElementById('wardrobeFilterRow');
  if (filterRow) {
    filterRow.style.display = (activeCat === 'saved') ? 'none' : 'flex';
  }

  // If active category is 'saved', render the saved looks presets manager
  if (activeCat === 'saved') {
    renderSavedLooksGrid();
    return;
  }

  const grid = elements.wardrobeGrid || document.getElementById('wardrobeGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let items = [];
  if (activeCat === 'hats') {
    items = WARDROBE_CATALOG[gender]?.hats || [];
  } else if (activeCat === 'hair') {
    items = WARDROBE_CATALOG[gender]?.hair || [];
  } else if (activeCat === 'outfits') {
    items = WARDROBE_CATALOG[gender]?.outfits || [];
  }

  // Filter items by status (all / unlocked / shop) and search query
  let filteredItems = items.filter(item => {
    const isUnlocked = item.cost === 0 || nookiWardrobeState.unlockedItems.includes(item.id);
    if (currentWardrobeFilter === 'unlocked' && !isUnlocked) return false;
    if (currentWardrobeFilter === 'shop' && (isUnlocked && item.cost > 0)) return false;
    if (currentWardrobeFilter === 'shop' && item.cost === 0) return false;

    if (wardrobeSearchQuery) {
      const matchName = item.name && item.name.toLowerCase().includes(wardrobeSearchQuery);
      if (!matchName) return false;
    }
    return true;
  });

  // Favourites sort first!
  filteredItems.sort((a, b) => {
    const aFav = (nookiWardrobeState.favorites || []).includes(a.id);
    const bFav = (nookiWardrobeState.favorites || []).includes(b.id);
    if (aFav !== bFav) return aFav ? -1 : 1;
    return 0;
  });

  if (filteredItems.length === 0) {
    const noResult = document.createElement('div');
    noResult.className = 'saved-looks-empty';
    noResult.innerHTML = `
      <span class="empty-icon">🔍</span>
      <span class="empty-title">No Matching Styles</span>
      <span class="empty-sub">Try switching filters or clearing your search!</span>
    `;
    grid.appendChild(noResult);
    return;
  }

  filteredItems.forEach(item => {
    const isUnlocked = item.cost === 0 || nookiWardrobeState.unlockedItems.includes(item.id);
    const isFav = (nookiWardrobeState.favorites || []).includes(item.id);
    let isEquipped = false;
    if (activeCat === 'hats') isEquipped = (nookiWardrobeState.equippedHat === item.id);
    if (activeCat === 'hair') isEquipped = (nookiWardrobeState.equippedHair === item.id);
    if (activeCat === 'outfits') isEquipped = (nookiWardrobeState.equippedOutfit === item.id);

    const card = document.createElement('div');
    card.className = `wardrobe-card ${isEquipped ? 'equipped' : ''}`;

    // Heart Favourite Button
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = `wardrobe-card-fav ${isFav ? 'active' : ''}`;
    favBtn.textContent = isFav ? '❤️' : '🤍';
    favBtn.title = isFav ? 'Remove from favorites' : 'Mark as favorite';
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!nookiWardrobeState.favorites) nookiWardrobeState.favorites = [];
      const idx = nookiWardrobeState.favorites.indexOf(item.id);
      if (idx >= 0) {
        nookiWardrobeState.favorites.splice(idx, 1);
      } else {
        nookiWardrobeState.favorites.push(item.id);
      }
      saveWardrobeState();
      updateWardrobeUI();
    });

    // Picture Thumbnail
    const thumbBox = document.createElement('div');
    thumbBox.className = 'wardrobe-card-thumb';
    if (item.thumb || item.sprite) {
      const img = document.createElement('img');
      img.src = item.thumb || item.sprite;
      img.className = 'wardrobe-pic-img';
      img.alt = item.name;
      img.draggable = false;
      thumbBox.appendChild(img);
    } else {
      const iconSpan = document.createElement('span');
      iconSpan.style.fontSize = '2rem';
      iconSpan.textContent = item.icon || '✨';
      thumbBox.appendChild(iconSpan);
    }

    const name = document.createElement('div');
    name.className = 'wardrobe-card-name';
    name.textContent = item.name;

    const cost = document.createElement('div');
    cost.className = 'wardrobe-card-cost';
    cost.textContent = isUnlocked ? 'Unlocked' : `⭐ ${item.cost} XP`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wardrobe-card-btn';

    if (isEquipped) {
      btn.className += ' btn-equipped';
      btn.textContent = '✓ Equipped';
      btn.disabled = true;
    } else if (isUnlocked) {
      btn.className += ' btn-equip';
      btn.textContent = 'Equip';
    } else if (nookiProductivityState.exp >= item.cost) {
      btn.className += ' btn-unlock';
      btn.textContent = `Unlock (${item.cost} XP)`;
    } else {
      btn.className += ' btn-locked';
      btn.textContent = `Need ${item.cost} XP`;
      btn.disabled = true;
    }

    // Tapping the card immediately updates dressing mirror at once
    card.addEventListener('click', () => {
      if (isEquipped) return;
      if (isUnlocked) {
        equipWardrobeItem(activeCat, item.id);
      } else if (nookiProductivityState.exp >= item.cost) {
        unlockWardrobeItem(activeCat, item);
      } else {
        showWardrobeBubbleMessage(`Need ${item.cost} XP to unlock this style! Complete quests to earn XP! ⭐`, 2500);
      }
    });

    card.appendChild(favBtn);
    card.appendChild(thumbBox);
    card.appendChild(name);
    card.appendChild(cost);
    card.appendChild(btn);
    grid.appendChild(card);
  });

  // Sync Wardrobe Carousel on Dashboard
  try {
    const dashCarousel = document.getElementById('dashWardrobeCarousel');
    if (dashCarousel) {
      dashCarousel.innerHTML = '';
      const hats = WARDROBE_CATALOG[gender]?.hats || [];
      const outfits = WARDROBE_CATALOG[gender]?.outfits || [];
      const dashItems = [...hats.slice(1, 4), ...outfits.slice(0, 3)];

      dashItems.forEach(item => {
        const isHat = hats.includes(item);
        const cat = isHat ? 'hats' : 'outfits';
        const isEquipped = isHat ? (nookiWardrobeState.equippedHat === item.id) : (nookiWardrobeState.equippedOutfit === item.id);
        const isUnlocked = item.cost === 0 || nookiWardrobeState.unlockedItems.includes(item.id);

        const dCard = document.createElement('div');
        dCard.className = `dash-wardrobe-item ${isEquipped ? 'equipped' : ''}`;
        dCard.style.cssText = `
          flex: 0 0 100px;
          background: #ffffff;
          border: 2px solid ${isEquipped ? '#10b981' : 'rgba(255,255,255,0.95)'};
          border-radius: 18px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(133, 114, 235, 0.1);
          text-align: center;
          cursor: pointer;
        `;

        dCard.innerHTML = `
          <span style="font-size: 1.8rem; line-height: 1;">${item.icon || '✨'}</span>
          <span style="font-size: 0.74rem; font-weight: 800; color: #2a2254; max-width: 85px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</span>
        `;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
          width: 100%;
          padding: 4px 0;
          font-size: 0.68rem;
          border-radius: 10px;
          background: ${isEquipped ? '#10b981' : '#8572eb'};
          color: #ffffff;
          border: none;
          cursor: pointer;
          font-weight: 800;
        `;
        btn.textContent = isEquipped ? 'Equipped' : (isUnlocked ? 'Equip' : `${item.cost} XP`);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isUnlocked) {
            equipWardrobeItem(cat, item.id);
          } else {
            unlockWardrobeItem(cat, item);
          }
        });

        dCard.appendChild(btn);
        dashCarousel.appendChild(dCard);
      });
    }
  } catch (_) {}
}

function equipWardrobeItem(category, itemId) {
  if (category === 'hats') nookiWardrobeState.equippedHat = itemId;
  if (category === 'hair') nookiWardrobeState.equippedHair = itemId;
  if (category === 'outfits') nookiWardrobeState.equippedOutfit = itemId;

  saveWardrobeState();
  applyWardrobe();
  updateWardrobeUI();
  playPoseSound();
  spawnParticle(true);
  showWardrobeBubbleMessage("Wardrobe updated! Looking fabulous! 💖✨", 2500);
}

function unlockWardrobeItem(category, item) {
  if (nookiProductivityState.exp < item.cost) return;

  nookiProductivityState.exp -= item.cost;
  saveProductivityState();

  if (!nookiWardrobeState.unlockedItems.includes(item.id)) {
    nookiWardrobeState.unlockedItems.push(item.id);
  }

  equipWardrobeItem(category, item.id);
  updateProductivityUI();
  showWardrobeBubbleMessage(`Unlocked "${item.name}"! 🎉 Equipped!`, 3000);
}

function setWardrobeGender(gender) {
  if (nookiWardrobeState.gender === gender) return;
  nookiWardrobeState.gender = gender;

  if (gender === 'female') {
    if (nookiWardrobeState.equippedHat === 'cap_m') nookiWardrobeState.equippedHat = 'ribbon_f';
    nookiWardrobeState.equippedHair = 'hair_twintails';
    nookiWardrobeState.equippedOutfit = 'sundress_f';
  } else {
    if (nookiWardrobeState.equippedHat === 'ribbon_f') nookiWardrobeState.equippedHat = 'cap_m';
    nookiWardrobeState.equippedHair = 'hair_black';
    nookiWardrobeState.equippedOutfit = 'sport_jacket';
  }

  saveWardrobeState();
  applyWardrobe();
  updateWardrobeUI();
  playPoseSound();
  showWardrobeBubbleMessage(`Switched character body to ${gender === 'female' ? '👧 Girl' : '👦 Boy'}! ✨`, 2800);
}

function openWardrobeDrawer() {
  state.isWardrobeOpen = true;
  closeMenu();
  closeProductivityDrawer();
  if (window.NookiDrop?.state?.isDrawerOpen) window.NookiDrop.toggleDrawer();
  elements.wardrobeDrawer?.classList.add('open');
  updateWardrobeUI();
  syncSheetState();
}

function closeWardrobeDrawer() {
  state.isWardrobeOpen = false;
  elements.wardrobeDrawer?.classList.remove('open');
  syncSheetState();
}

function toggleWardrobeDrawer(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (state.isWardrobeOpen) {
    closeWardrobeDrawer();
  } else {
    openWardrobeDrawer();
  }
}

let lastPokeTime = 0;
function handlePoke() {
  const now = Date.now();
  if (now - lastPokeTime < 180) return;
  lastPokeTime = now;

  getAudioContext();
  wakeUp();
  playPokeSound();

  // Trigger bouncy poke animation on dashboard stage and floating pet stage ONLY (Wardrobe Chibi has dedicated pose animations)
  const stages = [
    elements.characterStage,
    elements.floatingPetStage,
    document.getElementById('floatingPetStage')
  ].filter(Boolean);
  stages.forEach(st => {
    st.classList.remove('state-poked');
    void st.offsetWidth;
    st.classList.add('state-poked');
    setTimeout(() => st?.classList.remove('state-poked'), 450);
  });
  triggerPokeRig();

  // Expression badge pop using equipped emote on dashboard & floating pet badges
  const emote = WARDROBE_CATALOG.emotes.find(e => e.id === nookiWardrobeState.equippedEmote);
  const emoji = (emote && Math.random() < 0.65) ? emote.emoji : ['💖', '✨', '🌸', '🐾', '☁️', '🥰'][Math.floor(Math.random() * 6)];
  const badges = [
    elements.expressionBadge,
    elements.floatingExpressionBadge,
    document.getElementById('floatingExpressionBadge')
  ].filter(Boolean);
  badges.forEach(b => {
    b.textContent = emoji;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    setTimeout(() => b?.classList.remove('show'), 900);
  });

  // Floating sparkle / particle
  spawnParticle(Math.random() < 0.5);

  const pokeMsgs = [
    "Poke! ☁️",
    "Hehe, that tickles! (≧◡≦)",
    "Floating high in the sky! ✨",
    "Bestie! 💖",
    "Ready to play and keep you company! 🐾",
    "Soft as a cloud! ☁️🌸"
  ];
  showBubbleMessage(pokeMsgs[Math.floor(Math.random() * pokeMsgs.length)], 3200);
}

// ==========================================
// 10. DRAGGABLE WIDGET ON WEB & DESKTOP (TOUCH & MOUSE)
// ==========================================
let hasDragged = false;
function initDraggable() {
  let isPotentialDrag = false;
  let isDragging = false;
  let startX = 0, startY = 0;
  let lastClientX = 0, lastClientY = 0;
  let initialLeft = 0, initialTop = 0;
  const DRAG_THRESHOLD = 6;

  function isInteractive(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('#menuBtn, #prodBtn, #wardrobeBtn, #dropBtn, #popoverMenu, #productivityDrawer, #wardrobeDrawer, #dropDrawer, #resizeHandle, input, button, textarea, select');
  }

  // Pointer Down (Mouse, Touch, Pen)
  elements.cloudWidget.addEventListener('pointerdown', (e) => {
    if (isInteractive(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isPotentialDrag = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    const rect = elements.cloudWidget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    try {
      elements.cloudWidget.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  // Pointer Move (Mouse, Touch, Pen)
  window.addEventListener('pointermove', (e) => {
    if (!isPotentialDrag) return;

    const totalDx = e.clientX - startX;
    const totalDy = e.clientY - startY;
    const stepDx = e.clientX - lastClientX;
    const stepDy = e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    if (!isDragging) {
      if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) {
        isDragging = true;
        hasDragged = true;
        if (!window.desktopAPI?.isDesktop) {
          elements.cloudWidget.style.position = 'fixed';
          elements.cloudWidget.style.left = `${initialLeft}px`;
          elements.cloudWidget.style.top = `${initialTop}px`;
          elements.cloudWidget.style.margin = '0';
        }
      }
    }

    if (isDragging) {
      if (window.desktopAPI?.moveWindowBy) {
        // Electron Desktop: move native frameless window smoothly across the screen
        window.desktopAPI.moveWindowBy(stepDx, stepDy);
      } else {
        // Web Browser / Touchscreen: move the widget element
        elements.cloudWidget.style.position = 'fixed';
        elements.cloudWidget.style.left = `${Math.max(10, Math.min(window.innerWidth - 80, initialLeft + totalDx))}px`;
        elements.cloudWidget.style.top = `${Math.max(10, Math.min(window.innerHeight - 80, initialTop + totalDy))}px`;
        elements.cloudWidget.style.margin = '0';
      }
    }
  });

  // Pointer Up
  window.addEventListener('pointerup', (e) => {
    if (!isPotentialDrag) return;

    try {
      elements.cloudWidget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (!isDragging) {
      // Direct clean tap or click on character/cloud
      handlePoke();
    } else {
      setTimeout(() => { hasDragged = false; }, 180);
    }

    isPotentialDrag = false;
    isDragging = false;
  });

  // Pointer Cancel (resets state if interrupted)
  window.addEventListener('pointercancel', (e) => {
    try {
      elements.cloudWidget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    isPotentialDrag = false;
    isDragging = false;
    setTimeout(() => { hasDragged = false; }, 180);
  });

  // Dedicated Native Touch Support for iOS / Android Web & Hybrid
  elements.cloudWidget.addEventListener('touchstart', (e) => {
    if (isInteractive(e.target)) return;
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];

    isPotentialDrag = true;
    isDragging = false;
    startX = t.clientX;
    startY = t.clientY;
    lastClientX = t.clientX;
    lastClientY = t.clientY;

    const rect = elements.cloudWidget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
  }, { passive: true });

  elements.cloudWidget.addEventListener('touchmove', (e) => {
    if (!isPotentialDrag || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    const totalDx = t.clientX - startX;
    const totalDy = t.clientY - startY;

    if (!isDragging) {
      if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) {
        isDragging = true;
        hasDragged = true;
        elements.cloudWidget.style.position = 'fixed';
        elements.cloudWidget.style.left = `${initialLeft}px`;
        elements.cloudWidget.style.top = `${initialTop}px`;
        elements.cloudWidget.style.margin = '0';
      }
    }

    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      elements.cloudWidget.style.left = `${Math.max(10, Math.min(window.innerWidth - 80, initialLeft + totalDx))}px`;
      elements.cloudWidget.style.top = `${Math.max(10, Math.min(window.innerHeight - 80, initialTop + totalDy))}px`;
    }
  }, { passive: false });

  elements.cloudWidget.addEventListener('touchend', (e) => {
    if (!isPotentialDrag) return;
    if (!isDragging) {
      handlePoke();
    } else {
      setTimeout(() => { hasDragged = false; }, 180);
    }
    isPotentialDrag = false;
    isDragging = false;
  }, { passive: true });
}

// ==========================================
// 10.5 NATIVE MOBILE APP CONTROLLER (PASTEL UI)
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initSettingsTab() {
  // 1. Companion Card
  const petSwitch = document.getElementById('settingsTogglePetSwitch');
  if (petSwitch) {
    petSwitch.checked = state.showFloatingPet !== false;
    petSwitch.addEventListener('change', (e) => {
      setFloatingPetVisibility(e.target.checked);
      playPokeSound();
    });
  }

  const settingsScaleLabel = document.getElementById('settingsScaleLabel');
  if (settingsScaleLabel) {
    settingsScaleLabel.textContent = `${(state.scale || 1.0).toFixed(2)}x`;
  }

  const slider = document.getElementById('sizeSlider');
  if (slider) {
    slider.value = state.scale || 1.0;
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setScale(val);
      if (settingsScaleLabel) settingsScaleLabel.textContent = `${val.toFixed(2)}x`;
      document.querySelectorAll('.scale-preset-pill').forEach(pill => {
        pill.classList.toggle('active', Math.abs(parseFloat(pill.getAttribute('data-scale')) - val) < 0.05);
      });
    });
  }

  document.querySelectorAll('.scale-preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const val = parseFloat(pill.getAttribute('data-scale'));
      setScale(val);
      if (slider) slider.value = val;
      if (settingsScaleLabel) settingsScaleLabel.textContent = `${val.toFixed(2)}x`;
      document.querySelectorAll('.scale-preset-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      playPokeSound();
    });
  });

  const nameInput = document.getElementById('nameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const applyName = () => {
    if (!nameInput) return;
    state.name = nameInput.value.trim() || 'Chibi';
    localStorage.setItem('bongo_name', state.name);
    updateDockDisplay();
    playPokeSound();
    showBubbleMessage(`Companion name saved: "${state.name}"! 🐾`, 2200);
  };
  if (nameInput) {
    nameInput.value = state.name || 'Chibi';
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyName(); }
    });
  }
  saveNameBtn?.addEventListener('click', applyName);

  // 2. Dashboard Card
  const toggleTasks = document.getElementById('toggleShowTasks');
  if (toggleTasks) {
    toggleTasks.checked = nookiProductivityState.modules.tasks !== false;
    toggleTasks.addEventListener('change', (e) => {
      nookiProductivityState.modules.tasks = e.target.checked;
      saveProductivityState();
      updateProductivityUI();
    });
  }

  const toggleWater = document.getElementById('toggleShowWater');
  if (toggleWater) {
    toggleWater.checked = nookiProductivityState.modules.water !== false;
    toggleWater.addEventListener('change', (e) => {
      nookiProductivityState.modules.water = e.target.checked;
      saveProductivityState();
      updateProductivityUI();
    });
  }

  const toggleWardrobe = document.getElementById('toggleShowWardrobe');
  if (toggleWardrobe) {
    const showW = localStorage.getItem('nooki_show_wardrobe') !== 'false';
    toggleWardrobe.checked = showW;
    const wardrobeCard = document.getElementById('dashWardrobeCarousel')?.closest('.clay-card');
    if (wardrobeCard) wardrobeCard.style.display = showW ? 'flex' : 'none';
    toggleWardrobe.addEventListener('change', (e) => {
      localStorage.setItem('nooki_show_wardrobe', e.target.checked.toString());
      if (wardrobeCard) wardrobeCard.style.display = e.target.checked ? 'flex' : 'none';
    });
  }

  const toggleDrop = document.getElementById('toggleShowDrop');
  if (toggleDrop) {
    const showD = localStorage.getItem('nooki_show_drop') !== 'false';
    toggleDrop.checked = showD;
    const dropCard = document.querySelector('.dash-drop-quick-card');
    if (dropCard) dropCard.style.display = showD ? 'flex' : 'none';
    toggleDrop.addEventListener('change', (e) => {
      localStorage.setItem('nooki_show_drop', e.target.checked.toString());
      if (dropCard) dropCard.style.display = e.target.checked ? 'flex' : 'none';
    });
  }

  const toggleCounter = document.getElementById('counterToggle');
  if (toggleCounter) {
    toggleCounter.checked = state.countKeystrokes !== false;
    toggleCounter.addEventListener('change', (e) => {
      state.countKeystrokes = e.target.checked;
      localStorage.setItem('bongo_count_enabled', state.countKeystrokes.toString());
      updateDockDisplay();
      playPokeSound();
      showBubbleMessage(state.countKeystrokes ? "Keystroke counter ON! ⌨️" : "Keystroke counter OFF! ⌨️", 2000);
    });
  }

  // 3. Sound & Reminders Card
  const soundSwitch = document.getElementById('settingsSoundToggle');
  if (soundSwitch) {
    soundSwitch.checked = state.soundEnabled !== false;
    soundSwitch.addEventListener('change', (e) => {
      state.soundEnabled = e.target.checked;
      localStorage.setItem('nooki_sound_enabled', state.soundEnabled.toString());
      if (state.soundEnabled) playPokeSound();
    });
  }

  const volumeSlider = document.getElementById('soundVolumeSlider');
  const volumeLabel = document.getElementById('soundVolumeLabel');
  if (volumeSlider) {
    const savedVol = localStorage.getItem('nooki_sound_volume') || '80';
    volumeSlider.value = savedVol;
    if (volumeLabel) volumeLabel.textContent = `${savedVol}%`;
    volumeSlider.addEventListener('input', (e) => {
      localStorage.setItem('nooki_sound_volume', e.target.value);
      if (volumeLabel) volumeLabel.textContent = `${e.target.value}%`;
    });
  }

  const waterReminderSwitch = document.getElementById('settingsWaterReminderToggle');
  if (waterReminderSwitch) {
    waterReminderSwitch.checked = localStorage.getItem('nooki_water_reminder') !== 'false';
    waterReminderSwitch.addEventListener('change', (e) => {
      localStorage.setItem('nooki_water_reminder', e.target.checked.toString());
    });
  }

  const waterInterval = document.getElementById('waterIntervalSelect');
  if (waterInterval) {
    waterInterval.value = localStorage.getItem('nooki_water_interval') || '60';
    waterInterval.addEventListener('change', (e) => {
      localStorage.setItem('nooki_water_interval', e.target.value);
    });
  }

  const quietHoursSwitch = document.getElementById('settingsQuietHoursToggle');
  if (quietHoursSwitch) {
    quietHoursSwitch.checked = localStorage.getItem('nooki_quiet_hours') === 'true';
    quietHoursSwitch.addEventListener('change', (e) => {
      localStorage.setItem('nooki_quiet_hours', e.target.checked.toString());
    });
  }

  // 4. Daily Goals Card
  const resetSelect = document.getElementById('dailyResetSelect');
  if (resetSelect) {
    resetSelect.value = localStorage.getItem('nooki_reset_time') || '00:00';
    resetSelect.addEventListener('change', (e) => {
      localStorage.setItem('nooki_reset_time', e.target.value);
    });
  }

  const weightInput = document.getElementById('userWeightInput');
  if (weightInput) {
    weightInput.value = localStorage.getItem('nooki_user_weight') || '65';
    weightInput.addEventListener('change', (e) => {
      localStorage.setItem('nooki_user_weight', e.target.value);
    });
  }

  const waterGoalInput = document.getElementById('dailyWaterGoalInput');
  if (waterGoalInput) {
    const currentGoalMl = (nookiProductivityState.hydration?.targetGlasses || 8) * 250;
    waterGoalInput.value = currentGoalMl;
    waterGoalInput.addEventListener('change', (e) => {
      const ml = Math.max(250, parseInt(e.target.value, 10) || 2000);
      const glassSize = parseInt(document.getElementById('glassSizeInput')?.value, 10) || 250;
      nookiProductivityState.hydration.targetGlasses = Math.max(1, Math.round(ml / glassSize));
      localStorage.setItem('nooki_daily_water_goal', ml.toString());
      saveProductivityState();
      updateProductivityUI();
      showBubbleMessage(`Water goal updated to ${ml.toLocaleString()} ml! 💧`, 2000);
    });
  }

  const glassSizeInput = document.getElementById('glassSizeInput');
  if (glassSizeInput) {
    glassSizeInput.value = localStorage.getItem('nooki_glass_size') || '250';
    glassSizeInput.addEventListener('change', (e) => {
      localStorage.setItem('nooki_glass_size', e.target.value);
    });
  }

  // 5. Trusted Devices Card
  function renderTrustedDevices() {
    const list = document.getElementById('trustedDevicesList');
    if (!list) return;
    list.innerHTML = '';

    let devices = [];
    try {
      const raw = localStorage.getItem('nooki_trusted_devices');
      if (raw) devices = JSON.parse(raw);
    } catch (_) {}

    if (!Array.isArray(devices) || devices.length === 0) {
      devices = [
        { id: 'dev-1', name: 'MacBook Air (Local)', type: '💻' },
        { id: 'dev-2', name: 'iPhone 15 Pro (Wi-Fi Drop)', type: '📱' }
      ];
      localStorage.setItem('nooki_trusted_devices', JSON.stringify(devices));
    }

    devices.forEach((dev) => {
      const li = document.createElement('li');
      li.className = 'trusted-device-item';
      li.innerHTML = `
        <div class="trusted-device-info">
          <span>${dev.type || '📱'}</span>
          <span>${escapeHtml(dev.name)}</span>
        </div>
      `;
      const remBtn = document.createElement('button');
      remBtn.type = 'button';
      remBtn.className = 'trusted-device-remove-btn';
      remBtn.textContent = 'Remove';
      remBtn.addEventListener('click', () => {
        devices = devices.filter(d => d.id !== dev.id);
        localStorage.setItem('nooki_trusted_devices', JSON.stringify(devices));
        renderTrustedDevices();
        playPokeSound();
        showBubbleMessage(`Removed ${dev.name}! 🗑️`, 1800);
      });
      li.appendChild(remBtn);
      list.appendChild(li);
    });
  }
  renderTrustedDevices();

  // 6. App & Data Card
  const startupToggle = document.getElementById('settingsStartupToggle');
  if (startupToggle) {
    startupToggle.checked = localStorage.getItem('nooki_startup') === 'true';
    startupToggle.addEventListener('change', (e) => {
      localStorage.setItem('nooki_startup', e.target.checked.toString());
      if (window.desktopAPI?.setOpenAtLogin) window.desktopAPI.setOpenAtLogin(e.target.checked);
    });
  }

  const alwaysOnTopToggle = document.getElementById('settingsAlwaysOnTopToggle');
  if (alwaysOnTopToggle) {
    alwaysOnTopToggle.checked = localStorage.getItem('nooki_always_on_top') === 'true';
    alwaysOnTopToggle.addEventListener('change', (e) => {
      localStorage.setItem('nooki_always_on_top', e.target.checked.toString());
      if (window.desktopAPI?.setAlwaysOnTop) window.desktopAPI.setAlwaysOnTop(e.target.checked);
    });
  }

  // Theme Colour Pills
  document.querySelectorAll('.theme-color-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const color = pill.getAttribute('data-color');
      document.querySelectorAll('.theme-color-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      document.documentElement.style.setProperty('--color-primary', color);
      document.documentElement.style.setProperty('--clay-purple', color);
      localStorage.setItem('nooki_theme_color', color);
      playPokeSound();
    });
  });

  // Backup & Restore
  document.getElementById('backupDataBtn')?.addEventListener('click', () => {
    const backupObj = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      backupObj[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nooki-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showBubbleMessage("Settings & progress exported! 📥✨", 2500);
  });

  const restoreInput = document.getElementById('restoreFileInput');
  document.getElementById('restoreDataBtn')?.addEventListener('click', () => {
    restoreInput?.click();
  });

  restoreInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
        showBubbleMessage("Backup restored! Reloading... 🔄", 2000);
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        alert("Failed to restore backup: Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  });

  // Reset Everything Button
  document.getElementById('resetAllDataBtn')?.addEventListener('click', () => {
    if (confirm("Reset everything in Nooki? This will clear all quests, wardrobe unlocks, hydration, and settings.")) {
      localStorage.clear();
      showBubbleMessage("Nooki reset to defaults! Reloading... 🔄", 2000);
      setTimeout(() => location.reload(), 800);
    }
  });
}

function init() {
  setScale(state.scale, false);
  elements.nameInput.value = state.name;
  scheduleIdleSleep();

  // Initialize Nooki Productivity Module
  if (elements.toggleShowWater) elements.toggleShowWater.checked = nookiProductivityState.modules.water;
  if (elements.toggleShowStreak) elements.toggleShowStreak.checked = nookiProductivityState.modules.streak;
  if (elements.toggleShowTasks) elements.toggleShowTasks.checked = nookiProductivityState.modules.tasks;
  updateProductivityUI();

  // Initialize Nooki Wardrobe & Customization
  applyWardrobe();
  updateWardrobeUI();

  // Initialize Native Mobile App Module
  
  

  // Apply Initial Mode (Desktop vs Mobile)
  const savedMode = localStorage.getItem('nooki_device_mode') || 'desktop';
  applyMode(savedMode, false);

  // Desktop Electron / Native Bridge Detection
  if (window.desktopAPI?.isDesktop) {
    document.body.classList.add('mode-desktop');
    if (isPetWindow) {
      document.body.classList.add('mode-pet-window', 'mode-mini-pet');
      initPetWindowMousePassThrough();
    } else {
      document.body.classList.add('mode-main-window');
      if (new URLSearchParams(window.location.search).get('chrome') === 'native') {
        document.body.classList.add('native-titlebar');
      }
    }
    applyMode('desktop', false);
  }

  // Mobile Android Detection (Keystroke counter not needed on mobile)
  if (window.AndroidBridge || navigator.userAgent.includes('Android')) {
    applyMode('mobile', false);

    document.getElementById('launchOverlayBtn')?.addEventListener('click', () => {
      window.AndroidBridge?.launchOverlay();
    });

    document.getElementById('pinWidgetBtn')?.addEventListener('click', () => {
      window.AndroidBridge?.pinWidget();
    });
  }

  // Mode Switcher Buttons (Allows testing Desktop and Mobile anytime)
  elements.modeDesktopBtn?.addEventListener('click', () => {
    applyMode('desktop');
    playPokeSound();
    showBubbleMessage("Switched to Desktop Mode! 🖥️ Keystrokes on cloud.", 2500);
  });

  elements.modeMobileBtn?.addEventListener('click', () => {
    applyMode('mobile');
    playPokeSound();
    showBubbleMessage("Switched to Mobile Mode! 📱 Battery optimized.", 2500);
  });

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
    if (e.target.closest('#menuBtn, #prodBtn, #wardrobeBtn, #dropBtn, #popoverMenu, #productivityDrawer, #wardrobeDrawer, #dropDrawer, #resizeHandle, input, button')) {
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
    if (state.isProductivityOpen && !e.target.closest('#productivityDrawer, #prodBtn, #viewProductivityBtn')) {
      closeProductivityDrawer();
    }
    if (state.isWardrobeOpen && !e.target.closest('#wardrobeDrawer, #viewWardrobeBtn')) {
      closeWardrobeDrawer();
    }
  });

  // Nooki Wardrobe & Customization Listeners
  elements.viewWardrobeBtn?.addEventListener('click', toggleWardrobeDrawer);
  elements.closeWardrobeBtn?.addEventListener('click', closeWardrobeDrawer);

  elements.genderMaleBtn?.addEventListener('click', () => setWardrobeGender('male'));
  elements.genderFemaleBtn?.addEventListener('click', () => setWardrobeGender('female'));

  elements.wardrobeTabs?.querySelectorAll('.w-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const cat = tab.getAttribute('data-cat');
      updateWardrobeUI(cat);
      playPokeSound();
    });
  });

  // Nooki Productivity Module Listeners
  elements.prodBtn?.addEventListener('click', toggleProductivityDrawer);
  elements.closeProdBtn?.addEventListener('click', closeProductivityDrawer);
  elements.viewProductivityBtn?.addEventListener('click', toggleProductivityDrawer);

  elements.waterAddBtn?.addEventListener('click', () => {
    const target = nookiProductivityState.hydration?.targetGlasses || 8;
    nookiProductivityState.hydration.currentGlasses = Math.min(target, (nookiProductivityState.hydration.currentGlasses || 0) + 1);
    saveProductivityState();
    celebrateHydration(nookiProductivityState.hydration.currentGlasses);
    updateProductivityUI();
  });

  elements.waterSubBtn?.addEventListener('click', () => {
    nookiProductivityState.hydration.currentGlasses = Math.max(0, nookiProductivityState.hydration.currentGlasses - 1);
    saveProductivityState();
    updateProductivityUI();
  });

  elements.waterResetBtn?.addEventListener('click', () => {
    nookiProductivityState.hydration.currentGlasses = 0;
    saveProductivityState();
    updateProductivityUI();
    playPokeSound();
    showBubbleMessage("Hydration counter reset! 💧", 2000);
  });

  document.getElementById('dashWaterResetBtn')?.addEventListener('click', () => {
    nookiProductivityState.hydration.currentGlasses = 0;
    saveProductivityState();
    updateProductivityUI();
    playPokeSound();
    showBubbleMessage("Water Well reset for today! 💧", 2000);
  });

  // Global Helper: Add New Task from Dashboard or Productivity Center
  function addNewTask(rawText) {
    const text = (rawText || '').trim();
    if (!text) {
      // Empty box: show a gentle hint instead of doing nothing
      ['taskInput', 'fullTaskInput'].forEach((id) => {
        const box = document.getElementById(id);
        if (!box) return;
        if (!box.dataset.hintHome) box.dataset.hintHome = box.placeholder;
        box.placeholder = 'Type a quest first ✏️';
        setTimeout(() => { box.placeholder = box.dataset.hintHome; }, 2500);
      });
      showBubbleMessage('Type a quest first ✏️', 2200);
      return;
    }
    nookiProductivityState.tasks.push({
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: new Date().toISOString()
    });
    saveProductivityState();
    updateProductivityUI();
    playPokeSound();
    showBubbleMessage(`Task added: "${text}" 📝✨`, 2200);
  }

  // 1. Dashboard Task Form Submit & Plus Button
  elements.taskAddForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (elements.taskInput) {
      addNewTask(elements.taskInput.value);
      elements.taskInput.value = '';
    }
  });
  document.getElementById('taskAddBtn')?.addEventListener('click', (e) => {
    if (elements.taskInput && elements.taskInput.value.trim()) {
      e.preventDefault();
      addNewTask(elements.taskInput.value);
      elements.taskInput.value = '';
    }
  });

  // 2. Productivity Center Window Task Form Submit & Plus Button
  const fullTaskForm = document.getElementById('fullTaskAddForm');
  const fullTaskInput = document.getElementById('fullTaskInput');
  const fullTaskBtn = document.getElementById('fullTaskAddBtn');

  fullTaskForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (fullTaskInput) {
      addNewTask(fullTaskInput.value);
      fullTaskInput.value = '';
    }
  });
  fullTaskBtn?.addEventListener('click', (e) => {
    if (fullTaskInput && fullTaskInput.value.trim()) {
      e.preventDefault();
      addNewTask(fullTaskInput.value);
      fullTaskInput.value = '';
    }
  });

  // Clear Done Tasks Button (Productivity Center & Dashboard)
  const handleClearDoneTasks = () => {
    const prevCount = nookiProductivityState.tasks.length;
    nookiProductivityState.tasks = nookiProductivityState.tasks.filter(t => !t.completed);
    const removed = prevCount - nookiProductivityState.tasks.length;
    saveProductivityState();
    updateProductivityUI();
    playPokeSound();
    if (removed > 0) {
      showBubbleMessage(`Cleared ${removed} done item${removed === 1 ? '' : 's'}! 🗑️✨`, 2500);
    }
  };
  elements.clearDoneTasksBtn?.addEventListener('click', handleClearDoneTasks);
  document.getElementById('dashClearDoneTasksBtn')?.addEventListener('click', handleClearDoneTasks);

  // Buy Streak Shield Button (50 XP)
  const buyShieldAction = () => {
    if (nookiProductivityState.exp >= 50) {
      nookiProductivityState.exp -= 50;
      nookiProductivityState.streak.shields = (nookiProductivityState.streak.shields || 0) + 1;
      saveProductivityState();
      updateProductivityUI();
      playPokeSound();
      showBubbleMessage("Streak Shield purchased! 🛡️✨ Your streak is safe.", 3000);
    } else {
      showBubbleMessage(`Need 50 XP to buy a shield! You have ${nookiProductivityState.exp} XP. (+15 XP per task) ⭐`, 3000);
    }
  };

  elements.buyShieldBtn?.addEventListener('click', buyShieldAction);
  document.getElementById('fullBuyShieldBtn')?.addEventListener('click', buyShieldAction);

  // Initialize Settings & Options Screen (6 Soft Rounded Cards with Switches)
  initSettingsTab();

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
  elements.resetCountBtn?.addEventListener('click', () => {
    state.keyCount = 0;
    if (elements.counterNum) elements.counterNum.textContent = '0';
    if (elements.floatingCounterNum) elements.floatingCounterNum.textContent = '0';
    const dashKey = document.getElementById('dashKeyCount');
    if (dashKey) dashKey.textContent = '0';
    localStorage.setItem('bongo_count', '0');
    playPokeSound();
    showBubbleMessage("Count reset to 0! 🔄", 2500);
  });

  // Tap Keystroke Counter Badge -> Poke reaction
  if (elements.keystrokeBadge) {
    elements.keystrokeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePoke();
    });
  }
  if (elements.floatingKeystrokeBadge) {
    elements.floatingKeystrokeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePoke();
    });
  }

  // ==========================================
  // VOICE-TO-TEXT (SPEECH RECOGNITION) ENGINE
  // ==========================================
  let currentSpeechRecognition = null;
  let activeMicButton = null;

  function setupVoiceRecognition(buttonId, targetInputId, onFinalResult = null) {
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(targetInputId);
    if (!btn || !input) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // If Android Native Bridge has speech recognition, use it
      if (window.AndroidBridge?.startSpeechRecognition) {
        playPokeSound();
        btn.classList.add('listening');
        window.AndroidBridge.startSpeechRecognition(targetInputId);
        return;
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        showBubbleMessage("Speech recognition isn't supported in this browser. Try Chrome or Android app! 🎙️", 3500);
        return;
      }

      if (currentSpeechRecognition && activeMicButton === btn) {
        currentSpeechRecognition.stop();
        currentSpeechRecognition = null;
        btn.classList.remove('listening');
        return;
      }

      if (currentSpeechRecognition) {
        currentSpeechRecognition.abort();
        if (activeMicButton) activeMicButton.classList.remove('listening');
      }

      try {
        const recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

        currentSpeechRecognition = recognition;
        activeMicButton = btn;
        btn.classList.add('listening');
        playPokeSound();
        showBubbleMessage("Listening... Speak now! 🎙️✨", 4000);

        const originalVal = input.value;

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            input.value = originalVal ? `${originalVal} ${transcript}` : transcript;
          }
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          btn.classList.remove('listening');
          currentSpeechRecognition = null;
          if (event.error === 'not-allowed') {
            showBubbleMessage("Microphone permission denied! Please allow mic access. 🎙️", 3500);
          } else if (event.error !== 'no-speech') {
            showBubbleMessage("Couldn't hear you clearly! Please try again. 🎙️", 2500);
          }
        };

        recognition.onend = () => {
          btn.classList.remove('listening');
          currentSpeechRecognition = null;
          if (input.value.trim() && onFinalResult) {
            onFinalResult(input.value.trim());
          }
        };

        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        btn.classList.remove('listening');
        currentSpeechRecognition = null;
        showBubbleMessage("Speech recognition error: " + err.message, 3000);
      }
    });
  }

  // Hook up mic buttons for tasks
  setupVoiceRecognition('taskMicBtn', 'taskInput');
  setupVoiceRecognition('fullTaskMicBtn', 'fullTaskInput');
  setupVoiceRecognition('mQuickTaskMicBtn', 'mQuickTaskInput');
  setupVoiceRecognition('mFullTaskMicBtn', 'mFullTaskInput');

  // Global native bridge callback for Android
  window.handleNativeSpeechResult = (targetInputId, text) => {
    const input = document.getElementById(targetInputId);
    if (input) {
      input.value = input.value ? `${input.value} ${text}` : text;
      playPokeSound();
      showBubbleMessage(`Transcribed: "${text}" 🎙️✨`, 2500);
    }
    document.querySelectorAll('.m-mic-btn, .mic-btn').forEach(b => b.classList.remove('listening'));
  };

  // Enable Draggable
  initDraggable();

  // Initialize Live 2D Rigging, Gaze Tracking & Blinking
  window.addEventListener('mousemove', handlePointerMove);
  // Desktop app: follow the mouse anywhere on the screen, not only over this window
  if (window.desktopAPI && typeof window.desktopAPI.onCursorPos === 'function') {
    window.desktopAPI.onCursorPos((x, y) => handlePointerMove({ clientX: x, clientY: y }));
  }
  scheduleNextBlink();
  autonomousSaccade();
  if (!eyeAnimFrame) eyeAnimFrame = requestAnimationFrame(updateEyeGaze);

  // Initialize All-in-One Desktop App Tabs & Window Controls
  initDesktopAppTabs();

  // Initialize Floating Screen Pet Visibility & Scalability
  setFloatingPetVisibility(state.showFloatingPet, false);
  initFloatingPetResize();
  updateDockDisplay();

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

// ==========================================
// ALL-IN-ONE DESKTOP APPLICATION CONTROLLER
// Supports Dual-Mode: Full Dashboard + Floating Screen Pet
// ==========================================
function toggleDashboardApp(forceOpen) {
  const isMini = document.body.classList.contains('mode-mini-pet');
  const shouldOpen = forceOpen !== undefined ? forceOpen : isMini;

  if (window.desktopAPI && typeof window.desktopAPI.setWindowMode === 'function') {
    window.desktopAPI.setWindowMode(shouldOpen ? 'dashboard' : 'mini');
  } else {
    // Browser Mode fallback
    if (shouldOpen) {
      document.body.classList.remove('mode-mini-pet');
      const shell = document.getElementById('desktopAppShell');
      if (shell) shell.style.display = 'flex';
      playPokeSound();
      showBubbleMessage("Welcome back to your Nooki Dashboard! ☁️✨", 2600);
    } else {
      document.body.classList.add('mode-mini-pet');
      const shell = document.getElementById('desktopAppShell');
      if (shell) shell.style.display = 'none';
      playPokeSound();
      showBubbleMessage("I'm floating on your screen! Click ⚙️ anytime to open Dashboard! 🐾", 3200);
    }
  }
}

// -------------------------------------------------------------
// Floating Screen Pet Visibility Manager (Show / Hide / Close)
// -------------------------------------------------------------
function setFloatingPetVisibility(show, save = true) {
  state.showFloatingPet = !!show;
  if (save) {
    localStorage.setItem('nooki_show_floating_pet', state.showFloatingPet ? 'true' : 'false');
  }

  if (window.desktopAPI && typeof window.desktopAPI.setPetVisible === 'function') {
    window.desktopAPI.setPetVisible(state.showFloatingPet);
  }

  const pet = elements.floatingScreenPet || document.getElementById('floatingScreenPet');
  if (pet) {
    if (state.showFloatingPet) {
      pet.style.display = 'flex';
      void pet.offsetWidth;
      pet.classList.remove('hidden');
    } else {
      pet.classList.add('hidden');
      setTimeout(() => {
        if (!state.showFloatingPet && pet) {
          pet.style.display = 'none';
        }
      }, 260);
    }
  }

  // Update button texts & checkboxes across Dashboard
  const labelText = state.showFloatingPet ? '🐾 Hide Floating Pet' : '🌟 Show Floating Pet';
  if (elements.headerTogglePetText) elements.headerTogglePetText.textContent = labelText;
  if (elements.dashTogglePetText) elements.dashTogglePetText.textContent = labelText;
  if (elements.dashHeroTogglePetBtn) {
    elements.dashHeroTogglePetBtn.innerHTML = state.showFloatingPet ? '🐾 Hide Floating Pet' : '🌟 Show Floating Pet';
  }
  if (elements.toggleFloatingPetCheckbox) {
    elements.toggleFloatingPetCheckbox.checked = state.showFloatingPet;
  }
}

// -------------------------------------------------------------
// Floating Screen Pet Resizing (Wheel Zoom, Drag Corner, Presets)
// -------------------------------------------------------------
function initFloatingPetResize() {
  const handle = elements.floatingResizeHandle || document.getElementById('floatingResizeHandle');
  const pet = elements.floatingScreenPet || document.getElementById('floatingScreenPet');
  if (!pet) return;

  // 1. Mouse Wheel Zoom directly on floating Chibi pet
  pet.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newScale = Math.min(CONFIG.maxScale, Math.max(CONFIG.minScale, state.scale + delta));
    setScale(newScale);
  }, { passive: false });

  // 2. Corner Resize Handle Pointer Drag
  if (handle) {
    let isResizing = false;
    let startX = 0, startY = 0;
    let startScale = 1.0;

    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startScale = state.scale;
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      e.stopPropagation();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const deltaScale = (dx + dy) / 160;
      const newScale = Math.min(CONFIG.maxScale, Math.max(CONFIG.minScale, startScale + deltaScale));
      setScale(newScale);
    });

    const stopResize = (e) => {
      if (!isResizing) return;
      isResizing = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    };

    handle.addEventListener('pointerup', stopResize);
    handle.addEventListener('pointercancel', stopResize);
  }

  // 3. Quick Scale Preset Buttons in Settings Tab
  document.querySelectorAll('.scale-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScale = parseFloat(btn.getAttribute('data-scale'));
      if (!isNaN(targetScale)) {
        setScale(targetScale);
        playPokeSound();
        showBubbleMessage(`Scale set to ${targetScale}x! 🔍✨`, 2000);
      }
    });
  });
}

function initPetWindowMousePassThrough() {
  if (!window.desktopAPI?.setIgnoreMouseEvents) return;

  // By default, clicks pass through the transparent areas to other apps
  window.desktopAPI.setIgnoreMouseEvents(true, { forward: true });

  window.addEventListener('mousemove', (e) => {
    if (window._isPetDragging || window._isPetPotentialDrag) {
      window.desktopAPI.setIgnoreMouseEvents(false);
      return;
    }
    const isOverPet = !!e.target.closest('.floating-screen-pet');
    if (isOverPet) {
      window.desktopAPI.setIgnoreMouseEvents(false);
    } else {
      window.desktopAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  window.addEventListener('mouseleave', () => {
    if (!window._isPetDragging && !window._isPetPotentialDrag) {
      window.desktopAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  });
}

function initFloatingPetDraggable() {
  const pet = document.getElementById('floatingScreenPet');
  if (!pet) return;

  let isPotentialDrag = false;
  let isDragging = false;
  let startScreenX = 0, startScreenY = 0;
  let initialLeft = 0, initialTop = 0;
  const DRAG_THRESHOLD = 6;

  pet.addEventListener('pointerdown', (e) => {
    // Ignore interactive controls like settings gear, close button, resize handle
    if (e.target.closest('button, input, select, textarea, a, .resize-handle')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isPotentialDrag = true;
    window._isPetPotentialDrag = true;
    isDragging = false;
    window._isPetDragging = false;
    startScreenX = e.screenX;
    startScreenY = e.screenY;

    const rect = pet.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    try { pet.setPointerCapture(e.pointerId); } catch (_) {}
  });

  pet.addEventListener('pointermove', (e) => {
    if (!isPotentialDrag) return;
    const dx = e.screenX - startScreenX;
    const dy = e.screenY - startScreenY;

    if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      isDragging = true;
      window._isPetDragging = true;
      pet.style.transition = 'none';
    }

    if (isDragging) {
      if (window.desktopAPI && typeof window.desktopAPI.moveWindowBy === 'function' && (isPetWindow || document.body.classList.contains('mode-mini-pet'))) {
        window.desktopAPI.moveWindowBy(dx, dy);
        startScreenX = e.screenX;
        startScreenY = e.screenY;
      } else {
        const newLeft = Math.max(10, Math.min(window.innerWidth - pet.offsetWidth - 10, initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - pet.offsetHeight - 10, initialTop + dy));

        pet.style.left = `${newLeft}px`;
        pet.style.top = `${newTop}px`;
        pet.style.right = 'auto';
        pet.style.bottom = 'auto';
      }
    }
  });

  const onPointerUp = (e) => {
    if (!isPotentialDrag) return;

    try { pet.releasePointerCapture(e.pointerId); } catch (_) {}
    pet.style.transition = '';

    // If movement didn't exceed drag threshold, this is a clean CLICK/POKE!
    if (!isDragging) {
      if (!e.target.closest('button, .resize-handle')) {
        handlePoke();
      }
    }

    isPotentialDrag = false;
    isDragging = false;
    window._isPetPotentialDrag = false;
    window._isPetDragging = false;
  };

  pet.addEventListener('pointerup', onPointerUp);
  pet.addEventListener('pointercancel', (e) => {
    isPotentialDrag = false;
    isDragging = false;
    window._isPetPotentialDrag = false;
    window._isPetDragging = false;
    try { pet.releasePointerCapture(e.pointerId); } catch (_) {}
    pet.style.transition = '';
  });

  // Direct click fallback on floating pet and stage
  pet.addEventListener('click', (e) => {
    if (isDragging) return;
    if (e.target.closest('button, .resize-handle')) return;
    handlePoke();
  });
}

function initDesktopAppTabs() {
  document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-screen-view').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');
        playPokeSound();
      }
    });
  });

  // Shortcut Links on Dashboard
  document.getElementById('dashSeeAllTasksBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar-tab[data-tab="tabTasks"]')?.click();
  });
  document.getElementById('dashSeeAllWardrobeBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar-tab[data-tab="tabWardrobe"]')?.click();
  });
  document.getElementById('dashSeeAllDropBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar-tab[data-tab="tabDrop"]')?.click();
  });
  document.getElementById('dashOpenDropBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar-tab[data-tab="tabDrop"]')?.click();
  });
  document.getElementById('headerDropBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar-tab[data-tab="tabDrop"]')?.click();
  });
  document.getElementById('sidebarQuickShareBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar-tab[data-tab="tabDrop"]')?.click();
  });

  // Floating Screen Pet Controls
  // ⚙️ Clicking Setting icon on floating chibi opens/displays the Dashboard!
  document.getElementById('floatingPetSettingsBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.desktopAPI && typeof window.desktopAPI.openMainWindow === 'function') {
      window.desktopAPI.openMainWindow();
    } else {
      toggleDashboardApp(true);
    }
  });

  // ✕ Close / Hide Floating Pet Button (Directly on Floating Chibi)
  document.getElementById('floatingPetCloseBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setFloatingPetVisibility(false);
    playPokeSound();
    showBubbleMessage("Floating Chibi hidden! You can show it anytime from Dashboard 🌟", 3200);
  });

  // Toggle Floating Pet on Screen (Titlebar, Greeting Bar, Hero Card, Settings Checkbox)
  document.getElementById('headerTogglePetBtn')?.addEventListener('click', () => {
    setFloatingPetVisibility(!state.showFloatingPet);
    playPokeSound();
  });
  document.getElementById('dashTogglePetBtn')?.addEventListener('click', () => {
    setFloatingPetVisibility(!state.showFloatingPet);
    playPokeSound();
  });
  document.getElementById('dashHeroTogglePetBtn')?.addEventListener('click', () => {
    setFloatingPetVisibility(!state.showFloatingPet);
    playPokeSound();
  });
  document.getElementById('toggleFloatingPetCheckbox')?.addEventListener('change', (e) => {
    setFloatingPetVisibility(e.target.checked);
    playPokeSound();
  });

  // Buttons to switch from Dashboard to Floating Mini Pet
  document.getElementById('dashFloatPetBtn')?.addEventListener('click', () => toggleDashboardApp(false));
  document.getElementById('dashHeroFloatBtn')?.addEventListener('click', () => toggleDashboardApp(false));
  document.getElementById('headerFloatPetBtn')?.addEventListener('click', () => toggleDashboardApp(false));

  // Initialize Draggable on Floating Screen Pet
  initFloatingPetDraggable();

  // Traffic Light Window Controls
  document.getElementById('winCloseBtn')?.addEventListener('click', () => {
    if (window.desktopAPI?.closeWindow) window.desktopAPI.closeWindow();
  });
  document.getElementById('winMinBtn')?.addEventListener('click', () => {
    if (window.desktopAPI?.minimizeWindow) window.desktopAPI.minimizeWindow();
  });
  document.getElementById('winMaxBtn')?.addEventListener('click', () => {
    if (window.desktopAPI?.maximizeWindow) window.desktopAPI.maximizeWindow();
  });

  // Cheer Button on Dashboard
  document.getElementById('dashCheerBtn')?.addEventListener('click', () => {
    handlePoke();
    showBubbleMessage("Yay! Chibi loves you! 💖✨ (+5 XP)", 2500);
    spawnParticle(false);
    nookiProductivityState.exp += 5;
    saveProductivityState();
    updateProductivityUI();
  });

  // Dressing Mirror Chibi Stage Click: STRICTLY POSE ANIMATION ONLY (NO POKING SQUISH!)
  document.getElementById('wardrobeCharacterStage')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cycleNextWardrobePose();
  });

  // Dedicated Pose Cheer Button (+5 XP)
  document.getElementById('wardrobePoseBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    playWardrobePose('model', true);
  });

  // Pose Pills in Pose Bar
  document.querySelectorAll('#wardrobePoseBar .pose-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pose = btn.getAttribute('data-pose');
      if (pose) playWardrobePose(pose);
    });
  });

  // Mirror Ambience Lighting Pills
  document.querySelectorAll('#wardrobeAmbienceBar .ambience-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const theme = pill.getAttribute('data-theme');
      if (theme) setWardrobeAmbience(theme, true);
    });
  });

  // Save Look Dialog & Actions
  document.getElementById('saveCurrentLookBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openSaveLookDialog();
  });
  document.getElementById('studioSaveLookBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openSaveLookDialog();
  });
  document.getElementById('closeSaveLookDialogBtn')?.addEventListener('click', closeSaveLookDialog);
  document.getElementById('cancelSaveLookBtn')?.addEventListener('click', closeSaveLookDialog);
  document.getElementById('confirmSaveLookBtn')?.addEventListener('click', () => {
    const input = document.getElementById('saveLookNameInput');
    const name = input ? input.value : '';
    saveCurrentLook(name);
    closeSaveLookDialog();
  });
  document.getElementById('saveLookNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('confirmSaveLookBtn')?.click();
    } else if (e.key === 'Escape') {
      closeSaveLookDialog();
    }
  });

  // Styling Utility Tools: Randomize & Reset
  document.getElementById('randomizeLookBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    randomizeLook();
  });
  document.getElementById('resetLookBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetLook();
  });
  document.getElementById('viewAllSavedLooksBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateWardrobeUI('saved');
  });

  // Filter Pills (All / Unlocked / XP Shop)
  document.querySelectorAll('#wardrobeFilterPills .w-filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const filter = pill.getAttribute('data-filter');
      setWardrobeFilter(filter);
    });
  });

  // Wardrobe Search Input & Clear
  const wSearch = document.getElementById('wardrobeSearchInput');
  const wClear = document.getElementById('wardrobeSearchClearBtn');
  wSearch?.addEventListener('input', (e) => {
    setWardrobeSearch(e.target.value);
  });
  wClear?.addEventListener('click', (e) => {
    if (wSearch) wSearch.value = '';
    setWardrobeSearch('');
  });

  // Load Persisted Mirror Ambience
  try {
    const savedTheme = localStorage.getItem('nooki_wardrobe_theme') || 'lavender';
    setWardrobeAmbience(savedTheme, false);
  } catch (_) {}

  // Initialize Saved Looks Rack
  updateSavedLooksUI();

  // Hydration Full Buttons
  document.getElementById('waterAddBtnFull')?.addEventListener('click', () => {
    elements.waterAddBtn?.click();
  });
  document.getElementById('waterSubBtnFull')?.addEventListener('click', () => {
    elements.waterSubBtn?.click();
  });

  // Electron Mode Listener
  if (window.desktopAPI && typeof window.desktopAPI.onWindowModeChanged === 'function') {
    window.desktopAPI.onWindowModeChanged((mode) => {
      if (mode === 'mini') {
        document.body.classList.add('mode-mini-pet');
        const shell = document.getElementById('desktopAppShell');
        if (shell) shell.style.display = 'none';
      } else {
        document.body.classList.remove('mode-mini-pet');
        const shell = document.getElementById('desktopAppShell');
        if (shell) shell.style.display = 'flex';
      }
    });
  }

  // Sync state across Electron windows (wardrobe, keystrokes, scale, pet visibility)
  window.addEventListener('storage', (e) => {
    if (e.key === 'nooki_wardrobe_state') {
      try {
        nookiWardrobeState = loadWardrobeState();
        applyWardrobe();
        updateWardrobeUI();
      } catch (_) {}
    } else if (e.key === 'bongo_count') {
      const count = parseInt(e.newValue || '0', 10);
      state.keyCount = count;
      if (elements.floatingCounterNum) elements.floatingCounterNum.textContent = count.toLocaleString();
      const dashKey = document.getElementById('dashKeyCount');
      if (dashKey) dashKey.textContent = count.toLocaleString();
    } else if (e.key === 'bongo_scale') {
      const s = parseFloat(e.newValue || '1.0');
      setScale(s, false);
    } else if (e.key === 'nooki_show_floating_pet') {
      setFloatingPetVisibility(e.newValue !== 'false', false);
    }
  });
}
