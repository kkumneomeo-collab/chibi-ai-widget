/**
 * Nooki Companion & Local Wi-Fi Sharing Server
 * - High-speed static file serving for Desktop & Mobile
 * - Zero-config same Wi-Fi peer discovery & pairing (AirDrop-style)
 * - Cross-platform: Desktop (macOS, Windows, Linux), Mobile (Android, iOS)
 * - Dual Engine: WebRTC direct P2P + High-throughput chunked LAN HTTP streaming
 * - Any file type: PDFs, videos, images, APKs, docs, ZIPs, audios
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

let PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = __dirname;
const TRANSFERS_DIR = path.join(__dirname, '.nooki_transfers');

// Native User Downloads Folder (Direct Hard Drive Streaming)
const DOWNLOADS_DIR = (function() {
  try {
    const home = os.homedir();
    const dl = path.join(home, 'Downloads', 'NookiDrop');
    if (!fs.existsSync(dl)) fs.mkdirSync(dl, { recursive: true });
    return dl;
  } catch (_) {
    const fallback = path.join(__dirname, 'Downloads');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
})();

// Avoid filename collision: returns unique path (e.g. photo (1).jpg)
function getUniqueFilePath(dir, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let finalPath = path.join(dir, originalName);
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }
  return finalPath;
}

// Ensure temporary transfers directory exists
if (!fs.existsSync(TRANSFERS_DIR)) {
  fs.mkdirSync(TRANSFERS_DIR, { recursive: true });
}

// In-Memory State
const activePeers = new Map();      // peerId -> { id, name, type, ip, lastSeen, pin }
const pendingSignals = new Map();   // peerId -> Array of { from, signal, time }
const pendingTransfers = new Map(); // transferId -> { id, fileName, fileType, fileSize, senderName, senderId, targetId, filePath, createdAt }

// Generate a random 6-digit room PIN for easy cross-device manual entry
const ROOM_PIN = Math.floor(100000 + Math.random() * 900000).toString();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.apk': 'application/vnd.android.package-archive',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

// Find local Wi-Fi / LAN IP address
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      // Pick first non-internal IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Compact SVG QR Code Generator (Zero dependencies)
function generateQRCodeSVG(text, size = 180) {
  const GF256 = new Uint8Array(512);
  const LOG256 = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256[i] = x;
    GF256[i + 255] = x;
    LOG256[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF256[LOG256[a] + LOG256[b]];
  }
  function gfPolyMul(p, q) {
    const res = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < q.length; j++) {
        res[i + j] ^= gfMul(p[i], q[j]);
      }
    }
    return res;
  }
  function computeECC(data, eccCount) {
    let gen = new Uint8Array([1]);
    for (let i = 0; i < eccCount; i++) gen = gfPolyMul(gen, new Uint8Array([1, GF256[i]]));
    const msg = new Uint8Array(data.length + eccCount);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
    return msg.slice(data.length);
  }

  const bytes = new TextEncoder().encode(text);
  const version = bytes.length <= 17 ? 2 : (bytes.length <= 32 ? 3 : 4);
  const matrixSize = 17 + version * 4;
  const specs = {
    2: { data: 34, ecc: 10 },
    3: { data: 55, ecc: 15 },
    4: { data: 80, ecc: 20 }
  }[version];

  const bitArr = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) bitArr.push((val >> i) & 1);
  }
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (let b of bytes) pushBits(b, 8);
  pushBits(0b0000, 4);
  while (bitArr.length % 8 !== 0) bitArr.push(0);

  const dataCodewords = new Uint8Array(specs.data);
  for (let i = 0; i < bitArr.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) byteVal = (byteVal << 1) | (bitArr[i + j] || 0);
    if (i / 8 < specs.data) dataCodewords[i / 8] = byteVal;
  }
  let padToggle = 0xEC;
  for (let i = Math.ceil(bitArr.length / 8); i < specs.data; i++) {
    dataCodewords[i] = padToggle;
    padToggle = padToggle === 0xEC ? 0x11 : 0xEC;
  }

  const eccCodewords = computeECC(dataCodewords, specs.ecc);
  const allCodewords = new Uint8Array(specs.data + specs.ecc);
  allCodewords.set(dataCodewords);
  allCodewords.set(eccCodewords, specs.data);

  const matrix = Array.from({ length: matrixSize }, () => new Int8Array(matrixSize).fill(-1));

  function placeFinder(r0, c0) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = r0 + r, col = c0 + c;
        if (row < 0 || row >= matrixSize || col < 0 || col >= matrixSize) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) matrix[row][col] = 0;
        else if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) matrix[row][col] = 1;
        else matrix[row][col] = 0;
      }
    }
  }
  placeFinder(0, 0);
  placeFinder(0, matrixSize - 7);
  placeFinder(matrixSize - 7, 0);

  if (version >= 2) {
    const alignPos = [0, 0, 18, 22, 26][version];
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const row = alignPos + r, col = alignPos + c;
        if (matrix[row][col] === -1) {
          matrix[row][col] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
        }
      }
    }
  }

  for (let i = 8; i < matrixSize - 8; i++) {
    if (matrix[6][i] === -1) matrix[6][i] = (i % 2 === 0) ? 1 : 0;
    if (matrix[i][6] === -1) matrix[i][6] = (i % 2 === 0) ? 1 : 0;
  }
  matrix[4 * version + 9][8] = 1;

  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === -1) matrix[8][i] = 0;
    if (matrix[i][8] === -1) matrix[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][matrixSize - 1 - i] === -1) matrix[8][matrixSize - 1 - i] = 0;
    if (matrix[matrixSize - 1 - i][8] === -1) matrix[matrixSize - 1 - i][8] = 0;
  }

  const allBits = [];
  for (let b of allCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
  }

  let bitIdx = 0, dir = -1, row = matrixSize - 1, col = matrixSize - 1;
  while (col > 0) {
    if (col === 6) col--;
    for (let i = 0; i < 2; i++) {
      const c = col - i;
      if (matrix[row][c] === -1) {
        const b = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
        matrix[row][c] = b ^ (((row + c) % 2 === 0) ? 1 : 0);
      }
    }
    row += dir;
    if (row < 0 || row >= matrixSize) {
      dir = -dir;
      row += dir;
      col -= 2;
    }
  }

  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const formatCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatCoords[i];
    matrix[r][c] = formatBits[i];
    if (i < 7) matrix[matrixSize - 1 - i][8] = formatBits[i];
    else matrix[8][matrixSize - 15 + i] = formatBits[i];
  }

  const moduleSize = 6;
  const padding = 14;
  const totalDim = matrixSize * moduleSize + padding * 2;
  let svgPaths = '';

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c] === 1) {
        svgPaths += `<rect x="${padding + c * moduleSize}" y="${padding + r * moduleSize}" width="${moduleSize}" height="${moduleSize}" rx="1" fill="#4338ca"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${size}" height="${size}" class="nooki-qr-svg"><rect width="100%" height="100%" rx="16" fill="#ffffff"/>${svgPaths}</svg>`;
}

// Clean stale peers every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of activePeers.entries()) {
    if (now - peer.lastSeen > 20000) {
      activePeers.delete(id);
      pendingSignals.delete(id);
    }
  }
  // Clean old transfer files (> 15 minutes)
  for (const [tId, t] of pendingTransfers.entries()) {
    if (now - t.createdAt > 900000) {
      try { if (fs.existsSync(t.filePath)) fs.unlinkSync(t.filePath); } catch (_) {}
      pendingTransfers.delete(tId);
    }
  }
}, 10000);

// Helper for sending JSON
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  });
  res.end(JSON.stringify(data));
}

// Helper to read request body JSON
function readBodyJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e6) req.destroy(); // 2MB limit for metadata
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ==========================================
  // NOOKI DROP API ENDPOINTS
  // ==========================================

  // 1. Network Info & QR Code
  if (pathname === '/api/network-info') {
    const localIp = getLocalIp();
    const pairUrl = `http://${localIp}:${PORT}/`;
    const qrSvg = generateQRCodeSVG(pairUrl, 200);
    return sendJSON(res, 200, {
      localIp,
      port: PORT,
      pairUrl,
      pairPin: ROOM_PIN,
      qrSvg,
      downloadsDir: DOWNLOADS_DIR
    });
  }

  // 2. Announce Peer (Heartbeat / Registration)
  if (pathname === '/api/drop/announce' && req.method === 'POST') {
    const data = await readBodyJSON(req);
    const peerId = data.id || 'peer-' + Math.random().toString(36).substr(2, 9);
    const peerName = data.name || 'Nooki Device';
    const peerType = data.type || 'desktop';
    const clientIp = req.socket.remoteAddress || '127.0.0.1';

    activePeers.set(peerId, {
      id: peerId,
      name: peerName,
      type: peerType,
      ip: clientIp,
      lastSeen: Date.now(),
      pin: ROOM_PIN
    });

    const peersList = Array.from(activePeers.values()).filter(p => p.id !== peerId);
    return sendJSON(res, 200, { success: true, myId: peerId, peers: peersList, pin: ROOM_PIN });
  }

  // 3. List Active Wi-Fi Peers
  if (pathname === '/api/drop/peers') {
    const excludeId = parsedUrl.searchParams.get('exclude');
    const peersList = Array.from(activePeers.values()).filter(p => p.id !== excludeId);
    return sendJSON(res, 200, { peers: peersList });
  }

  // 4. WebRTC Signaling (Offer, Answer, ICE Candidates)
  if (pathname === '/api/drop/signal' && req.method === 'POST') {
    const data = await readBodyJSON(req);
    const { from, to, signal } = data;
    if (to && signal) {
      if (!pendingSignals.has(to)) pendingSignals.set(to, []);
      pendingSignals.get(to).push({ from, signal, time: Date.now() });
    }
    return sendJSON(res, 200, { success: true });
  }

  if (pathname === '/api/drop/signal' && req.method === 'GET') {
    const peerId = parsedUrl.searchParams.get('peerId');
    const signals = pendingSignals.get(peerId) || [];
    pendingSignals.delete(peerId);
    return sendJSON(res, 200, { signals });
  }

  // 5. High-Throughput Chunked LAN Upload (Any file type, streaming direct to disk)
  if (pathname === '/api/drop/upload' && req.method === 'POST') {
    const transferId = 'xfer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const rawFileName = req.headers['x-file-name'] || 'file.bin';
    const fileName = decodeURIComponent(rawFileName);
    const fileType = req.headers['x-file-type'] || 'application/octet-stream';
    const fileSize = parseInt(req.headers['x-file-size'] || '0', 10);
    const senderName = decodeURIComponent(req.headers['x-sender-name'] || 'Unknown Companion');
    const senderId = req.headers['x-sender-id'] || '';
    const targetId = req.headers['x-target-id'] || 'all';

    // Stream directly into user's Downloads/NookiDrop folder on Desktop
    const finalSavePath = getUniqueFilePath(DOWNLOADS_DIR, fileName);
    const fileStream = fs.createWriteStream(finalSavePath);

    req.pipe(fileStream);

    req.on('end', () => {
      const savedFileName = path.basename(finalSavePath);
      pendingTransfers.set(transferId, {
        id: transferId,
        fileName: savedFileName,
        fileType,
        fileSize,
        senderName,
        senderId,
        targetId,
        filePath: finalSavePath,
        savedToDisk: true,
        createdAt: Date.now()
      });
      return sendJSON(res, 200, {
        success: true,
        transferId,
        fileName: savedFileName,
        savedTo: finalSavePath
      });
    });

    req.on('error', (err) => {
      try { if (fs.existsSync(finalSavePath)) fs.unlinkSync(finalSavePath); } catch (_) {}
      return sendJSON(res, 500, { error: err.message });
    });
    return;
  }

  // 6. Check Pending Transfers for a Device
  if (pathname === '/api/drop/pending') {
    const targetId = parsedUrl.searchParams.get('targetId');
    const list = [];
    for (const [id, t] of pendingTransfers.entries()) {
      if (t.targetId === 'all' || t.targetId === targetId) {
        list.push({
          transferId: t.id,
          fileName: t.fileName,
          fileType: t.fileType,
          fileSize: t.fileSize,
          senderName: t.senderName,
          senderId: t.senderId
        });
      }
    }
    return sendJSON(res, 200, { pending: list });
  }

  // 7. Download File Stream
  if (pathname.startsWith('/api/drop/download/')) {
    const transferId = pathname.replace('/api/drop/download/', '').trim();
    const t = pendingTransfers.get(transferId);
    if (!t || !fs.existsSync(t.filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Transfer not found or expired');
    }

    res.writeHead(200, {
      'Content-Type': t.fileType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(t.fileName)}"`,
      'Content-Length': t.fileSize,
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(t.filePath);
    readStream.pipe(res);
    return;
  }

  // 8. Acknowledge and Clean Up Transfer
  if (pathname.startsWith('/api/drop/ack/')) {
    const transferId = pathname.replace('/api/drop/ack/', '').trim();
    const t = pendingTransfers.get(transferId);
    if (t) {
      try { if (fs.existsSync(t.filePath)) fs.unlinkSync(t.filePath); } catch (_) {}
      pendingTransfers.delete(transferId);
    }
    return sendJSON(res, 200, { success: true });
  }

  // ==========================================
  // STATIC ASSETS SERVING
  // ==========================================
  let safePath = path.normalize(decodeURIComponent(pathname));
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Listen on 0.0.0.0 so all Wi-Fi peers can connect!
function startServer(portToTry) {
  server.listen(portToTry, '0.0.0.0', () => {
    PORT = portToTry;
    const localIp = getLocalIp();
    console.log(`\n==============================================`);
    console.log(`✨ Nooki Cloud Companion & Wi-Fi Drop Active!`);
    console.log(`📱 Localhost:   http://localhost:${PORT}/`);
    console.log(`📡 Wi-Fi Pair:  http://${localIp}:${PORT}/`);
    console.log(`🔑 Room PIN:   ${ROOM_PIN}`);
    console.log(`==============================================\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying port ${PORT + 1}...`);
    PORT++;
    startServer(PORT);
  } else {
    console.error('Nooki server error:', err.message);
  }
});

startServer(PORT);
