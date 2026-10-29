# 🌸 Chibi AI Companion (Web & Floating Desktop Pet)

A 100% free, zero-login, zero-API-key AI companion with live anime animations, interactive poke reactions, voice chimes, and dual deployment modes: **Static GitHub Pages Web App** and **Frameless Floating Desktop Pet (Electron / Tauri)**.

---

## 🌟 Features

- **100% Free Public AI Backend**: Uses Pollinations.ai text endpoint with zero signups, zero credit cards, and zero API keys needed.
- **Dual Mode (Web & Desktop Pet)**:
  - **Web App**: Hosted for free on GitHub Pages. Responsive on desktop and mobile.
  - **Desktop Floating Pet**: Frameless, transparent background window (`alwaysOnTop: true`), draggable anywhere on your screen!
- **Interactive Chibi Character**:
  - **Idle**: Gentle breathing and shadow animation.
  - **Thinking**: Curious tilt and thought bubble with pulsing dots.
  - **Talking**: Energetic bounce with live speech bubble typewriter animation.
  - **Poke Interaction**: Click or tap the chibi for squash-and-stretch reactions, flying heart particles, and cute sound effects!
  - **Pet Mode Toggle**: Click the 🐾 button to shrink the window into a compact floating desktop pet.
- **Built-in Web Audio Synthesizer**: Generates 8-bit chimes and squeaks natively with no external sound files required.

---

## 🏗️ Architecture & Framework Comparison

| Feature | **Web (GitHub Pages)** | **Electron Desktop Pet** | **Tauri Desktop Pet** |
| :--- | :--- | :--- | :--- |
| **Setup Cost** | 100% Free | 100% Free | 100% Free |
| **Window Frame** | Browser window | Frameless, Transparent | Frameless, Transparent |
| **Screen Floating** | Inside tab | `alwaysOnTop: true` | `alwaysOnTop: true` |
| **Memory Usage** | Tab memory (~40MB) | Chromium runtime (~90MB) | Native OS Webview (~25MB) |
| **Ease of Setup** | Upload files & done | `npm install && npm start` | Requires Rust & Tauri CLI |
| **Draggable Pet** | N/A | `-webkit-app-region: drag` | `tauri-drag-region` |

---

## 🚀 Quick Start: Running as a Floating Desktop Pet (Electron)

### 1. Open the Project Folder
```bash
cd /Users/yumeokoete/.gemini/antigravity/scratch/chibi-ai-chat
```

### 2. Install Electron
```bash
npm install electron --save-dev
```

### 3. Launch the Floating Chibi Pet!
```bash
npm start
```
Your chibi will instantly appear floating at the bottom-right of your screen over all your applications!
- **Drag**: Click and drag the top title bar to move your chibi anywhere.
- **Poke**: Click your chibi to get cute squeaks and heart particles.
- **Compact Pet Mode**: Click the **🐾** button to hide the chat window and keep only the floating chibi character.

---

## 🌐 Quick Start: Deploying to GitHub Pages (100% Free)

1. **Create a GitHub Account**: Sign up for free at [github.com](https://github.com).
2. **Create a New Repository**: Click **New Repository**, name it `chibi-ai-chat`, set it to **Public**, and initialize with a README.
3. **Upload Your Files**: Click **Add file** -> **Upload files**, drag and drop:
   - `index.html`
   - `style.css`
   - `script.js`
   - The `assets/` folder (with `chibi-transparent.png` and `chibi.png`)
   - Click **Commit changes**.
4. **Enable GitHub Pages**:
   - Go to your repository **Settings** tab.
   - On the left sidebar, click **Pages**.
   - Under *Build and deployment*, set Source to **Deploy from a branch**, select `main` (or `master`), and root `/`. Click **Save**.
5. **Get Your Live URL**:
   Within a minute, your link will be live at:
   `https://<your-username>.github.io/chibi-ai-chat`

---

## 🦀 Optional: Tauri Setup

If you prefer Tauri for ultra-low memory consumption:
1. Ensure Rust is installed: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Run `npm install -D @tauri-apps/cli`
3. Run `npx tauri init`
4. In `src-tauri/tauri.conf.json`, set:
   ```json
   "windows": [
     {
       "title": "Chibi Companion",
       "width": 380,
       "height": 550,
       "transparent": true,
       "decorations": false,
       "alwaysOnTop": true
     }
   ]
   ```
5. Run `npx tauri dev`

