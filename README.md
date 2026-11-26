# Nooki Desktop Companion ☁️🐾

> Ultra-lightweight floating anime screen companion & keystroke counter for macOS & Windows.

## Features
- **Fluffy Cloud Pedestal**: Chibi stands directly on a fluffy floating cloud over your wallpaper and apps.
- **Keystroke Counter**: Automatically counts keystrokes as you type in code editors, design apps, or browser with paw-tapping audio and cute particle effects.
- **100% Free AI Engine**: Real answers without API keys or registrations, with multi-turn memory, math evaluation, and knowledge search.
- **Voice-to-Text (🎙️)**: Speak directly into the chat or task checklists using the microphone button.
- **Nooki Productivity**: Slide-out drawers for daily micro-tasks, habit streaks with streak shields, and hydration counter.
- **Nooki Wardrobe**: Tailored outfits, hats, and emote expressions unlocked via EXP earned from completing tasks.
- **Smooth Resizing**: Scroll wheel zoom and corner drag-to-resize.

## Getting Started

### Web / Browser Preview
```bash
npm run serve
```
Open `http://localhost:3000` in your browser.

### Run with Tauri (Recommended: ~15MB Ultra-Lightweight Rust & Native Transparency)
Requires Rust installed (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`):
```bash
npm run tauri:dev
```
To build production release:
```bash
npm run tauri:build
```

### Run with Electron (Alternative)
```bash
npm install
npm start
```

### Package for Distribution
- **macOS**: `npm run pack:mac`
- **Windows**: `npm run pack:win`

