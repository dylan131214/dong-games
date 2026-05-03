// ────────────────────────────────────────────────
//  해저 동굴 전용 맵  cave.js
// ────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const nickname = localStorage.getItem('nickname');
if (!nickname) { window.location.href = 'index.html'; }

let playerData = { nickname, coins: 0, inventory: {
  anchovy:0, clownfish:0, salmon:0, barracuda:0,
  tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
  ballooneel:0, toothfish:0,
  seaweed:0, stone:0, iron:0, aluminum:0
}, fishLog: {
  anchovy:0, clownfish:0, salmon:0, barracuda:0,
  tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
  ballooneel:0, toothfish:0
}, upgrades: { flipper:0, oxygen:0, harpoon:0 }};

function applyPlayerDataDefaults(data) {
  if (!data.fishLog) data.fishLog = {
    anchovy:0, clownfish:0, salmon:0, barracuda:0,
    tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
    ballooneel:0, toothfish:0
  };
  else {
    if (data.fishLog.ballooneel===undefined) data.fishLog.ballooneel=0;
    if (data.fishLog.toothfish===undefined) data.fishLog.toothfish=0;
  }
  if (!data.inventory) data.inventory = {
    anchovy:0, clownfish:0, salmon:0, barracuda:0,
    tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
    ballooneel:0, toothfish:0,
    seaweed:0, stone:0, iron:0, aluminum:0
  };
  else {
    if (data.inventory.ballooneel===undefined) data.inventory.ballooneel=0;
    if (data.inventory.toothfish===undefined) data.inventory.toothfish=0;
  }
  if (!data.upgrades) data.upgrades = { flipper:0, oxygen:0, harpoon:0 };
  if (data.activeHarpoon === undefined) data.activeHarpoon = 'normal';
  if (!data.scopeUpgrades) data.scopeUpgrades = { harpoon: 0 };
}

async function loadPlayerData() {
  const cached = sessionStorage.getItem('cavePlayerData');
  if (cached) {
    try {
      playerData = JSON.parse(cached);
      sessionStorage.removeItem('cavePlayerData');
      applyPlayerDataDefaults(playerData);
      return;
    } catch(e) {}
  }
  try {
    const res = await fetch('/api/player/' + encodeURIComponent(nickname));
    if (res.ok) {
      playerData = await res.json();
      applyPlayerDataDefaults(playerData);
    }
  } catch(e) {}
}

// ── 업그레이드 효과 ──────────────────────────────────
function effectiveSpeed() { return PLAYER_SPEED + (playerData.upgrades?.flipper||0) * 8; }
function effectiveOxygen() { return MAX_OXYGEN_SEC + (playerData.upgrades?.oxygen||0) * 6; }
function effectiveHarpoonDamage() {
  const base = HARPOON_DAMAGE + (playerData.upgrades?.harpoon||0) * 4;
  if (playerData.activeHarpoon === 'scope') return base * 1.5 + (playerData.scopeUpgrades?.harpoon||0) * 4;
  return base;
}
function effectiveHarpoonRange() { return HARPOON_MAX_DIST * (playerData.activeHarpoon === 'scope' ? 2.5 : 1); }
function effectiveCooldown() { return playerData.activeHarpoon === 'scope' ? 3.0 : 1.0; }

const UPGRADE_COLORS = {
  flipper:  ['#fdd835','#00e5ff','#76ff03','#ff6d00','#e040fb','#ffd700'],
  tank:     ['#455a64','#0288d1','#00838f','#558b2f','#6a1b9a','#b71c1c'],
  harpoon:  ['#78909c','#0277bd','#00695c','#558b2f','#6a1b9a','#bf360c'],
};
function upgradeTier(level) { return Math.min(5, Math.floor(level/10)); }
async function savePlayerData() {
  await fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(playerData) });
}
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/save', new Blob([JSON.stringify(playerData)], {type:'application/json'}));
});

// ── 상수 ─────────────────────────────────────────
const SURFACE_RATIO = 0.5;
const PLAYER_W = 30, PLAYER_H = 40;
const PLAYER_SPEED = 150;
const HARPOON_SPEED = 600;
const HARPOON_MAX_DIST = 300;
const HARPOON_HIT_RADIUS = 10;
const HARPOON_DAMAGE = 20;
const MAX_OXYGEN_SEC = 60;
const MAX_GRACE_SEC = 10;

const BUOYANCY_ACCEL = 70;
const SWIM_ACCEL = 12;
const SWIM_DRAG = 3.5;

const BARRACUDA_MAX=6, BARRACUDA_W=55, BARRACUDA_H=14, BARRACUDA_SPEED=130, BARRACUDA_HP=100;
const OCTOPUS_MAX=4, OCTOPUS_W=36, OCTOPUS_H=26, OCTOPUS_SPEED=50, OCTOPUS_HP=150;
const MORAY_MAX=6, MORAY_W=58, MORAY_H=10, MORAY_SPEED=90, MORAY_HP=80;
const BALLOONEEL_MAX=3, BALLOONEEL_W=90, BALLOONEEL_H=18, BALLOONEEL_SPEED=45, BALLOONEEL_HP=250;
const TOOTHFISH_MAX=2, TOOTHFISH_W=400, TOOTHFISH_H=160, TOOTHFISH_SPEED=60, TOOTHFISH_CHASE_SPEED=145, TOOTHFISH_HP=900;
const REGEN_MS = 12000;

// ── 동굴 지형 ─────────────────────────────────────
function caveCeilY(wx) {
  let y = 700;
  y += Math.sin(wx * 0.003 + 0.5) * 200;
  y += Math.sin(wx * 0.012 + 1.5) * 100;
  y += Math.sin(wx * 0.035 + 3.2) * 50;
  return Math.max(380, Math.min(1100, y));
}
function caveFlrY(wx) {
  let y = caveCeilY(wx) + 750;
  y += Math.sin(wx * 0.005 + 2.8) * 120;
  y += Math.sin(wx * 0.018 + 0.6) * 60;
  return y;
}

// ── 동굴 비채집 일반 부유석 (노드 생성용) ───────────
const CFLROCK_CHUNK = 500;
const CFLROCK_PER_CHUNK = 3;

function getCaveFloatingRocksInChunk(c) {
  const rocks = [];
  for (let i = 0; i < CFLROCK_PER_CHUNK; i++) {
    const seed = c * 7283 + i * 5113 + 3971;
    const rx2 = c * CFLROCK_CHUNK + seededRandCR(seed) * CFLROCK_CHUNK;
    const cc2 = caveCeilY(rx2), cf2 = caveFlrY(rx2);
    const minY = cc2 + 120, maxY = cf2 - 120;
    if (maxY < minY + 80) continue;
    const ry = minY + seededRandCR(seed * 5.3) * (maxY - minY);
    const r = 32 + seededRandCR(seed * 7.1) * 45;
    rocks.push({ x: rx2, y: ry, r, seed: seed + 50000, key: `cfl_${c}_${i}` });
  }
  return rocks;
}

function getVisibleCaveFloatingRocks() {
  const lx = camera.x - canvas.width * 0.7;
  const rx2 = camera.x + canvas.width * 0.7;
  const sc = Math.floor(lx / CFLROCK_CHUNK) - 1;
  const ec = Math.floor(rx2 / CFLROCK_CHUNK) + 1;
  const rocks = [];
  for (let c = sc; c <= ec; c++) rocks.push(...getCaveFloatingRocksInChunk(c));
  return rocks;
}

function getCaveFloatingRockNodes() {
  const nodes = [];
  for (const rock of getVisibleCaveFloatingRocks()) {
    const key = `cfn_${rock.key}`;
    if (caveNodeRespawning.has(key)) continue;
    const roll = seededRandCR(rock.seed * 3.17);
    let type;
    if (roll < 0.25) type = 'seaweed';
    else if (roll < 0.55) type = 'stone_ore';
    else if (roll < 0.80) type = 'iron_ore';
    else type = 'aluminum_ore';
    nodes.push({ x: rock.x, y: rock.y - rock.r, type, key });
  }
  return nodes;
}

function seededRandCR(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── 동굴 채집 노드 ─────────────────────────────────
const CAVE_NODE_DEFS = {
  seaweed:      { label:'해초',         invKey:'seaweed',   hp:10, r:14 },
  stone_ore:    { label:'돌 광맥',      invKey:'stone',     hp:30, r:20 },
  iron_ore:     { label:'철 광맥',      invKey:'iron',      hp:30, r:20 },
  aluminum_ore: { label:'알루미늄 광맥',invKey:'aluminum',  hp:40, r:20 },
};
const CAVE_GATHER_CHUNK = 900;
const CAVE_GATHER_PER = 4;
const CAVE_GATHER_RESPAWN_MS = 25000;

function seededRandCG(seed) {
  const x = Math.sin(seed * 193.7 + 511.3) * 61234.5453;
  return x - Math.floor(x);
}

function getCaveGatherChunk(c) {
  const nodes = [];
  for (let i = 0; i < CAVE_GATHER_PER; i++) {
    const seed = c * 8317 + i * 4729 + 6113;
    const nx = c * CAVE_GATHER_CHUNK + seededRandCG(seed) * CAVE_GATHER_CHUNK;
    const cf = caveFlrY(nx);
    const roll = seededRandCG(seed * 3.9);
    let type;
    if (roll < 0.25) type = 'seaweed';
    else if (roll < 0.50) type = 'stone_ore';
    else if (roll < 0.75) type = 'iron_ore';
    else type = 'aluminum_ore';
    nodes.push({ x: nx, y: cf, type, key: `cv_${c}_${i}` });
  }
  return nodes;
}

function getCaveVisibleGatherNodes() {
  const lx = camera.x - canvas.width * 0.75;
  const rx = camera.x + canvas.width * 0.75;
  const sc = Math.floor(lx / CAVE_GATHER_CHUNK) - 1;
  const ec = Math.floor(rx / CAVE_GATHER_CHUNK) + 1;
  const nodes = [];
  for (let c = sc; c <= ec; c++) nodes.push(...getCaveGatherChunk(c));
  nodes.push(...getCaveFloatingRockNodes());
  return nodes.filter(n => !caveNodeRespawning.has(n.key));
}

const caveNodeHitStates = new Map();
const caveNodeRespawning = new Map();

function updateCaveGatherNodes(dt) {
  const now = Date.now();
  for (const [key, respawnAt] of caveNodeRespawning.entries()) {
    if (now >= respawnAt) { caveNodeRespawning.delete(key); caveNodeHitStates.delete(key); }
  }
  for (const [, state] of caveNodeHitStates.entries()) {
    if (state.flashTimer > 0) state.flashTimer -= dt;
    if (state.collecting) {
      state.collectT += dt;
      if (state.collectT >= 0.5 && !state.done) {
        state.done = true;
        playerData.inventory[state.invKey] = (playerData.inventory[state.invKey] || 0) + 1;
        savePlayerData();
        caveNodeRespawning.set(state.key, Date.now() + CAVE_GATHER_RESPAWN_MS);
      }
    }
  }
}

function hitCaveGatherNode(node) {
  const def = CAVE_NODE_DEFS[node.type];
  let state = caveNodeHitStates.get(node.key);
  if (!state) {
    state = { hp: def.hp, flashTimer: 0, collecting: false, collectT: 0,
              startX: node.x, startY: node.y, invKey: def.invKey, type: node.type, done: false, key: node.key };
    caveNodeHitStates.set(node.key, state);
  }
  if (state.collecting) return;
  state.hp -= effectiveHarpoonDamage();
  harpoon.returning = true;
  if (state.hp <= 0) { state.collecting = true; state.collectT = 0; }
  else { state.flashTimer = 0.15; }
}

// ── 게임 상태 ─────────────────────────────────────
let lastTime = 0;
const camera = { x: 0, y: 0 };

const ENTRY_X = 0;
const EXIT_CLICK_RADIUS = 65;

const player = { x: ENTRY_X, y: caveCeilY(ENTRY_X) + 110, vx: 0, vy: 30, alive: true };
const harpoon = { active: false, x: 0, y: 0, vx: 0, vy: 0, dist: 0, returning: false };

let barracudas = [], barracudaIdCounter = 0;
let octopuses = [], octopusIdCounter = 0;
let morays = [], morayIdCounter = 0;
let balloonEels = [], balloonEelIdCounter = 0;
let toothFishes = [], toothFishIdCounter = 0;

let oxygenTimer = MAX_OXYGEN_SEC, graceTimer = MAX_GRACE_SEC;
let graceBlinkTimer = 0;
let gameOverState = null, fadeOpacity = 0, fallVelocity = 0;
let playerFacingRight = true;
let bubbles = [], bubbleTimer = 0;
let inventoryOpen = false, logOpen = false;
let logSearchText = '', logScrollY = 0;
let harpoonCooldown = 0;

const keys = {};
let mouseWorld = { x: 0, y: 0 };
let mouseScreen = { x: 0, y: 0 };

// ── 월드 ↔ 화면 ───────────────────────────────────
function toScreen(wx, wy) {
  return { sx: wx - camera.x + canvas.width * 0.5, sy: wy - camera.y + canvas.height * SURFACE_RATIO };
}
function toWorld(sx, sy) {
  return { wx: sx - canvas.width * 0.5 + camera.x, wy: sy - canvas.height * SURFACE_RATIO + camera.y };
}
function ws(wx, wy) { return toScreen(wx, wy); }

// ── 초기화 ────────────────────────────────────────
async function init() {
  player.x = ENTRY_X;
  player.y = caveCeilY(ENTRY_X) + 110;
  camera.x = player.x;
  camera.y = player.y;
  requestAnimationFrame(loop);

  await loadPlayerData();
  oxygenTimer = effectiveOxygen();

  spawnBarracudas(BARRACUDA_MAX);
  spawnOctopuses(OCTOPUS_MAX);
  spawnMorays(MORAY_MAX);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);

  const searchEl = document.getElementById('log-search');
  searchEl.addEventListener('input', e => { logSearchText = e.target.value; });
  searchEl.addEventListener('keydown', e => {
    if (e.code === 'Semicolon' || e.code === 'Escape') {
      logOpen = false; searchEl.style.display = 'none'; searchEl.value = ''; logSearchText = '';
    }
    if (e.code !== 'Enter') e.stopPropagation();
  });

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyI') { inventoryOpen = !inventoryOpen; if (inventoryOpen) { logOpen = false; searchEl.style.display='none'; searchEl.value=''; logSearchText=''; } }
    if (e.code === 'Semicolon') {
      logOpen = !logOpen;
      if (logOpen) { inventoryOpen = false; logScrollY = 0; positionCaveLogSearch(); searchEl.style.display = 'block'; setTimeout(() => searchEl.focus(), 10); }
      else { searchEl.style.display = 'none'; searchEl.value = ''; logSearchText = ''; }
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('resize', () => { if (logOpen) positionCaveLogSearch(); });
  canvas.addEventListener('wheel', e => {
    if (logOpen) { logScrollY += e.deltaY * 0.8; e.preventDefault(); }
    if (inventoryOpen) { e.preventDefault(); }
  }, { passive: false });
  canvas.addEventListener('mousedown', e => {
    if (!logOpen) return;
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const pw = Math.min(620, canvas.width - 40), HEADER_H = 88, FOOTER_H = 24;
    const px = Math.round(canvas.width / 2 - pw / 2);
    const cardH = 76, cardM = 4, secM = 8;
    let totalH = 0;
    CAVE_FISH_CATALOG.forEach(sec => { totalH += 20 + secM + sec.keys.length * (cardH + cardM); });
    const visibleH = Math.min(Math.max(totalH, 1), canvas.height - 120);
    const ph = HEADER_H + visibleH + FOOTER_H;
    const py = Math.round(canvas.height / 2 - ph / 2);
    if (cx >= px + pw - 46 && cx <= px + pw - 12 && cy >= py + 12 && cy <= py + 38) {
      logOpen = false; searchEl.style.display = 'none'; searchEl.value = ''; logSearchText = ''; return;
    }
    if (!(cx >= px && cx <= px + pw && cy >= py && cy <= py + ph)) {
      logOpen = false; searchEl.style.display = 'none'; searchEl.value = ''; logSearchText = '';
    }
  });
}

// ── 스폰 ─────────────────────────────────────────
function mkFish(extra) {
  return { dead:false, collecting:false, collectT:0, collectDur:0.5, startX:0, startY:0, flashTimer:0, dirTimer:Math.random()*3, fleeTimer:0, fleeVx:0, fleeVy:0, ...extra };
}

function spawnBarracuda() {
  if (barracudas.length >= BARRACUDA_MAX) return;
  const sx = player.x + (Math.random() - 0.5) * 2000;
  const cc = caveCeilY(sx), cf = caveFlrY(sx);
  barracudas.push(mkFish({
    id: barracudaIdCounter++, hp: BARRACUDA_HP, collectDur: 0.7,
    x: sx, y: cc + 150 + Math.random() * Math.max(100, cf - cc - 300),
    vx: (Math.random() < 0.5 ? 1 : -1) * BARRACUDA_SPEED,
    vy: (Math.random() - 0.5) * 25,
  }));
}
function spawnBarracudas(n) { for (let i = 0; i < n; i++) spawnBarracuda(); }

function spawnOctopus() {
  if (octopuses.length >= OCTOPUS_MAX) return;
  const sx = player.x + (Math.random() - 0.5) * 1800;
  const cc = caveCeilY(sx), cf = caveFlrY(sx);
  octopuses.push(mkFish({
    id: octopusIdCounter++, hp: OCTOPUS_HP, collectDur: 0.65,
    x: sx, y: cc + 200 + Math.random() * Math.max(80, cf - cc - 400),
    vx: (Math.random() < 0.5 ? 1 : -1) * OCTOPUS_SPEED,
    vy: (Math.random() - 0.5) * 20,
  }));
}
function spawnOctopuses(n) { for (let i = 0; i < n; i++) spawnOctopus(); }

function spawnMoray() {
  if (morays.length >= MORAY_MAX) return;
  const sx = player.x + (Math.random() - 0.5) * 1800;
  const cc = caveCeilY(sx), cf = caveFlrY(sx);
  morays.push(mkFish({
    id: morayIdCounter++, hp: MORAY_HP, collectDur: 0.6,
    x: sx, y: cc + 100 + Math.random() * Math.max(100, cf - cc - 300),
    vx: (Math.random() < 0.5 ? 1 : -1) * MORAY_SPEED,
    vy: (Math.random() - 0.5) * 20,
  }));
}
function spawnMorays(n) { for (let i = 0; i < n; i++) spawnMoray(); }

function spawnBalloonEel() {
  if (balloonEels.length >= BALLOONEEL_MAX) return;
  const sx = player.x + (Math.random() - 0.5) * 2000;
  const cc = caveCeilY(sx), cf = caveFlrY(sx);
  balloonEels.push(mkFish({
    id: balloonEelIdCounter++, hp: BALLOONEEL_HP, collectDur: 0.8,
    x: sx, y: cc + 120 + Math.random() * Math.max(80, cf - cc - 240),
    vx: (Math.random() < 0.5 ? 1 : -1) * BALLOONEEL_SPEED, vy: (Math.random() - 0.5) * 15,
  }));
}

function spawnToothFish() {
  if (toothFishes.length >= TOOTHFISH_MAX) return;
  const sx = player.x + (Math.random() - 0.5) * 2000;
  const cc = caveCeilY(sx), cf = caveFlrY(sx);
  toothFishes.push(mkFish({
    id: toothFishIdCounter++, hp: TOOTHFISH_HP, collectDur: 1.3,
    x: sx, y: cc + 200 + Math.random() * Math.max(100, cf - cc - 400),
    vx: (Math.random() < 0.5 ? 1 : -1) * TOOTHFISH_SPEED, vy: (Math.random() - 0.5) * 12,
    touchCooldown: 0,
  }));
}

// ── 입력 ─────────────────────────────────────────
function onMouseMove(e) {
  const r = canvas.getBoundingClientRect();
  mouseScreen.x = e.clientX - r.left;
  mouseScreen.y = e.clientY - r.top;
  const w = toWorld(mouseScreen.x, mouseScreen.y);
  mouseWorld.x = w.wx; mouseWorld.y = w.wy;
}

function onMouseDown(e) {
  if (e.button !== 0 || !player.alive || gameOverState) return;
  if (inventoryOpen || logOpen) return;

  // 출구 포털 클릭
  const exitY = caveCeilY(ENTRY_X) - 50;
  const dex = mouseWorld.x - ENTRY_X, dey = mouseWorld.y - exitY;
  if (Math.sqrt(dex * dex + dey * dey) < EXIT_CLICK_RADIUS) {
    leaveCave(); return;
  }

  if (harpoonCooldown > 0) return;
  const dx = mouseWorld.x - player.x, dy = mouseWorld.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  harpoon.active = true; harpoon.returning = false;
  harpoon.x = player.x; harpoon.y = player.y;
  harpoon.vx = (dx / dist) * HARPOON_SPEED; harpoon.vy = (dy / dist) * HARPOON_SPEED;
  harpoon.dist = 0;
  harpoonCooldown = effectiveCooldown();
  scatterFish(player.x, player.y);
}

async function leaveCave() {
  await savePlayerData();
  window.location.href = 'game.html';
}

// ── 메인 루프 ─────────────────────────────────────
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (inventoryOpen || logOpen) return;
  if (gameOverState) { updateGameOver(dt); return; }
  const mw = toWorld(mouseScreen.x, mouseScreen.y);
  mouseWorld.x = mw.wx; mouseWorld.y = mw.wy;
  if (harpoonCooldown > 0) harpoonCooldown = Math.max(0, harpoonCooldown - dt);
  updatePlayer(dt);
  updateOxygen(dt);
  updateHarpoon(dt);
  if (Math.random() < 0.05 * dt && balloonEels.length < BALLOONEEL_MAX) spawnBalloonEel();
  if (Math.random() < 0.025 * dt && toothFishes.length < TOOTHFISH_MAX) spawnToothFish();
  updateBarracudas(dt);
  updateOctopuses(dt);
  updateMorays(dt);
  updateBalloonEels(dt);
  updateToothFishes(dt);
  updateCaveGatherNodes(dt);
  updateBubbles(dt);
  updateCamera(dt);
}

function updatePlayer(dt) {
  if (!player.alive) return;
  let ix = 0, iy = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;

  const cc0 = caveCeilY(player.x), cf0 = caveFlrY(player.x);
  if (player.y - PLAYER_H / 2 <= cc0 && iy < 0) iy = 0;
  if (player.y + PLAYER_H / 2 >= cf0 && iy > 0) iy = 0;

  const spd = effectiveSpeed();
  player.vx += (ix * spd - player.vx) * Math.min(SWIM_ACCEL * dt, 1);
  player.vy += (iy * spd - player.vy) * Math.min(SWIM_ACCEL * dt, 1);
  player.vy -= BUOYANCY_ACCEL * dt;
  if (ix === 0) player.vx *= Math.max(0, 1 - SWIM_DRAG * dt);
  if (iy === 0) player.vy *= Math.max(0, 1 - SWIM_DRAG * dt);

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const cc = caveCeilY(player.x), cf = caveFlrY(player.x);
  if (player.y - PLAYER_H / 2 < cc) { player.y = cc + PLAYER_H / 2; if (player.vy < 0) player.vy = 0; }
  if (player.y + PLAYER_H / 2 > cf) { player.y = cf - PLAYER_H / 2; if (player.vy > 0) player.vy = 0; }

  const pr = 16;
  const allCaveRocks = getVisibleCaveFloatingRocks();
  for (const rock of allCaveRocks) {
    const dx = player.x - rock.x, dy = player.y - rock.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const minD = rock.r + pr;
    if (dist < minD) {
      const nx = dx / dist, ny = dy / dist;
      player.x += nx * (minD - dist); player.y += ny * (minD - dist);
      const dot = player.vx * nx + player.vy * ny;
      if (dot < 0) {
        player.vx -= dot * nx; player.vy -= dot * ny;
        const spd = Math.sqrt(player.vx ** 2 + player.vy ** 2);
        const maxS = effectiveSpeed() * 1.2;
        if (spd > maxS) { player.vx = player.vx / spd * maxS; player.vy = player.vy / spd * maxS; }
      }
    }
  }

  playerFacingRight = mouseWorld.x >= player.x;
}

function updateOxygen(dt) {
  if (!player.alive) return;
  if (oxygenTimer > 0) { oxygenTimer = Math.max(0, oxygenTimer - dt); }
  else { graceTimer = Math.max(0, graceTimer - dt); }
  graceBlinkTimer += dt;
  if (graceTimer <= 0) triggerGameOver();
}

function updateHarpoon(dt) {
  if (!harpoon.active) return;
  if (harpoon.returning) {
    const dx = player.x - harpoon.x, dy = player.y - harpoon.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < 18) { harpoon.active = false; harpoon.returning = false; return; }
    const spd = HARPOON_SPEED * 1.3;
    harpoon.vx = (dx / d) * spd; harpoon.vy = (dy / d) * spd;
    harpoon.x += harpoon.vx * dt; harpoon.y += harpoon.vy * dt;
    return;
  }
  harpoon.x += harpoon.vx * dt;
  harpoon.y += harpoon.vy * dt;
  harpoon.dist += Math.sqrt(harpoon.vx * harpoon.vx + harpoon.vy * harpoon.vy) * dt;
  if (harpoon.dist >= effectiveHarpoonRange()) { harpoon.returning = true; return; }

  function hitCheck(list, radius) {
    for (const f of list) {
      if (f.dead || f.collecting) continue;
      const dx = harpoon.x - f.x, dy = harpoon.y - f.y;
      if (Math.sqrt(dx * dx + dy * dy) <= HARPOON_HIT_RADIUS + radius) {
        f.hp -= effectiveHarpoonDamage();
        harpoon.returning = true;
        if (f.hp <= 0) { f.dead = true; startCollectAnim(f); }
        else { f.flashTimer = 0.15; }
        return true;
      }
    }
    return false;
  }
  if (hitCheck(barracudas, 12)) return;
  if (hitCheck(octopuses, 8)) return;
  if (hitCheck(morays, 6)) return;
  if (hitCheck(balloonEels, 10)) return;
  if (hitCheck(toothFishes, 90)) return;

  const gnodes = getCaveVisibleGatherNodes();
  for (const node of gnodes) {
    const def = CAVE_NODE_DEFS[node.type];
    const dx = harpoon.x - node.x, dy = harpoon.y - node.y;
    if (Math.sqrt(dx*dx+dy*dy) <= HARPOON_HIT_RADIUS + def.r) { hitCaveGatherNode(node); return; }
  }
}

function startCollectAnim(f) { f.collecting = true; f.collectT = 0; f.startX = f.x; f.startY = f.y; }

function filterCollect(f, dt, invKey, spawnFn) {
  if (f.collecting) {
    f.collectT += dt;
    const t = Math.min(f.collectT / f.collectDur, 1);
    f.x = f.startX + (player.x - f.startX) * t;
    f.y = f.startY + (player.y - f.startY) * t;
    if (t >= 1) {
      playerData.inventory[invKey] = (playerData.inventory[invKey] || 0) + 1;
      playerData.fishLog[invKey] = (playerData.fishLog[invKey] || 0) + 1;
      savePlayerData();
      setTimeout(spawnFn, REGEN_MS);
      return false;
    }
  }
  return true;
}

function updateCaveFish(list, dt, speed, maxDist) {
  for (const f of list) {
    if (f.dead || f.collecting) continue;
    if (f.flashTimer > 0) f.flashTimer -= dt;

    if (f.fleeTimer > 0) {
      f.fleeTimer -= dt;
      f.vx += f.fleeVx * speed * 5 * dt;
      f.vy += f.fleeVy * speed * 5 * dt;
      const s = Math.sqrt(f.vx * f.vx + f.vy * f.vy) || 1;
      const cap = speed * 2.8;
      if (s > cap) { f.vx = f.vx / s * cap; f.vy = f.vy / s * cap; }
    } else {
      f.dirTimer -= dt;
      if (f.dirTimer <= 0) {
        f.dirTimer = 1.2 + Math.random() * 2.5;
        f.vx = (Math.random() < 0.5 ? 1 : -1) * speed * (0.6 + Math.random() * 0.8);
        f.vy = (Math.random() - 0.5) * 45;
      }
      // 매 프레임 미세 방향 변화로 자연스러운 배회
      f.vx += (Math.random() - 0.5) * speed * 0.35 * dt;
      f.vy += (Math.random() - 0.5) * 28 * dt;
      const s = Math.sqrt(f.vx * f.vx + f.vy * f.vy) || 1;
      const cap = speed * 1.3;
      if (s > cap) { f.vx = f.vx / s * cap; f.vy = f.vy / s * cap; }
    }

    f.x += f.vx * dt; f.y += f.vy * dt;
    const cc = caveCeilY(f.x), cf = caveFlrY(f.x);
    if (f.y < cc + 40) { f.y = cc + 40; f.vy = Math.abs(f.vy); }
    if (f.y > cf - 40) { f.y = cf - 40; f.vy = -Math.abs(f.vy); }
    if (Math.abs(f.x - player.x) > maxDist) {
      f.x = player.x + (Math.random() - 0.5) * 1600;
      const cc2 = caveCeilY(f.x), cf2 = caveFlrY(f.x);
      f.y = cc2 + 120 + Math.random() * Math.max(50, cf2 - cc2 - 240);
    }
  }
}

function scatterFish(ox, oy) {
  const SCARE_R = 480;
  for (const list of [barracudas, octopuses, morays, balloonEels]) {
    for (const f of list) {
      if (f.dead || f.collecting) continue;
      const dx = f.x - ox, dy = f.y - oy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < SCARE_R) {
        const nx = dx / dist, ny = dy / dist;
        const intensity = 1 + (SCARE_R - dist) / SCARE_R;
        f.fleeTimer = 1.8 + Math.random() * 1.5;
        f.fleeVx = nx * intensity;
        f.fleeVy = ny * intensity;
        f.dirTimer = f.fleeTimer + 0.5;
      }
    }
  }
}

function updateBarracudas(dt) {
  updateCaveFish(barracudas, dt, BARRACUDA_SPEED, 2200);
  barracudas = barracudas.filter(f => !f.eaten && filterCollect(f, dt, 'barracuda', spawnBarracuda));
}
function updateOctopuses(dt) {
  updateCaveFish(octopuses, dt, OCTOPUS_SPEED, 2000);
  octopuses = octopuses.filter(f => !f.eaten && filterCollect(f, dt, 'octopus', spawnOctopus));
}
function updateMorays(dt) {
  updateCaveFish(morays, dt, MORAY_SPEED, 2000);
  morays = morays.filter(f => !f.eaten && filterCollect(f, dt, 'moray', spawnMoray));
}
function updateBalloonEels(dt) {
  updateCaveFish(balloonEels, dt, BALLOONEEL_SPEED, 2200);
  // 이빨고기 제외 모두 섭식
  for (const f of balloonEels) {
    if (f.dead || f.collecting) continue;
    for (const list of [barracudas, octopuses, morays]) {
      for (const p of list) {
        if (p.dead || p.collecting || p.eaten) continue;
        if ((f.x-p.x)**2+(f.y-p.y)**2 < 60**2) { p.eaten = true; break; }
      }
    }
  }
  balloonEels = balloonEels.filter(f => !f.eaten && filterCollect(f, dt, 'ballooneel', spawnBalloonEel));
}
function updateToothFishes(dt) {
  for (const f of toothFishes) {
    if (f.dead || f.collecting) continue;
    if (f.flashTimer > 0) f.flashTimer -= dt;
    if (f.touchCooldown > 0) f.touchCooldown -= dt;
    const dx = player.x - f.x, dy = player.y - f.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist < 80) {
      f.vx = -f.vx * 0.8; f.vy = (Math.random() - 0.5) * 30;
    } else {
      f.dirTimer -= dt;
      if (f.dirTimer <= 0 || dist > 400) {
        f.dirTimer = 1 + Math.random() * 2;
        f.vx = (dx / dist) * TOOTHFISH_CHASE_SPEED;
        f.vy = (dy / dist) * TOOTHFISH_CHASE_SPEED;
      }
    }
    // 바라쿠다·문어·곰치·풍선장어 섭식
    for (const list of [barracudas, octopuses, morays, balloonEels]) {
      for (const p of list) {
        if (p.dead || p.collecting || p.eaten) continue;
        if ((f.x-p.x)**2+(f.y-p.y)**2 < 120**2) { p.eaten = true; break; }
      }
    }
    f.x += f.vx * dt; f.y += f.vy * dt;
    const cc = caveCeilY(f.x), cf = caveFlrY(f.x);
    if (f.y < cc + 90) { f.y = cc + 90; if (f.vy < 0) f.vy = Math.abs(f.vy); }
    if (f.y > cf - 90) { f.y = cf - 90; if (f.vy > 0) f.vy = -Math.abs(f.vy); }
    if (Math.abs(f.x - player.x) > 3000) {
      f.x = player.x + (Math.random() - 0.5) * 2000;
      const cc2 = caveCeilY(f.x), cf2 = caveFlrY(f.x);
      f.y = cc2 + 200 + Math.random() * Math.max(100, cf2 - cc2 - 400);
    }
  }
  toothFishes = toothFishes.filter(f => {
    if (f.eaten) return false;
    if (!f.collecting) return true;
    f.collectT += dt; const t = Math.min(f.collectT / f.collectDur, 1);
    f.x = f.startX + (player.x - f.startX) * t; f.y = f.startY + (player.y - f.startY) * t;
    if (t >= 1) {
      playerData.inventory.toothfish = (playerData.inventory.toothfish || 0) + 1;
      playerData.fishLog.toothfish = (playerData.fishLog.toothfish || 0) + 1;
      savePlayerData(); setTimeout(spawnToothFish, REGEN_MS * 4); return false;
    }
    return true;
  });
}

function updateBubbles(dt) {
  bubbleTimer += dt;
  if (player.alive && !gameOverState && bubbleTimer >= 0.35) {
    bubbleTimer = 0;
    bubbles.push({
      x: player.x + (playerFacingRight ? 10 : -10), y: player.y - PLAYER_H / 2 + 22,
      r: 1.5 + Math.random() * 2, vx: (Math.random() - 0.5) * 12,
      vy: -(22 + Math.random() * 18), life: 1.0
    });
  }
  for (const b of bubbles) { b.x += b.vx * dt; b.y += b.vy * dt; b.r += 1.2 * dt; b.life -= 0.38 * dt; }
  bubbles = bubbles.filter(b => b.life > 0);
}

function updateCamera(dt) {
  camera.x += (player.x - camera.x) * Math.min(dt * 3, 1);
  camera.y += (player.y - camera.y) * Math.min(dt * 3, 1);
}

// ── 게임오버 ─────────────────────────────────────
function triggerGameOver() {
  player.alive = false; gameOverState = 'falling'; fadeOpacity = 0; fallVelocity = 50;
}
function updateGameOver(dt) {
  if (gameOverState === 'falling') {
    fallVelocity += 200 * dt; player.y += fallVelocity * dt;
    fadeOpacity = Math.min(fadeOpacity + dt / 3, 1);
    camera.x = player.x; camera.y = player.y;
    if (fadeOpacity >= 1) {
      gameOverState = 'dead';
      playerData.inventory = { anchovy:0, clownfish:0, salmon:0, barracuda:0, tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0, ballooneel:0, toothfish:0 };
      fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ nickname: playerData.nickname, inventory: playerData.inventory })
      }).then(() => { window.location.href = 'game.html'; });
    }
  }
}

// ── 렌더링 ───────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawCaveTerrain();
  drawCaveNonMineableRocks();
  drawExitPortal();
  drawCaveGatherNodes();
  drawBarracudas();
  drawOctopuses();
  drawMorays();
  drawBalloonEels();
  drawToothFishes();
  drawHarpoon();
  drawPlayer();
  drawBubbles();
  drawHUD();
  drawFadeOverlay();
  if (inventoryOpen) drawInventory();
  if (logOpen) drawCaveLog();
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#000f08');
  bg.addColorStop(0.5, '#001612');
  bg.addColorStop(1, '#000805');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 바위 발광 파티클
  const t = Date.now() / 1000;
  ctx.save();
  for (let i = 0; i < 28; i++) {
    const seed = i * 317 + Math.floor(camera.x / 400) * 400;
    const wx = Math.floor(camera.x / 400) * 400 + (i * 317 % 2800) - 1400 + (Math.floor(i / 7) * 400);
    const gx = (wx - camera.x) + canvas.width * 0.5;
    const gy = 60 + (i * 173 % (canvas.height - 80));
    const r = 1 + Math.sin(i * 2.3 + t * 1.2) * 0.7;
    ctx.globalAlpha = 0.18 + Math.sin(i * 3.1 + t * 1.8) * 0.1;
    ctx.fillStyle = i % 3 === 0 ? '#00ffaa' : i % 3 === 1 ? '#00ccff' : '#88ffcc';
    ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCaveTerrain() {
  const leftWX = camera.x - canvas.width, rightWX = camera.x + canvas.width, step = 10;

  // 천장
  ctx.save();
  const cg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  cg.addColorStop(0, '#37474f'); cg.addColorStop(0.3, '#2e3c43'); cg.addColorStop(1, '#1a2529');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.moveTo(-10, -10);
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveCeilY(wx)); ctx.lineTo(sx, sy);
  }
  ctx.lineTo(canvas.width + 10, -10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(100,160,180,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); let fc = true;
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveCeilY(wx));
    fc ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); fc = false;
  }
  ctx.stroke();
  ctx.restore();

  // 바닥
  ctx.save();
  const fg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  fg.addColorStop(0, '#37474f'); fg.addColorStop(0.3, '#2e3c43'); fg.addColorStop(1, '#1a2529');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(-10, canvas.height + 10);
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveFlrY(wx)); ctx.lineTo(sx, sy);
  }
  ctx.lineTo(canvas.width + 10, canvas.height + 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(100,160,180,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); let ff = true;
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveFlrY(wx));
    ff ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); ff = false;
  }
  ctx.stroke();
  ctx.restore();
}

function drawCaveNonMineableRocks() {
  const rocks = getVisibleCaveFloatingRocks();
  for (const rock of rocks) {
    const { sx, sy } = ws(rock.x, rock.y);
    const nv = 7 + Math.floor(seededRandCR(rock.seed * 1.7) * 4);
    ctx.save();
    const grad = ctx.createRadialGradient(sx - rock.r * 0.25, sy - rock.r * 0.2, 1, sx, sy, rock.r * 1.1);
    grad.addColorStop(0, '#1a2e1a'); grad.addColorStop(0.5, '#0f1e12'); grad.addColorStop(1, '#060e08');
    ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(0,160,80,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = 0; j < nv; j++) {
      const ang = (j / nv) * Math.PI * 2;
      const jit = 0.68 + seededRandCR(rock.seed * (j + 2) * 4.3) * 0.65;
      const px2 = sx + Math.cos(ang) * rock.r * jit, py2 = sy + Math.sin(ang) * rock.r * jit;
      j === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,180,80,0.07)';
    ctx.beginPath(); ctx.ellipse(sx - rock.r * 0.3, sy - rock.r * 0.3, rock.r * 0.35, rock.r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawCaveGatherNodes() {
  const nodes = getCaveVisibleGatherNodes();
  const drawnKeys = new Set();
  for (const node of nodes) {
    const state = caveNodeHitStates.get(node.key);
    drawnKeys.add(node.key);
    if (state && state.collecting) {
      const t = Math.min(state.collectT / 0.5, 1);
      const cx = state.startX + (player.x - state.startX) * t;
      const cy2 = state.startY + (player.y - state.startY) * t;
      const { sx, sy } = ws(cx, cy2);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
      drawCaveNodeShape(sx, sy, node.type, false);
      ctx.restore();
      continue;
    }
    const flash = !!(state && state.flashTimer > 0);
    const { sx, sy } = ws(node.x, node.y);
    drawCaveNodeShape(sx, sy, node.type, flash);
    if (state && state.hp < CAVE_NODE_DEFS[node.type].hp && !state.collecting) {
      const def = CAVE_NODE_DEFS[node.type];
      const bw = def.r * 2, bh = 4, bx = sx - def.r, by2 = sy - def.r - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by2, bw, bh);
      ctx.fillStyle = '#f44336'; ctx.fillRect(bx, by2, bw * (state.hp / def.hp), bh);
    }
  }
  for (const [key, state] of caveNodeHitStates.entries()) {
    if (state.collecting && !drawnKeys.has(key) && !state.done) {
      const t = Math.min(state.collectT / 0.5, 1);
      const cx = state.startX + (player.x - state.startX) * t;
      const cy2 = state.startY + (player.y - state.startY) * t;
      const { sx, sy } = ws(cx, cy2);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
      drawCaveNodeShape(sx, sy, state.type, false);
      ctx.restore();
    }
  }
}

function drawCaveNodeShape(sx, sy, type, flash) {
  ctx.save();
  switch (type) {
    case 'seaweed':      drawCaveSeaweedNode(sx, sy, flash); break;
    case 'stone_ore':    drawCaveOreNode(sx, sy, '#90a4ae', '#546e7a', flash); break;
    case 'iron_ore':     drawCaveOreNode(sx, sy, '#cfd8dc', '#90a4ae', flash); break;
    case 'aluminum_ore': drawCaveOreNode(sx, sy, '#b3e5fc', '#4fc3f7', flash); break;
  }
  ctx.restore();
}

function drawCaveSeaweedNode(sx, sy, flash) {
  const t = Date.now() / 1000;
  const sway = Math.sin(t * 1.3 + sx * 0.01) * 8;
  ctx.strokeStyle = flash ? '#fff' : '#1b5e20'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const ox = i * 8;
    ctx.beginPath();
    ctx.moveTo(sx + ox, sy);
    ctx.quadraticCurveTo(sx + ox + sway * 0.5, sy - 20, sx + ox + sway, sy - 42);
    ctx.stroke();
  }
  ctx.fillStyle = flash ? '#fff' : '#2e7d32';
  ctx.beginPath(); ctx.ellipse(sx + sway, sy - 42, 8, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx - 8 + sway * 0.7, sy - 26, 7, 4, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawCaveOreNode(sx, sy, mainColor, darkColor, flash) {
  ctx.fillStyle = flash ? '#fff' : '#263238'; ctx.strokeStyle = flash ? '#fff' : '#1a2329'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx, sy - 11, 20, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sx - 13, sy - 9, 12, 9, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sx + 14, sy - 10, 11, 8, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (!flash) {
    ctx.fillStyle = mainColor; ctx.strokeStyle = darkColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx - 5, sy - 9); ctx.lineTo(sx, sy - 20); ctx.lineTo(sx + 5, sy - 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 16, sy - 11); ctx.lineTo(sx - 12, sy - 20); ctx.lineTo(sx - 7, sy - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 10, sy - 13); ctx.lineTo(sx + 15, sy - 22); ctx.lineTo(sx + 19, sy - 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(sx, sy - 15, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawExitPortal() {
  const exitY = caveCeilY(ENTRY_X) - 50;
  const { sx, sy } = ws(ENTRY_X, exitY);
  const t = Date.now() / 1000;
  ctx.save();
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 80);
  glow.addColorStop(0, 'rgba(0,220,155,0.5)');
  glow.addColorStop(0.5, 'rgba(0,220,155,0.2)');
  glow.addColorStop(1, 'rgba(0,220,155,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(sx, sy, 80, 60, 0, 0, Math.PI * 2); ctx.fill();

  const pulse = 1 + Math.sin(t * 2.5) * 0.12;
  ctx.fillStyle = '#00dda0';
  ctx.save(); ctx.translate(sx, sy); ctx.scale(pulse, pulse);
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-18, -10); ctx.lineTo(18, -10); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#00dda0'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,200,120,0.9)'; ctx.shadowBlur = 10;
  ctx.fillText('바다로 나가기', sx, sy + 22);
  ctx.shadowBlur = 0;
  ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(0,180,120,0.75)';
  ctx.fillText('클릭하여 나가기', sx, sy + 36);
  ctx.restore();
}

// ── 물고기 그리기 ─────────────────────────────────
function drawHpBar(sx, sy, halfW, halfH, hp, maxHp) {
  if (hp >= maxHp) return;
  const bw = halfW * 2 + 4, bh = 4, bx = sx - halfW - 2, by = sy - halfH - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = hp > maxHp * 0.5 ? '#4caf50' : hp > maxHp * 0.25 ? '#ffeb3b' : '#f44336';
  ctx.fillRect(bx, by, bw * (hp / maxHp), bh);
}

function drawBarracudas() {
  for (const b of barracudas) {
    if (b.dead && !b.collecting) continue;
    const { sx, sy } = ws(b.x, b.y);
    drawBarracudaSprite(sx, sy, b.vx >= 0, b.collecting ? 0.5 : 1, b.hp, BARRACUDA_HP, b.flashTimer > 0);
  }
}
function drawBarracudaSprite(sx, sy, fr, alpha, hp, maxHp, flash) {
  const f = fr ? 1 : -1, W = BARRACUDA_W / 2, H = BARRACUDA_H / 2;
  ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.fillStyle = flash ? '#fff' : '#607d8b'; ctx.strokeStyle = '#263238'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx - f * W, sy); ctx.lineTo(sx - f * (W + 15), sy - 11); ctx.lineTo(sx - f * (W + 9), sy); ctx.lineTo(sx - f * (W + 15), sy + 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(sx, sy, W, H, 0, 0, Math.PI * 2); ctx.clip();
  if (flash) { ctx.fillStyle = '#fff'; ctx.fillRect(sx - W, sy - H, W * 2, H * 2); }
  else { const g = ctx.createLinearGradient(sx, sy - H, sx, sy + H); g.addColorStop(0, '#b0bec5'); g.addColorStop(0.35, '#78909c'); g.addColorStop(1, '#455a64'); ctx.fillStyle = g; ctx.fillRect(sx - W, sy - H, W * 2, H * 2); }
  ctx.restore();
  ctx.strokeStyle = '#263238'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, W, H, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = flash ? '#fff' : '#546e7a'; ctx.strokeStyle = '#263238'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx - W * 0.5, sy - H); ctx.lineTo(sx - W * 0.1, sy - H - 10); ctx.lineTo(sx + W * 0.4, sy - H - 5); ctx.lineTo(sx + W * 0.5, sy - H); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = flash ? '#fff' : '#b0bec5'; ctx.strokeStyle = '#263238'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx + f * W, sy - 1); ctx.lineTo(sx + f * (W + 12), sy - 2); ctx.lineTo(sx + f * (W + 12), sy + 2); ctx.lineTo(sx + f * W, sy + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx + f * (W - 9), sy - 1, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.arc(sx + f * (W - 8.5), sy - 1, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(sx + f * (W - 8.5), sy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  drawHpBar(sx, sy, W, H, hp, maxHp);
  ctx.restore();
}

function drawOctopuses() {
  for (const f of octopuses) {
    if (f.dead && !f.collecting) continue;
    const { sx, sy } = ws(f.x, f.y);
    drawOctopusSprite(sx, sy, f.vx >= 0, f.collecting ? 0.5 : 1, f.hp, OCTOPUS_HP, f.flashTimer > 0);
  }
}
function drawOctopusSprite(sx, sy, fr, alpha, hp, maxHp, flash) {
  const W = OCTOPUS_W / 2, H = OCTOPUS_H / 2;
  ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.strokeStyle = flash ? '#fff' : '#7b1fa2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 5 - 0.5) * Math.PI * 0.9 + Math.PI * 0.5;
    const ex = sx + Math.cos(angle) * W * 1.4, ey = sy + Math.sin(angle) * H * 1.3 + 10;
    ctx.beginPath(); ctx.moveTo(sx + Math.cos(angle) * W * 0.5, sy + H * 0.3); ctx.quadraticCurveTo(ex - 5, ey - 8, ex, ey + 8); ctx.stroke();
  }
  if (flash) { ctx.fillStyle = '#fff'; }
  else { const g = ctx.createRadialGradient(sx - 4, sy - 4, 2, sx, sy, W); g.addColorStop(0, '#ce93d8'); g.addColorStop(0.6, '#9c27b0'); g.addColorStop(1, '#6a0080'); ctx.fillStyle = g; }
  ctx.beginPath(); ctx.ellipse(sx, sy - 4, W, H * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6a0080'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy - 4, W, H * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx - 6, sy - 6, 4, 0, Math.PI * 2); ctx.fill(); ctx.arc(sx + 6, sy - 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx - 5.5, sy - 6, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.arc(sx + 6.5, sy - 6, 2.5, 0, Math.PI * 2); ctx.fill();
  drawHpBar(sx, sy, W, H, hp, maxHp);
  ctx.restore();
}

function drawMorays() {
  for (const f of morays) {
    if (f.dead && !f.collecting) continue;
    const { sx, sy } = ws(f.x, f.y);
    drawMoraySprite(sx, sy, f.vx >= 0, f.collecting ? 0.5 : 1, f.hp, MORAY_HP, f.flashTimer > 0);
  }
}
function drawMoraySprite(sx, sy, fr, alpha, hp, maxHp, flash) {
  const fac = fr ? 1 : -1, W = MORAY_W / 2, H = MORAY_H / 2;
  ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.fillStyle = flash ? '#fff' : '#827717'; ctx.strokeStyle = '#33691e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx - fac * W, sy); ctx.lineTo(sx - fac * (W + 12), sy - 5); ctx.lineTo(sx - fac * (W + 12), sy + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(sx, sy, W, H, 0, 0, Math.PI * 2); ctx.clip();
  if (flash) { ctx.fillStyle = '#fff'; ctx.fillRect(sx - W, sy - H, W * 2, H * 2); }
  else {
    const g = ctx.createLinearGradient(sx, sy - H, sx, sy + H);
    g.addColorStop(0, '#dce775'); g.addColorStop(0.5, '#c6c827'); g.addColorStop(1, '#9e9d24');
    ctx.fillStyle = g; ctx.fillRect(sx - W, sy - H, W * 2, H * 2);
    ctx.fillStyle = 'rgba(0,80,0,0.25)';
    for (let i = 0; i < 5; i++) { const bx = sx - W + W * 0.35 * i; ctx.beginPath(); ctx.ellipse(bx, sy, 8, H * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  ctx.strokeStyle = '#827717'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy, W, H, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = flash ? '#fff' : '#d4e157'; ctx.strokeStyle = '#827717'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx + fac * W + 4, sy, 10, H + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + fac * (W + 1), sy + 2); ctx.lineTo(sx + fac * (W + 12), sy + 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sx + fac * (W + 3 + i * 3), sy + 2); ctx.lineTo(sx + fac * (W + 2.5 + i * 3), sy + 5); ctx.lineTo(sx + fac * (W + 4 + i * 3), sy + 2); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx + fac * (W + 5), sy - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + fac * (W + 5.5), sy - 3, 1.8, 0, Math.PI * 2); ctx.fill();
  drawHpBar(sx, sy, W, H, hp, maxHp);
  ctx.restore();
}

function drawBalloonEels() {
  for (const f of balloonEels) {
    if (f.dead && !f.collecting) continue;
    const { sx, sy } = ws(f.x, f.y);
    drawBalloonEelSprite(sx, sy, f.vx >= 0, f.collecting ? 0.5 : 1, f.hp, BALLOONEEL_HP, f.flashTimer > 0);
  }
}
function drawBalloonEelSprite(sx, sy, fr, alpha, hp, maxHp, flash) {
  const fac = fr ? 1 : -1, W = BALLOONEEL_W / 2, H = BALLOONEEL_H / 2;
  const t = Date.now() / 1000;
  ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha;

  // 얇은 몸통
  if (flash) { ctx.fillStyle = '#fff'; }
  else {
    const g = ctx.createLinearGradient(sx - fac * W, sy, sx + fac * W * 0.4, sy);
    g.addColorStop(0, '#1a237e'); g.addColorStop(1, '#3949ab');
    ctx.fillStyle = g;
  }
  ctx.beginPath(); ctx.ellipse(sx - fac * W * 0.15, sy, W * 0.72, H, 0, 0, Math.PI * 2); ctx.fill();

  // 생체발광 점
  if (!flash) {
    ctx.fillStyle = 'rgba(0,229,255,0.55)';
    for (let i = 0; i < 5; i++) {
      const bx = sx - fac * W * 0.55 + fac * i * W * 0.25;
      const by = sy + Math.sin(t * 2.1 + i * 1.3) * H * 0.5;
      ctx.beginPath(); ctx.arc(bx, by, H * 0.42, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 꼬리지느러미
  ctx.fillStyle = flash ? '#fff' : '#3949ab';
  const tailX = sx - fac * (W + 2);
  ctx.beginPath();
  ctx.moveTo(tailX, sy);
  ctx.lineTo(tailX - fac * 13, sy - 14); ctx.lineTo(tailX - fac * 18, sy); ctx.lineTo(tailX - fac * 13, sy + 14);
  ctx.closePath(); ctx.fill();

  // 풍선 입 (크고 둥근 머리)
  const mouthCX = sx + fac * W * 0.25;
  const mouthR = H * 2.9;
  if (flash) { ctx.fillStyle = '#fff'; }
  else {
    const mg = ctx.createRadialGradient(mouthCX - fac * mouthR * 0.18, sy - mouthR * 0.15, 1, mouthCX, sy, mouthR);
    mg.addColorStop(0, '#4a148c'); mg.addColorStop(0.65, '#311b92'); mg.addColorStop(1, '#0d0050');
    ctx.fillStyle = mg;
  }
  ctx.beginPath(); ctx.arc(mouthCX, sy, mouthR, 0, Math.PI * 2); ctx.fill();
  if (!flash) { ctx.strokeStyle = 'rgba(120,0,255,0.28)'; ctx.lineWidth = 1.5; ctx.stroke(); }

  // 입 내부
  if (!flash) {
    ctx.fillStyle = '#060008';
    ctx.beginPath(); ctx.arc(mouthCX + fac * mouthR * 0.24, sy, mouthR * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,200,255,0.18)';
    ctx.beginPath(); ctx.arc(mouthCX + fac * mouthR * 0.24, sy, mouthR * 0.25, 0, Math.PI * 2); ctx.fill();
  }

  // 눈
  const eyeX = mouthCX - fac * mouthR * 0.28, eyeY = sy - mouthR * 0.36;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeY, H * 0.88, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(eyeX + fac * H * 0.1, eyeY, H * 0.56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(eyeX + fac * H * 0.32, eyeY - H * 0.22, H * 0.2, 0, Math.PI * 2); ctx.fill();

  drawHpBar(sx, sy, W + mouthR * 0.6, mouthR, hp, maxHp);
  ctx.restore();
}

function drawToothFishes() {
  for (const f of toothFishes) {
    if (f.dead && !f.collecting) continue;
    const { sx, sy } = ws(f.x, f.y);
    drawToothFishSprite(sx, sy, f.vx >= 0, f.collecting ? 0.5 : 1, f.hp, TOOTHFISH_HP, f.flashTimer > 0);
  }
}
function drawToothFishSprite(sx, sy, fr, alpha, hp, maxHp, flash) {
  const fac = fr ? 1 : -1, W = TOOTHFISH_W / 2, H = TOOTHFISH_H / 2;
  ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha;

  // 거대한 몸통
  if (flash) { ctx.fillStyle = '#fff'; }
  else {
    const g = ctx.createLinearGradient(sx, sy - H, sx, sy + H);
    g.addColorStop(0, '#37474f'); g.addColorStop(0.45, '#263238'); g.addColorStop(1, '#1a2326');
    ctx.fillStyle = g;
  }
  ctx.beginPath(); ctx.ellipse(sx - fac * W * 0.05, sy - H * 0.08, W * 0.87, H * 0.78, 0, 0, Math.PI * 2); ctx.fill();
  if (!flash) { ctx.strokeStyle = '#1c2b30'; ctx.lineWidth = 2; ctx.stroke(); }

  // 꼬리지느러미
  ctx.fillStyle = flash ? '#fff' : '#455a64';
  ctx.beginPath();
  ctx.moveTo(sx - fac * W * 0.88, sy);
  ctx.lineTo(sx - fac * (W + 48), sy - H * 0.66);
  ctx.lineTo(sx - fac * (W + 26), sy);
  ctx.lineTo(sx - fac * (W + 48), sy + H * 0.66);
  ctx.closePath(); ctx.fill();

  // 등지느러미
  ctx.fillStyle = flash ? '#fff' : '#546e7a';
  ctx.beginPath();
  ctx.moveTo(sx - fac * W * 0.25, sy - H);
  ctx.lineTo(sx + fac * W * 0.12, sy - H - H * 0.58);
  ctx.lineTo(sx + fac * W * 0.52, sy - H);
  ctx.closePath(); ctx.fill();

  // 가슴지느러미
  ctx.fillStyle = flash ? '#fff' : '#37474f';
  ctx.beginPath(); ctx.ellipse(sx + fac * W * 0.05, sy + H * 0.72, W * 0.22, H * 0.28, fac * 0.35, 0, Math.PI * 2); ctx.fill();

  // 머리 (앞부분)
  const headCX = sx + fac * W * 0.8;
  if (flash) { ctx.fillStyle = '#fff'; }
  else {
    const hg = ctx.createRadialGradient(headCX - fac * H * 0.3, sy - H * 0.15, 3, headCX, sy, H);
    hg.addColorStop(0, '#455a64'); hg.addColorStop(1, '#263238');
    ctx.fillStyle = hg;
  }
  ctx.beginPath(); ctx.ellipse(headCX, sy - H * 0.05, H * 0.74, H * 0.88, 0, 0, Math.PI * 2); ctx.fill();

  // 거대한 입
  if (!flash) {
    ctx.fillStyle = '#070d0e';
    ctx.beginPath();
    ctx.moveTo(headCX + fac * H * 0.72, sy - H * 0.08);
    ctx.lineTo(headCX + fac * H * 0.18, sy - H * 0.74);
    ctx.lineTo(headCX - fac * H * 0.42, sy - H * 0.56);
    ctx.lineTo(headCX - fac * H * 0.32, sy + H * 0.56);
    ctx.lineTo(headCX + fac * H * 0.18, sy + H * 0.74);
    ctx.closePath(); ctx.fill();

    // 위 이빨
    ctx.fillStyle = '#f5f5f5'; ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const tp = i / 5;
      const tx = headCX - fac * H * 0.38 + fac * tp * H * 0.62;
      const ty = sy - H * 0.6 + tp * H * 0.07;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + fac * H * 0.07, ty + H * 0.29); ctx.lineTo(tx + fac * H * 0.14, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 아래 이빨
    for (let i = 0; i < 5; i++) {
      const tp = i / 4;
      const tx = headCX - fac * H * 0.32 + fac * tp * H * 0.56;
      const ty = sy + H * 0.6 - tp * H * 0.06;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + fac * H * 0.07, ty - H * 0.29); ctx.lineTo(tx + fac * H * 0.14, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // 눈 (붉고 위협적)
  const eyeX = sx + fac * W * 0.58, eyeY = sy - H * 0.42, eyeR = H * 0.2;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR * 1.32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b71c1c'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(eyeX + fac * eyeR * 0.2, eyeY, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(eyeX + fac * eyeR * 0.55, eyeY - eyeR * 0.5, eyeR * 0.24, 0, Math.PI * 2); ctx.fill();

  // 비늘 음영
  if (!flash) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = H * 0.13;
    for (let i = 0; i < 4; i++) {
      const bx = sx - fac * W * 0.48 + fac * i * W * 0.23;
      ctx.beginPath(); ctx.moveTo(bx, sy - H * 0.5); ctx.lineTo(bx + fac * H * 0.12, sy + H * 0.5); ctx.stroke();
    }
  }

  drawHpBar(sx, sy, W + 48, H, hp, maxHp);
  ctx.restore();
}

function drawHarpoon() {
  if (!harpoon.active) return;
  const { sx: px, sy: py } = ws(player.x, player.y);
  const { sx: hx, sy: hy } = ws(harpoon.x, harpoon.y);
  ctx.save();
  ctx.strokeStyle = 'rgba(200,200,200,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#bdbdbd'; ctx.strokeStyle = '#757575'; ctx.lineWidth = 2;
  const angle = Math.atan2(harpoon.vy, harpoon.vx);
  ctx.translate(hx, hy); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -4); ctx.lineTo(-4, 0); ctx.lineTo(-6, 4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const { sx, sy } = ws(player.x, player.y);
  const f = playerFacingRight ? 1 : -1;
  const upg = playerData.upgrades || { flipper:0, oxygen:0, harpoon:0 };
  const flipperTier = upgradeTier(upg.flipper||0);
  const tankTier = upgradeTier(upg.oxygen||0);
  const harpoonTier = upgradeTier(upg.harpoon||0);
  const flipperColor = UPGRADE_COLORS.flipper[flipperTier];
  const tankColor = UPGRADE_COLORS.tank[tankTier];
  const harpoonColor = UPGRADE_COLORS.harpoon[harpoonTier];
  ctx.save();

  // 물갈퀴
  ctx.fillStyle = flipperColor;
  if(flipperTier>=3){ctx.shadowColor=flipperColor;ctx.shadowBlur=6;}
  ctx.beginPath(); ctx.ellipse(sx + f * 10, sy + 18, 12+(flipperTier*1.5), 4, f * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx - f * 2, sy + 18, 9+(flipperTier*1.2), 3, -f * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#0d47a1'; ctx.fillRect(sx - 11, sy + 7, 9, 12); ctx.fillRect(sx + 2, sy + 7, 9, 12);
  ctx.fillStyle = '#1565c0'; ctx.fillRect(sx - 12, sy - 8, 24, 15);
  ctx.strokeStyle = '#0a3880'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 7); ctx.stroke();

  // 산소통
  const tx = sx - f * 15;
  ctx.fillStyle = tankColor; ctx.fillRect(tx - 4, sy - 8, 9, 14);
  ctx.fillStyle = '#b0bec5'; ctx.fillRect(tx - 2, sy - 5, 4, 10);
  ctx.fillStyle = tankTier>=1?tankColor:'#607d8b'; ctx.fillRect(tx - 3, sy - 12, 7, 6);
  ctx.fillStyle = '#90a4ae'; ctx.fillRect(tx - 1, sy - 11, 3, 3);
  if(tankTier>=2){ctx.strokeStyle=tankColor;ctx.lineWidth=1;ctx.strokeRect(tx-4,sy-8,9,14);}
  if(tankTier>=4){ctx.shadowColor=tankColor;ctx.shadowBlur=8;ctx.strokeStyle=tankColor;ctx.lineWidth=1.5;ctx.strokeRect(tx-4,sy-8,9,14);ctx.shadowBlur=0;}

  ctx.strokeStyle = '#263238'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(tx + f * 5, sy - 5); ctx.quadraticCurveTo(sx + f * 2, sy - 22, sx + f * 11, sy - 14); ctx.stroke();
  ctx.fillStyle = '#ffcc80'; ctx.beginPath(); ctx.arc(sx, sy - 17, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(sx + f * 3, sy - 18, 8.5, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(100,200,255,0.62)'; ctx.beginPath(); ctx.ellipse(sx + f * 3, sy - 18, 6.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(sx + f * 5, sy - 21, 2.5, 1.5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - f * 5, sy - 18); ctx.lineTo(sx - f * 10, sy - 18); ctx.stroke();
  ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(sx + f * 10, sy - 13, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#546e7a'; ctx.beginPath(); ctx.arc(sx + f * 10, sy - 13, 2.5, 0, Math.PI * 2); ctx.fill();

  // 작살 건
  const aimAngle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  const gx = sx + Math.cos(aimAngle) * 10, gy = sy - 2 + Math.sin(aimAngle) * 6;
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(aimAngle);
  if(harpoonTier>=3){ctx.shadowColor=harpoonColor;ctx.shadowBlur=8;}
  ctx.fillStyle = harpoonColor; ctx.fillRect(-2, -2, 26, 5);
  ctx.fillStyle = harpoonTier>=2?harpoonColor:'#cfd8dc'; ctx.fillRect(24, -3, 5, 7);
  ctx.fillStyle = '#546e7a'; ctx.fillRect(-9, -2, 8, 10); ctx.fillStyle = '#37474f'; ctx.fillRect(-4, 3, 2.5, 6);
  ctx.strokeStyle = harpoonTier>=1?harpoonColor:'#546e7a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(22, 0); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.restore();
}

function drawBubbles() {
  for (const b of bubbles) {
    const { sx, sy } = ws(b.x, b.y);
    ctx.save(); ctx.globalAlpha = Math.max(0, b.life) * 0.85;
    ctx.strokeStyle = 'rgba(180,230,255,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(sx - b.r * 0.3, sy - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ── HUD ──────────────────────────────────────────
function drawHUD() {
  drawOxygenBar();
  drawInventoryHUD();
  drawHarpoonCooldown();
  drawCaveLabel();
}

function drawCaveLabel() {
  ctx.save();
  ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = 'rgba(0,220,150,0.8)'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,200,120,0.6)'; ctx.shadowBlur = 8;
  ctx.fillText('🌊 해저 동굴', canvas.width / 2, 30);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHarpoonCooldown() {
  if (harpoonCooldown <= 0) return;
  const r = harpoonCooldown / 1.0;
  const cx = canvas.width / 2, cy = canvas.height - 40;
  ctx.save();
  ctx.strokeStyle = 'rgba(200,200,200,0.3)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - r)); ctx.stroke();
  ctx.restore();
}

function drawOxygenBar() {
  const x = 20, y = 20, w = 200, h = 20;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const ratio = oxygenTimer / effectiveOxygen();
  ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ffeb3b' : '#f44336';
  ctx.fillRect(x, y, w * ratio, h);
  if (oxygenTimer <= 0) { const bl = Math.sin(graceBlinkTimer * 8) > 0; ctx.strokeStyle = bl ? '#ff1744' : '#ff8a80'; ctx.lineWidth = 3; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); }
  const txt = oxygenTimer > 0 ? `산소: ${Math.ceil(oxygenTimer)}초` : `⚠ 위험! ${Math.ceil(graceTimer)}초`;
  ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.fillText(txt, x + 4, y + 14);
  ctx.restore();
}

function drawInventoryHUD() {
  const items = [
    { key:'anchovy',      label:'멸치',        color:'#e0e0e0' },
    { key:'clownfish',    label:'흰동가리',    color:'#ff8a65' },
    { key:'salmon',       label:'연어',        color:'#f48fb1' },
    { key:'tuna',         label:'참치',        color:'#1565c0' },
    { key:'shark',        label:'상어',        color:'#546e7a' },
    { key:'whale',        label:'고래',        color:'#1a237e' },
    { key:'tropicalfish', label:'열대어',      color:'#ff7043' },
    { key:'turtle',       label:'거북이',      color:'#388e3c' },
    { key:'butterflyfish',label:'나비고기',    color:'#ffd54f' },
    { key:'barracuda',    label:'바라쿠다',    color:'#90caf9' },
    { key:'octopus',      label:'문어',        color:'#ce93d8' },
    { key:'moray',        label:'곰치',        color:'#dce775' },
    { key:'sunfish',      label:'개복치',      color:'#80cbc4' },
    { key:'holefish',     label:'구멍고기',    color:'#4dd0e1' },
    { key:'plesio',       label:'수장룡',      color:'#26a69a' },
    { key:'ballooneel',   label:'풍선입 장어', color:'#7986cb' },
    { key:'toothfish',    label:'이빨고기',    color:'#ef9a9a' },
    { key:'seaweed',      label:'해초',        color:'#81c784' },
    { key:'anemone',      label:'말미잘',      color:'#ff8a80' },
    { key:'jellyfish',    label:'해파리',      color:'#b39ddb' },
    { key:'stone',        label:'돌',          color:'#b0bec5' },
    { key:'iron',         label:'철',          color:'#eceff1' },
    { key:'gold',         label:'금',          color:'#ffd700' },
    { key:'aluminum',     label:'알루미늄',    color:'#b3e5fc' },
  ].filter(it => (playerData.inventory[it.key] || 0) > 0);

  const lineH = 22, pw = 210;
  const ph = 16 + lineH + (items.length > 0 ? items.length * lineH + 6 : 0) + lineH;
  const x = canvas.width - 220, y = 20;
  ctx.save();
  ctx.fillStyle = inventoryOpen ? 'rgba(10,60,120,0.8)' : 'rgba(0,0,0,0.45)';
  ctx.strokeStyle = inventoryOpen ? '#4fc3f7' : 'transparent'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x - 8, y - 8, pw, ph, 8); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  let oy = y + 14;
  items.forEach(it => { ctx.fillStyle = it.color; ctx.fillText(`${it.label}: ${playerData.inventory[it.key] || 0}`, x, oy); oy += lineH; });
  if (items.length > 0) oy += 6;
  ctx.fillStyle = '#ffe082'; ctx.fillText(`코인: ${playerData.coins || 0}`, x, oy); oy += lineH;
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(150,220,255,0.7)'; ctx.fillText('[ I ] 인벤토리', x, oy);
  ctx.restore();
}

function drawInventory() {
  const species = [
    { key:'anchovy',      name:'멸치',        coinValue:1,   desc:'얕은 수심 은빛 물고기' },
    { key:'clownfish',    name:'흰동가리',    coinValue:2,   desc:'산호 근처 주황 줄무늬 물고기' },
    { key:'salmon',       name:'연어',        coinValue:5,   desc:'중간 수심 분홍빛 물고기' },
    { key:'tuna',         name:'참치',        coinValue:32,  desc:'빠르고 강한 심청색 물고기' },
    { key:'shark',        name:'상어',        coinValue:80,  desc:'삼각 등지느러미 포식자' },
    { key:'whale',        name:'고래',        coinValue:300, desc:'거대한 심청색 고래' },
    { key:'tropicalfish', name:'열대어',      coinValue:3,   desc:'형형색색 줄무늬 물고기' },
    { key:'turtle',       name:'거북이',      coinValue:24,  desc:'심해를 유영하는 초록 거북이' },
    { key:'butterflyfish',name:'나비고기',    coinValue:5,   desc:'나비 같은 날개의 희귀 물고기' },
    { key:'barracuda',    name:'바라쿠다',    coinValue:10,  desc:'날카로운 이빨의 동굴 포식자' },
    { key:'octopus',      name:'문어',        coinValue:20,  desc:'동굴 바닥을 기어다닌다' },
    { key:'moray',        name:'곰치',        coinValue:15,  desc:'얼룩무늬 긴 뱀장어' },
    { key:'sunfish',      name:'개복치',      coinValue:18,  desc:'청록빛 바다의 거대 원반 물고기' },
    { key:'holefish',     name:'구멍고기',    coinValue:10,  desc:'나비고기와 공생하는 청록 물고기' },
    { key:'plesio',       name:'수장룡',      coinValue:200, desc:'유연한 목을 가진 거대 해룡' },
    { key:'ballooneel',   name:'풍선입 장어', coinValue:30,  desc:'발광하는 거대 입의 심해 장어' },
    { key:'toothfish',    name:'이빨고기',    coinValue:150, desc:'고래만한 거대 이빨의 동굴 포식자' },
    { key:'seaweed',      name:'해초',        coinValue:1,   desc:'동굴 바닥에서 자라는 해초' },
    { key:'anemone',      name:'말미잘',      coinValue:2,   desc:'촉수로 먹이를 잡는 말미잘' },
    { key:'jellyfish',    name:'해파리',      coinValue:3,   desc:'청록빛 바다를 유영하는 해파리' },
    { key:'stone',        name:'돌',          coinValue:1,   desc:'광맥에서 채취한 단단한 돌' },
    { key:'iron',         name:'철',          coinValue:3,   desc:'동굴 광맥의 철광석' },
    { key:'gold',         name:'금',          coinValue:10,  desc:'청록빛 바다 심층의 금광석' },
    { key:'aluminum',     name:'알루미늄',    coinValue:5,   desc:'동굴 깊은 곳의 알루미늄 광맥' },
  ].filter(sp => (playerData.inventory[sp.key] || 0) > 0);

  const pw = Math.min(460, canvas.width - 40);
  const cardH = 70, cardM = 6;
  const ph = Math.max(130, 70 + species.length * (cardH + cardM) + 24);
  const px = Math.round(canvas.width / 2 - pw / 2);
  const py = Math.round(canvas.height / 2 - ph / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = 'rgba(5,18,48,0.97)'; ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill(); ctx.stroke();
  ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#e0f7fa'; ctx.textAlign = 'center';
  ctx.fillText('인벤토리 (동굴)', px + pw / 2, py + 34);
  ctx.fillStyle = '#455a64'; ctx.beginPath(); ctx.roundRect(px + pw - 46, py + 12, 34, 26, 5); ctx.fill();
  ctx.fillStyle = '#eceff1'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✕', px + pw - 29, py + 30);

  if (species.length === 0) {
    ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(100,180,200,0.5)'; ctx.textAlign = 'center';
    ctx.fillText('아직 잡은 물고기가 없습니다', px + pw / 2, py + ph / 2);
  } else {
    let oy = py + 54;
    species.forEach(sp => {
      const cnt = playerData.inventory[sp.key] || 0;
      ctx.fillStyle = 'rgba(79,195,247,0.07)'; ctx.strokeStyle = 'rgba(79,195,247,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px + 14, oy, pw - 28, cardH, 8); ctx.fill(); ctx.stroke();
      const tx = px + 24; ctx.textAlign = 'left';
      ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#e0f7fa'; ctx.fillText(sp.name, tx, oy + 20);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#cfd8dc'; ctx.fillText(sp.desc, tx, oy + 36);
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(`보유: ${cnt}마리`, tx, oy + 52);
      ctx.fillStyle = '#ffe082'; ctx.fillText(`${sp.coinValue}코인/마리`, tx + 100, oy + 52);
      ctx.fillStyle = '#a5d6a7'; ctx.fillText(`총 ${cnt * sp.coinValue}코인`, tx + 190, oy + 52);
      oy += cardH + cardM;
    });
  }
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(100,180,200,0.5)'; ctx.textAlign = 'center';
  ctx.fillText('[ I ] 또는 클릭으로 닫기', px + pw / 2, py + ph - 10);
  ctx.restore();
}

function positionCaveLogSearch() {
  const searchEl = document.getElementById('log-search');
  if (!logOpen) { searchEl.style.display = 'none'; return; }
  const pw = Math.min(620, canvas.width - 40);
  const px = Math.round(canvas.width / 2 - pw / 2);
  const HEADER_H = 88, cardH = 76, cardM = 4, secM = 8;
  let totalH = 0;
  CAVE_FISH_CATALOG.forEach(sec => { totalH += 20 + secM + sec.keys.length * (cardH + cardM); });
  const visibleH = Math.min(totalH, canvas.height - 120);
  const ph = HEADER_H + visibleH + 24;
  const py = Math.round(canvas.height / 2 - ph / 2);
  const rect = canvas.getBoundingClientRect();
  searchEl.style.left = (rect.left + px + 14) + 'px';
  searchEl.style.top = (rect.top + py + 46) + 'px';
  searchEl.style.width = (pw - 80) + 'px';
  searchEl.style.display = 'block';
}

const CAVE_FISH_CATALOG = [
  { region:'얕은 바다',   keys:['anchovy','clownfish','tuna','shark','whale'] },
  { region:'중간 수심',   keys:['salmon'] },
  { region:'동굴',        keys:['barracuda','octopus','moray','ballooneel','toothfish'] },
  { region:'청록빛 바다', keys:['tropicalfish','butterflyfish','turtle','sunfish','holefish','plesio'] },
];

const CAVE_FISH_DATA = {
  anchovy:      {name:'멸치',        hp:20,   trait:'무리 지어 유영하며 해초를 먹는다',           habitat:'일반 바다 전역',      coinValue:1,   drawFn:(x,y)=>drawCaveLogIcon(x,y,'anchovy')},
  clownfish:    {name:'흰동가리',    hp:20,   trait:'산호초 근처를 맴돌며 말미잘과 공생한다',     habitat:'일반 바다 전역',      coinValue:2,   drawFn:(x,y)=>drawCaveLogIcon(x,y,'clownfish')},
  tuna:         {name:'참치',        hp:160,  trait:'5초 주기로 배가 고파지며 먹잇감을 추격한다', habitat:'일반 바다 전역',      coinValue:32,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'tuna')},
  shark:        {name:'상어',        hp:300,  trait:'날카로운 이빨의 최상위 포식자',              habitat:'일반 바다 전역',      coinValue:80,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'shark')},
  whale:        {name:'고래',        hp:1000, trait:'거대한 몸집으로 천천히 유영한다',            habitat:'일반 바다 전역',      coinValue:300, drawFn:(x,y)=>drawCaveLogIcon(x,y,'whale')},
  salmon:       {name:'연어',        hp:40,   trait:'중간 수심 600~1600m를 빠르게 유영한다',     habitat:'중간 수심 600~1600m', coinValue:5,   drawFn:(x,y)=>drawCaveLogIcon(x,y,'salmon')},
  barracuda:    {name:'바라쿠다',    hp:100,  trait:'동굴에서만 서식하며 매우 빠르다',            habitat:'해저 동굴',           coinValue:10,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'barracuda')},
  octopus:      {name:'문어',        hp:150,  trait:'동굴 바닥을 기어다닌다',                    habitat:'동굴 깊은 곳',        coinValue:20,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'octopus')},
  moray:        {name:'곰치',        hp:80,   trait:'날카로운 이빨로 굴 속에 몸을 숨긴다',       habitat:'동굴 암석 사이',      coinValue:15,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'moray')},
  ballooneel:   {name:'풍선입 장어', hp:250,  trait:'생체발광 점이 있는 심해 거대 장어',          habitat:'해저 동굴 심층',      coinValue:30,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'ballooneel')},
  toothfish:    {name:'이빨고기',    hp:900,  trait:'고래만한 몸집의 최강 동굴 포식자',           habitat:'해저 동굴 심층',      coinValue:450, drawFn:(x,y)=>drawCaveLogIcon(x,y,'toothfish')},
  tropicalfish: {name:'열대어',      hp:30,   trait:'무리 지어 유영하며 나비고기의 먹이가 된다',  habitat:'청록빛 바다 전역',    coinValue:3,   drawFn:(x,y)=>drawCaveLogIcon(x,y,'tropicalfish')},
  butterflyfish:{name:'나비고기',    hp:30,   trait:'열대어를 사냥하며 자극 시 산소를 빼앗는다',  habitat:'청록빛 바다 전역',    coinValue:5,   drawFn:(x,y)=>drawCaveLogIcon(x,y,'butterflyfish')},
  turtle:       {name:'거북이',      hp:200,  trait:'해파리를 먹으며 단단한 껍질로 높은 맷집',    habitat:'청록빛 바다 전역',    coinValue:24,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'turtle')},
  sunfish:      {name:'개복치',      hp:200,  trait:'거대한 원반 몸통으로 천천히 유영한다',       habitat:'청록빛 바다 전역',    coinValue:32,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'sunfish')},
  holefish:     {name:'구멍고기',    hp:400,  trait:'나비고기의 곁을 좋아하며 함께 추격한다',    habitat:'청록빛 바다 전역',    coinValue:70,  drawFn:(x,y)=>drawCaveLogIcon(x,y,'holefish')},
  plesio:       {name:'수장룡',      hp:800,  trait:'유연한 목으로 먹잇감을 낚아챈다',            habitat:'청록빛 바다 심층',    coinValue:600, drawFn:(x,y)=>drawCaveLogIcon(x,y,'plesio')},
};

function drawSimpleSeaFishIcon(sx, sy, key) {
  const defs = {
    anchovy:      { c:'#c8c8d0', t:'#a0a0a0', w:16, h:8  },
    clownfish:    { c:'#ff7043', t:'#bf360c', w:13, h:10, stripe:'#fff' },
    salmon:       { c:'#f48fb1', t:'#e91e63', w:18, h:9  },
    tuna:         { c:'#1e88e5', t:'#0d47a1', w:18, h:9  },
    shark:        { c:'#607d8b', t:'#37474f', w:22, h:9,  dorsal:true },
    whale:        { c:'#283593', t:'#1a237e', w:26, h:13 },
    tropicalfish: { c:'#ffa000', t:'#ff6f00', w:13, h:13, stripe:'#fff' },
    turtle:       { c:'#388e3c', t:'#1b5e20', w:16, h:13, round:true },
    butterflyfish:{ c:'#ffd54f', t:'#f57f17', w:12, h:16 },
    sunfish:      { c:'#80cbc4', t:'#00796b', w:11, h:20, round:true },
    holefish:     { c:'#00acc1', t:'#006064', w:22, h:10 },
    plesio:       { c:'#26a69a', t:'#00695c', w:20, h:9,  neck:true },
  };
  const d = defs[key] || { c:'#90a4ae', t:'#546e7a', w:16, h:8 };
  ctx.save();
  if (!d.round) {
    ctx.fillStyle = d.t;
    ctx.beginPath(); ctx.moveTo(sx-d.w-2,sy); ctx.lineTo(sx-d.w-10,sy-9); ctx.lineTo(sx-d.w-10,sy+9); ctx.closePath(); ctx.fill();
  }
  if (d.dorsal) {
    ctx.fillStyle = d.t;
    ctx.beginPath(); ctx.moveTo(sx-8,sy-d.h); ctx.lineTo(sx,sy-d.h-13); ctx.lineTo(sx+8,sy-d.h); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = d.c;
  if (d.round) {
    ctx.beginPath(); ctx.ellipse(sx, sy, d.w, d.h, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = d.t;
    ctx.beginPath(); ctx.moveTo(sx-d.w+2,sy); ctx.lineTo(sx-d.w-8,sy-8); ctx.lineTo(sx-d.w-8,sy+8); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(sx, sy, d.w, d.h, 0, 0, Math.PI*2); ctx.fill();
  }
  if (d.stripe) {
    ctx.strokeStyle = d.stripe; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx-3,sy-d.h); ctx.lineTo(sx-3,sy+d.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+4,sy-d.h); ctx.lineTo(sx+4,sy+d.h); ctx.stroke();
  }
  if (d.neck) {
    ctx.fillStyle = d.c;
    ctx.beginPath(); ctx.ellipse(sx+10, sy-12, 5, 10, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx+13, sy-20, 6, 0, Math.PI*2); ctx.fill();
  }
  const eyeX = d.round ? sx+d.w*0.4 : sx+d.w*0.6-2;
  const eyeY = sy - d.h * 0.25;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeY, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(eyeX+0.5, eyeY, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawCaveLogIcon(sx, sy, key) {
  ctx.save();
  switch (key) {
    case 'barracuda':
      drawBarracudaSprite(sx, sy, true, 1, BARRACUDA_HP, BARRACUDA_HP, false); break;
    case 'octopus':
      drawOctopusSprite(sx, sy, true, 1, OCTOPUS_HP, OCTOPUS_HP, false); break;
    case 'moray':
      drawMoraySprite(sx, sy, true, 1, MORAY_HP, MORAY_HP, false); break;
    case 'ballooneel':
      ctx.translate(sx, sy); ctx.scale(0.52, 0.52);
      drawBalloonEelSprite(0, 0, true, 1, BALLOONEEL_HP, BALLOONEEL_HP, false); break;
    case 'toothfish':
      ctx.translate(sx, sy); ctx.scale(0.16, 0.16);
      drawToothFishSprite(0, 0, true, 1, TOOTHFISH_HP, TOOTHFISH_HP, false); break;
    default:
      drawSimpleSeaFishIcon(sx, sy, key); break;
  }
  ctx.restore();
}

function drawCaveLog() {
  const pw = Math.min(620, canvas.width - 40);
  const px = Math.round(canvas.width / 2 - pw / 2);
  const HEADER_H = 88, FOOTER_H = 24;
  const cardH = 76, cardM = 4, secM = 8;

  const filteredCatalog = CAVE_FISH_CATALOG.map(sec => ({
    region: sec.region,
    keys: sec.keys.filter(key => {
      if (!logSearchText) return true;
      const d = CAVE_FISH_DATA[key];
      return d.name.includes(logSearchText) || key.toLowerCase().includes(logSearchText.toLowerCase());
    })
  })).filter(sec => sec.keys.length > 0);

  let totalH = 0;
  filteredCatalog.forEach(sec => { totalH += 20 + secM + sec.keys.length * (cardH + cardM); });
  const contentH = Math.max(totalH, 1);
  const visibleH = Math.min(contentH, canvas.height - 120);
  const ph = HEADER_H + visibleH + FOOTER_H;
  const py = Math.round(canvas.height / 2 - ph / 2);

  const maxScroll = Math.max(0, contentH - visibleH);
  logScrollY = Math.max(0, Math.min(logScrollY, maxScroll));

  positionCaveLogSearch();

  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = 'rgba(5,18,48,0.97)'; ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill(); ctx.stroke();

  ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#e0f7fa'; ctx.textAlign = 'center';
  ctx.fillText('도감', px + pw / 2, py + 30);
  ctx.fillStyle = '#455a64'; ctx.beginPath(); ctx.roundRect(px + pw - 46, py + 12, 34, 26, 5); ctx.fill();
  ctx.fillStyle = '#eceff1'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✕', px + pw - 29, py + 30);

  ctx.fillStyle = 'rgba(0,20,50,0.9)'; ctx.strokeStyle = 'rgba(79,195,247,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px + 14, py + 44, pw - 28 - 46, 28, 5); ctx.fill(); ctx.stroke();
  ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(100,180,200,0.5)'; ctx.textAlign = 'left';
  if (!logSearchText) ctx.fillText('물고기 검색...', px + 22, py + 63);

  ctx.strokeStyle = 'rgba(79,195,247,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 20, py + HEADER_H - 6); ctx.lineTo(px + pw - 20, py + HEADER_H - 6); ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.rect(px, py + HEADER_H, pw, visibleH); ctx.clip();

  let oy = py + HEADER_H - logScrollY;
  filteredCatalog.forEach(section => {
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#4dd0e1'; ctx.textAlign = 'left';
    ctx.fillText('━ ' + section.region, px + 18, oy + 14);
    oy += 20 + secM;
    section.keys.forEach(key => {
      const data = CAVE_FISH_DATA[key];
      const caught = (playerData.fishLog && playerData.fishLog[key]) || 0;
      const cy = oy;
      ctx.fillStyle = caught > 0 ? 'rgba(79,195,247,0.07)' : 'rgba(40,40,40,0.5)';
      ctx.strokeStyle = caught > 0 ? 'rgba(79,195,247,0.35)' : 'rgba(80,80,80,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px + 14, cy, pw - 28, cardH, 7); ctx.fill(); ctx.stroke();

      ctx.fillStyle = caught > 0 ? 'rgba(0,40,80,0.55)' : 'rgba(15,15,15,0.6)';
      ctx.beginPath(); ctx.roundRect(px + 20, cy + 5, 74, cardH - 10, 5); ctx.fill();

      if (caught > 0) {
        data.drawFn(px + 57, cy + cardH / 2);
      } else {
        ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#37474f'; ctx.textAlign = 'center';
        ctx.fillText('?', px + 57, cy + cardH / 2 + 8);
      }

      const tx = px + 104; ctx.textAlign = 'left';
      if (caught > 0) {
        ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#e0f7fa'; ctx.fillText(data.name, tx, cy + 16);
        ctx.font = '9.5px sans-serif'; ctx.fillStyle = '#80cbc4';
        ctx.fillText('HP: ' + data.hp + '  서식지: ' + data.habitat, tx, cy + 30);
        ctx.fillStyle = '#90a4ae'; ctx.fillText('특이점: ' + data.trait, tx, cy + 43);
        ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ffe082';
        ctx.fillText(data.coinValue + '코인/마리', tx, cy + 58);
        ctx.fillStyle = '#a5d6a7';
        ctx.fillText('총 ' + caught + '마리 포획', tx + 90, cy + 58);
      } else {
        ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#455a64'; ctx.fillText('???', tx, cy + 16);
        ctx.font = '9.5px sans-serif'; ctx.fillStyle = '#37474f'; ctx.fillText('아직 발견하지 못한 생물', tx, cy + 30);
      }
      oy += cardH + cardM;
    });
  });

  ctx.restore();

  if (contentH > visibleH) {
    const sbx = px + pw - 8, sby = py + HEADER_H;
    const ratio = visibleH / contentH;
    const thumbH = Math.max(20, visibleH * ratio);
    const thumbY = sby + (logScrollY / maxScroll) * (visibleH - thumbH);
    ctx.fillStyle = 'rgba(79,195,247,0.2)'; ctx.beginPath(); ctx.roundRect(sbx, sby, 4, visibleH, 2); ctx.fill();
    ctx.fillStyle = 'rgba(79,195,247,0.6)'; ctx.beginPath(); ctx.roundRect(sbx, thumbY, 4, thumbH, 2); ctx.fill();
  }

  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(100,180,200,0.5)'; ctx.textAlign = 'center';
  ctx.fillText('[ ; ] 또는 ✕ 로 닫기  |  스크롤로 탐색', px + pw / 2, py + ph - 8);
  ctx.restore();
}

function drawFadeOverlay() {
  if (fadeOpacity <= 0) return;
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${fadeOpacity})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (gameOverState === 'falling' && fadeOpacity > 0.5) {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = `rgba(255,100,100,${(fadeOpacity - 0.5) * 2})`;
    ctx.textAlign = 'center'; ctx.fillText('익사...', canvas.width / 2, canvas.height / 2);
  }
  ctx.restore();
}

init();
