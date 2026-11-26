/**
 * Nooki Cloud Drop - Cross-Platform Wi-Fi File Sharing System
 * - Zero-config LAN AirDrop alternative for Desktop, iOS & Android
 * - Direct HTTP chunked streaming (No file size limit, 10 GB+ support)
 * - Nooki Companion Reactions, Drag-over Cloud, and Transfer progress
 */

(function() {
  'use strict';

  // Detect Platform
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
  const isWin = /Windows/.test(ua);

  let defaultDeviceType = 'desktop';
  let defaultDeviceName = 'Desktop Companion';
  if (isIOS) {
    defaultDeviceType = 'ios';
    defaultDeviceName = 'iPhone (iOS)';
  } else if (isAndroid) {
    defaultDeviceType = 'android';
    defaultDeviceName = 'Android Phone';
  } else if (isMac) {
    defaultDeviceType = 'mac';
    defaultDeviceName = 'Mac Desktop';
  } else if (isWin) {
    defaultDeviceType = 'windows';
    defaultDeviceName = 'Windows PC';
  }

  // Persistent Device ID & User-configured Name
  const STORAGE_KEY_ID = 'nooki_drop_device_id';
  const STORAGE_KEY_NAME = 'nooki_drop_device_name';
  let myDeviceId = localStorage.getItem(STORAGE_KEY_ID);
  if (!myDeviceId) {
    myDeviceId = 'dev-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(STORAGE_KEY_ID, myDeviceId);
  }
  let myDeviceName = localStorage.getItem(STORAGE_KEY_NAME) || defaultDeviceName;

  // Nooki Drop State
  const dropState = {
    myId: myDeviceId,
    myName: myDeviceName,
    myType: defaultDeviceType,
    selectedPeerId: null,
    peers: [],
    networkInfo: null,
    isDrawerOpen: false,
    activeTransfers: {}, // transferId -> { name, size, progress, speed, status }
    transferHistory: [],
    serverHost: window.location.origin
  };

  // Helper: Format bytes into KB / MB / GB
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Helper: Get icon based on device type
  function getDeviceIcon(type) {
    if (type === 'ios') return '📱';
    if (type === 'android') return '🤖';
    if (type === 'mac') return '💻';
    if (type === 'windows') return '🖥️';
    return '💻';
  }

  // Helper: Get file type emoji
  function getFileIcon(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) return '🎵';
    if (['pdf'].includes(ext)) return '📕';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['apk', 'dmg', 'exe', 'ipa'].includes(ext)) return '🚀';
    if (['txt', 'md', 'doc', 'docx'].includes(ext)) return '📄';
    return '📁';
  }

  // ==========================================
  // 1. API COMMUNICATION & PEER DISCOVERY
  // ==========================================

  // Fetch local Wi-Fi info & QR Code from server
  async function fetchNetworkInfo() {
    try {
      const res = await fetch(`${dropState.serverHost}/api/network-info`);
      if (res.ok) {
        dropState.networkInfo = await res.json();
        updateNetworkUI();
      }
    } catch (e) {
      console.warn('[NookiDrop] Network info fetch error:', e.message);
    }
  }

  // Announce presence (heartbeat)
  async function announcePresence() {
    try {
      const res = await fetch(`${dropState.serverHost}/api/drop/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropState.myId,
          name: dropState.myName,
          type: dropState.myType
        })
      });
      if (res.ok) {
        const data = await res.json();
        dropState.peers = data.peers || [];
        // Auto-select first peer if none selected
        if (!dropState.selectedPeerId && dropState.peers.length > 0) {
          dropState.selectedPeerId = dropState.peers[0].id;
        }
        renderPeersList();
      }
    } catch (e) {
      // Offline / standalone mode
    }
  }

  // Check for incoming pending transfers
  async function checkPendingTransfers() {
    try {
      const res = await fetch(`${dropState.serverHost}/api/drop/pending?targetId=${dropState.myId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pending && data.pending.length > 0) {
          for (const item of data.pending) {
            handleIncomingTransferNotice(item);
          }
        }
      }
    } catch (e) {}
  }

  // ==========================================
  // 2. FILE STREAMING ENGINE (Zero RAM overhead)
  // ==========================================

  // Stream send file to target peer or broadcast
  function sendFile(file, targetPeerId) {
    if (!file) return;

    const targetId = targetPeerId || dropState.selectedPeerId || 'all';
    const targetPeer = dropState.peers.find(p => p.id === targetId);
    const targetName = targetPeer ? targetPeer.name : 'Wi-Fi Devices';
    const transferId = 'xfer-' + Date.now();

    showTransferHUD(file.name, file.size, 'Uploading to ' + targetName);

    // Trigger Nooki excited bongo animation during send
    if (typeof animateBongoPaw === 'function') {
      let pawToggle = false;
      const bongoInterval = setInterval(() => {
        if (!dropState.activeTransfers[transferId]) {
          clearInterval(bongoInterval);
          return;
        }
        pawToggle = !pawToggle;
        animateBongoPaw(pawToggle);
      }, 160);
    }

    dropState.activeTransfers[transferId] = {
      name: file.name,
      size: file.size,
      progress: 0,
      startTime: Date.now()
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${dropState.serverHost}/api/drop/upload`, true);

    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-file-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-file-size', file.size.toString());
    xhr.setRequestHeader('x-sender-name', encodeURIComponent(dropState.myName));
    xhr.setRequestHeader('x-sender-id', dropState.myId);
    xhr.setRequestHeader('x-target-id', targetId);

    const startTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
        const speedBytesPerSec = e.loaded / elapsedSec;
        const speedFormatted = formatBytes(speedBytesPerSec) + '/s';

        updateTransferHUD(percent, speedFormatted);
      }
    };

    xhr.onload = () => {
      delete dropState.activeTransfers[transferId];
      hideTransferHUD();

      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText || '{}');
        // Success celebration
        if (typeof showBubbleMessage === 'function') {
          showBubbleMessage(`🎉 Sent "${file.name}" to ${targetName}! (${formatBytes(file.size)})`, 4500);
        }
        if (typeof triggerPokeRig === 'function') triggerPokeRig();
        if (typeof playPokeSound === 'function') playPokeSound();

        addTransferHistory({
          type: 'sent',
          fileName: file.name,
          fileSize: file.size,
          targetName: targetName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        alert('Upload failed: ' + xhr.statusText);
      }
    };

    xhr.onerror = () => {
      delete dropState.activeTransfers[transferId];
      hideTransferHUD();
      alert('Network transfer error occurred.');
    };

    // Stream raw file blob directly! (Zero buffer copying)
    xhr.send(file);
  }

  // Handle incoming transfer notice
  const handledTransfers = new Set();
  function handleIncomingTransferNotice(item) {
    if (handledTransfers.has(item.transferId)) return;
    handledTransfers.add(item.transferId);

    const fileName = item.fileName || 'file.bin';
    const fileSize = formatBytes(item.fileSize);
    const sender = item.senderName || 'Companion';

    // On Desktop Electron: server.js already streamed the file straight into Downloads/NookiDrop!
    const isDesktopApp = window.desktopAPI?.isDesktop;

    if (isDesktopApp) {
      if (typeof showBubbleMessage === 'function') {
        showBubbleMessage(`📥 Received from ${sender}:\n"${fileName}" (${fileSize})!\nSaved to Downloads ✨`, 6000);
      }
      if (typeof triggerPokeRig === 'function') triggerPokeRig();
      if (typeof playPokeSound === 'function') playPokeSound();

      addTransferHistory({
        type: 'received',
        fileName,
        fileSize: item.fileSize,
        senderName: sender,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      // Acknowledge receipt
      fetch(`${dropState.serverHost}/api/drop/ack/${item.transferId}`, { method: 'POST' }).catch(() => {});
      return;
    }

    // On Mobile (iOS / Android): Prompt user with download action
    if (typeof showBubbleMessage === 'function') {
      showBubbleMessage(`📦 ${sender} sent you "${fileName}" (${fileSize})! Tap to download!`, 7000);
    }
    if (typeof playPokeSound === 'function') playPokeSound();

    showIncomingTransferModal(item);
  }

  // Show incoming transfer confirmation modal on mobile
  function showIncomingTransferModal(item) {
    const modal = document.getElementById('nookiIncomingModal');
    if (!modal) return;

    const titleEl = document.getElementById('nookiIncomingTitle');
    const descEl = document.getElementById('nookiIncomingDesc');
    const acceptBtn = document.getElementById('nookiIncomingAccept');
    const declineBtn = document.getElementById('nookiIncomingDecline');

    if (titleEl) titleEl.textContent = `${getFileIcon(item.fileName)} Incoming File`;
    if (descEl) descEl.innerHTML = `<strong>${item.senderName}</strong> is sharing <strong>${item.fileName}</strong> (${formatBytes(item.fileSize)}).`;

    modal.classList.add('show');

    acceptBtn.onclick = () => {
      modal.classList.remove('show');
      downloadIncomingFile(item);
    };

    declineBtn.onclick = () => {
      modal.classList.remove('show');
      fetch(`${dropState.serverHost}/api/drop/ack/${item.transferId}`, { method: 'POST' }).catch(() => {});
    };
  }

  // Download incoming file stream
  function downloadIncomingFile(item) {
    const downloadUrl = `${dropState.serverHost}/api/drop/download/${item.transferId}`;
    
    // Create direct native download anchor
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = item.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    addTransferHistory({
      type: 'received',
      fileName: item.fileName,
      fileSize: item.fileSize,
      senderName: item.senderName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    if (typeof showBubbleMessage === 'function') {
      showBubbleMessage(`✅ Downloading "${item.fileName}"!`, 3000);
    }
  }

  // ==========================================
  // 3. UI RENDERING & DRAG-AND-DROP ZONE
  // ==========================================

  function renderPeersList() {
    const peersContainer = document.getElementById('nookiDropPeersList');
    const peerCountBadge = document.getElementById('nookiDropPeerCount');
    if (!peersContainer) return;

    if (peerCountBadge) {
      peerCountBadge.textContent = dropState.peers.length.toString();
    }

    if (dropState.peers.length === 0) {
      peersContainer.innerHTML = `
        <div class="drop-empty-peers">
          <div class="radar-ping-ring"></div>
          <span class="radar-icon">📡</span>
          <p class="radar-text">Looking for Nooki devices on your Wi-Fi...</p>
          <p class="radar-subtext">Open Nooki on your iPhone, Android, or laptop on the same Wi-Fi network!</p>
        </div>
      `;
      return;
    }

    let html = '';
    dropState.peers.forEach(peer => {
      const isSelected = peer.id === dropState.selectedPeerId;
      html += `
        <div class="drop-peer-card ${isSelected ? 'selected' : ''}" data-peer-id="${peer.id}">
          <div class="peer-avatar-wrap">
            <span class="peer-device-icon">${getDeviceIcon(peer.type)}</span>
            <span class="peer-online-dot"></span>
          </div>
          <div class="peer-info">
            <span class="peer-name">${peer.name}</span>
            <span class="peer-status">Connected on Wi-Fi</span>
          </div>
          <button type="button" class="peer-send-btn" title="Send file to ${peer.name}">
            <span>📤 Send</span>
          </button>
        </div>
      `;
    });

    peersContainer.innerHTML = html;

    // Attach click events to peer cards
    peersContainer.querySelectorAll('.drop-peer-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const pId = card.getAttribute('data-peer-id');
        dropState.selectedPeerId = pId;
        renderPeersList();

        // If clicked on "Send" button specifically, open file picker directly
        if (e.target.closest('.peer-send-btn')) {
          triggerFilePicker(pId);
        }
      });
    });
  }

  function triggerFilePicker(targetPeerId) {
    const input = document.getElementById('nookiDropFileInput');
    if (!input) return;
    input.onchange = (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          sendFile(files[i], targetPeerId);
        }
      }
      input.value = '';
    };
    input.click();
  }

  function updateNetworkUI() {
    if (!dropState.networkInfo) return;
    const ipEl = document.getElementById('nookiDropLocalIp');
    const qrContainer = document.getElementById('nookiDropQrCode');
    const pinEl = document.getElementById('nookiDropPin');

    if (ipEl) ipEl.textContent = dropState.networkInfo.pairUrl;
    if (pinEl) pinEl.textContent = dropState.networkInfo.pairPin;
    if (qrContainer && dropState.networkInfo.qrSvg) {
      qrContainer.innerHTML = dropState.networkInfo.qrSvg;
    }
  }

  // Transfer HUD Progress Bar
  function showTransferHUD(fileName, fileSize, statusText) {
    let hud = document.getElementById('nookiTransferHUD');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'nookiTransferHUD';
      hud.className = 'nooki-transfer-hud';
      document.body.appendChild(hud);
    }
    hud.innerHTML = `
      <div class="hud-card">
        <div class="hud-header">
          <span class="hud-icon">${getFileIcon(fileName)}</span>
          <div class="hud-meta">
            <span class="hud-filename">${fileName}</span>
            <span class="hud-status">${statusText} • ${formatBytes(fileSize)}</span>
          </div>
        </div>
        <div class="hud-progress-track">
          <div class="hud-progress-fill" id="hudProgressFill" style="width: 0%"></div>
        </div>
        <div class="hud-stats">
          <span id="hudPercentText">0%</span>
          <span id="hudSpeedText">Streaming...</span>
        </div>
      </div>
    `;
    hud.classList.add('show');
  }

  function updateTransferHUD(percent, speed) {
    const fill = document.getElementById('hudProgressFill');
    const pText = document.getElementById('hudPercentText');
    const sText = document.getElementById('hudSpeedText');
    if (fill) fill.style.width = percent + '%';
    if (pText) pText.textContent = percent + '%';
    if (sText) sText.textContent = speed;
  }

  function hideTransferHUD() {
    const hud = document.getElementById('nookiTransferHUD');
    if (hud) hud.classList.remove('show');
  }

  function addTransferHistory(entry) {
    dropState.transferHistory.unshift(entry);
    if (dropState.transferHistory.length > 20) dropState.transferHistory.pop();
    renderTransferHistory();
  }

  function renderTransferHistory() {
    const container = document.getElementById('nookiDropHistoryList');
    if (!container) return;
    if (dropState.transferHistory.length === 0) {
      container.innerHTML = `<p class="history-empty">No recent transfers.</p>`;
      return;
    }
    let html = '';
    dropState.transferHistory.forEach(h => {
      const isSent = h.type === 'sent';
      html += `
        <div class="history-item">
          <span class="h-icon">${getFileIcon(h.fileName)}</span>
          <div class="h-info">
            <span class="h-name">${h.fileName}</span>
            <span class="h-meta">${isSent ? 'Sent to ' + h.targetName : 'From ' + h.senderName} • ${formatBytes(h.fileSize)}</span>
          </div>
          <span class="h-time">${h.time}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================
  // 4. DRAG AND DROP ON NOOKI CLOUD PEDESTAL
  // ==========================================

  function setupCloudDragAndDrop() {
    const cloudPedestal = document.getElementById('cloudPedestal') || document.getElementById('characterStage');
    if (!cloudPedestal) return;

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      document.body.classList.add('file-drag-active');
      cloudPedestal.classList.add('cloud-drop-target');
      if (typeof showBubbleMessage === 'function') {
        showBubbleMessage("✨ Drop file onto Nooki to share! 🚀", 2500);
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Track eyes toward drag coordinates if rigged
      if (typeof handlePointerMove === 'function') {
        handlePointerMove(e);
      }
    });

    window.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        document.body.classList.remove('file-drag-active');
        cloudPedestal.classList.remove('cloud-drop-target');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('file-drag-active');
      cloudPedestal.classList.remove('cloud-drop-target');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        if (typeof triggerPokeRig === 'function') triggerPokeRig();
        if (typeof playPokeSound === 'function') playPokeSound();

        for (let i = 0; i < files.length; i++) {
          sendFile(files[i]);
        }
      }
    });
  }

  // ==========================================
  // 5. DRAWER TOGGLE & CONTROLS
  // ==========================================

  function toggleDropDrawer() {
    const drawer = document.getElementById('nookiDropDrawer');
    if (!drawer) return;
    dropState.isDrawerOpen = !dropState.isDrawerOpen;
    drawer.classList.toggle('open', dropState.isDrawerOpen);

    if (dropState.isDrawerOpen) {
      if (typeof closeMenu === 'function') closeMenu();
      if (typeof closeProductivityDrawer === 'function') closeProductivityDrawer();
      if (typeof closeWardrobeDrawer === 'function') closeWardrobeDrawer();
    }

    if (window.desktopAPI?.setWidgetScale) {
      const scale = parseFloat(localStorage.getItem('bongo_scale') || '1.0');
      window.desktopAPI.setWidgetScale(scale, dropState.isDrawerOpen);
    }

    if (dropState.isDrawerOpen) {
      fetchNetworkInfo();
      announcePresence();
    }
  }

  function initDropModule() {
    setupCloudDragAndDrop();
    fetchNetworkInfo();
    announcePresence();

    // Heartbeat every 3.5s
    setInterval(announcePresence, 3500);
    // Poll pending transfers every 2.5s
    setInterval(checkPendingTransfers, 2500);

    // Wire up Drawer Buttons
    const triggerBtns = document.querySelectorAll('.nooki-drop-btn, #dropBtn, #mHeaderDropBtn');
    triggerBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropDrawer();
      });
    });

    const closeBtn = document.getElementById('closeDropDrawerBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toggleDropDrawer();
      });
    }

    const copyIpBtn = document.getElementById('nookiCopyIpBtn');
    if (copyIpBtn) {
      copyIpBtn.addEventListener('click', () => {
        if (dropState.networkInfo?.pairUrl) {
          navigator.clipboard.writeText(dropState.networkInfo.pairUrl);
          const orig = copyIpBtn.textContent;
          copyIpBtn.textContent = '✅ Copied!';
          setTimeout(() => copyIpBtn.textContent = orig, 1800);
        }
      });
    }

    const openDownloadsBtn = document.getElementById('nookiOpenDownloadsBtn');
    if (openDownloadsBtn) {
      openDownloadsBtn.addEventListener('click', () => {
        if (window.desktopAPI?.openDownloadsFolder) {
          window.desktopAPI.openDownloadsFolder();
        } else {
          alert('Files are saved directly in your Downloads/NookiDrop folder!');
        }
      });
    }

    const selectFileBtn = document.getElementById('nookiDropSelectFileBtn');
    if (selectFileBtn) {
      selectFileBtn.addEventListener('click', () => {
        triggerFilePicker();
      });
    }
  }

  // Expose API
  window.NookiDrop = {
    state: dropState,
    sendFile,
    toggleDrawer: toggleDropDrawer,
    init: initDropModule
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropModule);
  } else {
    initDropModule();
  }

})();
