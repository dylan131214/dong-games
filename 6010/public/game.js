// ────────────────────────────────────────────────
//  바다 낚시 게임  game.js
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
  tuna:0, shark:0, whale:0,
  sunfish:0, holefish:0, plesio:0,
  ballooneel:0, toothfish:0
}, fishLog: {
  anchovy:0, clownfish:0, salmon:0, barracuda:0,
  tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
  tuna:0, shark:0, whale:0,
  sunfish:0, holefish:0, plesio:0,
  ballooneel:0, toothfish:0
}, upgrades: { flipper:0, oxygen:0, harpoon:0 }, hasScope:false, activeHarpoon:'normal', scopeUpgrades:{harpoon:0}};

async function loadPlayerData() {
  const res = await fetch('/api/player/' + encodeURIComponent(nickname));
  if (res.ok) {
    playerData = await res.json();
    if (!playerData.fishLog) playerData.fishLog = {
      anchovy:0, clownfish:0, salmon:0, barracuda:0,
      tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
      tuna:0, shark:0, whale:0,
      sunfish:0, holefish:0, plesio:0,
      ballooneel:0, toothfish:0
    };
    else {
      if (playerData.fishLog.sunfish===undefined) playerData.fishLog.sunfish=0;
      if (playerData.fishLog.holefish===undefined) playerData.fishLog.holefish=0;
      if (playerData.fishLog.plesio===undefined) playerData.fishLog.plesio=0;
      if (playerData.fishLog.ballooneel===undefined) playerData.fishLog.ballooneel=0;
      if (playerData.fishLog.toothfish===undefined) playerData.fishLog.toothfish=0;
    }
    if (!playerData.inventory) playerData.inventory = {
      anchovy:0, clownfish:0, salmon:0, barracuda:0,
      tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0,
      tuna:0, shark:0, whale:0,
      seaweed:0, anemone:0, jellyfish:0, stone:0, iron:0, gold:0, aluminum:0,
      sunfish:0, holefish:0, plesio:0,
      ballooneel:0, toothfish:0
    };
    else {
      if (playerData.inventory.sunfish===undefined) playerData.inventory.sunfish=0;
      if (playerData.inventory.holefish===undefined) playerData.inventory.holefish=0;
      if (playerData.inventory.plesio===undefined) playerData.inventory.plesio=0;
      if (playerData.inventory.ballooneel===undefined) playerData.inventory.ballooneel=0;
      if (playerData.inventory.toothfish===undefined) playerData.inventory.toothfish=0;
    }
    if (!playerData.upgrades) playerData.upgrades = { flipper:0, oxygen:0, harpoon:0 };
    if (playerData.hasScope===undefined) playerData.hasScope=false;
    if (!playerData.activeHarpoon) playerData.activeHarpoon='normal';
    if (!playerData.scopeUpgrades) playerData.scopeUpgrades={harpoon:0};
    if (playerData.hasSeamouse===undefined) playerData.hasSeamouse=false;
    if (playerData.hasCamp===undefined) playerData.hasCamp=false;
  }
}
async function savePlayerData() {
  await fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(playerData) });
}
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/save', new Blob([JSON.stringify(playerData)], {type:'application/json'}));
});

// ── 상수 ────────────────────────────────────────
const SURFACE_RATIO = 0.3;
const SHIP_W = 120, SHIP_H = 50;
const SMALL_BOAT_OFFSET = 150;
const SMALL_W = 80, SMALL_H = 35;
const PLAYER_W = 30, PLAYER_H = 40;
const PLAYER_SPEED_SURFACE = 200;
const PLAYER_SPEED_WATER = 150;
const HARPOON_SPEED = 600;
const HARPOON_SPEED_OUT = HARPOON_SPEED * 5;
const HARPOON_MAX_DIST = 300;
const HARPOON_HIT_RADIUS = 10;
const HARPOON_DAMAGE = 20;
const MAX_OXYGEN_SEC = 60;
const MAX_GRACE_SEC = 10;
const SELL_BOAT_RADIUS = 50;
const ANCHOVY_REGEN_MS = 10000;
const REGEN_MS = 12000;

const GRAVITY = 500;
const JUMP_VY = -380;
const BUOYANCY_ACCEL = 70;
const SWIM_ACCEL = 12;
const SWIM_DRAG = 3.5;

// 물고기 상수
const ANCHOVY_MAX=150, ANCHOVY_W=15, ANCHOVY_H=8, ANCHOVY_SPEED=80, ANCHOVY_HP=20;
const CLOWNFISH_MAX=40, CLOWNFISH_W=22, CLOWNFISH_H=13, CLOWNFISH_SPEED=55, CLOWNFISH_HP=20;
const SALMON_MAX=9, SALMON_W=32, SALMON_H=16, SALMON_SPEED=90, SALMON_HP=40;
const BARRACUDA_MAX=4, BARRACUDA_W=55, BARRACUDA_H=14, BARRACUDA_SPEED=130, BARRACUDA_HP=100;
const TROPICALFISH_MAX=35, TROPICALFISH_W=22, TROPICALFISH_H=13, TROPICALFISH_SPEED=65, TROPICALFISH_HP=30;
const TURTLE_MAX=4, TURTLE_W=44, TURTLE_H=30, TURTLE_SPEED=35, TURTLE_HP=200;
const BUTTERFLYFISH_MAX=4, BUTTERFLYFISH_W=20, BUTTERFLYFISH_H=20, BUTTERFLYFISH_SPEED=70, BUTTERFLYFISH_CHASE_SPEED=130, BUTTERFLYFISH_HP=30;
const OCTOPUS_MAX=4, OCTOPUS_W=36, OCTOPUS_H=26, OCTOPUS_SPEED=50, OCTOPUS_HP=150;
const MORAY_MAX=4, MORAY_W=58, MORAY_H=10, MORAY_SPEED=90, MORAY_HP=80;
const TUNA_MAX=5,  TUNA_W=45,  TUNA_H=20,  TUNA_SPEED=130, TUNA_HP=160;
const SHARK_MAX=3, SHARK_W=140,SHARK_H=50, SHARK_SPEED=100, SHARK_HP=300;
const WHALE_MAX=2, WHALE_W=480,WHALE_H=200,WHALE_SPEED=30,  WHALE_HP=1000;
const SUNFISH_MAX=3, SUNFISH_W=65, SUNFISH_H=90,  SUNFISH_SPEED=30,  SUNFISH_HP=200;
const HOLEFISH_MAX=6,HOLEFISH_W=360,HOLEFISH_H=140, HOLEFISH_SPEED=130, HOLEFISH_HP=400;
const PLESIO_MAX=1,  PLESIO_W=360, PLESIO_H=150,  PLESIO_SPEED=130,  PLESIO_HP=800;
const PLESIO_NECK_SEG=38, PLESIO_HEAD_SPEED=480, PLESIO_HEAD_R=58;

// 시마우스 상수
const SEAMOUSE_W=70, SEAMOUSE_H=32;
const SEAMOUSE_SPEED=220;
const SEAMOUSE_MAX_OXYGEN=100;
const SEAMOUSE_ACCEL=10;
const SEAMOUSE_DRAG=3.5;
const SEAMOUSE_BOARD_RADIUS=55;
const SEAMOUSE_RESPAWN_DELAY=10;

// 구멍 시스템
const HOLE_CHUNK_SIZE = 900;
const HOLE_WIDTH = 150;
const SHAFT_DEPTH = 500; // 지형1 두께 (구멍 샤프트 길이)

const SHIP_WORLD_X = 0;

// ── 게임 상태 ────────────────────────────────────
let lastTime = 0;
const camera = { x:0, y:0 };
const player = { x:SHIP_WORLD_X, y:0, vx:0, vy:0, alive:true, onShip:false };
const harpoon = { active:false, x:0, y:0, vx:0, vy:0, dist:0, returning:false };

let anchovies=[], anchovyIdCounter=0;
let clownfishes=[], clownfishIdCounter=0;
let salmons=[], salmonIdCounter=0;
let tropicalfishes=[], tropicalfishIdCounter=0;
let turtles=[], turtleIdCounter=0;
let butterflyfishes=[], butterflyfishIdCounter=0;
let tunas=[], tunaIdCounter=0;
let sharks=[], sharkIdCounter=0;
let whales=[], whaleIdCounter=0;
let sunfishes=[], sunfishIdCounter=0;
let holefishes=[], holefishIdCounter=0;
let plesios=[], plesioIdCounter=0;
let infiniteOxygen=false;
let logSearchText='';

let oxygenTimer=MAX_OXYGEN_SEC, graceTimer=MAX_GRACE_SEC;
let isUnderwater=false, graceBlinkTimer=0;
let gameOverState=null, fadeOpacity=0, fallVelocity=0;
let playerZone='sea1'; // 'sea1' | 'teal'
let tealTransitionAlpha=0;
let cameraOffsetY=0; // 청록빛 바다에서 카메라 세로 오프셋 (지형 천장이 보이도록)
let playerFacingRight=true;
let bubbles=[], bubbleTimer=0;
let inventoryOpen=false, inventoryBounds=null, inventoryScrollY=0;
let showShipMarker=false;
let logOpen=false, logBounds=null, logScrollY=0;
let sellPanelOpen=false, sellPanelBounds=null, sellPromptBounds=null, sellScrollY=0;
let shopOpen=false, shopBtnBounds=null;
let craftOpen=false, craftBtnBounds=null, craftConfirmBounds=null, craftSeamouseBounds=null, craftCampBounds=null;
let campObject=null; // { x, y, used }
const CAMP_INTERACT_RADIUS=65;
let seamouse=null; // {x,y,vx,vy,oxygen,piloted,angle,exploding,explodeTimer,flashTimer,explodeParticles}
let seamouseRespawnTimer=0;
let tealBlockedTimer=0;
let harpoonCooldown=0;
let terrainBlockDown=false, terrainBlockUp=false;
let butterflyfishAgro=false;

// ── 업그레이드 효과 ──────────────────────────────────
function effectiveSpeed() { return PLAYER_SPEED_WATER + (playerData.upgrades?.flipper||0) * 8; }
function effectiveOxygen() { return MAX_OXYGEN_SEC + (playerData.upgrades?.oxygen||0) * 6; }
function effectiveHarpoonDamage() {
  const base=HARPOON_DAMAGE + (playerData.upgrades?.harpoon||0) * 4;
  if(playerData.activeHarpoon==='scope') return base*1.5 + (playerData.scopeUpgrades?.harpoon||0)*4;
  return base;
}
function effectiveHarpoonRange() { return playerData.activeHarpoon==='scope'?HARPOON_MAX_DIST*2.5:HARPOON_MAX_DIST; }
function effectiveCooldown() { return playerData.activeHarpoon==='scope'?3.0:1.0; }

// ── 업그레이드 외형 티어 ──────────────────────────────
const UPGRADE_COLORS = {
  flipper:  ['#fdd835','#00e5ff','#76ff03','#ff6d00','#e040fb','#ffd700'],
  tank:     ['#455a64','#0288d1','#00838f','#558b2f','#6a1b9a','#b71c1c'],
  harpoon:  ['#78909c','#0277bd','#00695c','#558b2f','#6a1b9a','#bf360c'],
};
function upgradeTier(level) { return Math.min(5, Math.floor(level/10)); }
function upgradeCost(currentLevel) { return Math.floor(70 * Math.pow(1.1, currentLevel)); }

// ── 부유석 시스템 ────────────────────────────────────
const FROCK_CHUNK = 800;
const FROCK_PER_CHUNK = 3;

function seededRandFR(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function getFloatingRocksInChunk(c) {
  const rocks = [];
  for (let i = 0; i < FROCK_PER_CHUNK; i++) {
    const seed = c * 9371 + i * 2939 + 5731;
    const rx = c * FROCK_CHUNK + seededRandFR(seed) * FROCK_CHUNK;
    if (Math.abs(rx) < 250) continue;
    if (isInHoleAt(rx)) continue;
    const ty = terrainY(rx);
    const minY = surfaceY() + 200;
    const maxY = ty - 140;
    if (maxY < minY + 100) continue;
    const ry = minY + seededRandFR(seed * 5.1) * (maxY - minY);
    const r = 40 + seededRandFR(seed * 7.3) * 60;
    rocks.push({ x: rx, y: ry, r, seed, key: `fr_${c}_${i}` });
  }
  return rocks;
}

function getVisibleFloatingRocks() {
  const lx = camera.x - canvas.width * 0.7;
  const rx = camera.x + canvas.width * 0.7;
  const sc = Math.floor(lx / FROCK_CHUNK) - 1;
  const ec = Math.floor(rx / FROCK_CHUNK) + 1;
  const rocks = [];
  for (let c = sc; c <= ec; c++) rocks.push(...getFloatingRocksInChunk(c));
  return rocks;
}

const TROCK_CHUNK = 700;
const TROCK_PER_CHUNK = 8;

function getTealRocksInChunk(c) {
  const rocks = [];
  for (let i = 0; i < TROCK_PER_CHUNK; i++) {
    const seed = c * 8419 + i * 3571 + 6247;
    const rx = c * TROCK_CHUNK + seededRandFR(seed) * TROCK_CHUNK;
    const ty = terrainY(rx), t2y = terrain2Y(rx);
    const minY = ty + SHAFT_DEPTH + 80;
    const maxY = t2y - 120;
    if (maxY < minY + 80) continue;
    const ry = minY + seededRandFR(seed * 5.3) * (maxY - minY);
    const r = 45 + seededRandFR(seed * 7.1) * 65;
    const roll = seededRandFR(seed * 13.7);
    const invKey = roll < 0.40 ? 'stone' : roll < 0.75 ? 'iron' : 'gold';
    rocks.push({ x: rx, y: ry, r, seed: seed + 10000, key: `tr_${c}_${i}`, invKey, hp: 60 });
  }
  return rocks;
}

function getVisibleTealRocks() {
  const lx = camera.x - canvas.width * 0.7;
  const rx = camera.x + canvas.width * 0.7;
  const sc = Math.floor(lx / TROCK_CHUNK) - 1;
  const ec = Math.floor(rx / TROCK_CHUNK) + 1;
  const rocks = [];
  for (let c = sc; c <= ec; c++) rocks.push(...getTealRocksInChunk(c));
  return rocks;
}

// ── 청록 비채집 일반 부유석 (노드 생성용) ─────────────
const NTROCK_CHUNK = 750;
const NTROCK_PER_CHUNK = 5;

function getNonMineableTealRocksInChunk(c) {
  const rocks = [];
  for (let i = 0; i < NTROCK_PER_CHUNK; i++) {
    const seed = c * 5923 + i * 3779 + 7301;
    const rx2 = c * NTROCK_CHUNK + seededRandFR(seed) * NTROCK_CHUNK;
    const ty = terrainY(rx2), t2y = terrain2Y(rx2);
    const minY = ty + SHAFT_DEPTH + 80;
    const maxY = t2y - 120;
    if (maxY < minY + 100) continue;
    const ry = minY + seededRandFR(seed * 5.1) * (maxY - minY);
    const r = 38 + seededRandFR(seed * 7.3) * 55;
    rocks.push({ x: rx2, y: ry, r, seed: seed + 30000, key: `ntr_${c}_${i}` });
  }
  return rocks;
}

function getVisibleNonMineableTealRocks() {
  const lx = camera.x - canvas.width * 0.7;
  const rx2 = camera.x + canvas.width * 0.7;
  const sc = Math.floor(lx / NTROCK_CHUNK) - 1;
  const ec = Math.floor(rx2 / NTROCK_CHUNK) + 1;
  const rocks = [];
  for (let c = sc; c <= ec; c++) rocks.push(...getNonMineableTealRocksInChunk(c));
  return rocks;
}

function getNonMineableTealRockNodes() {
  const nodes = [];
  for (const rock of getVisibleNonMineableTealRocks()) {
    const key = `ntrn_${rock.key}`;
    if (nodeRespawning.has(key)) continue;
    const roll = seededRandFR(rock.seed * 2.99);
    let type;
    if (roll < 0.25) type = 'jellyfish';
    else if (roll < 0.50) type = 'stone_ore';
    else if (roll < 0.75) type = 'iron_ore';
    else type = 'gold_ore';
    nodes.push({ x: rock.x, y: rock.y - rock.r, type, key });
  }
  return nodes;
}

// ── 채집 노드 시스템 ────────────────────────────────
const NODE_DEFS = {
  seaweed:      { label:'해초',         invKey:'seaweed',   coinValue:1,  hp:10, r:14 },
  anemone:      { label:'말미잘',       invKey:'anemone',   coinValue:2,  hp:10, r:16 },
  jellyfish:    { label:'해파리',       invKey:'jellyfish', coinValue:3,  hp:10, r:16 },
  stone_ore:    { label:'돌 광맥',      invKey:'stone',     coinValue:1,  hp:30, r:20 },
  iron_ore:     { label:'철 광맥',      invKey:'iron',      coinValue:3,  hp:30, r:20 },
  gold_ore:     { label:'금 광맥',      invKey:'gold',      coinValue:10, hp:50, r:20 },
  aluminum_ore: { label:'알루미늄 광맥',invKey:'aluminum',  coinValue:5,  hp:40, r:20 },
};
const GATHER_CHUNK = 1000;
const GATHER_PER_CHUNK = 5;
const GATHER_RESPAWN_MS = 25000;

function seededRandG(seed) {
  const x = Math.sin(seed * 181.7 + 419.3) * 57319.5453;
  return x - Math.floor(x);
}

function getSea1GatherChunk(c) {
  const nodes = [];
  for (let i = 0; i < GATHER_PER_CHUNK; i++) {
    const seed = c * 6173 + i * 3191 + 8237;
    const nx = c * GATHER_CHUNK + seededRandG(seed) * GATHER_CHUNK;
    if (isInHoleAt(nx)) continue;
    const roll = seededRandG(seed * 3.7);
    let type;
    if (roll < 0.65) type = 'seaweed';
    else if (roll < 0.78) type = 'anemone';
    else if (roll < 0.90) type = 'stone_ore';
    else type = 'iron_ore';
    nodes.push({ x: nx, y: terrainY(nx), type, key: `s1_${c}_${i}` });
  }
  return nodes;
}

function getTealGatherChunk(c) {
  const nodes = [];
  for (let i = 0; i < GATHER_PER_CHUNK; i++) {
    const seed = c * 7219 + i * 4337 + 9173;
    const nx = c * GATHER_CHUNK + seededRandG(seed) * GATHER_CHUNK;
    const roll = seededRandG(seed * 4.1);
    let type, ny;
    const ty = terrainY(nx), t2y = terrain2Y(nx);
    if (roll < 0.55) { type = 'seaweed'; ny = t2y; }
    else if (roll < 0.70) { type = 'jellyfish'; ny = t2y; }
    else if (roll < 0.82) { type = 'stone_ore'; ny = t2y; }
    else if (roll < 0.92) { type = 'iron_ore'; ny = t2y; }
    else { type = 'gold_ore'; ny = t2y; }
    nodes.push({ x: nx, y: ny, type, key: `tl_${c}_${i}` });
  }
  return nodes;
}

function getFloatingRockNodes() {
  const nodes = [];
  for (const rock of getVisibleFloatingRocks()) {
    const key = `frn_${rock.key}`;
    if (nodeRespawning.has(key)) continue;
    const roll = seededRandFR(rock.seed * 2.71);
    let type;
    if (roll < 0.30) type = 'seaweed';
    else if (roll < 0.55) type = 'anemone';
    else if (roll < 0.75) type = 'stone_ore';
    else type = 'iron_ore';
    nodes.push({ x: rock.x, y: rock.y - rock.r, type, key });
  }
  return nodes;
}

function getVisibleGatherNodes() {
  const lx = camera.x - canvas.width * 0.75;
  const rx = camera.x + canvas.width * 0.75;
  const sc = Math.floor(lx / GATHER_CHUNK) - 1;
  const ec = Math.floor(rx / GATHER_CHUNK) + 1;
  const nodes = [];
  const genFn = playerZone === 'teal' ? getTealGatherChunk : getSea1GatherChunk;
  for (let c = sc; c <= ec; c++) nodes.push(...genFn(c));
  if(playerZone==='sea1') nodes.push(...getFloatingRockNodes());
  if(playerZone==='teal') nodes.push(...getNonMineableTealRockNodes());
  return nodes.filter(n => !nodeRespawning.has(n.key));
}

const nodeHitStates = new Map();
const nodeRespawning = new Map();

// 부유석 히트 상태 (청록 + 동굴)
const rockHitStates = new Map();  // key -> { hp, flashTimer, done }
const rockRespawning = new Map(); // key -> respawnAt
const ROCK_RESPAWN_MS = 30000;

function updateRockStates(dt) {
  const now = Date.now();
  for (const [key, respawnAt] of rockRespawning.entries()) {
    if (now >= respawnAt) { rockRespawning.delete(key); rockHitStates.delete(key); }
  }
  for (const [, state] of rockHitStates.entries()) {
    if (state.flashTimer > 0) state.flashTimer -= dt;
  }
}

function hitRock(rock) {
  if (rockRespawning.has(rock.key)) return;
  let state = rockHitStates.get(rock.key);
  if (!state) { state = { hp: rock.hp, flashTimer: 0, done: false }; rockHitStates.set(rock.key, state); }
  if (state.done) return;
  state.hp -= effectiveHarpoonDamage();
  harpoon.returning = true;
  if (state.hp <= 0) {
    state.done = true;
    const amt = 1 + Math.floor(seededRandFR((rock.seed || 1) * 19.3) * 3);
    playerData.inventory[rock.invKey] = (playerData.inventory[rock.invKey] || 0) + amt;
    savePlayerData();
    rockRespawning.set(rock.key, Date.now() + ROCK_RESPAWN_MS);
  } else {
    state.flashTimer = 0.15;
  }
}

function updateGatherNodes(dt) {
  const now = Date.now();
  for (const [key, respawnAt] of nodeRespawning.entries()) {
    if (now >= respawnAt) { nodeRespawning.delete(key); nodeHitStates.delete(key); }
  }
  for (const [key, state] of nodeHitStates.entries()) {
    if (state.flashTimer > 0) state.flashTimer -= dt;
    if (state.collecting) {
      state.collectT += dt;
      if (state.collectT >= 0.5 && !state.done) {
        state.done = true;
        playerData.inventory[state.invKey] = (playerData.inventory[state.invKey] || 0) + 1;
        savePlayerData();
        nodeRespawning.set(key, Date.now() + GATHER_RESPAWN_MS);
      }
    }
  }
}

function hitGatherNode(node) {
  const def = NODE_DEFS[node.type];
  let state = nodeHitStates.get(node.key);
  if (!state) {
    state = { hp: def.hp, flashTimer: 0, collecting: false, collectT: 0,
              startX: node.x, startY: node.y, invKey: def.invKey, type: node.type, done: false };
    nodeHitStates.set(node.key, state);
  }
  if (state.collecting) return;
  state.hp -= effectiveHarpoonDamage();
  harpoon.returning = true;
  if (state.hp <= 0) { state.collecting = true; state.collectT = 0; }
  else { state.flashTimer = 0.15; }
}

// ── 서식지별 범위 헬퍼 ────────────────────────────
function randomSea1Y(sx, H) {
  const ty=terrainY(sx);
  return surfaceY()+30+Math.random()*Math.max(50,ty-surfaceY()-H-60);
}
function randomTealY(sx, H) {
  const ty=terrainY(sx), t2y=terrain2Y(sx);
  return ty+SHAFT_DEPTH+H+6+Math.random()*Math.max(50,t2y-ty-SHAFT_DEPTH-H*2-12);
}
function clampSea1Fish(f, H) {
  if(f.y<surfaceY()+30){f.y=surfaceY()+30;f.vy=Math.abs(f.vy);}
  const ceil=terrainY(f.x)-H-6; if(f.y>ceil){f.y=ceil;f.vy=-Math.abs(f.vy);}
}
function clampTealFish(f, H) {
  const ty=terrainY(f.x), t2y=terrain2Y(f.x);
  if(f.y<ty+SHAFT_DEPTH+H+6){f.y=ty+SHAFT_DEPTH+H+6;f.vy=Math.abs(f.vy);}
  if(f.y>t2y-H-6){f.y=t2y-H-6;f.vy=-Math.abs(f.vy);}
}

const keys={};
let mouseWorld={x:0,y:0};
let mouseScreen={x:0,y:0};

const sellUI={
  visible:false, delivering:false, countdown:0,
  amount:0, clownfishAmount:0, salmonAmount:0, barracudaAmount:0,
  tropicalfishAmount:0, turtleAmount:0, butterflyfishAmount:0, octopusAmount:0, morayAmount:0,
  tunaAmount:0, sharkAmount:0, whaleAmount:0,
  sunfishAmount:0, holefishAmount:0, plesioAmount:0,
  balloneelAmount:0, toothfishAmount:0,
  seaweedAmount:0, anemoneAmount:0, jellyfishAmount:0,
  stoneAmount:0, ironAmount:0, goldAmount:0, aluminumAmount:0,
};

// ── 초기화 ───────────────────────────────────────
async function init() {
  await loadPlayerData();
  oxygenTimer = effectiveOxygen();
  player.x = SHIP_WORLD_X;
  player.y = deckTopY() - PLAYER_H/2;
  if(playerData.hasSeamouse) spawnSeamouse();

  spawnAnchoviesInit(ANCHOVY_MAX);
  spawnClownfishesInit(CLOWNFISH_MAX);
  spawnSalmons(SALMON_MAX);
  spawnTropicalFishes(TROPICALFISH_MAX);
  spawnTurtles(TURTLE_MAX);
  spawnButterflyfishes(BUTTERFLYFISH_MAX);
  const cmdEl=document.getElementById('cmd-input');
  cmdEl.addEventListener('keydown', e=>{
    if(e.code==='Enter'){processCommand(cmdEl.value.trim());cmdEl.value='';cmdEl.blur();cmdEl.style.display='none';}
    if(e.code==='Escape'){cmdEl.value='';cmdEl.blur();cmdEl.style.display='none';}
    e.stopPropagation();
  });

  const searchEl=document.getElementById('log-search');
  searchEl.addEventListener('input', e=>{logSearchText=e.target.value;});
  searchEl.addEventListener('keydown', e=>{
    if(e.code==='Semicolon'||e.code==='Escape'){logOpen=false;searchEl.style.display='none';searchEl.value='';logSearchText='';}
    if(e.code!=='Enter') e.stopPropagation();
  });

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', e => {
    keys[e.code]=true;
    if(e.code==='KeyI') { inventoryOpen=!inventoryOpen; if(inventoryOpen){logOpen=false;sellPanelOpen=false;shopOpen=false;inventoryScrollY=0;} }
    if(e.code==='Semicolon') {
      logOpen=!logOpen;
      const se=document.getElementById('log-search');
      if(logOpen){inventoryOpen=false;sellPanelOpen=false;shopOpen=false;logScrollY=0;positionLogSearch();se.style.display='block';setTimeout(()=>se.focus(),10);}
      else{se.style.display='none';se.value='';logSearchText='';}
    }
    if(e.code==='Enter') {
      if(logOpen){
        const se=document.getElementById('log-search');
        const val=se.value.trim();
        if(isCommand(val)){processCommand(val);logOpen=false;se.style.display='none';se.value='';logSearchText='';}
      } else {
        const ce=document.getElementById('cmd-input');
        if(document.activeElement!==ce){ce.style.display='block';ce.focus();}
      }
    }
    if(e.code==='KeyP') showShipMarker=!showShipMarker;
    if(e.code==='KeyF'){
      if(playerData.hasCamp&&player.y>surfaceY()+80&&!campObject&&player.alive&&!gameOverState){
        campObject={x:player.x,y:player.y,used:false};
      }
    }
    if(e.code==='KeyM'&&e.shiftKey&&e.ctrlKey){playerData.hasSeamouse=true;seamouse=null;seamouseRespawnTimer=0;spawnSeamouse();playerData.hasCamp=true;savePlayerData();}
    if(e.code==='Escape') { shopOpen=false; craftOpen=false; const ce=document.getElementById('cmd-input');ce.style.display='none';ce.value=''; }
    if(e.code==='KeyE'){
      if(seamouse&&!seamouse.exploding&&!seamouse.piloted&&player.alive&&!gameOverState){
        const dx=player.x-seamouse.x,dy=player.y-seamouse.y;
        if(Math.sqrt(dx*dx+dy*dy)<SEAMOUSE_BOARD_RADIUS*1.5){seamouse.piloted=true;}
      } else if(seamouse&&seamouse.piloted){
        seamouse.piloted=false;
        player.x=seamouse.x+20; player.y=seamouse.y;
      }
    }
  });
  window.addEventListener('keyup', e => { keys[e.code]=false; });
  window.addEventListener('resize', ()=>{ if(logOpen) positionLogSearch(); });
  canvas.addEventListener('click', onSellUIClick);
  canvas.addEventListener('wheel', e => {
    if(logOpen) { logScrollY+=e.deltaY*0.8; e.preventDefault(); }
    if(inventoryOpen) { inventoryScrollY+=e.deltaY*0.8; e.preventDefault(); }
    if(sellPanelOpen) { sellScrollY+=e.deltaY*0.8; e.preventDefault(); }
  }, {passive:false});

  requestAnimationFrame(loop);
}

function surfaceY() { return 0; }
function deckTopY() { return surfaceY()-12; }

function seededRand(seed) {
  const x = Math.sin(seed*127.1+311.7)*43758.5453;
  return x-Math.floor(x);
}

// 해저 지형 1 (청록빛 바다 천장)
function terrainY(wx) {
  let y=2480;
  y+=Math.sin(wx*0.006)*300;
  y+=Math.sin(wx*0.018+2.1)*160;
  y+=Math.sin(wx*0.055+4.7)*80;
  y+=Math.sin(wx*0.13+1.2)*40;
  return Math.max(2160,Math.min(2920,y));
}

// 해저 지형 2 (청록빛 바다 바닥 / 동굴 천장) — 1번 바다와 동일한 깊이
function terrain2Y(wx) {
  let y=terrainY(wx)+SHAFT_DEPTH+2480;
  y+=Math.sin(wx*0.0055+1.8)*280;
  y+=Math.sin(wx*0.017+3.2)*150;
  y+=Math.sin(wx*0.048+0.7)*70;
  y+=Math.sin(wx*0.13+0.5)*35;
  return y;
}

// 동굴 바닥
function caveFloorY(wx) {
  let y=terrain2Y(wx)+900;
  y+=Math.sin(wx*0.008+5.3)*100;
  y+=Math.sin(wx*0.021+2.1)*50;
  return y;
}

// 동굴 오브젝트 시스템 (청록빛 바다 바닥 terrain2에 배치)
const CAVE_OBJ_CHUNK = 2800;

function getCaveObjXForChunk(c) {
  const seed=c*8317+25193;
  if(seededRand(seed*11.7)>0.55) return null;
  return c*CAVE_OBJ_CHUNK+seededRand(seed*19.3)*(CAVE_OBJ_CHUNK-300)+150;
}

function getVisibleCaveObjs(fromWX,toWX) {
  const s=Math.floor(fromWX/CAVE_OBJ_CHUNK)-1;
  const e=Math.floor(toWX/CAVE_OBJ_CHUNK)+1;
  const objs=[];
  for(let c=s;c<=e;c++){
    const x=getCaveObjXForChunk(c);
    if(x!==null&&x>=fromWX-200&&x<=toWX+200) objs.push({x,y:terrain2Y(x)-130});
  }
  return objs;
}


// 구멍 시스템
function holeXForChunk(c) {
  const seed=c*7919+31337;
  if(seededRand(seed*17.3+5.1)>0.42) return null;
  const hx=c*HOLE_CHUNK_SIZE+seededRand(seed*23.7+8.3)*(HOLE_CHUNK_SIZE-HOLE_WIDTH)+HOLE_WIDTH/2;
  if(Math.abs(hx)<300) return null; // 배 근처엔 구멍 없음
  return hx;
}

function isInHoleAt(wx) {
  const chunk=Math.floor(wx/HOLE_CHUNK_SIZE);
  for(let c=chunk-1;c<=chunk+1;c++) {
    const hx=holeXForChunk(c);
    if(hx!==null&&Math.abs(wx-hx)<HOLE_WIDTH/2) return true;
  }
  return false;
}

function getVisibleHoles(fromWX,toWX) {
  const s=Math.floor(fromWX/HOLE_CHUNK_SIZE)-1;
  const e=Math.floor(toWX/HOLE_CHUNK_SIZE)+1;
  const holes=[];
  for(let c=s;c<=e;c++) {
    const hx=holeXForChunk(c);
    if(hx!==null&&hx>=fromWX-HOLE_WIDTH&&hx<=toWX+HOLE_WIDTH) holes.push(hx);
  }
  return holes;
}

// 월드↔화면 변환
function toScreen(wx,wy) {
  return { sx:wx-camera.x+canvas.width*0.5, sy:wy-camera.y+canvas.height*SURFACE_RATIO };
}
function toWorld(sx,sy) {
  return { wx:sx-canvas.width*0.5+camera.x, wy:sy-canvas.height*SURFACE_RATIO+camera.y };
}
function ws(wx,wy) { return toScreen(wx,wy); }

// ── 스폰 함수 ────────────────────────────────────
function mkFish(extra) {
  return { dead:false, collecting:false, collectT:0, collectDur:0.5, startX:0, startY:0, flashTimer:0, dirTimer:Math.random()*3, hungerTimer:0, ...extra };
}

function spawnAnchovy() {
  if(anchovies.length>=ANCHOVY_MAX) return;
  anchovies.push(mkFish({
    id:anchovyIdCounter++, hp:ANCHOVY_HP, collectDur:0.4,
    x:player.x+(Math.random()-0.5)*1400,
    y:surfaceY()+60+Math.random()*500,
    vx:(Math.random()<0.5?1:-1)*ANCHOVY_SPEED,
    vy:(Math.random()-0.5)*40,
  }));
}
function spawnAnchovies(n) { for(let i=0;i<n;i++) spawnAnchovy(); }
function spawnAnchoviesInit(n) {
  for(let i=0;i<n;i++){
    if(anchovies.length>=ANCHOVY_MAX)return;
    const sx=player.x+(Math.random()-0.5)*2400;
    anchovies.push(mkFish({id:anchovyIdCounter++,hp:ANCHOVY_HP,collectDur:0.4,
      x:sx,y:randomSea1Y(sx,ANCHOVY_H),
      vx:(Math.random()<0.5?1:-1)*ANCHOVY_SPEED,vy:(Math.random()-0.5)*40}));
  }
}

function spawnClownfish() {
  if(clownfishes.length>=CLOWNFISH_MAX) return;
  clownfishes.push(mkFish({
    id:clownfishIdCounter++, hp:CLOWNFISH_HP, collectDur:0.5,
    x:player.x+(Math.random()-0.5)*1400,
    y:surfaceY()+400+Math.random()*600,
    vx:(Math.random()<0.5?1:-1)*CLOWNFISH_SPEED,
    vy:(Math.random()-0.5)*25,
  }));
}
function spawnClownfishes(n) { for(let i=0;i<n;i++) spawnClownfish(); }
function spawnClownfishesInit(n) {
  for(let i=0;i<n;i++){
    if(clownfishes.length>=CLOWNFISH_MAX)return;
    const sx=player.x+(Math.random()-0.5)*2400;
    clownfishes.push(mkFish({id:clownfishIdCounter++,hp:CLOWNFISH_HP,collectDur:0.5,
      x:sx,y:randomSea1Y(sx,CLOWNFISH_H),
      vx:(Math.random()<0.5?1:-1)*CLOWNFISH_SPEED,vy:(Math.random()-0.5)*25}));
  }
}

function spawnSalmon() {
  if(salmons.length>=SALMON_MAX) return;
  salmons.push(mkFish({
    id:salmonIdCounter++, hp:SALMON_HP, collectDur:0.55,
    x:player.x+(Math.random()-0.5)*1800,
    y:surfaceY()+900+Math.random()*1000,
    vx:(Math.random()<0.5?1:-1)*SALMON_SPEED,
    vy:(Math.random()-0.5)*30,
  }));
}
function spawnSalmons(n) { for(let i=0;i<n;i++) spawnSalmon(); }

function spawnTropicalFish() {
  if(tropicalfishes.length>=TROPICALFISH_MAX) return;
  const sx=player.x+(Math.random()-0.5)*1600;
  tropicalfishes.push(mkFish({
    id:tropicalfishIdCounter++, hp:TROPICALFISH_HP, collectDur:0.45,
    x:sx, y:randomTealY(sx,TROPICALFISH_H),
    vx:(Math.random()<0.5?1:-1)*TROPICALFISH_SPEED,
    vy:(Math.random()-0.5)*30,
  }));
}
function spawnTropicalFishes(n) { for(let i=0;i<n;i++) spawnTropicalFish(); }

function spawnTurtle() {
  if(turtles.length>=TURTLE_MAX) return;
  const sx=player.x+(Math.random()-0.5)*1800;
  turtles.push(mkFish({
    id:turtleIdCounter++, hp:TURTLE_HP, collectDur:0.8,
    x:sx, y:randomTealY(sx,TURTLE_H),
    vx:(Math.random()<0.5?1:-1)*TURTLE_SPEED,
    vy:(Math.random()-0.5)*15,
  }));
}
function spawnTurtles(n) { for(let i=0;i<n;i++) spawnTurtle(); }

function spawnButterflyfish() {
  if(butterflyfishes.length>=BUTTERFLYFISH_MAX) return;
  const sx=player.x+(Math.random()-0.5)*2000;
  butterflyfishes.push(mkFish({
    id:butterflyfishIdCounter++, hp:BUTTERFLYFISH_HP, collectDur:0.45,
    x:sx, y:randomTealY(sx,BUTTERFLYFISH_H),
    vx:(Math.random()<0.5?1:-1)*BUTTERFLYFISH_SPEED,
    vy:(Math.random()-0.5)*30,
    touchCooldown:0,
  }));
}
function spawnButterflyfishes(n) { for(let i=0;i<n;i++) spawnButterflyfish(); }

function spawnSunfish() {
  if(sunfishes.length>=SUNFISH_MAX) return;
  const sx=player.x+(Math.random()-0.5)*1800;
  sunfishes.push(mkFish({
    id:sunfishIdCounter++, hp:SUNFISH_HP, collectDur:0.9,
    x:sx, y:randomTealY(sx,SUNFISH_H),
    vx:(Math.random()<0.5?1:-1)*SUNFISH_SPEED, vy:(Math.random()-0.5)*8,
  }));
}
function spawnHolefish() {
  if(holefishes.length>=HOLEFISH_MAX) return;
  const sx=player.x+(Math.random()-0.5)*1600;
  holefishes.push(mkFish({
    id:holefishIdCounter++, hp:HOLEFISH_HP, collectDur:0.5,
    x:sx, y:randomTealY(sx,HOLEFISH_H), touchCooldown:0,
    vx:(Math.random()<0.5?1:-1)*HOLEFISH_SPEED, vy:(Math.random()-0.5)*20,
  }));
}
function spawnPlesio() {
  if(plesios.length>=PLESIO_MAX) return;
  const sx=player.x+(Math.random()-0.5)*3000;
  const sy=randomTealY(sx, PLESIO_H);
  const dir=Math.random()<0.5?1:-1;
  const trail=Array.from({length:30},()=>({x:sx,y:sy}));
  const nkAttX=sx+dir*(PLESIO_W/2*0.68), nkAttY=sy-PLESIO_H/2*0.22;
  const neck=Array.from({length:10},(_,i)=>({x:nkAttX+dir*i*PLESIO_NECK_SEG,y:nkAttY-i*4}));
  plesios.push({...mkFish({
    id:plesioIdCounter++, hp:PLESIO_HP, collectDur:2.5, touchCooldown:0,
    x:sx, y:sy,
    vx:dir*PLESIO_SPEED, vy:0,
  }), trail, neck});
}

function spawnTuna() {
  if(tunas.length>=TUNA_MAX) return;
  tunas.push(mkFish({
    id:tunaIdCounter++, hp:TUNA_HP, collectDur:0.5,
    x:player.x+(Math.random()-0.5)*1800,
    y:surfaceY()+80+Math.random()*Math.max(50,terrainY(player.x)-surfaceY()-TUNA_H-120),
    vx:(Math.random()<0.5?1:-1)*TUNA_SPEED, vy:(Math.random()-0.5)*30,
  }));
}
function spawnShark() {
  if(sharks.length>=SHARK_MAX) return;
  sharks.push(mkFish({
    id:sharkIdCounter++, hp:SHARK_HP, collectDur:0.7, touchCooldown:0,
    x:player.x+(Math.random()-0.5)*2000,
    y:surfaceY()+100+Math.random()*Math.max(50,terrainY(player.x)-surfaceY()-SHARK_H-140),
    vx:(Math.random()<0.5?1:-1)*SHARK_SPEED, vy:(Math.random()-0.5)*20,
  }));
}
function spawnWhale() {
  if(whales.length>=WHALE_MAX) return;
  whales.push(mkFish({
    id:whaleIdCounter++, hp:WHALE_HP, collectDur:1.2,
    x:player.x+(Math.random()-0.5)*2400,
    y:surfaceY()+150+Math.random()*Math.max(50,terrainY(player.x)-surfaceY()-WHALE_H-200),
    vx:(Math.random()<0.5?1:-1)*WHALE_SPEED, vy:(Math.random()-0.5)*10,
  }));
}

// ── 입력 ─────────────────────────────────────────
function onMouseMove(e) {
  const r=canvas.getBoundingClientRect();
  mouseScreen.x=e.clientX-r.left;
  mouseScreen.y=e.clientY-r.top;
  const w=toWorld(mouseScreen.x,mouseScreen.y);
  mouseWorld.x=w.wx; mouseWorld.y=w.wy;
}
function onMouseDown(e) {
  if(e.button!==0||!player.alive||gameOverState) return;

  // 상점 패널 열린 상태면 패널 내 클릭 처리
  if(shopOpen) { handleShopClick(e); return; }
  if(craftOpen) { handleCraftClick(e); return; }

  if(inventoryOpen||logOpen||sellPanelOpen) return;

  // 상점 버튼 클릭 (화면 좌표 기준)
  if(shopBtnBounds) {
    const r=canvas.getBoundingClientRect();
    const cx=e.clientX-r.left, cy=e.clientY-r.top;
    if(cx>=shopBtnBounds.x&&cx<=shopBtnBounds.x+shopBtnBounds.w&&cy>=shopBtnBounds.y&&cy<=shopBtnBounds.y+shopBtnBounds.h) {
      shopOpen=true; return;
    }
  }
  if(craftBtnBounds) {
    const r2=canvas.getBoundingClientRect();
    const cx2=e.clientX-r2.left, cy2=e.clientY-r2.top;
    if(cx2>=craftBtnBounds.x&&cx2<=craftBtnBounds.x+craftBtnBounds.w&&cy2>=craftBtnBounds.y&&cy2<=craftBtnBounds.y+craftBtnBounds.h) {
      craftOpen=true; return;
    }
  }

  // 동굴 입구 클릭 → 전용 맵으로 이동
  if(playerZone==='teal') {
    const caveObjs=getVisibleCaveObjs(player.x-canvas.width,player.x+canvas.width);
    for(const obj of caveObjs){
      const dx=mouseWorld.x-obj.x, dy=mouseWorld.y-obj.y;
      if(Math.sqrt(dx*dx+dy*dy)<90){
        savePlayerData().then(()=>{
          sessionStorage.setItem('cavePlayerData', JSON.stringify(playerData));
          window.location.href='cave.html';
        });
        return;
      }
    }
  }

  // 간이 캠프 클릭
  if(campObject){
    const r_=canvas.getBoundingClientRect();
    const cw_=toWorld(e.clientX-r_.left,e.clientY-r_.top);
    const cmdx=cw_.wx-campObject.x,cmdy=cw_.wy-campObject.y;
    if(Math.sqrt(cmdx*cmdx+cmdy*cmdy)<CAMP_INTERACT_RADIUS){
      const pcdx=player.x-campObject.x,pcdy=player.y-campObject.y;
      if(Math.sqrt(pcdx*pcdx+pcdy*pcdy)<CAMP_INTERACT_RADIUS*3){
        if(!campObject.used){
          oxygenTimer=effectiveOxygen();graceTimer=MAX_GRACE_SEC;
          campObject.used=true;
        }
        craftOpen=true;
        return;
      }
    }
  }

  if(seamouse&&seamouse.piloted) return;
  if(harpoonCooldown>0) return;
  const dx=mouseWorld.x-player.x, dy=mouseWorld.y-player.y;
  const dist=Math.sqrt(dx*dx+dy*dy)||1;
  harpoon.active=true; harpoon.returning=false;
  harpoon.x=player.x; harpoon.y=player.y;
  harpoon.vx=(dx/dist)*HARPOON_SPEED_OUT; harpoon.vy=(dy/dist)*HARPOON_SPEED_OUT;
  harpoon.dist=0;
  harpoonCooldown=effectiveCooldown();
}

// ── 메인 루프 ────────────────────────────────────
function loop(ts) {
  const dt=Math.min((ts-lastTime)/1000,0.05);
  lastTime=ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  if(inventoryOpen||logOpen||sellPanelOpen||shopOpen||craftOpen) return;
  if(gameOverState) { updateGameOver(dt); return; }
  const mw=toWorld(mouseScreen.x,mouseScreen.y);
  mouseWorld.x=mw.wx; mouseWorld.y=mw.wy;
  if(harpoonCooldown>0) harpoonCooldown=Math.max(0,harpoonCooldown-dt);
  if(tealBlockedTimer>0) tealBlockedTimer=Math.max(0,tealBlockedTimer-dt);
  updatePlayer(dt);
  updateOxygen(dt);
  updateHarpoon(dt);
  updateSeamouse(dt);
  updateAnchovies(dt);
  updateClownfishes(dt);
  updateSalmons(dt);
  updateTropicalFishes(dt);
  updateTurtles(dt);
  updateButterflyfishes(dt);
  updateTunas(dt);
  updateSharks(dt);
  updateWhales(dt);
  updateSunfishes(dt);
  updateHolefishes(dt);
  updatePlesios(dt);
  if(playerZone==='sea1'&&player.alive){
    if(Math.random()<0.05*dt&&tunas.length<TUNA_MAX) spawnTuna();
    if(Math.random()<0.0125*dt&&sharks.length<SHARK_MAX) spawnShark();
    if(Math.random()<0.0025*dt&&whales.length<WHALE_MAX) spawnWhale();
  }
  if(playerZone==='teal'&&player.alive){
    if(Math.random()<0.05*dt&&sunfishes.length<SUNFISH_MAX) spawnSunfish();
    if(Math.random()<0.025*dt&&holefishes.length<HOLEFISH_MAX) spawnHolefish();
    if(Math.random()<0.0025*dt&&plesios.length<PLESIO_MAX) spawnPlesio();
  }
  updateGatherNodes(dt);
  updateRockStates(dt);
  updateBubbles(dt);
  updateSellUI(dt);
  updateTealTransition(dt);
  updateCamera(dt);
}

function isOnDeck() {
  const deck=deckTopY();
  const pb=player.y+PLAYER_H/2;
  return player.x+PLAYER_W/2>SHIP_WORLD_X-SHIP_W/2
    && player.x-PLAYER_W/2<SHIP_WORLD_X+SHIP_W/2
    && pb>=deck-2 && pb<=deck+10 && player.vy>=0;
}

function updatePlayer(dt) {
  if(!player.alive) return;
  if(seamouse&&seamouse.piloted) return; // 탑승 중엔 플레이어 직접 이동 안 함
  const inWater=player.y>surfaceY();
  let ix=0,iy=0;
  if(keys['KeyW']||keys['ArrowUp']) iy-=1;
  if(keys['KeyS']||keys['ArrowDown']) iy+=1;
  if(keys['KeyA']||keys['ArrowLeft']) ix-=1;
  if(keys['KeyD']||keys['ArrowRight']) ix+=1;

  if(inWater) {
    // 지형 근접 직접 체크 (1프레임 지연 제거 — 같은 프레임에서 위치 기반으로 차단)
    const _ph=PLAYER_H/2;
    if(playerZone==='sea1') {
      const _ty=terrainY(player.x);
      if(!isInHoleAt(player.x)&&player.y+_ph>=_ty-4){if(iy>0)iy=0;if(player.vy>0)player.vy=0;}
    } else if(playerZone==='teal') {
      const _ty=terrainY(player.x),_t2y=terrain2Y(player.x);
      const _rb=_ty+SHAFT_DEPTH;
      if(!isInHoleAt(player.x)&&player.y-_ph<=_rb+4){if(iy<0)iy=0;if(player.vy<0)player.vy=0;}
      if(player.y+_ph>=_t2y-4){if(iy>0)iy=0;if(player.vy>0)player.vy=0;}
    }
    const spd=effectiveSpeed();
    player.vx+=(ix*spd-player.vx)*Math.min(SWIM_ACCEL*dt,1);
    player.vy+=(iy*spd-player.vy)*Math.min(SWIM_ACCEL*dt,1);
    player.vy-=BUOYANCY_ACCEL*dt;
    if(ix===0) player.vx*=Math.max(0,1-SWIM_DRAG*dt);
    if(iy===0) player.vy*=Math.max(0,1-SWIM_DRAG*dt);
  } else {
    const onDeck=isOnDeck();
    if(onDeck) {
      player.vy=0; player.y=deckTopY()-PLAYER_H/2;
      player.vx=ix*PLAYER_SPEED_SURFACE;
      if(iy<0) player.vy=JUMP_VY;
    } else {
      player.vy+=GRAVITY*dt;
      if(ix!==0) player.vx+=(ix*PLAYER_SPEED_SURFACE-player.vx)*Math.min(8*dt,1);
      else player.vx*=Math.max(0,1-4*dt);
    }
  }

  player.x+=player.vx*dt;
  player.y+=player.vy*dt;

  if(!inWater) {
    const deck=deckTopY(), pb=player.y+PLAYER_H/2;
    if(player.x+PLAYER_W/2>SHIP_WORLD_X-SHIP_W/2
      &&player.x-PLAYER_W/2<SHIP_WORLD_X+SHIP_W/2
      &&pb>deck&&player.vy>=0) {
      player.y=deck-PLAYER_H/2; player.vy=0;
    }
  }

  if(player.y<surfaceY()-220) { player.y=surfaceY()-220; player.vy=0; }
  if(player.y>7000) { player.y=7000; player.vy=0; }

  resolveTerrainCollision();

  const sl=SHIP_WORLD_X-SHIP_W/2, sr=SHIP_WORLD_X+SHIP_W/2;
  player.onShip=player.x+PLAYER_W/2>sl&&player.x-PLAYER_W/2<sr&&player.y<surfaceY();
  if(player.onShip) {
    const maxOxy=effectiveOxygen();
    if(oxygenTimer<maxOxy||graceTimer<MAX_GRACE_SEC) {
      oxygenTimer=maxOxy; graceTimer=MAX_GRACE_SEC;
      butterflyfishAgro=false;
      savePlayerData();
    }
  }
  resolveFloatingRockCollision();
  if(player.y<surfaceY()+5&&campObject) campObject=null;
  playerFacingRight=mouseWorld.x>=player.x;
}

// 샤프트 내 좌우 벽 충돌
function constrainToShaft(px) {
  const chunk=Math.floor(px/HOLE_CHUNK_SIZE);
  for(let c=chunk-1;c<=chunk+1;c++){
    const hx=holeXForChunk(c);
    if(hx!==null&&Math.abs(px-hx)<HOLE_WIDTH/2+PLAYER_W){
      const limit=HOLE_WIDTH/2-PLAYER_W/2-3;
      if(player.x>hx+limit){player.x=hx+limit;if(player.vx>0)player.vx=0;}
      if(player.x<hx-limit){player.x=hx-limit;if(player.vx<0)player.vx=0;}
      break;
    }
  }
}

function resolveTerrainCollision() {
  const px=player.x, ph=PLAYER_H/2;
  terrainBlockDown=false; terrainBlockUp=false;

  if(playerZone==='sea1') {
    const ty=terrainY(px);
    const inHole=isInHoleAt(px);
    if(!inHole) {
      if(player.y+ph>ty) { player.y=ty-ph; if(player.vy>0) player.vy=0; terrainBlockDown=true; }
    } else {
      if(player.y>ty&&player.y<ty+SHAFT_DEPTH) constrainToShaft(px);
      if(player.y>ty+SHAFT_DEPTH+30) {
        if((playerData.upgrades?.oxygen||0)>=10) {
          playerZone='teal';
        } else {
          player.y=ty+SHAFT_DEPTH+30; if(player.vy>0) player.vy=-80;
          tealBlockedTimer=2.5;
          terrainBlockDown=true;
        }
      }
    }
  } else if(playerZone==='teal') {
    const ty=terrainY(px);
    const t2y=terrain2Y(px);
    const rockBottom=ty+SHAFT_DEPTH;
    const inHole=isInHoleAt(px);
    if(!inHole) {
      if(player.y-ph<rockBottom) { player.y=rockBottom+ph; if(player.vy<0) player.vy=0; terrainBlockUp=true; }
    } else {
      if(player.y>ty&&player.y<rockBottom) constrainToShaft(px);
      if(player.y<ty-100) playerZone='sea1';
    }
    if(player.y+ph>t2y) { player.y=t2y-ph; if(player.vy>0) player.vy=0; terrainBlockDown=true; }
  }
}

function updateBubbles(dt) {
  if(player.y>surfaceY()&&player.alive&&!gameOverState) {
    bubbleTimer+=dt;
    if(bubbleTimer>=0.35) {
      bubbleTimer=0;
      bubbles.push({ x:player.x+(playerFacingRight?10:-10), y:player.y-PLAYER_H/2+22,
        r:1.5+Math.random()*2, vx:(Math.random()-0.5)*12, vy:-(22+Math.random()*18), life:1.0 });
    }
  }
  for(const b of bubbles) { b.x+=b.vx*dt; b.y+=b.vy*dt; b.r+=1.2*dt; b.life-=0.38*dt; }
  bubbles=bubbles.filter(b=>b.life>0&&b.y>surfaceY()-5);
}

function updateOxygen(dt) {
  isUnderwater=player.y>surfaceY()+5;
  if(!isUnderwater||player.onShip) return;
  if(seamouse&&seamouse.piloted) return; // 탑승 중엔 플레이어 산소 소모 안 함
  if(infiniteOxygen){oxygenTimer=effectiveOxygen();graceTimer=MAX_GRACE_SEC;return;}
  if(oxygenTimer>0) { oxygenTimer=Math.max(0,oxygenTimer-dt); }
  else { graceTimer=Math.max(0,graceTimer-dt); }
  graceBlinkTimer+=dt;
  if(graceTimer<=0) triggerGameOver();
}

function spawnSeamouse() {
  if(!playerData.hasSeamouse) return;
  seamouse={x:SHIP_WORLD_X, y:surfaceY()+120, vx:0, vy:0,
    oxygen:SEAMOUSE_MAX_OXYGEN, piloted:false, angle:0,
    exploding:false, explodeTimer:0, flashTimer:0, explodeParticles:[]};
}

function updateSeamouse(dt) {
  if(seamouseRespawnTimer>0) {
    seamouseRespawnTimer=Math.max(0,seamouseRespawnTimer-dt);
    if(seamouseRespawnTimer<=0) spawnSeamouse();
    return;
  }
  if(!seamouse) return;
  if(seamouse.flashTimer>0) seamouse.flashTimer-=dt;

  if(seamouse.exploding) {
    seamouse.explodeTimer-=dt;
    for(const p of seamouse.explodeParticles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
    if(seamouse.explodeTimer<=0){
      if(seamouse.piloted){seamouse.piloted=false;player.x=seamouse.x;player.y=seamouse.y;}
      seamouse=null; seamouseRespawnTimer=SEAMOUSE_RESPAWN_DELAY;
    }
    return;
  }

  if(seamouse.piloted) {
    let ix=0,iy=0;
    if(keys['KeyW']||keys['ArrowUp']) iy-=1;
    if(keys['KeyS']||keys['ArrowDown']) iy+=1;
    if(keys['KeyA']||keys['ArrowLeft']) ix-=1;
    if(keys['KeyD']||keys['ArrowRight']) ix+=1;
    seamouse.vx+=(ix*SEAMOUSE_SPEED-seamouse.vx)*Math.min(SEAMOUSE_ACCEL*dt,1);
    seamouse.vy+=(iy*SEAMOUSE_SPEED-seamouse.vy)*Math.min(SEAMOUSE_ACCEL*dt,1);
    if(ix===0) seamouse.vx*=Math.max(0,1-SEAMOUSE_DRAG*dt);
    if(iy===0) seamouse.vy*=Math.max(0,1-SEAMOUSE_DRAG*dt);
    const spd=Math.sqrt(seamouse.vx**2+seamouse.vy**2);
    if(spd>8) seamouse.angle=Math.atan2(seamouse.vy,seamouse.vx);
    seamouse.x+=seamouse.vx*dt; seamouse.y+=seamouse.vy*dt;
    // 수면 위 진입 차단
    const smR=SEAMOUSE_H/2+4;
    if(seamouse.y<surfaceY()+smR){seamouse.y=surfaceY()+smR;if(seamouse.vy<0)seamouse.vy=0;}
    // 지형 충돌
    if(playerZone==='sea1'){
      const ty=terrainY(seamouse.x);
      if(!isInHoleAt(seamouse.x)&&seamouse.y+smR>ty){seamouse.y=ty-smR;if(seamouse.vy>0)seamouse.vy=0;}
    } else if(playerZone==='teal'){
      const ty=terrainY(seamouse.x),t2y=terrain2Y(seamouse.x);
      const rb=ty+SHAFT_DEPTH;
      if(!isInHoleAt(seamouse.x)&&seamouse.y-smR<rb){seamouse.y=rb+smR;if(seamouse.vy<0)seamouse.vy=0;}
      if(seamouse.y+smR>t2y){seamouse.y=t2y-smR;if(seamouse.vy>0)seamouse.vy=0;}
    }
    // 부유석 충돌
    const smRocks=playerZone==='teal'
      ? [...getVisibleTealRocks().filter(r=>!rockRespawning.has(r.key)),...getVisibleNonMineableTealRocks()]
      : getVisibleFloatingRocks();
    for(const rock of smRocks){
      const dx=seamouse.x-rock.x,dy=seamouse.y-rock.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      const minD=rock.r+smR;
      if(dist<minD){
        const nx=dx/dist,ny=dy/dist;
        seamouse.x+=nx*(minD-dist);seamouse.y+=ny*(minD-dist);
        const dot=seamouse.vx*nx+seamouse.vy*ny;
        if(dot<0){seamouse.vx-=dot*nx;seamouse.vy-=dot*ny;}
      }
    }
    player.x=seamouse.x; player.y=seamouse.y;
    // 구역 전환 (시마우스 탑승 중에는 resolveTerrainCollision이 호출되지 않으므로 여기서 처리)
    if(playerZone==='sea1'){
      const ty=terrainY(seamouse.x);
      if(isInHoleAt(seamouse.x)&&seamouse.y>ty+SHAFT_DEPTH+30){
        if((playerData.upgrades?.oxygen||0)>=10){ playerZone='teal'; }
        else{ seamouse.y=ty+SHAFT_DEPTH+30; seamouse.vy=0; player.y=seamouse.y; tealBlockedTimer=2.5; }
      }
    } else if(playerZone==='teal'){
      const ty=terrainY(seamouse.x);
      if(isInHoleAt(seamouse.x)&&seamouse.y<ty-100) playerZone='sea1';
    }
    seamouse.oxygen=Math.max(0,seamouse.oxygen-dt);
    if(seamouse.oxygen<=0) explodeSeamouse();
  }
}

function seamouseDamage(amount) {
  if(!seamouse||seamouse.exploding) return;
  seamouse.oxygen=Math.max(0,seamouse.oxygen-amount);
  seamouse.flashTimer=0.15;
  if(seamouse.oxygen<=0) explodeSeamouse();
}

function explodeSeamouse() {
  if(!seamouse||seamouse.exploding) return;
  seamouse.exploding=true; seamouse.explodeTimer=1.2;
  seamouse.explodeParticles=Array.from({length:18},(_,i)=>{
    const a=i/18*Math.PI*2,spd=80+Math.random()*160;
    return{x:seamouse.x,y:seamouse.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:1.0};
  });
  if(seamouse.piloted){seamouse.piloted=false;player.x=seamouse.x;player.y=seamouse.y;}
}

function updateHarpoon(dt) {
  if(!harpoon.active) return;
  if(harpoon.returning) {
    const dx=player.x-harpoon.x, dy=player.y-harpoon.y;
    const d=Math.sqrt(dx*dx+dy*dy)||1;
    if(d<18) { harpoon.active=false; harpoon.returning=false; return; }
    const spd=HARPOON_SPEED*1.3;
    harpoon.vx=(dx/d)*spd; harpoon.vy=(dy/d)*spd;
    harpoon.x+=harpoon.vx*dt; harpoon.y+=harpoon.vy*dt;
    return;
  }
  harpoon.x+=harpoon.vx*dt; harpoon.y+=harpoon.vy*dt;
  harpoon.dist+=HARPOON_SPEED_OUT*dt;
  if(harpoon.dist>=effectiveHarpoonRange()) { harpoon.returning=true; return; }

  function hitCheck(list, radius, onKill, onHit) {
    for(const f of list) {
      if(f.dead||f.collecting) continue;
      const dx=harpoon.x-f.x, dy=harpoon.y-f.y;
      if(Math.sqrt(dx*dx+dy*dy)<=HARPOON_HIT_RADIUS+radius) {
        f.hp-=effectiveHarpoonDamage();
        harpoon.returning=true;
        if(f.hp<=0) { f.dead=true; startCollectAnim(f); onKill&&onKill(f); }
        else { f.flashTimer=0.15; onHit&&onHit(f); }
        return true;
      }
    }
    return false;
  }

  if(hitCheck(anchovies,0)) return;
  if(hitCheck(clownfishes,4)) return;
  if(hitCheck(tropicalfishes,4)) return;
  if(hitCheck(salmons,6)) return;
  if(hitCheck(turtles,10)) return;
  if(hitCheck(tunas,8)) return;
  if(hitCheck(sharks,12)) return;
  if(hitCheck(whales,90)) return;
  if(hitCheck(sunfishes,10)) return;
  if(hitCheck(holefishes,90,()=>{butterflyfishAgro=true;},()=>{butterflyfishAgro=true;})) return;
  // 수장룡: 몸통·목·머리 모든 부위 피격
  for(const f of plesios){
    if(f.dead||f.collecting)continue;
    const W2=PLESIO_W/2,H2=PLESIO_H/2,hr=HARPOON_HIT_RADIUS;
    const bdx=harpoon.x-f.x,bdy=harpoon.y-f.y;
    let hit=(bdx/(W2+hr))**2+(bdy/(H2+hr))**2<=1;
    if(!hit&&f.neck){
      const nr=H2*0.33+hr;
      for(const j of f.neck){if((harpoon.x-j.x)**2+(harpoon.y-j.y)**2<=nr*nr){hit=true;break;}}
    }
    if(hit){
      f.hp-=effectiveHarpoonDamage();harpoon.returning=true;
      if(f.hp<=0){f.dead=true;startCollectAnim(f);}else f.flashTimer=0.15;
      return;
    }
  }
  if(hitCheck(butterflyfishes,4,
    ()=>{ butterflyfishAgro=true; },
    ()=>{ butterflyfishAgro=true; })) return;

  // 청록 부유석 히트
  if (playerZone === 'teal') {
    const trocks = getVisibleTealRocks().filter(r => !rockRespawning.has(r.key));
    for (const rock of trocks) {
      const dx = harpoon.x - rock.x, dy = harpoon.y - rock.y;
      if (Math.sqrt(dx*dx+dy*dy) <= HARPOON_HIT_RADIUS + rock.r * 0.6) { hitRock(rock); return; }
    }
  }

  // 채집 노드 히트
  const gnodes = getVisibleGatherNodes();
  for (const node of gnodes) {
    const def = NODE_DEFS[node.type];
    const dx = harpoon.x - node.x, dy = harpoon.y - node.y;
    if (Math.sqrt(dx*dx+dy*dy) <= HARPOON_HIT_RADIUS + def.r) { hitGatherNode(node); return; }
  }
}

// ── 물고기 업데이트 헬퍼 ─────────────────────────
function genericSeaFishUpdate(list, dt, minY, maxYfn, speed, W, H, spawnFn, maxCnt, invKey, regenMs) {
  for(const f of list) {
    if(f.dead) continue;
    if(f.collecting) continue;
    if(f.flashTimer>0) f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0) {
      f.dirTimer=2+Math.random()*3;
      f.vx=(Math.random()<0.5?1:-1)*speed;
      f.vy=(Math.random()-0.5)*40;
    }
    f.x+=f.vx*dt; f.y+=f.vy*dt;
    if(f.y<surfaceY()+minY) { f.y=surfaceY()+minY; f.vy=Math.abs(f.vy); }
    const ceil=terrainY(f.x)-H-6;
    if(f.y>ceil) { f.y=ceil; f.vy=-Math.abs(f.vy); }
    // 너무 멀면 재스폰
    if(Math.abs(f.x-player.x)>2000) {
      f.x=player.x+(Math.random()-0.5)*1600;
      f.y=surfaceY()+minY+Math.random()*(maxYfn()-minY)*0.6;
    }
  }
  list=list.filter(f=>filterCollect(f,dt,invKey,spawnFn,regenMs,list,maxCnt));
  return list;
}

function filterCollect(f,dt,invKey,spawnFn,regenMs,list,maxCnt) {
  if(f.collecting) {
    f.collectT+=dt;
    const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;
    f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1) {
      playerData.inventory[invKey]=(playerData.inventory[invKey]||0)+1;
      playerData.fishLog[invKey]=(playerData.fishLog[invKey]||0)+1;
      savePlayerData();
      setTimeout(spawnFn,regenMs);
      return false;
    }
  }
  return true;
}

function startCollectAnim(f) { f.collecting=true; f.collectT=0; f.startX=f.x; f.startY=f.y; }

// 작살 발사 중 또는 플레이어 30유닛 이내 → 빠른 속도로 회피
function applyFlee(f, fleeSpeed) {
  let tx=null, ty=null;
  if(harpoon.active&&!harpoon.returning){
    const hd2=(f.x-harpoon.x)**2+(f.y-harpoon.y)**2;
    if(hd2<100**2){tx=harpoon.x;ty=harpoon.y;}
  }
  const pd2=(f.x-player.x)**2+(f.y-player.y)**2;
  if(pd2<30**2){tx=player.x;ty=player.y;}
  if(tx===null) return false;
  const dx=f.x-tx,dy=f.y-ty,d=Math.sqrt(dx*dx+dy*dy)||1;
  f.vx=(dx/d)*fleeSpeed; f.vy=(dy/d)*fleeSpeed;
  return true;
}

function updateAnchovies(dt) {
  const seaweedNodes=getVisibleGatherNodes().filter(n=>n.type==='seaweed');
  // 1500유닛 구역 단위로 소떼 분리, 최대 10마리씩 뭉침
  const aliveAnc = anchovies.filter(a=>!a.dead&&!a.collecting);
  const zoneMap=new Map();
  for(const a of aliveAnc){
    const zid=Math.floor(a.x/1500);
    if(!zoneMap.has(zid))zoneMap.set(zid,[]);
    zoneMap.get(zid).push(a);
  }
  const fishSchool=new Map();
  for(const group of zoneMap.values()){
    let cx=0,cy=0;
    group.forEach(a=>{cx+=a.x;cy+=a.y;});
    const sc={cx:cx/group.length,cy:cy/group.length};
    group.forEach(a=>fishSchool.set(a,sc));
  }
  for(const a of anchovies) {
    if(a.dead||a.collecting) continue;
    a.dirTimer-=dt;
    if(a.dirTimer<=0){a.dirTimer=1.5+Math.random()*2.5;a.vx=(Math.random()<0.5?1:-1)*ANCHOVY_SPEED;a.vy=(Math.random()-0.5)*40;}
    // 소떼 중심으로 조금씩 이끌림
    const sc=fishSchool.get(a);
    if(sc){
      const fdx=sc.cx-a.x,fdy=sc.cy-a.y,fd=Math.sqrt(fdx*fdx+fdy*fdy)||1;
      if(fd>70){a.vx+=(fdx/fd)*ANCHOVY_SPEED*0.8*dt;a.vy+=(fdy/fd)*ANCHOVY_SPEED*0.8*dt;}
    }
    // 해초 섭식
    for(const n of seaweedNodes){
      if((a.x-n.x)**2+(a.y-n.y)**2<30**2){
        nodeRespawning.set(n.key,Date.now()+GATHER_RESPAWN_MS);
        nodeHitStates.delete(n.key);
        break;
      }
    }
    const spd=Math.sqrt(a.vx*a.vx+a.vy*a.vy)||1;
    if(spd>ANCHOVY_SPEED*1.5){a.vx=a.vx/spd*ANCHOVY_SPEED*1.5;a.vy=a.vy/spd*ANCHOVY_SPEED*1.5;}
    applyFlee(a,200);
    a.x+=a.vx*dt; a.y+=a.vy*dt;
    clampSea1Fish(a,ANCHOVY_H);
    if(Math.abs(a.x-player.x)>2000){a.x=player.x+(Math.random()-0.5)*1400;a.y=randomSea1Y(a.x,ANCHOVY_H);}
  }
  anchovies=anchovies.filter(a=>{
    if(a.eaten) return false;
    if(!a.collecting) return true;
    a.collectT+=dt;
    const t=Math.min(a.collectT/a.collectDur,1);
    a.x=a.startX+(player.x-a.startX)*t; a.y=a.startY+(player.y-a.startY)*t;
    if(t>=1){playerData.inventory.anchovy=(playerData.inventory.anchovy||0)+1;playerData.fishLog.anchovy=(playerData.fishLog.anchovy||0)+1;savePlayerData();setTimeout(spawnAnchovy,ANCHOVY_REGEN_MS);return false;}
    return true;
  });
}

function updateClownfishes(dt) {
  const anemoneNodes=getVisibleGatherNodes().filter(n=>n.type==='anemone');
  for(const c of clownfishes) {
    if(c.dead||c.collecting) continue;
    if(c.flashTimer>0)c.flashTimer-=dt;
    c.dirTimer-=dt;
    if(c.dirTimer<=0){c.dirTimer=1.5+Math.random()*2.5;c.vx=(Math.random()<0.5?1:-1)*CLOWNFISH_SPEED;c.vy=(Math.random()-0.5)*35;}
    // 가장 가까운 말미잘로 조금씩 이끌림
    if(anemoneNodes.length>0){
      let near=null,nd2=Infinity;
      for(const n of anemoneNodes){const d2=(n.x-c.x)**2+(n.y-c.y)**2;if(d2<nd2){nd2=d2;near=n;}}
      if(near&&nd2>90**2){const dx=near.x-c.x,dy=near.y-c.y,d=Math.sqrt(nd2)||1;c.vx+=(dx/d)*CLOWNFISH_SPEED*dt;c.vy+=(dy/d)*CLOWNFISH_SPEED*dt;}
    }
    const spd=Math.sqrt(c.vx*c.vx+c.vy*c.vy)||1;
    if(spd>CLOWNFISH_SPEED*1.5){c.vx=c.vx/spd*CLOWNFISH_SPEED*1.5;c.vy=c.vy/spd*CLOWNFISH_SPEED*1.5;}
    applyFlee(c,160);
    c.x+=c.vx*dt;c.y+=c.vy*dt;
    clampSea1Fish(c,CLOWNFISH_H);
    if(Math.abs(c.x-player.x)>2000){c.x=player.x+(Math.random()-0.5)*1400;c.y=randomSea1Y(c.x,CLOWNFISH_H);}
  }
  clownfishes=clownfishes.filter(c=>{
    if(c.eaten)return false;
    if(!c.collecting)return true;
    c.collectT+=dt;const t=Math.min(c.collectT/c.collectDur,1);
    c.x=c.startX+(player.x-c.startX)*t;c.y=c.startY+(player.y-c.startY)*t;
    if(t>=1){playerData.inventory.clownfish=(playerData.inventory.clownfish||0)+1;playerData.fishLog.clownfish=(playerData.fishLog.clownfish||0)+1;savePlayerData();setTimeout(spawnClownfish,ANCHOVY_REGEN_MS*1.5);return false;}
    return true;
  });
}

function updateSalmons(dt) {
  for(const s of salmons) {
    if(s.dead||s.collecting)continue;
    if(s.flashTimer>0)s.flashTimer-=dt;
    s.dirTimer-=dt;
    if(s.dirTimer<=0){s.dirTimer=2.5+Math.random()*3;s.vx=(Math.random()<0.5?1:-1)*SALMON_SPEED;s.vy=(Math.random()-0.5)*30;}
    applyFlee(s,200);
    s.x+=s.vx*dt;s.y+=s.vy*dt;
    if(s.y<surfaceY()+600){s.y=surfaceY()+600;s.vy=Math.abs(s.vy);}
    const sl=terrainY(s.x)-SALMON_H-6;if(s.y>sl){s.y=sl;s.vy=-Math.abs(s.vy);}
    if(Math.abs(s.x-player.x)>2000){s.x=player.x+(Math.random()-0.5)*1800;s.y=surfaceY()+900+Math.random()*1000;}
  }
  salmons=salmons.filter(s=>{
    if(!s.collecting)return true;
    s.collectT+=dt;const t=Math.min(s.collectT/s.collectDur,1);
    s.x=s.startX+(player.x-s.startX)*t;s.y=s.startY+(player.y-s.startY)*t;
    if(t>=1){playerData.inventory.salmon=(playerData.inventory.salmon||0)+1;playerData.fishLog.salmon=(playerData.fishLog.salmon||0)+1;savePlayerData();setTimeout(spawnSalmon,ANCHOVY_REGEN_MS*2);return false;}
    return true;
  });
}

function updateTropicalFishes(dt) {
  // 최대 10마리 단위 소떼로 군집 행동
  const aliveTrop = tropicalfishes.filter(f=>!f.dead&&!f.collecting);
  const SCHOOL_SIZE=10;
  const fishSchool=new Map();
  for(let i=0;i<aliveTrop.length;i+=SCHOOL_SIZE){
    const slice=aliveTrop.slice(i,i+SCHOOL_SIZE);
    let cx=0,cy=0;
    slice.forEach(f=>{cx+=f.x;cy+=f.y;});
    const sc={cx:cx/slice.length,cy:cy/slice.length};
    slice.forEach(f=>fishSchool.set(f,sc));
  }
  for(const f of tropicalfishes) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0){f.dirTimer=1.5+Math.random()*2.5;f.vx=(Math.random()<0.5?1:-1)*TROPICALFISH_SPEED;f.vy=(Math.random()-0.5)*40;}
    // 소떼 중심으로 이끌림
    const sc=fishSchool.get(f);
    if(sc){
      const fdx=sc.cx-f.x,fdy=sc.cy-f.y,fd=Math.sqrt(fdx*fdx+fdy*fdy)||1;
      if(fd>70){f.vx+=(fdx/fd)*TROPICALFISH_SPEED*0.8*dt;f.vy+=(fdy/fd)*TROPICALFISH_SPEED*0.8*dt;}
    }
    const spd=Math.sqrt(f.vx*f.vx+f.vy*f.vy)||1;
    if(spd>TROPICALFISH_SPEED*1.5){f.vx=f.vx/spd*TROPICALFISH_SPEED*1.5;f.vy=f.vy/spd*TROPICALFISH_SPEED*1.5;}
    applyFlee(f,180);
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,TROPICALFISH_H);
    if(Math.abs(f.x-player.x)>2000){f.x=player.x+(Math.random()-0.5)*1600;f.y=randomTealY(f.x,TROPICALFISH_H);}
  }
  tropicalfishes=tropicalfishes.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.tropicalfish=(playerData.inventory.tropicalfish||0)+1;playerData.fishLog.tropicalfish=(playerData.fishLog.tropicalfish||0)+1;savePlayerData();setTimeout(spawnTropicalFish,ANCHOVY_REGEN_MS*1.5);return false;}
    return true;
  });
}

function updateTurtles(dt) {
  const jellyNodes=getVisibleGatherNodes().filter(n=>n.type==='jellyfish');
  for(const f of turtles) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0){f.dirTimer=3+Math.random()*4;f.vx=(Math.random()<0.5?1:-1)*TURTLE_SPEED;f.vy=(Math.random()-0.5)*15;}
    // 해파리 섭식
    for(const n of jellyNodes){
      if((f.x-n.x)**2+(f.y-n.y)**2<55**2){
        nodeRespawning.set(n.key,Date.now()+GATHER_RESPAWN_MS);
        nodeHitStates.delete(n.key);
        break;
      }
    }
    applyFlee(f,130);
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,TURTLE_H);
    if(Math.abs(f.x-player.x)>2000){f.x=player.x+(Math.random()-0.5)*1800;f.y=randomTealY(f.x,TURTLE_H);}
  }
  turtles=turtles.filter(f=>{
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.turtle=(playerData.inventory.turtle||0)+1;playerData.fishLog.turtle=(playerData.fishLog.turtle||0)+1;savePlayerData();setTimeout(spawnTurtle,ANCHOVY_REGEN_MS*3);return false;}
    return true;
  });
}

function updateButterflyfishes(dt) {
  for(const f of butterflyfishes) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    if(f.touchCooldown>0)f.touchCooldown-=dt;

    if(butterflyfishAgro&&f.touchCooldown<=0) {
      const dx=player.x-f.x, dy=player.y-f.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      if(dist<28) {
        oxygenTimer=Math.max(0,oxygenTimer-10);
        if(seamouse&&seamouse.piloted) seamouseDamage(15);
        f.touchCooldown=6;
        f.vx=-f.vx; f.vy=-f.vy;
      } else {
        f.vx=(dx/dist)*BUTTERFLYFISH_CHASE_SPEED;
        f.vy=(dy/dist)*BUTTERFLYFISH_CHASE_SPEED;
      }
    } else {
      // 가장 가까운 구멍고기 곁으로 이끌림
      let nearH=null,hd2=Infinity;
      for(const h of holefishes){if(h.dead||h.collecting)continue;const d2=(h.x-f.x)**2+(h.y-f.y)**2;if(d2<hd2){hd2=d2;nearH=h;}}
      if(nearH&&hd2>110**2){const dx=nearH.x-f.x,dy=nearH.y-f.y,d=Math.sqrt(hd2)||1;f.vx+=(dx/d)*BUTTERFLYFISH_SPEED*dt;f.vy+=(dy/d)*BUTTERFLYFISH_SPEED*dt;}
      f.dirTimer-=dt;
      if(f.dirTimer<=0){f.dirTimer=2+Math.random()*3;f.vx=(Math.random()<0.5?1:-1)*BUTTERFLYFISH_SPEED;f.vy=(Math.random()-0.5)*35;}
    }
    // 열대어 섭식 (배고플 때만)
    if(f.hungerTimer<=0){
      for(const tf of tropicalfishes){
        if(tf.dead||tf.collecting||tf.eaten)continue;
        if((f.x-tf.x)**2+(f.y-tf.y)**2<32**2){tf.eaten=true;f.hungerTimer=5;break;}
      }
    } else { f.hungerTimer-=dt; }
    const spd=Math.sqrt(f.vx*f.vx+f.vy*f.vy)||1;
    if(spd>BUTTERFLYFISH_CHASE_SPEED*1.1){f.vx=f.vx/spd*BUTTERFLYFISH_CHASE_SPEED*1.1;f.vy=f.vy/spd*BUTTERFLYFISH_CHASE_SPEED*1.1;}
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,BUTTERFLYFISH_H);
    if(Math.abs(f.x-player.x)>2200){
      f.x=player.x+(Math.random()-0.5)*2000;
      f.y=randomTealY(f.x,BUTTERFLYFISH_H);
    }
  }
  butterflyfishes=butterflyfishes.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.butterflyfish=(playerData.inventory.butterflyfish||0)+1;playerData.fishLog.butterflyfish=(playerData.fishLog.butterflyfish||0)+1;savePlayerData();setTimeout(spawnButterflyfish,ANCHOVY_REGEN_MS*2);return false;}
    return true;
  });
}

function updateTunas(dt) {
  for(const f of tunas) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    // 가장 가까운 멸치 추적·섭식 (배고플 때만)
    if(f.hungerTimer>0) {
      f.hungerTimer-=dt;
      f.dirTimer-=dt;
      if(f.dirTimer<=0){f.dirTimer=2+Math.random()*4;f.vx=(Math.random()<0.5?1:-1)*TUNA_SPEED;f.vy=(Math.random()-0.5)*25;}
    } else {
      let nearA=null,ad2=Infinity;
      for(const a of anchovies){if(a.dead||a.collecting||a.eaten)continue;const d2=(a.x-f.x)**2+(a.y-f.y)**2;if(d2<ad2){ad2=d2;nearA=a;}}
      if(nearA&&ad2<550**2){
        const dx=nearA.x-f.x,dy=nearA.y-f.y,d=Math.sqrt(ad2)||1;
        f.vx=(dx/d)*TUNA_SPEED;f.vy=(dy/d)*TUNA_SPEED;
        if(ad2<45**2){nearA.eaten=true;f.hungerTimer=5;}
      } else {
        f.dirTimer-=dt;
        if(f.dirTimer<=0){f.dirTimer=2+Math.random()*4;f.vx=(Math.random()<0.5?1:-1)*TUNA_SPEED;f.vy=(Math.random()-0.5)*25;}
      }
    }
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampSea1Fish(f,TUNA_H);
    if(Math.abs(f.x-player.x)>2400){f.x=player.x+(Math.random()-0.5)*1800;f.y=randomSea1Y(f.x,TUNA_H);}
  }
  tunas=tunas.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.tuna=(playerData.inventory.tuna||0)+1;playerData.fishLog.tuna=(playerData.fishLog.tuna||0)+1;savePlayerData();return false;}
    return true;
  });
}
function updateSharks(dt) {
  for(const f of sharks) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    if(f.touchCooldown>0)f.touchCooldown-=dt;
    const pdx=player.x-f.x,pdy=player.y-f.y,pdist=Math.sqrt(pdx*pdx+pdy*pdy)||1;
    // 플레이어 추적 (수중일 때)
    if(player.y>surfaceY()&&pdist<950){
      f.vx=(pdx/pdist)*SHARK_SPEED;f.vy=(pdy/pdist)*SHARK_SPEED*0.7;
      if(pdist<85&&f.touchCooldown<=0){
        oxygenTimer=Math.max(0,oxygenTimer-20);
        if(seamouse&&seamouse.piloted) seamouseDamage(20);
        f.touchCooldown=4;f.vx=-f.vx*0.6;f.vy=(Math.random()-0.5)*40;
      }
    } else {
      f.dirTimer-=dt;
      if(f.dirTimer<=0){f.dirTimer=3+Math.random()*4;f.vx=(Math.random()<0.5?1:-1)*SHARK_SPEED;f.vy=(Math.random()-0.5)*18;}
    }
    // 고래 제외 모두 섭식 (배고플 때만)
    if(f.hungerTimer>0){f.hungerTimer-=dt;}
    else{
      let ate=false;
      for(const list of [anchovies,clownfishes,salmons,tropicalfishes,turtles,butterflyfishes,tunas]){
        for(const p of list){
          if(p.dead||p.collecting||p.eaten)continue;
          if((f.x-p.x)**2+(f.y-p.y)**2<80**2){p.eaten=true;f.hungerTimer=5;ate=true;break;}
        }
        if(ate)break;
      }
    }
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampSea1Fish(f,SHARK_H);
    if(Math.abs(f.x-player.x)>2600){f.x=player.x+(Math.random()-0.5)*2000;f.y=randomSea1Y(f.x,SHARK_H);}
  }
  sharks=sharks.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.shark=(playerData.inventory.shark||0)+1;playerData.fishLog.shark=(playerData.fishLog.shark||0)+1;savePlayerData();return false;}
    return true;
  });
}
function updateWhales(dt) {
  for(const f of whales) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0){f.dirTimer=4+Math.random()*6;f.vx=(Math.random()<0.5?1:-1)*WHALE_SPEED;f.vy=(Math.random()-0.5)*8;}
    // 멸치 섭식 (배고플 때만)
    if(f.hungerTimer>0){f.hungerTimer-=dt;}
    else{
      for(const a of anchovies){
        if(a.dead||a.collecting||a.eaten)continue;
        if((f.x-a.x)**2+(f.y-a.y)**2<200**2){a.eaten=true;f.hungerTimer=5;break;}
      }
    }
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampSea1Fish(f,WHALE_H);
    if(Math.abs(f.x-player.x)>3000){f.x=player.x+(Math.random()-0.5)*2400;f.y=randomSea1Y(f.x,WHALE_H);}
  }
  whales=whales.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.whale=(playerData.inventory.whale||0)+1;playerData.fishLog.whale=(playerData.fishLog.whale||0)+1;savePlayerData();return false;}
    return true;
  });
}

function updateSunfishes(dt) {
  const jellyNodes=getVisibleGatherNodes().filter(n=>n.type==='jellyfish');
  for(const f of sunfishes) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0){f.dirTimer=4+Math.random()*5;f.vx=(Math.random()<0.5?1:-1)*SUNFISH_SPEED;f.vy=(Math.random()-0.5)*6;}
    // 해파리 섭식 (배고플 때만)
    if(f.hungerTimer>0){f.hungerTimer-=dt;}
    else{
      for(const n of jellyNodes){
        if((f.x-n.x)**2+(f.y-n.y)**2<55**2){
          nodeRespawning.set(n.key,Date.now()+GATHER_RESPAWN_MS);
          nodeHitStates.delete(n.key);
          f.hungerTimer=5;
          break;
        }
      }
    }
    applyFlee(f,120);
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,SUNFISH_H);
    if(Math.abs(f.x-player.x)>2600){f.x=player.x+(Math.random()-0.5)*1800;f.y=randomTealY(f.x,SUNFISH_H);}
  }
  sunfishes=sunfishes.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.sunfish=(playerData.inventory.sunfish||0)+1;playerData.fishLog.sunfish=(playerData.fishLog.sunfish||0)+1;savePlayerData();setTimeout(spawnSunfish,REGEN_MS*2);return false;}
    return true;
  });
}

function updateHolefishes(dt) {
  for(const f of holefishes) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    if(butterflyfishAgro) {
      const dx=player.x-f.x,dy=player.y-f.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      f.vx=(dx/d)*HOLEFISH_SPEED*1.4;f.vy=(dy/d)*HOLEFISH_SPEED*1.4;
    } else {
      // 가장 가까운 나비고기 곁으로 이끌림
      let nearBF=null,bfd2=Infinity;
      for(const b of butterflyfishes){if(b.dead||b.collecting)continue;const d2=(b.x-f.x)**2+(b.y-f.y)**2;if(d2<bfd2){bfd2=d2;nearBF=b;}}
      if(nearBF&&bfd2>120**2){const dx=nearBF.x-f.x,dy=nearBF.y-f.y,d=Math.sqrt(bfd2)||1;f.vx+=(dx/d)*HOLEFISH_SPEED*0.6*dt;f.vy+=(dy/d)*HOLEFISH_SPEED*0.6*dt;}
      f.dirTimer-=dt;
      if(f.dirTimer<=0){f.dirTimer=1.5+Math.random()*3;f.vx=(Math.random()<0.5?1:-1)*HOLEFISH_SPEED;f.vy=(Math.random()-0.5)*25;}
      applyFlee(f,220);
    }
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,HOLEFISH_H);
    if(f.touchCooldown>0)f.touchCooldown-=dt;
    const hdx=player.x-f.x,hdy=player.y-f.y;
    if(Math.sqrt(hdx*hdx+hdy*hdy)<150&&f.touchCooldown<=0){
      oxygenTimer=Math.max(0,oxygenTimer-30);f.touchCooldown=3;
      if(seamouse&&seamouse.piloted) seamouseDamage(25);
    }
    if(Math.abs(f.x-player.x)>2200){f.x=player.x+(Math.random()-0.5)*1600;f.y=randomTealY(f.x,HOLEFISH_H);}
  }
  holefishes=holefishes.filter(f=>{
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.holefish=(playerData.inventory.holefish||0)+1;playerData.fishLog.holefish=(playerData.fishLog.holefish||0)+1;savePlayerData();setTimeout(spawnHolefish,REGEN_MS);return false;}
    return true;
  });
}

function updatePlesios(dt) {
  for(const f of plesios) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    if(f.touchCooldown>0)f.touchCooldown-=dt;
    // 몸통 이동 — 플레이어를 적극 추적
    const pdx=player.x-f.x,pdy=player.y-f.y,pdist=Math.sqrt(pdx*pdx+pdy*pdy)||1;
    const targetVx=(pdx/pdist)*PLESIO_SPEED, targetVy=(pdy/pdist)*PLESIO_SPEED*0.9;
    const steer=7*dt;
    f.vx+=(targetVx-f.vx)*steer;
    f.vy+=(targetVy-f.vy)*steer;
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,PLESIO_H);
    f.trail.unshift({x:f.x,y:f.y});
    if(f.trail.length>30)f.trail.pop();
    if(Math.abs(f.x-player.x)>5000){
      f.x=player.x+(Math.random()-0.5)*4000;f.y=randomTealY(f.x,PLESIO_H);
      f.trail=Array.from({length:30},()=>({x:f.x,y:f.y}));
      if(f.neck){const fac=f.vx>=0?1:-1;const ax=f.x+fac*(PLESIO_W/2*0.68),ay=f.y-PLESIO_H/2*0.22;f.neck=Array.from({length:10},(_,i)=>({x:ax+fac*i*PLESIO_NECK_SEG,y:ay-i*4}));}
    }
    // 목 체인 시뮬레이션
    if(f.neck&&f.neck.length===10){
      const fac=f.vx>=0?1:-1;
      const attachX=f.x+fac*(PLESIO_W/2*0.68), attachY=f.y-PLESIO_H/2*0.22;
      // 목표: 플레이어 또는 가장 가까운 피식자
      let tx=player.x,ty=player.y,tDist=pdist;
      if(f.hungerTimer<=0){
        for(const list of [tropicalfishes,turtles,butterflyfishes,sunfishes,holefishes]){
          for(const p of list){
            if(p.dead||p.collecting||p.eaten)continue;
            const d=Math.sqrt((p.x-f.x)**2+(p.y-f.y)**2);
            if(d<tDist){tDist=d;tx=p.x;ty=p.y;}
          }
        }
      }
      // 머리(neck[9])를 목표 방향으로 이동
      const head=f.neck[9];
      const hdx=tx-head.x,hdy=ty-head.y,hd=Math.sqrt(hdx*hdx+hdy*hdy)||1;
      head.x+=hdx/hd*PLESIO_HEAD_SPEED*dt;
      head.y+=hdy/hd*PLESIO_HEAD_SPEED*dt;
      // FABRIK 전진 패스 (머리→뿌리 방향 제약)
      for(let i=8;i>=0;i--){
        const next=f.neck[i+1],curr=f.neck[i];
        const dx=curr.x-next.x,dy=curr.y-next.y,d=Math.sqrt(dx*dx+dy*dy)||1;
        if(d>PLESIO_NECK_SEG){curr.x=next.x+dx/d*PLESIO_NECK_SEG;curr.y=next.y+dy/d*PLESIO_NECK_SEG;}
      }
      // 뿌리 고정 후 앵커 패스 (뿌리→머리 방향 제약)
      f.neck[0].x=attachX;f.neck[0].y=attachY;
      for(let i=0;i<9;i++){
        const curr=f.neck[i],next=f.neck[i+1];
        const dx=next.x-curr.x,dy=next.y-curr.y,d=Math.sqrt(dx*dx+dy*dy)||1;
        if(d>PLESIO_NECK_SEG){next.x=curr.x+dx/d*PLESIO_NECK_SEG;next.y=curr.y+dy/d*PLESIO_NECK_SEG;}
      }
      // 머리 위치로 플레이어 산소 피해
      const headX=f.neck[9].x,headY=f.neck[9].y;
      if(Math.sqrt((player.x-headX)**2+(player.y-headY)**2)<PLESIO_HEAD_R&&f.touchCooldown<=0){
        oxygenTimer=Math.max(0,oxygenTimer-40);
        if(seamouse&&seamouse.piloted) seamouseDamage(40);
        f.touchCooldown=5;
      }
      // 머리 위치로 피식자 섭취
      if(f.hungerTimer>0){f.hungerTimer-=dt;}
      else{
        let ate=false;
        for(const list of [tropicalfishes,turtles,butterflyfishes,sunfishes,holefishes]){
          for(const p of list){
            if(p.dead||p.collecting||p.eaten)continue;
            if((headX-p.x)**2+(headY-p.y)**2<80**2){p.eaten=true;f.hungerTimer=5;ate=true;break;}
          }
          if(ate)break;
        }
      }
    }
  }
  plesios=plesios.filter(f=>{
    if(f.eaten)return false;
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.plesio=(playerData.inventory.plesio||0)+1;playerData.fishLog.plesio=(playerData.fishLog.plesio||0)+1;savePlayerData();setTimeout(spawnPlesio,REGEN_MS*8);return false;}
    return true;
  });
}

function updateSellUI(dt) {
  const sbx=SHIP_WORLD_X+SHIP_W/2+SMALL_BOAT_OFFSET, sby=surfaceY();
  const dx=player.x-sbx, dy=player.y-sby;
  sellUI.visible=Math.sqrt(dx*dx+dy*dy)<=SELL_BOAT_RADIUS;
  if(!sellUI.visible && sellPanelOpen) sellPanelOpen=false;
  if(sellUI.delivering) {
    sellUI.countdown-=dt;
    if(sellUI.countdown<=0) {
      sellUI.delivering=false; sellUI.countdown=0;
      fetch('/api/player/'+encodeURIComponent(nickname)).then(r=>r.json()).then(d=>{playerData.coins=d.coins;});
    }
  }
  // 수량 조정
  const keys2=['amount','clownfishAmount','salmonAmount','barracudaAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','tunaAmount','sharkAmount','whaleAmount','octopusAmount','morayAmount','seaweedAmount','anemoneAmount','jellyfishAmount','stoneAmount','ironAmount','goldAmount','aluminumAmount','sunfishAmount','holefishAmount','plesioAmount','balloneelAmount','toothfishAmount'];
  const invs=['anchovy','clownfish','salmon','barracuda','tropicalfish','turtle','butterflyfish','tuna','shark','whale','octopus','moray','seaweed','anemone','jellyfish','stone','iron','gold','aluminum','sunfish','holefish','plesio','ballooneel','toothfish'];
  for(let i=0;i<keys2.length;i++) {
    const mx=Math.min(10,playerData.inventory[invs[i]]||0);
    if(sellUI[keys2[i]]>mx) sellUI[keys2[i]]=Math.max(0,mx);
  }
  const total=keys2.reduce((s,k)=>s+sellUI[k],0);
  if(total>10) sellUI.amount=Math.max(0,sellUI.amount-(total-10));
}

function updateTealTransition(dt) {
  const ty=terrainY(player.x);
  let target;
  if(playerZone==='teal') {
    target=1;
  } else {
    const dist=ty-player.y;
    target=Math.max(0,Math.min(1,1-dist/600));
  }
  tealTransitionAlpha+=(target-tealTransitionAlpha)*Math.min(dt*2.5,1);
}

function updateCamera(dt) {
  camera.x=player.x;
  const targetOffset = playerZone==='teal' ? canvas.height*0.4 : 0;
  cameraOffsetY+=(targetOffset-cameraOffsetY)*Math.min(dt*3,1);
  camera.y=player.y-cameraOffsetY;
}

// ── 게임오버 ─────────────────────────────────────
function triggerGameOver() {
  player.alive=false; gameOverState='falling'; fadeOpacity=0; fallVelocity=50;
}
function updateGameOver(dt) {
  if(gameOverState==='falling') {
    fallVelocity+=200*dt; player.y+=fallVelocity*dt; fadeOpacity=Math.min(fadeOpacity+dt/3,1);
    camera.x=player.x; camera.y=player.y;
    if(fadeOpacity>=1) {
      gameOverState='reset';
      playerData.inventory={anchovy:0,clownfish:0,salmon:0,barracuda:0,
        tropicalfish:0,turtle:0,butterflyfish:0,octopus:0,moray:0,
        tuna:0,shark:0,whale:0,sunfish:0,holefish:0,plesio:0,
        ballooneel:0,toothfish:0,
        seaweed:0,anemone:0,jellyfish:0,stone:0,iron:0,gold:0,aluminum:0};
      // 인벤토리만 초기화 저장 (fishLog는 전송하지 않아 서버가 보존)
      fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({nickname:playerData.nickname,inventory:playerData.inventory})
      }).then(()=>{
        player.x=SHIP_WORLD_X; player.y=deckTopY()-PLAYER_H/2; player.vx=0; player.vy=0;
        oxygenTimer=effectiveOxygen(); graceTimer=MAX_GRACE_SEC;
        playerZone='sea1'; tealTransitionAlpha=0; cameraOffsetY=0;
        butterflyfishAgro=false; campObject=null; player.alive=true; gameOverState='fadein';
      }).catch(()=>{
        player.x=SHIP_WORLD_X; player.y=deckTopY()-PLAYER_H/2; player.vx=0; player.vy=0;
        oxygenTimer=effectiveOxygen(); graceTimer=MAX_GRACE_SEC;
        playerZone='sea1'; tealTransitionAlpha=0; cameraOffsetY=0;
        butterflyfishAgro=false; campObject=null; player.alive=true; gameOverState='fadein';
      });
    }
  } else if(gameOverState==='fadein') {
    fadeOpacity=Math.max(fadeOpacity-dt/1.5,0);
    camera.x=player.x; camera.y=player.y;
    if(fadeOpacity<=0) gameOverState=null;
  }
}

function drawTealCeiling() {
  if(tealTransitionAlpha<=0) return;
  const leftWX=camera.x-canvas.width*1.2, rightWX=camera.x+canvas.width*1.2, step=8;
  ctx.save();
  ctx.globalAlpha=tealTransitionAlpha;

  // 구멍(샤프트) 위치를 뚫어서 클립
  const holes=getVisibleHoles(leftWX,rightWX);
  ctx.beginPath();
  ctx.rect(0,0,canvas.width,canvas.height);
  for(const hx of holes){
    const{sx:hsx}=ws(hx,0);
    const hw=HOLE_WIDTH/2+4;
    ctx.moveTo(hsx-hw,canvas.height+10);ctx.lineTo(hsx+hw,canvas.height+10);
    ctx.lineTo(hsx+hw,-10);ctx.lineTo(hsx-hw,-10);ctx.closePath();
  }
  ctx.clip('evenodd');

  // 암석 밴드 채우기 (terrainY ~ terrainY+SHAFT_DEPTH)
  const grad=ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0,'#37474f');grad.addColorStop(0.3,'#2e3c43');grad.addColorStop(1,'#1a2529');
  ctx.fillStyle=grad;
  ctx.beginPath();
  let ftFirst=true;
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){const{sx,sy}=ws(wx,terrainY(wx));ftFirst?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);ftFirst=false;}
  for(let wx=rightWX+step;wx>=leftWX;wx-=step){const{sx,sy}=ws(wx,terrainY(wx)+SHAFT_DEPTH);ctx.lineTo(sx,sy);}
  ctx.closePath();ctx.fill();

  // 천장 표면선 (플레이어가 부딪히는 면)
  ctx.strokeStyle='rgba(100,160,180,0.35)';ctx.lineWidth=2;
  ctx.beginPath();let first=true;
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){
    if(isInHoleAt(wx)){first=true;continue;}
    const{sx,sy}=ws(wx,terrainY(wx)+SHAFT_DEPTH);
    first?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);first=false;
  }
  ctx.stroke();
  ctx.restore();
}

// ── 렌더링 ───────────────────────────────────────
function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground();
  drawTerrain();
  drawTealCeiling();
  drawTerrain2();
  drawFloatingRocks();
  drawNonMineableTealRocks();
  drawCaveObjects();
  drawGatherNodes();
  drawShip();
  drawSmallBoat();
  drawAnchovies();
  drawClownfishes();
  drawSalmons();
  drawTunas();
  drawSharks();
  drawWhales();
  drawTropicalFishes();
  drawTurtles();
  drawButterflyfishes();
  drawSunfishes();
  drawHolefishes();
  drawPlesios();
  drawSeamouse();
  drawCamp();
  drawHarpoon();
  drawPlayer();
  drawHUD();
  if(tealBlockedTimer>0) drawTealBlockedMsg();
  if(sellUI.visible && !sellPanelOpen) drawSellPrompt();
  drawFadeOverlay();
  if(inventoryOpen) drawInventory();
  if(logOpen) drawLog();
  if(sellPanelOpen) drawSellPanel();
  if(shopOpen) drawShopPanel();
  if(craftOpen) drawCraftPanel();
}

function drawBackground() {
  const surfSY=surfaceY()-camera.y+canvas.height*SURFACE_RATIO;
  const seaTop=Math.max(0,surfSY);

  // 하늘
  if(surfSY>0) {
    const sg=ctx.createLinearGradient(0,0,0,Math.max(0,surfSY));
    sg.addColorStop(0,'#87ceeb'); sg.addColorStop(1,'#b3e0f7');
    ctx.fillStyle=sg; ctx.fillRect(0,0,canvas.width,Math.max(0,surfSY));
  }

  if(seaTop<canvas.height) {
    // 파란 바다 (1번 바다)
    if(tealTransitionAlpha<1) {
      const og=ctx.createLinearGradient(0,seaTop,0,canvas.height);
      og.addColorStop(0,'#0277bd'); og.addColorStop(0.6,'#01579b'); og.addColorStop(1,'#002f6c');
      ctx.save();
      ctx.globalAlpha=1-tealTransitionAlpha;
      ctx.fillStyle=og; ctx.fillRect(0,seaTop,canvas.width,canvas.height-seaTop);
      ctx.restore();
    }
    // 청록빛 바다 (2번 바다) - 서서히 전환
    if(tealTransitionAlpha>0) {
      const tg=ctx.createLinearGradient(0,seaTop,0,canvas.height);
      tg.addColorStop(0,'#00545f'); tg.addColorStop(0.45,'#006b78'); tg.addColorStop(1,'#002830');
      ctx.save();
      ctx.globalAlpha=tealTransitionAlpha;
      ctx.fillStyle=tg; ctx.fillRect(0,seaTop,canvas.width,canvas.height-seaTop);
      ctx.restore();
    }
  }

  // 수면선
  if(surfSY>=0&&surfSY<=canvas.height) {
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,surfSY); ctx.lineTo(canvas.width,surfSY); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
    const wo=(Date.now()/500)%(Math.PI*2);
    ctx.beginPath();
    for(let x=0;x<=canvas.width;x+=4){const y=surfSY+Math.sin(x/40+wo)*3;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.stroke();
    ctx.restore();
  }
}


// 동굴 오브젝트 (열린 바다에 떠 있는 포털 — 클릭 시 동굴 전용 맵으로 이동)
function drawCaveObjects() {
  const leftWX=camera.x-canvas.width*0.65, rightWX=camera.x+canvas.width*0.65;
  const caveObjs=getVisibleCaveObjs(leftWX,rightWX);
  const t=Date.now()/1000;
  for(const obj of caveObjs){
    const bob=Math.sin(t*1.2+obj.x*0.001)*8; // 위아래 부유
    const{sx,sy}=ws(obj.x,obj.y+bob);
    ctx.save();
    // 외곽 발광
    const outerGlow=ctx.createRadialGradient(sx,sy,0,sx,sy,70);
    outerGlow.addColorStop(0,'rgba(0,200,140,0.22)');
    outerGlow.addColorStop(1,'rgba(0,200,140,0)');
    ctx.fillStyle=outerGlow;
    ctx.beginPath(); ctx.ellipse(sx,sy,70,50,0,0,Math.PI*2); ctx.fill();
    // 어두운 타원형 입구
    ctx.fillStyle='rgba(2,12,8,0.92)';
    ctx.beginPath(); ctx.ellipse(sx,sy,38,26,0,0,Math.PI*2); ctx.fill();
    // 테두리 링 (회전 효과)
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(t*0.6);
    ctx.strokeStyle='rgba(0,220,155,0.55)'; ctx.lineWidth=2.5;
    ctx.setLineDash([10,6]);
    ctx.beginPath(); ctx.ellipse(0,0,44,30,0,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // 라벨
    ctx.font='bold 11px sans-serif'; ctx.fillStyle='#00dda0'; ctx.textAlign='center';
    ctx.shadowColor='rgba(0,200,120,0.9)'; ctx.shadowBlur=7;
    ctx.fillText('해저 동굴',sx,sy-34);
    ctx.shadowBlur=0;
    ctx.font='10px sans-serif'; ctx.fillStyle='rgba(0,180,120,0.7)';
    ctx.fillText('클릭하여 입장',sx,sy-20);
    ctx.restore();
  }
}


function drawTerrain() {
  const leftWX=camera.x-canvas.width*1.2, rightWX=camera.x+canvas.width*1.2, step=8;
  ctx.save();

  // 구멍 제외 클립 영역 생성
  const holes=getVisibleHoles(leftWX,rightWX);
  ctx.beginPath();
  ctx.rect(0,0,canvas.width,canvas.height); // 전체 화면 (시계방향)
  for(const hx of holes) {
    const{sx:hsx}=ws(hx,0);
    const hw=HOLE_WIDTH/2+4;
    // 반시계방향 직사각형 (구멍 생성)
    ctx.moveTo(hsx-hw,canvas.height+10);
    ctx.lineTo(hsx+hw,canvas.height+10);
    ctx.lineTo(hsx+hw,-10);
    ctx.lineTo(hsx-hw,-10);
    ctx.closePath();
  }
  ctx.clip('evenodd');

  const grad=ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0,'#37474f'); grad.addColorStop(0.3,'#2e3c43'); grad.addColorStop(1,'#1a2529');
  ctx.fillStyle=grad;
  ctx.beginPath();
  let ftFirst=true;
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){const{sx,sy}=ws(wx,terrainY(wx));ftFirst?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);ftFirst=false;}
  for(let wx=rightWX+step;wx>=leftWX;wx-=step){const{sx,sy}=ws(wx,terrainY(wx)+SHAFT_DEPTH);ctx.lineTo(sx,sy);}
  ctx.closePath(); ctx.fill();

  // 지형 표면선
  ctx.strokeStyle='rgba(100,160,180,0.35)'; ctx.lineWidth=2;
  ctx.beginPath(); let first=true;
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){
    if(isInHoleAt(wx)){first=true;continue;}
    const{sx,sy}=ws(wx,terrainY(wx));
    first?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);first=false;
  }
  ctx.stroke();
  ctx.restore();

  // 구멍 테두리 글로우
  for(const hx of holes) {
    const{sx:hsx,sy:hsy}=ws(hx,terrainY(hx));
    ctx.save();
    const glow=ctx.createRadialGradient(hsx,hsy,0,hsx,hsy,HOLE_WIDTH/2+20);
    glow.addColorStop(0,'rgba(0,230,180,0.25)');
    glow.addColorStop(1,'rgba(0,230,180,0)');
    ctx.fillStyle=glow;
    ctx.beginPath(); ctx.ellipse(hsx,hsy,HOLE_WIDTH/2+20,30,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawTerrain2() {
  if(tealTransitionAlpha<=0) return;
  const leftWX=camera.x-canvas.width*1.2, rightWX=camera.x+canvas.width*1.2, step=8;
  ctx.save();
  ctx.globalAlpha=tealTransitionAlpha;

  const grad=ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0,'#37474f'); grad.addColorStop(0.3,'#2e3c43'); grad.addColorStop(1,'#1a2529');
  ctx.fillStyle=grad;
  ctx.beginPath();
  let ftFirst=true;
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){const{sx,sy}=ws(wx,terrain2Y(wx));ftFirst?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);ftFirst=false;}
  for(let wx=rightWX+step;wx>=leftWX;wx-=step){const{sx,sy}=ws(wx,terrain2Y(wx)+4000);ctx.lineTo(sx,sy);}
  ctx.closePath(); ctx.fill();

  // 지형 표면선
  ctx.strokeStyle='rgba(100,160,180,0.35)'; ctx.lineWidth=2;
  ctx.beginPath(); let first=true;
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){
    const{sx,sy}=ws(wx,terrain2Y(wx));
    first?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);first=false;
  }
  ctx.stroke();
  ctx.restore();
}

// ── 물고기 렌더 ───────────────────────────────────
function drawHpBar(sx,sy,halfW,halfH,hp,maxHp) {
  if(hp>=maxHp)return;
  const bw=halfW*2+4,bh=4,bx=sx-halfW-2,by=sy-halfH-10;
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle=hp>maxHp*0.5?'#4caf50':hp>maxHp*0.25?'#ffeb3b':'#f44336';
  ctx.fillRect(bx,by,bw*(hp/maxHp),bh);
}

function drawAnchovies() {
  for(const a of anchovies){
    if(a.dead&&!a.collecting)continue;
    const{sx,sy}=ws(a.x,a.y);
    ctx.save();
    ctx.fillStyle=a.collecting?'rgba(192,192,192,0.5)':'#c0c0c0';
    ctx.strokeStyle='#9e9e9e'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(sx,sy,ANCHOVY_W/2,ANCHOVY_H/2,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#333';
    const ex=a.vx>=0?ANCHOVY_W/2-4:-(ANCHOVY_W/2-4);
    ctx.beginPath(); ctx.arc(sx+ex,sy-1,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawClownfishes() {
  for(const c of clownfishes){if(c.dead&&!c.collecting)continue;const{sx,sy}=ws(c.x,c.y);drawClownfishSprite(sx,sy,c.vx>=0,c.collecting?0.5:1);}
}
function drawClownfishSprite(sx,sy,fr,alpha) {
  const f=fr?1:-1,W=CLOWNFISH_W/2,H=CLOWNFISH_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  ctx.fillStyle='#ff9800';ctx.strokeStyle='#4a2000';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy);ctx.lineTo(sx-f*(W+9),sy-7);ctx.lineTo(sx-f*(W+9),sy+7);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#ff6d00';ctx.fillRect(sx-W,sy-H,W*2,H*2);
  ctx.fillStyle='#fff';ctx.fillRect(sx+f*4-2,sy-H,4,H*2);ctx.fillRect(sx-f*1-1.5,sy-H,3,H*2);
  ctx.restore();
  ctx.strokeStyle='#3a1000';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#ff6d00';ctx.strokeStyle='#3a1000';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-W/2,sy-H);ctx.lineTo(sx,sy-H-6);ctx.lineTo(sx+W/2,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+f*6,sy-2,3.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+f*6.5,sy-2,1.8,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawSalmons() {
  for(const s of salmons){if(s.dead&&!s.collecting)continue;const{sx,sy}=ws(s.x,s.y);drawSalmonSprite(sx,sy,s.vx>=0,s.collecting?0.5:1,s.hp,SALMON_HP,s.flashTimer>0);}
}
function drawSalmonSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const f=fr?1:-1,W=SALMON_W/2,H=SALMON_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  ctx.fillStyle=flash?'#fff':'#b05868';ctx.strokeStyle='#5a2030';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy);ctx.lineTo(sx-f*(W+13),sy-9);ctx.lineTo(sx-f*(W+13),sy+9);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);g.addColorStop(0,'#e8a0b0');g.addColorStop(0.4,'#d46080');g.addColorStop(1,'#a04050');ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  ctx.restore();
  ctx.strokeStyle='#5a2030';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=flash?'#fff':'#c06070';ctx.strokeStyle='#5a2030';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-W*0.4,sy-H);ctx.lineTo(sx,sy-H-8);ctx.lineTo(sx+W*0.4,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+f*8,sy-2,3.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+f*8.5,sy-2,2,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawTunas() {
  for(const f of tunas){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawTunaSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,TUNA_HP,f.flashTimer>0);}
}
function drawTunaSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const f=fr?1:-1,W=TUNA_W/2,H=TUNA_H/2;
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  // 두 갈래 꼬리
  ctx.fillStyle=flash?'#fff':'#1a237e';ctx.strokeStyle='#0d0d3a';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy);ctx.lineTo(sx-f*(W+14),sy-10);ctx.lineTo(sx-f*(W+9),sy);ctx.lineTo(sx-f*(W+14),sy+10);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);g.addColorStop(0,'#1a237e');g.addColorStop(0.55,'#3949ab');g.addColorStop(0.75,'#9fa8da');g.addColorStop(1,'#e8eaf6');ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  ctx.restore();
  ctx.strokeStyle='#0d0d3a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 등지느러미
  ctx.fillStyle=flash?'#fff':'#1a237e';ctx.strokeStyle='#0d0d3a';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W*0.1,sy-H);ctx.lineTo(sx+f*W*0.35,sy-H-9);ctx.lineTo(sx+f*W*0.65,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  // 눈
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+f*(W-5),sy-2,2.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+f*(W-4.5),sy-2,1.5,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);ctx.restore();
}

function drawSharks() {
  for(const f of sharks){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawSharkSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,SHARK_HP,f.flashTimer>0);}
}
function drawSharkSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const f=fr?1:-1,W=SHARK_W/2,H=SHARK_H/2;
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  // 꼬리 (비대칭)
  ctx.fillStyle=flash?'#fff':'#546e7a';ctx.strokeStyle='#263238';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy);ctx.lineTo(sx-f*(W+18),sy-13);ctx.lineTo(sx-f*(W+12),sy+2);ctx.lineTo(sx-f*(W+18),sy+10);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);g.addColorStop(0,'#455a64');g.addColorStop(0.65,'#78909c');g.addColorStop(0.75,'#eceff1');g.addColorStop(1,'#eceff1');ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  ctx.restore();
  ctx.strokeStyle='#263238';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 삼각 등지느러미
  ctx.fillStyle=flash?'#fff':'#455a64';ctx.strokeStyle='#263238';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(sx+f*W*0.05,sy-H);ctx.lineTo(sx+f*W*0.42,sy-H-20);ctx.lineTo(sx+f*W*0.72,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  // 아래 지느러미
  ctx.beginPath();ctx.moveTo(sx,sy+H);ctx.lineTo(sx+f*8,sy+H+10);ctx.lineTo(sx-f*10,sy+H);ctx.closePath();ctx.fill();ctx.stroke();
  // 눈 (날카롭게)
  ctx.fillStyle='#111';ctx.beginPath();ctx.ellipse(sx+f*(W-9),sy-3,3.5,2.5,f*0.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(sx+f*(W-8),sy-4,1,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);ctx.restore();
}

function drawWhales() {
  for(const f of whales){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawWhaleSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,WHALE_HP,f.flashTimer>0);}
}
function drawWhaleSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const f=fr?1:-1,W=WHALE_W/2,H=WHALE_H/2;
  const tl=H*0.96,th=H*0.72,ta=H*0.16,fh=H*0.52,lw=H/25;
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  // 수평 꼬리 지느러미
  ctx.fillStyle=flash?'#fff':'#1565c0';ctx.strokeStyle='#0d3c8a';ctx.lineWidth=lw*2;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy-ta);ctx.lineTo(sx-f*(W+tl),sy-th);ctx.lineTo(sx-f*(W+tl*0.75),sy);ctx.lineTo(sx-f*(W+tl),sy+th);ctx.lineTo(sx-f*W,sy+ta);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);g.addColorStop(0,'#1565c0');g.addColorStop(0.62,'#1e88e5');g.addColorStop(0.72,'#e3f2fd');g.addColorStop(1,'#bbdefb');ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  ctx.restore();
  ctx.strokeStyle='#0d3c8a';ctx.lineWidth=lw*2.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 등지느러미
  ctx.fillStyle=flash?'#fff':'#1565c0';ctx.strokeStyle='#0d3c8a';ctx.lineWidth=lw*1.5;
  ctx.beginPath();ctx.moveTo(sx+f*W*0.1,sy-H);ctx.lineTo(sx+f*W*0.25,sy-H-fh);ctx.lineTo(sx+f*W*0.45,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  // 눈
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+f*W*0.8,sy-H*0.15,H*0.18,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.arc(sx+f*W*0.825,sy-H*0.23,H*0.072,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);ctx.restore();
}

function drawSunfishes() {
  for(const f of sunfishes){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawSunfishSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,SUNFISH_HP,f.flashTimer>0);}
}
function drawSunfishSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const fac=fr?1:-1,W=SUNFISH_W/2,H=SUNFISH_H/2;
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  // 등지느러미 (위)
  ctx.fillStyle=flash?'#fff':'#455a64';ctx.strokeStyle='#263238';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(sx+fac*W*0.1,sy-H);ctx.lineTo(sx+fac*W*0.1,sy-H-H*0.85);ctx.lineTo(sx+fac*W*0.5,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  // 배지느러미 (아래)
  ctx.beginPath();ctx.moveTo(sx+fac*W*0.1,sy+H);ctx.lineTo(sx+fac*W*0.1,sy+H+H*0.75);ctx.lineTo(sx+fac*W*0.5,sy+H);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{
    const g=ctx.createLinearGradient(sx-W,sy,sx+W,sy);
    g.addColorStop(0,'#546e7a');g.addColorStop(0.45,'#90a4ae');g.addColorStop(0.75,'#eceff1');g.addColorStop(1,'#b0bec5');
    ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);
    // 텍스처 줄무늬
    ctx.fillStyle='rgba(100,120,140,0.18)';
    for(let i=0;i<4;i++){const bx=sx-W+W*0.4*i;ctx.beginPath();ctx.ellipse(bx,sy,5,H*0.85,0,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
  ctx.strokeStyle=flash?'#fff':'#37474f';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 클라부스 (뭉툭한 꼬리 돌기)
  ctx.fillStyle=flash?'#fff':'#546e7a';ctx.strokeStyle='#263238';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(sx-fac*W*0.95,sy,W*0.22,H*0.45,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  // 가슴지느러미
  ctx.save();ctx.translate(sx+fac*W*0.1,sy-H*0.15);ctx.rotate(fac*0.3);
  ctx.fillStyle=flash?'#fff':'#607d8b';ctx.beginPath();ctx.ellipse(fac*8,0,9,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // 눈
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+fac*(W-7),sy-H*0.08,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+fac*(W-6.5),sy-H*0.08,3,0,Math.PI*2);ctx.fill();
  // 입 (작고 둥글게)
  ctx.strokeStyle='#263238';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(sx+fac*W*0.96,sy+H*0.12,3,Math.PI*0.7,Math.PI*1.3);ctx.stroke();
  drawHpBar(sx,sy,W,H,hp,maxHp);ctx.restore();
}

function drawHolefishes() {
  for(const f of holefishes){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawHolefishSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,HOLEFISH_HP,f.flashTimer>0);}
}
function drawHolefishSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const fac=fr?1:-1,W=HOLEFISH_W/2,H=HOLEFISH_H/2;
  const holeR=H*0.52;
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  // 꼬리
  ctx.fillStyle=flash?'#fff':'#00838f';ctx.strokeStyle='#006064';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(sx-fac*W,sy);ctx.lineTo(sx-fac*(W+H*0.8),sy-H*1.4);ctx.lineTo(sx-fac*(W+H*0.8),sy+H*1.4);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통 (도넛 - evenodd 클립으로 가운데 구멍)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);
  ctx.ellipse(sx,sy,holeR,holeR,0,0,Math.PI*2);
  ctx.clip('evenodd');
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{
    const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);
    g.addColorStop(0,'#00e5ff');g.addColorStop(0.45,'#00bcd4');g.addColorStop(1,'#00838f');
    ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);
    ctx.fillStyle='rgba(0,230,255,0.35)';
    ctx.fillRect(sx-W*0.3,sy-H,W*0.22,H*2);
    ctx.fillRect(sx+W*0.1,sy-H,W*0.18,H*2);
  }
  ctx.restore();
  ctx.strokeStyle='#006064';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#004a52';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(sx,sy,holeR,holeR,0,0,Math.PI*2);ctx.stroke();
  // 등지느러미
  ctx.fillStyle=flash?'#fff':'#00acc1';ctx.strokeStyle='#006064';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(sx-W*0.3,sy-H);ctx.lineTo(sx,sy-H-H*0.9);ctx.lineTo(sx+W*0.4,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  // 눈
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+fac*(W-H*0.4),sy-H*0.12,H*0.22,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+fac*(W-H*0.32),sy-H*0.12,H*0.13,0,Math.PI*2);ctx.fill();
  // 공생 발광 (나비고기 흥분 시)
  if(!flash&&butterflyfishAgro){
    ctx.strokeStyle='rgba(0,230,255,0.65)';ctx.lineWidth=6;
    ctx.beginPath();ctx.ellipse(sx,sy,W+10,H+10,0,0,Math.PI*2);ctx.stroke();
  }
  drawHpBar(sx,sy,W,H,hp,maxHp);ctx.restore();
}

function drawPlesios() {
  for(const f of plesios){
    if(f.dead&&!f.collecting)continue;
    const{sx,sy}=ws(f.x,f.y);
    drawPlesioSprite(f,sx,sy,f.collecting?0.5:1,f.hp,PLESIO_HP,f.flashTimer>0);
  }
}
function drawPlesioSprite(f,sx,sy,alpha,hp,maxHp,flash) {
  const fr=f.vx>=0,fac=fr?1:-1,W=PLESIO_W/2,H=PLESIO_H/2;
  const lw=H/37.5,t=Date.now()/1000;
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  // 꼬리 (trail 기반)
  if(f.trail&&f.trail.length>2){
    ctx.strokeStyle=flash?'#fff':'#1a237e';ctx.lineWidth=H*0.28;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    const troot=ws(f.x-fac*W*0.55,f.y+H*0.05);
    ctx.moveTo(troot.sx,troot.sy);
    [5,10,16,22].forEach(i=>{
      const tp=f.trail[Math.min(i,f.trail.length-1)];
      const{sx:tsx,sy:tsy}=ws(tp.x,tp.y);ctx.lineTo(tsx,tsy);
    });
    ctx.stroke();
    const last=f.trail[Math.min(22,f.trail.length-1)];
    const{sx:flx,sy:fly}=ws(last.x,last.y);
    ctx.fillStyle=flash?'#fff':'#283593';ctx.strokeStyle='#0d1a6e';ctx.lineWidth=lw*2;
    ctx.beginPath();ctx.moveTo(flx,fly-H*0.48);ctx.lineTo(flx-fac*H*0.90,fly-H*0.18);
    ctx.lineTo(flx,fly+H*0.48);ctx.lineTo(flx+fac*H*0.80,fly+H*0.18);ctx.closePath();ctx.fill();ctx.stroke();
  }
  // 지느러미발 (앞 2개 + 뒤 2개, 쌍으로 띄어서)
  const flipColor=flash?'#fff':'#1565c0';
  [
    [ fac*W*0.52, sy+H*0.90,  Math.PI/2+0.34*fac+Math.sin(t*1.8)*0.22],
    [ fac*W*0.26, sy+H*0.90,  Math.PI/2+0.11*fac+Math.sin(t*1.8+0.4)*0.22],
    [-fac*W*0.26, sy+H*0.90,  Math.PI/2-0.11*fac+Math.sin(t*1.8+0.8)*0.20],
    [-fac*W*0.52, sy+H*0.90,  Math.PI/2-0.34*fac+Math.sin(t*1.8+1.2)*0.20],
  ].forEach(([ox,fy2,rot])=>{
    ctx.save();ctx.translate(sx+ox,fy2);ctx.rotate(rot);
    ctx.fillStyle=flipColor;ctx.strokeStyle='#0d1a6e';ctx.lineWidth=lw*1.8;
    ctx.beginPath();ctx.ellipse(H*0.28,0,H*0.56,H*0.18,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=flash?'#dde':'#1976d2';
    ctx.beginPath();ctx.ellipse(H*0.80,0,H*0.34,H*0.44,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.restore();
  });
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{
    const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);
    g.addColorStop(0,'#1a237e');g.addColorStop(0.4,'#283593');g.addColorStop(0.75,'#3949ab');g.addColorStop(1,'#1565c0');
    ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);
    ctx.fillStyle='rgba(100,130,200,0.12)';ctx.beginPath();ctx.ellipse(sx-W*0.2,sy-H*0.3,W*0.45,H*0.28,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle='#0d1a6e';ctx.lineWidth=lw*2.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 목 + 머리
  const hr=H*0.55;
  if(f.neck&&f.neck.length>=2){
    // 체인 목 렌더링
    ctx.strokeStyle=flash?'#fff':'#1a237e';ctx.lineWidth=H*0.65;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    const n0=ws(f.neck[0].x,f.neck[0].y);ctx.moveTo(n0.sx,n0.sy);
    for(let i=1;i<f.neck.length;i++){const ni=ws(f.neck[i].x,f.neck[i].y);ctx.lineTo(ni.sx,ni.sy);}
    ctx.stroke();
    if(!flash){ctx.fillStyle='#283593';for(let i=1;i<f.neck.length-1;i++){const ni=ws(f.neck[i].x,f.neck[i].y);ctx.beginPath();ctx.arc(ni.sx,ni.sy,H*0.12,0,Math.PI*2);ctx.fill();}}
    const nLast=f.neck[f.neck.length-1],nPrev=f.neck[f.neck.length-2];
    const{sx:nhx,sy:nhy}=ws(nLast.x,nLast.y);
    const hfac=(nLast.x-nPrev.x)>=0?1:-1;
    ctx.fillStyle=flash?'#fff':'#283593';ctx.strokeStyle='#0d1a6e';ctx.lineWidth=lw*2.5;
    ctx.beginPath();ctx.ellipse(nhx,nhy,hr*1.8,hr,0.18*hfac,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(nhx+hfac*hr*0.55,nhy+hr*0.38,hr*0.85,hr*0.38,0.15*hfac,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=flash?'#ccc':'#fff';ctx.beginPath();ctx.arc(nhx+hfac*hr*0.82,nhy-hr*0.12,hr*0.36,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111';ctx.beginPath();ctx.arc(nhx+hfac*hr*0.84,nhy-hr*0.12,hr*0.22,0,Math.PI*2);ctx.fill();
  } else {
    // 베지어 목 (아이콘/도감 렌더링 폴백)
    const osc=Math.sin(t*1.1+f.x*0.0008)*H*0.44;
    const oscY=Math.cos(t*0.85+f.x*0.0006)*H*0.30;
    const nrx=sx+fac*W*0.68,nry=sy-H*0.22;
    const nmx=sx+fac*(W+H*1.4)+osc,nmy=sy-H*1.8+oscY;
    const nhx=sx+fac*(W+H*3.0)+osc*1.25,nhy=sy-H*2.6+oscY*1.25;
    ctx.strokeStyle=flash?'#fff':'#1a237e';ctx.lineWidth=H*0.65;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(nrx,nry);ctx.quadraticCurveTo(nmx,nmy,nhx,nhy);ctx.stroke();
    if(!flash){ctx.fillStyle='#283593';for(let i=0;i<=4;i++){const ti=i/4;const bx=(1-ti)*(1-ti)*nrx+2*(1-ti)*ti*nmx+ti*ti*nhx;const by=(1-ti)*(1-ti)*nry+2*(1-ti)*ti*nmy+ti*ti*nhy;ctx.beginPath();ctx.arc(bx,by,H*0.12,0,Math.PI*2);ctx.fill();}}
    ctx.fillStyle=flash?'#fff':'#283593';ctx.strokeStyle='#0d1a6e';ctx.lineWidth=lw*2.5;
    ctx.beginPath();ctx.ellipse(nhx,nhy,hr*1.8,hr,0.18*fac,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(nhx+fac*hr*0.55,nhy+hr*0.38,hr*0.85,hr*0.38,0.15*fac,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=flash?'#ccc':'#fff';ctx.beginPath();ctx.arc(nhx+fac*hr*0.82,nhy-hr*0.12,hr*0.36,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111';ctx.beginPath();ctx.arc(nhx+fac*hr*0.84,nhy-hr*0.12,hr*0.22,0,Math.PI*2);ctx.fill();
  }
  drawHpBar(sx,sy,W,H,hp,maxHp);ctx.restore();
}

function drawTropicalFishes() {
  for(const f of tropicalfishes){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawTropicalFishSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,TROPICALFISH_HP,f.flashTimer>0);}
}
function drawTropicalFishSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const f=fr?1:-1,W=TROPICALFISH_W/2,H=TROPICALFISH_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  // 꼬리
  ctx.fillStyle=flash?'#fff':'#ff8f00'; ctx.strokeStyle='#e65100'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy);ctx.lineTo(sx-f*(W+10),sy-7);ctx.lineTo(sx-f*(W+10),sy+7);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{
    const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);
    g.addColorStop(0,'#80deea');g.addColorStop(0.4,'#00acc1');g.addColorStop(1,'#006064');
    ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);
    ctx.fillStyle='rgba(255,200,0,0.6)';
    ctx.fillRect(sx-W*0.2,sy-H,W*0.4,H*2);
    ctx.fillRect(sx+W*0.4,sy-H,W*0.3,H*2);
  }
  ctx.restore();
  ctx.strokeStyle='#006064';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=flash?'#fff':'#00bcd4'; ctx.strokeStyle='#006064'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-W*0.3,sy-H);ctx.lineTo(sx+W*0.1,sy-H-7);ctx.lineTo(sx+W*0.4,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+f*7,sy-1,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+f*7.4,sy-1,1.7,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawTurtles() {
  for(const f of turtles){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawTurtleSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,TURTLE_HP,f.flashTimer>0);}
}
function drawTurtleSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const fac=fr?1:-1,W=TURTLE_W/2,H=TURTLE_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  // 지느러미
  const fc=flash?'#fff':'#558b2f';
  ctx.fillStyle=fc;ctx.strokeStyle='#33691e';ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(sx+fac*(W-4),sy+H+4,8,4,fac*0.3,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(sx-fac*(W-4),sy+H+4,8,4,-fac*0.3,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(sx+fac*W+8,sy-6,10,5,fac*0.4,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(sx+fac*W+8,sy+6,10,5,-fac*0.4,0,Math.PI*2);ctx.fill();ctx.stroke();
  // 껍질
  if(flash){ctx.fillStyle='#fff';}
  else{const g=ctx.createRadialGradient(sx-W*0.2,sy-H*0.3,2,sx,sy,W*1.1);g.addColorStop(0,'#8bc34a');g.addColorStop(0.5,'#558b2f');g.addColorStop(1,'#33691e');ctx.fillStyle=g;}
  ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#33691e';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 껍질 패턴
  if(!flash){
    ctx.strokeStyle='rgba(0,80,0,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(sx,sy-H+4);ctx.lineTo(sx,sy+H-4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(sx-W+4,sy);ctx.lineTo(sx+W-4,sy);ctx.stroke();
  }
  // 머리
  ctx.fillStyle=flash?'#fff':'#6d9e3e';ctx.strokeStyle='#33691e';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(sx+fac*(W+6),sy,8,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+fac*(W+8),sy-2,2.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+fac*(W+8.5),sy-2,1.5,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawButterflyfishes() {
  for(const f of butterflyfishes){if(f.dead&&!f.collecting)continue;const{sx,sy}=ws(f.x,f.y);drawButterflyFishSprite(sx,sy,f.vx>=0,f.collecting?0.5:1,f.hp,BUTTERFLYFISH_HP,f.flashTimer>0,butterflyfishAgro&&f.touchCooldown<=0);}
}
function drawButterflyFishSprite(sx,sy,fr,alpha,hp,maxHp,flash,agro) {
  const fac=fr?1:-1,W=BUTTERFLYFISH_W/2,H=BUTTERFLYFISH_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  // 날개형 몸통
  const bodyColor=flash?'#fff':agro?'#ff6060':'#ffd600';
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=bodyColor;ctx.fillRect(sx-W,sy-H,W*2,H*2);
  if(!flash){
    // 눈 띠
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(sx+fac*(W*0.2)-2,sy-H,5,H*2);
    // 꼬리 쪽 흰 띠
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fillRect(sx-fac*(W*0.5)-2,sy-H,4,H*2);
  }
  ctx.restore();
  ctx.strokeStyle='#f9a825';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 등지느러미 (날개처럼 부채꼴)
  ctx.fillStyle=flash?'#fff':'rgba(255,230,0,0.7)';
  ctx.beginPath();ctx.moveTo(sx-W*0.6,sy-H);ctx.lineTo(sx-W,sy-H-10);ctx.lineTo(sx+W,sy-H-10);ctx.lineTo(sx+W*0.6,sy-H);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+fac*6,sy-1,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+fac*6.5,sy-1,1.8,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawBarracudaSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const f=fr?1:-1,W=BARRACUDA_W/2,H=BARRACUDA_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  ctx.fillStyle=flash?'#fff':'#607d8b';ctx.strokeStyle='#263238';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-f*W,sy);ctx.lineTo(sx-f*(W+15),sy-11);ctx.lineTo(sx-f*(W+9),sy);ctx.lineTo(sx-f*(W+15),sy+11);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);g.addColorStop(0,'#b0bec5');g.addColorStop(0.35,'#78909c');g.addColorStop(1,'#455a64');ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  ctx.restore();
  ctx.strokeStyle='#263238';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=flash?'#fff':'#546e7a';ctx.strokeStyle='#263238';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-W*0.5,sy-H);ctx.lineTo(sx-W*0.1,sy-H-10);ctx.lineTo(sx+W*0.4,sy-H-5);ctx.lineTo(sx+W*0.5,sy-H);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=flash?'#fff':'#b0bec5';ctx.strokeStyle='#263238';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(sx+f*W,sy-1);ctx.lineTo(sx+f*(W+12),sy-2);ctx.lineTo(sx+f*(W+12),sy+2);ctx.lineTo(sx+f*W,sy+1);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+f*(W-9),sy-1,4.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#cc0000';ctx.beginPath();ctx.arc(sx+f*(W-8.5),sy-1,2.8,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.arc(sx+f*(W-8.5),sy-1,1.5,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawOctopusSprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const W=OCTOPUS_W/2,H=OCTOPUS_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  // 촉수
  ctx.strokeStyle=flash?'#fff':'#7b1fa2'; ctx.lineWidth=3; ctx.lineCap='round';
  const tentacleCount=6;
  for(let i=0;i<tentacleCount;i++){
    const angle=(i/(tentacleCount-1)-0.5)*Math.PI*0.9+Math.PI*0.5;
    const ex=sx+Math.cos(angle)*W*1.4, ey=sy+Math.sin(angle)*H*1.3+10;
    ctx.beginPath();ctx.moveTo(sx+Math.cos(angle)*W*0.5,sy+H*0.3);ctx.quadraticCurveTo(ex-5,ey-8,ex,ey+8);ctx.stroke();
  }
  // 머리
  if(flash){ctx.fillStyle='#fff';}
  else{const g=ctx.createRadialGradient(sx-4,sy-4,2,sx,sy,W);g.addColorStop(0,'#ce93d8');g.addColorStop(0.6,'#9c27b0');g.addColorStop(1,'#6a0080');ctx.fillStyle=g;}
  ctx.beginPath();ctx.ellipse(sx,sy-4,W,H*0.9,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#6a0080';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy-4,W,H*0.9,0,0,Math.PI*2);ctx.stroke();
  // 눈
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx-6,sy-6,4,0,Math.PI*2);ctx.fill();ctx.arc(sx+6,sy-6,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx-5.5,sy-6,2.5,0,Math.PI*2);ctx.fill();ctx.arc(sx+6.5,sy-6,2.5,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawMoraySprite(sx,sy,fr,alpha,hp,maxHp,flash) {
  const fac=fr?1:-1,W=MORAY_W/2,H=MORAY_H/2;
  ctx.save(); if(alpha<1)ctx.globalAlpha=alpha;
  // 꼬리
  ctx.fillStyle=flash?'#fff':'#827717';ctx.strokeStyle='#33691e';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-fac*W,sy);ctx.lineTo(sx-fac*(W+12),sy-5);ctx.lineTo(sx-fac*(W+12),sy+5);ctx.closePath();ctx.fill();ctx.stroke();
  // 몸통
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.clip();
  if(flash){ctx.fillStyle='#fff';ctx.fillRect(sx-W,sy-H,W*2,H*2);}
  else{
    const g=ctx.createLinearGradient(sx,sy-H,sx,sy+H);
    g.addColorStop(0,'#dce775');g.addColorStop(0.5,'#c6c827');g.addColorStop(1,'#9e9d24');
    ctx.fillStyle=g;ctx.fillRect(sx-W,sy-H,W*2,H*2);
    // 얼룩
    ctx.fillStyle='rgba(0,80,0,0.25)';
    for(let i=0;i<5;i++){const bx=sx-W+W*0.35*i;ctx.beginPath();ctx.ellipse(bx,sy,8,H*0.7,0,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
  ctx.strokeStyle='#827717';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W,H,0,0,Math.PI*2);ctx.stroke();
  // 머리/입
  ctx.fillStyle=flash?'#fff':'#d4e157';ctx.strokeStyle='#827717';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(sx+fac*W+4,sy,10,H+1,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#333';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx+fac*(W+1),sy+2);ctx.lineTo(sx+fac*(W+12),sy+2);ctx.stroke();
  // 이빨
  ctx.fillStyle='#fff';
  for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(sx+fac*(W+3+i*3),sy+2);ctx.lineTo(sx+fac*(W+2.5+i*3),sy+5);ctx.lineTo(sx+fac*(W+4+i*3),sy+2);ctx.closePath();ctx.fill();}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+fac*(W+5),sy-3,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+fac*(W+5.5),sy-3,1.8,0,Math.PI*2);ctx.fill();
  drawHpBar(sx,sy,W,H,hp,maxHp);
  ctx.restore();
}

function drawSeamouse() {
  // respawn 카운트다운 표시
  if(seamouseRespawnTimer>0&&playerData.hasSeamouse){
    const{sx,sy}=ws(SHIP_WORLD_X,surfaceY()+60);
    ctx.save();ctx.font='bold 12px sans-serif';ctx.fillStyle='rgba(100,220,255,0.8)';ctx.textAlign='center';
    ctx.fillText('시마우스 재배치: '+Math.ceil(seamouseRespawnTimer)+'초',sx,sy);ctx.restore();
  }
  if(!seamouse) return;

  // 폭발 파티클
  if(seamouse.exploding){
    ctx.save();
    for(const p of seamouse.explodeParticles){
      if(p.life<=0)continue;
      const{sx,sy}=ws(p.x,p.y);
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.life>0.6?'#fff':p.life>0.3?'#ffcc00':'#ff6600';
      ctx.beginPath();ctx.arc(sx,sy,4+Math.random()*4,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    return;
  }

  const{sx,sy}=ws(seamouse.x,seamouse.y);
  const flash=seamouse.flashTimer>0;
  ctx.save();
  ctx.translate(sx,sy);
  ctx.rotate(seamouse.angle);

  // 본체
  const bodyColor=flash?'#fff':'#37474f';
  const accentColor=flash?'#eee':'#00acc1';
  ctx.fillStyle=bodyColor;ctx.strokeStyle=flash?'#fff':'#1c3a45';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,0,SEAMOUSE_W/2,SEAMOUSE_H/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();

  // 측면 줄무늬
  if(!flash){
    ctx.fillStyle='rgba(0,172,193,0.25)';
    ctx.beginPath();ctx.ellipse(-4,0,SEAMOUSE_W*0.28,SEAMOUSE_H*0.28,0,0,Math.PI*2);ctx.fill();
  }

  // 등 지느러미 (위쪽)
  ctx.fillStyle=flash?'#ddd':accentColor;ctx.strokeStyle=flash?'#fff':'#007c91';ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(-8,-SEAMOUSE_H/2);
  ctx.lineTo(0,-SEAMOUSE_H/2-14);
  ctx.lineTo(10,-SEAMOUSE_H/2);
  ctx.closePath();ctx.fill();ctx.stroke();

  // 아래 지느러미 (배쪽)
  ctx.beginPath();
  ctx.moveTo(-6,SEAMOUSE_H/2);
  ctx.lineTo(2,SEAMOUSE_H/2+10);
  ctx.lineTo(12,SEAMOUSE_H/2);
  ctx.closePath();ctx.fill();ctx.stroke();

  // 꼬리 (뒤쪽 왼편)
  ctx.fillStyle=flash?'#ddd':accentColor;ctx.strokeStyle=flash?'#fff':'#007c91';ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(-SEAMOUSE_W/2,0);
  ctx.lineTo(-SEAMOUSE_W/2-14,-12);
  ctx.lineTo(-SEAMOUSE_W/2-18,0);
  ctx.lineTo(-SEAMOUSE_W/2-14,12);
  ctx.closePath();ctx.fill();ctx.stroke();

  // 조종석 창 (앞쪽)
  ctx.fillStyle=flash?'#fff':'#1a237e';ctx.strokeStyle=flash?'#ccc':'#000d47';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(SEAMOUSE_W*0.22,0,SEAMOUSE_H*0.32,SEAMOUSE_H*0.32,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  // 창문 반사
  if(!flash){
    ctx.fillStyle='rgba(100,200,255,0.5)';
    ctx.beginPath();ctx.ellipse(SEAMOUSE_W*0.22,0,SEAMOUSE_H*0.22,SEAMOUSE_H*0.22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath();ctx.ellipse(SEAMOUSE_W*0.20,-SEAMOUSE_H*0.09,SEAMOUSE_H*0.09,SEAMOUSE_H*0.07,-0.4,0,Math.PI*2);ctx.fill();
  }

  // 잠망경
  if(!flash){
    ctx.strokeStyle='#546e7a';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(4,-SEAMOUSE_H/2);ctx.lineTo(4,-SEAMOUSE_H/2-20);ctx.lineTo(14,-SEAMOUSE_H/2-20);ctx.stroke();
    ctx.fillStyle='#78909c';ctx.beginPath();ctx.rect(10,-SEAMOUSE_H/2-24,8,8);ctx.fill();
  }

  // 탑승 힌트 (미탑승 & 가까울때)
  ctx.restore();
  if(!seamouse.piloted){
    const dx=player.x-seamouse.x,dy=player.y-seamouse.y;
    if(Math.sqrt(dx*dx+dy*dy)<SEAMOUSE_BOARD_RADIUS*1.5){
      ctx.save();ctx.font='bold 12px sans-serif';ctx.fillStyle='rgba(100,240,255,0.9)';ctx.textAlign='center';
      const{sx:hsx,sy:hsy}=ws(seamouse.x,seamouse.y-SEAMOUSE_H/2-22);
      ctx.fillText('[E] 탑승',hsx,hsy);ctx.restore();
    }
  }

  // HP바 (산소)
  if(!seamouse.exploding){
    const bw=SEAMOUSE_W*1.2,bh=5;
    const{sx:bsx,sy:bsy}=ws(seamouse.x,seamouse.y-SEAMOUSE_H/2-12);
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bsx-bw/2,bsy,bw,bh);
    const ratio=seamouse.oxygen/SEAMOUSE_MAX_OXYGEN;
    ctx.fillStyle=ratio>0.5?'#00e5ff':ratio>0.25?'#ffeb3b':'#f44336';
    ctx.fillRect(bsx-bw/2,bsy,bw*ratio,bh);
    ctx.restore();
  }
}

function drawSeamouseHUD() {
  if(!seamouse||seamouse.exploding) return;
  const x=20,y=50,w=200,h=16;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(x-2,y-2,w+4,h+4);
  const ratio=seamouse.oxygen/SEAMOUSE_MAX_OXYGEN;
  ctx.fillStyle=ratio>0.5?'#00e5ff':ratio>0.25?'#ffeb3b':'#f44336';
  ctx.fillRect(x,y,w*ratio,h);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(x-2,y-2,w+4,h+4);
  ctx.font='bold 12px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='left';
  ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=4;
  ctx.fillText('🐭 시마우스: '+Math.ceil(seamouse.oxygen)+'초',x+4,y+13);
  ctx.shadowBlur=0;ctx.restore();
}

function drawHarpoon() {
  if(!harpoon.active)return;
  const{sx:px,sy:py}=ws(player.x,player.y);
  const{sx:hx,sy:hy}=ws(harpoon.x,harpoon.y);
  const isScope=playerData.activeHarpoon==='scope';
  ctx.save();
  if(isScope){
    ctx.strokeStyle='rgba(0,220,255,0.45)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(hx,hy);ctx.stroke();
  } else {
    ctx.strokeStyle='rgba(200,200,200,0.6)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(hx,hy);ctx.stroke();ctx.setLineDash([]);
  }
  const angle=Math.atan2(harpoon.vy,harpoon.vx);
  ctx.translate(hx,hy);ctx.rotate(angle);
  if(isScope){
    ctx.shadowColor='#00e5ff';ctx.shadowBlur=14;
    // 긴 몸통
    ctx.fillStyle='#00838f';ctx.fillRect(-30,-2,36,4);
    // 스코프 링
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(-14,0,5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(0,229,255,0.18)';ctx.fill();
    // 탄두
    ctx.shadowBlur=18;
    ctx.fillStyle='#e0f7fa';
    ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-1,-4);ctx.lineTo(1,0);ctx.lineTo(-1,4);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
  } else {
    ctx.fillStyle='#bdbdbd';ctx.strokeStyle='#757575';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-6,-4);ctx.lineTo(-4,0);ctx.lineTo(-6,4);ctx.closePath();
    ctx.fill();ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  if(seamouse&&seamouse.piloted) return;
  const{sx,sy}=ws(player.x,player.y);
  const inWater=player.y>surfaceY();
  const f=playerFacingRight?1:-1;
  const upg=playerData.upgrades||{flipper:0,oxygen:0,harpoon:0};
  const flipperTier=upgradeTier(upg.flipper||0);
  const tankTier=upgradeTier(upg.oxygen||0);
  const harpoonTier=upgradeTier(upg.harpoon||0);
  const flipperColor=UPGRADE_COLORS.flipper[flipperTier];
  const tankColor=UPGRADE_COLORS.tank[tankTier];
  const harpoonColor=UPGRADE_COLORS.harpoon[harpoonTier];
  ctx.save();

  // 물갈퀴 (업그레이드 색상 적용)
  if(inWater){
    ctx.fillStyle=flipperColor;
    if(flipperTier>=3){ctx.shadowColor=flipperColor;ctx.shadowBlur=6;}
    ctx.beginPath();ctx.ellipse(sx+f*10,sy+18,12+(flipperTier*1.5),4,f*0.25,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(sx-f*2,sy+18,9+(flipperTier*1.2),3,-f*0.2,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  }

  ctx.fillStyle=inWater?'#0d47a1':'#bf360c';ctx.fillRect(sx-11,sy+7,9,12);ctx.fillRect(sx+2,sy+7,9,12);
  ctx.fillStyle=inWater?'#1565c0':'#e65100';ctx.fillRect(sx-12,sy-8,24,15);
  ctx.strokeStyle=inWater?'#0a3880':'#8d1a00';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(sx,sy-8);ctx.lineTo(sx,sy+7);ctx.stroke();

  // 산소통 (업그레이드 색상 적용)
  const tx=sx-f*15;
  ctx.fillStyle=tankColor;ctx.fillRect(tx-4,sy-8,9,14);
  ctx.fillStyle='#b0bec5';ctx.fillRect(tx-2,sy-5,4,10);
  ctx.fillStyle=tankTier>=1?tankColor:'#607d8b';ctx.fillRect(tx-3,sy-12,7,6);
  ctx.fillStyle='#90a4ae';ctx.fillRect(tx-1,sy-11,3,3);
  if(tankTier>=2){ctx.strokeStyle=tankColor;ctx.lineWidth=1;ctx.strokeRect(tx-4,sy-8,9,14);}
  if(tankTier>=4){ctx.shadowColor=tankColor;ctx.shadowBlur=8;ctx.strokeStyle=tankColor;ctx.lineWidth=1.5;ctx.strokeRect(tx-4,sy-8,9,14);ctx.shadowBlur=0;}

  if(inWater){ctx.strokeStyle='#263238';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(tx+f*5,sy-5);ctx.quadraticCurveTo(sx+f*2,sy-22,sx+f*11,sy-14);ctx.stroke();}

  ctx.fillStyle='#ffcc80';ctx.beginPath();ctx.arc(sx,sy-17,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#212121';ctx.beginPath();ctx.ellipse(sx+f*3,sy-18,8.5,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(100,200,255,0.62)';ctx.beginPath();ctx.ellipse(sx+f*3,sy-18,6.5,5.5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.ellipse(sx+f*5,sy-21,2.5,1.5,-0.4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx-f*5,sy-18);ctx.lineTo(sx-f*10,sy-18);ctx.stroke();
  if(inWater){ctx.fillStyle='#37474f';ctx.beginPath();ctx.arc(sx+f*10,sy-13,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#546e7a';ctx.beginPath();ctx.arc(sx+f*10,sy-13,2.5,0,Math.PI*2);ctx.fill();}

  // 작살 건 (업그레이드 색상 적용)
  const aimAngle=Math.atan2(mouseWorld.y-player.y,mouseWorld.x-player.x);
  const gx=sx+Math.cos(aimAngle)*10,gy=sy-2+Math.sin(aimAngle)*6;
  const isScopeGun=playerData.activeHarpoon==='scope';
  ctx.save();ctx.translate(gx,gy);ctx.rotate(aimAngle);
  if(isScopeGun){
    ctx.shadowColor='#00e5ff';ctx.shadowBlur=7;
    ctx.fillStyle='#004d40';ctx.fillRect(-2,-2,36,5);       // 긴 총신
    ctx.fillStyle='#00bcd4';ctx.fillRect(34,-3,6,7);         // 총구
    ctx.fillStyle='#546e7a';ctx.fillRect(-9,-2,8,10);ctx.fillStyle='#37474f';ctx.fillRect(-4,3,2.5,6); // 손잡이
    ctx.fillStyle='#00695c';ctx.fillRect(6,-8,18,6);         // 스코프 튜브
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;ctx.strokeRect(6,-8,18,6);
    ctx.fillStyle='rgba(0,229,255,0.5)';ctx.beginPath();ctx.arc(15,-5,2.5,0,Math.PI*2);ctx.fill(); // 렌즈
    ctx.shadowBlur=0;
  } else {
    if(harpoonTier>=3){ctx.shadowColor=harpoonColor;ctx.shadowBlur=8;}
    ctx.fillStyle=harpoonColor;ctx.fillRect(-2,-2,26,5);
    ctx.fillStyle=harpoonTier>=2?harpoonColor:'#cfd8dc';ctx.fillRect(24,-3,5,7);
    ctx.fillStyle='#546e7a';ctx.fillRect(-9,-2,8,10);ctx.fillStyle='#37474f';ctx.fillRect(-4,3,2.5,6);
    ctx.strokeStyle=harpoonTier>=1?harpoonColor:'#546e7a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(22,0);ctx.stroke();
    ctx.shadowBlur=0;
  }
  ctx.restore();
  ctx.restore();
  drawBubbles();
}

function drawBubbles() {
  for(const b of bubbles){
    const{sx,sy}=ws(b.x,b.y);
    ctx.save();ctx.globalAlpha=Math.max(0,b.life)*0.85;
    ctx.strokeStyle='rgba(180,230,255,0.9)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(sx,sy,b.r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.25)';ctx.beginPath();ctx.arc(sx-b.r*0.3,sy-b.r*0.3,b.r*0.35,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

function drawShip() {
  const{sx,sy}=ws(SHIP_WORLD_X,surfaceY());
  ctx.save();
  ctx.fillStyle='#6d4c41';ctx.beginPath();ctx.moveTo(sx-SHIP_W/2,sy);ctx.lineTo(sx-SHIP_W/2+10,sy+SHIP_H);ctx.lineTo(sx+SHIP_W/2-10,sy+SHIP_H);ctx.lineTo(sx+SHIP_W/2,sy);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#4e342e';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#8d6e63';ctx.fillRect(sx-SHIP_W/2,sy-12,SHIP_W,12);
  ctx.strokeStyle='#5d4037';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(sx,sy-12);ctx.lineTo(sx,sy-70);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.85)';ctx.beginPath();ctx.moveTo(sx,sy-65);ctx.lineTo(sx+40,sy-40);ctx.lineTo(sx,sy-15);ctx.closePath();ctx.fill();
  ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(nickname+'호',sx,sy-78);

  // 상점 버튼 (배 왼쪽)
  const bx=sx-SHIP_W/2+6, by=sy-36, bw=44, bh=26;
  ctx.fillStyle=shopOpen?'#fbc02d':'#f57f17';
  ctx.strokeStyle='#e65100';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(bx,by,bw,bh,4);ctx.fill();ctx.stroke();
  ctx.font='bold 12px sans-serif';ctx.fillStyle='#212121';ctx.textAlign='center';
  ctx.fillText('상점',bx+bw/2,by+17);
  shopBtnBounds={x:bx,y:by,w:bw,h:bh};

  // 제작대 버튼 (배 오른쪽)
  const cbx=sx+SHIP_W/2-50, cby=by, cbw=44, cbh=26;
  ctx.fillStyle=craftOpen?'#26c6da':'#0097a7';
  ctx.strokeStyle='#006064';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(cbx,cby,cbw,cbh,4);ctx.fill();ctx.stroke();
  ctx.font='bold 12px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';
  ctx.fillText('제작',cbx+cbw/2,cby+17);
  craftBtnBounds={x:cbx,y:cby,w:cbw,h:cbh};
  ctx.restore();
}

function drawSmallBoat() {
  const bx=SHIP_WORLD_X+SHIP_W/2+SMALL_BOAT_OFFSET,by=surfaceY();
  const{sx,sy}=ws(bx,by);
  ctx.save();
  ctx.fillStyle='#a1887f';ctx.beginPath();ctx.moveTo(sx-SMALL_W/2,sy);ctx.lineTo(sx-SMALL_W/2+8,sy+SMALL_H);ctx.lineTo(sx+SMALL_W/2-8,sy+SMALL_H);ctx.lineTo(sx+SMALL_W/2,sy);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#6d4c41';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#bcaaa4';ctx.fillRect(sx-SMALL_W/2,sy-8,SMALL_W,8);
  ctx.fillStyle='#ffcc02';ctx.fillRect(sx-14,sy-26,28,20);ctx.strokeStyle='#e65100';ctx.lineWidth=2;ctx.strokeRect(sx-14,sy-26,28,20);
  ctx.beginPath();ctx.moveTo(sx,sy-26);ctx.lineTo(sx,sy-6);ctx.moveTo(sx-14,sy-16);ctx.lineTo(sx+14,sy-16);ctx.stroke();
  ctx.font='11px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('판매',sx,sy-32);
  ctx.restore();
}

// ── HUD ─────────────────────────────────────────
function drawHUD() { drawOxygenBar(); drawSeamouseHUD(); drawInventoryHUD(); drawHarpoonCooldown(); drawCampHUD(); if(showShipMarker) drawShipMarker(); }

function drawCampHUD() {
  if (!playerData.hasCamp) return;
  if (player.y <= surfaceY()) return;
  const x = canvas.width / 2, y = canvas.height - 24;
  ctx.save();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
  if (!campObject) {
    ctx.fillStyle = 'rgba(0,220,140,0.85)';
    ctx.fillText('[ F ] 간이 캠프 설치', x, y);
  } else if (!campObject.used) {
    ctx.fillStyle = 'rgba(0,255,180,0.9)';
    ctx.fillText('캠프 설치됨 — 클릭하여 입장', x, y);
  } else {
    ctx.fillStyle = 'rgba(100,180,130,0.6)';
    ctx.fillText('캠프 사용됨 (잠수당 1회)', x, y);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawShipMarker() {
  const {sx: shipSX, sy: shipSY} = ws(SHIP_WORLD_X, surfaceY());
  const dx = SHIP_WORLD_X - player.x;
  const dy = surfaceY() - player.y;
  const dist = Math.round(Math.sqrt(dx*dx + dy*dy) / 10);
  const onScreen = shipSX >= -10 && shipSX <= canvas.width + 10 && shipSY >= -10 && shipSY <= canvas.height + 10;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;

  if (onScreen) {
    // 배가 화면 안: 배 위에 황금색 앵커 마커
    const my = Math.max(24, shipSY - 38);
    const pulse = 0.85 + Math.sin(Date.now() / 400) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'center';
    ctx.fillText('⚓ 배', shipSX, my);
    ctx.globalAlpha = 1;
    // 아래 화살표
    ctx.fillStyle = '#ffd700'; ctx.beginPath();
    ctx.moveTo(shipSX, my + 6); ctx.lineTo(shipSX - 6, my + 0); ctx.lineTo(shipSX + 6, my + 0);
    ctx.closePath(); ctx.fill();
  } else {
    // 배가 화면 밖: 화면 가장자리에 방향 표시
    const angle = Math.atan2(dy, dx);
    const margin = 60;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    // 화면 테두리와 교점 계산
    const tanA = Math.tan(angle);
    let ex, ey;
    const hw = canvas.width / 2 - margin, hh = canvas.height / 2 - margin;
    if (Math.abs(Math.cos(angle)) * hh >= Math.abs(Math.sin(angle)) * hw) {
      ex = cx + (dx > 0 ? hw : -hw);
      ey = cy + (dx > 0 ? hw : -hw) * tanA;
    } else {
      ey = cy + (dy > 0 ? hh : -hh);
      ex = cy + (dy > 0 ? hh : -hh) !== 0 ? cx + (dy > 0 ? hh : -hh) / tanA : cx;
    }
    ex = Math.max(margin, Math.min(canvas.width - margin, ex));
    ey = Math.max(margin, Math.min(canvas.height - margin, ey));

    // 배경 박스
    const label = `⚓ 배 ${dist}m`;
    ctx.font = 'bold 13px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(ex - tw/2 - 10, ey - 16, tw + 20, 26, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd700'; ctx.textAlign = 'center';
    ctx.fillText(label, ex, ey + 4);

    // 방향 화살표
    ctx.save(); ctx.translate(ex, ey - 22); ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-5, 2); ctx.lineTo(5, 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHarpoonCooldown() {
  if(harpoonCooldown<=0) return;
  const r=harpoonCooldown/effectiveCooldown();
  const cx=canvas.width/2, cy=canvas.height-40;
  ctx.save();
  ctx.strokeStyle='rgba(200,200,200,0.3)';ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(cx,cy,16,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#b0bec5';ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(cx,cy,16,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-r));ctx.stroke();
  ctx.restore();
}

function drawOxygenBar() {
  const x=20,y=20,w=200,h=20;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(x-2,y-2,w+4,h+4);
  if(infiniteOxygen){
    ctx.fillStyle='#00e5ff';ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='rgba(0,220,255,0.6)';ctx.lineWidth=2;ctx.strokeRect(x-2,y-2,w+4,h+4);
    ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='left';ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=4;
    ctx.fillText('산소: 무한 ∞',x+4,y+14);
  } else {
    const ratio=oxygenTimer/effectiveOxygen();
    ctx.fillStyle=ratio>0.5?'#4caf50':ratio>0.25?'#ffeb3b':'#f44336';
    ctx.fillRect(x,y,w*ratio,h);
    if(oxygenTimer<=0){const bl=Math.sin(graceBlinkTimer*8)>0;ctx.strokeStyle=bl?'#ff1744':'#ff8a80';ctx.lineWidth=3;ctx.strokeRect(x-2,y-2,w+4,h+4);}
    else{ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(x-2,y-2,w+4,h+4);}
    const txt=oxygenTimer>0?`산소: ${Math.ceil(oxygenTimer)}초`:`⚠ 위험! ${Math.ceil(graceTimer)}초`;
    ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='left';ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=4;ctx.fillText(txt,x+4,y+14);
  }
  ctx.restore();
}

function drawInventoryHUD() {
  const HUD=[
    {key:'anchovy',label:'멸치',color:'#cfd8dc'},
    {key:'clownfish',label:'흰동가리',color:'#ffcc80'},
    {key:'salmon',label:'연어',color:'#f48fb1'},
    {key:'tropicalfish',label:'열대어',color:'#80deea'},
    {key:'turtle',label:'거북이',color:'#a5d6a7'},
    {key:'butterflyfish',label:'나비고기',color:'#fff176'},
    {key:'tuna',  label:'참치',   color:'#7986cb'},
    {key:'shark', label:'상어',   color:'#90a4ae'},
    {key:'whale', label:'고래',   color:'#64b5f6'},
    {key:'barracuda',label:'바라쿠다',color:'#90caf9'},
    {key:'octopus',label:'문어',color:'#ce93d8'},
    {key:'moray',label:'곰치',color:'#dce775'},
    {key:'seaweed',label:'해초',color:'#81c784'},
    {key:'anemone',label:'말미잘',color:'#f48fb1'},
    {key:'jellyfish',label:'해파리',color:'#ce93d8'},
    {key:'stone',label:'돌',color:'#b0bec5'},
    {key:'iron',label:'철',color:'#eceff1'},
    {key:'gold',label:'금',color:'#ffd700'},
    {key:'aluminum',label:'알루미늄',color:'#b3e5fc'},
    {key:'sunfish',label:'개복치',color:'#ffcc80'},
    {key:'holefish',label:'구멍고기',color:'#80cbc4'},
    {key:'plesio',label:'수장룡',color:'#ce93d8'},
    {key:'ballooneel',label:'풍선입 장어',color:'#7986cb'},
    {key:'toothfish',label:'이빨고기',color:'#ef9a9a'},
  ].filter(i=>(playerData.inventory[i.key]||0)>0);

  const lineH=22,pw=240;
  const ph=16+lineH+(HUD.length>0?HUD.length*lineH+6:0)+lineH+lineH+lineH;
  const x=canvas.width-220,y=20;
  ctx.save();
  ctx.fillStyle=inventoryOpen?'rgba(10,60,120,0.8)':'rgba(0,0,0,0.45)';
  ctx.strokeStyle=inventoryOpen?'#4fc3f7':'transparent';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x-8,y-8,pw,ph,8);ctx.fill();ctx.stroke();
  ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=4;ctx.font='bold 13px sans-serif';ctx.textAlign='left';
  let oy=y+14;
  HUD.forEach(it=>{ctx.fillStyle=it.color;ctx.fillText(`${it.label}: ${playerData.inventory[it.key]||0}`,x,oy);oy+=lineH;});
  if(HUD.length>0)oy+=6;
  ctx.fillStyle='#ffe082';ctx.fillText(`코인: ${playerData.coins||0}`,x,oy);oy+=lineH;
  const btnLineY=oy;
  ctx.font='11px sans-serif';
  ctx.fillStyle=inventoryOpen?'#4fc3f7':'rgba(150,220,255,0.7)';
  ctx.fillText('[ I ] 인벤토리',x,btnLineY);
  oy+=lineH;
  ctx.fillStyle=logOpen?'#80deea':'rgba(150,220,255,0.7)';
  ctx.fillText('[ ; ] 도감',x,oy);
  ctx.restore();
  inventoryBounds={x:x-8,y:y-8,w:pw,h:ph};
}

// ── 인벤토리 패널 ─────────────────────────────────
const ALL_SPECIES=[
  {key:'anchovy',   name:'멸치',    coinValue:1,  desc:'얕은 수심 은빛 물고기',        drawFn:(x,y)=>drawAnchovyIcon(x,y)},
  {key:'clownfish', name:'흰동가리',coinValue:2,  desc:'산호 근처 주황 줄무늬 물고기', drawFn:(x,y)=>drawClownfishIcon(x,y)},
  {key:'salmon',    name:'연어',    coinValue:5,  desc:'중간 수심 분홍빛 물고기',       drawFn:(x,y)=>drawSalmonIcon(x,y)},
  {key:'tuna',      name:'참치',    coinValue:32, desc:'빠르고 강한 심청색 물고기',     drawFn:(x,y)=>drawTunaSprite(x,y,true,1,TUNA_HP,TUNA_HP,false)},
  {key:'shark',     name:'상어',    coinValue:80, desc:'삼각 등지느러미 포식자',        drawFn:(x,y)=>drawSharkSprite(x,y,true,1,SHARK_HP,SHARK_HP,false)},
  {key:'whale',     name:'고래',    coinValue:300,desc:'거대한 심청색 고래',            drawFn:(x,y)=>drawWhaleIcon(x,y)},
  {key:'tropicalfish',name:'열대어',coinValue:3,  desc:'형형색색 줄무늬 물고기',        drawFn:(x,y)=>drawTropicalfishIcon(x,y)},
  {key:'turtle',    name:'거북이',  coinValue:24, desc:'심해를 유영하는 초록 거북이',   drawFn:(x,y)=>drawTurtleIcon(x,y)},
  {key:'butterflyfish',name:'나비고기',coinValue:5,desc:'나비 같은 날개의 희귀 물고기',drawFn:(x,y)=>drawButterflyfishIcon(x,y)},
  {key:'barracuda', name:'바라쿠다',coinValue:10, desc:'동굴 포식자 날카로운 이빨',     drawFn:(x,y)=>drawBarracudaIcon(x,y)},
  {key:'octopus',   name:'문어',    coinValue:20, desc:'동굴 바닥 적자색 문어',         drawFn:(x,y)=>drawOctopusIcon(x,y)},
  {key:'moray',     name:'곰치',    coinValue:15, desc:'동굴 얼룩무늬 긴 뱀장어',       drawFn:(x,y)=>drawMorayIcon(x,y)},
  {key:'sunfish',   name:'개복치',  coinValue:32, desc:'청록빛 바다의 거대 원반 물고기', drawFn:(x,y)=>drawSunfishIcon(x,y)},
  {key:'holefish',  name:'구멍고기',coinValue:70, desc:'나비고기와 공생하는 청록 물고기',drawFn:(x,y)=>drawHolefishIcon(x,y)},
  {key:'plesio',    name:'수장룡',  coinValue:600,desc:'유연한 목을 가진 거대 해룡',     drawFn:(x,y)=>drawPlesioIcon(x,y)},
  {key:'seaweed',   name:'해초',    coinValue:1,  desc:'해저 바닥에서 흔들리는 해초',   drawFn:(x,y)=>drawSeaweedNode(x,y,false)},
  {key:'anemone',   name:'말미잘',  coinValue:2,  desc:'촉수로 먹이를 잡는 말미잘',     drawFn:(x,y)=>drawAnemoneNode(x,y,false)},
  {key:'jellyfish', name:'해파리',  coinValue:3,  desc:'청록빛 바다를 유영하는 해파리', drawFn:(x,y)=>drawJellyfishNode(x,y,false)},
  {key:'stone',     name:'돌',      coinValue:1,  desc:'광맥에서 채취한 단단한 돌',     drawFn:(x,y)=>drawOreNode(x,y,'#90a4ae','#546e7a',false)},
  {key:'iron',      name:'철',      coinValue:3,  desc:'광맥에서 채취한 철광석',        drawFn:(x,y)=>drawOreNode(x,y,'#cfd8dc','#90a4ae',false)},
  {key:'gold',      name:'금',      coinValue:10, desc:'청록빛 바다 심층의 금광석',     drawFn:(x,y)=>drawOreNode(x,y,'#ffd700','#f9a825',false)},
  {key:'aluminum',  name:'알루미늄',coinValue:5,  desc:'동굴 깊은 곳의 알루미늄 광맥', drawFn:(x,y)=>drawOreNode(x,y,'#b3e5fc','#4fc3f7',false)},
  {key:'ballooneel',name:'풍선입 장어',coinValue:30, desc:'발광하는 거대 입의 동굴 심해 장어',drawFn:(x,y)=>drawBalloonEelIcon(x,y)},
  {key:'toothfish', name:'이빨고기',  coinValue:450,desc:'고래만한 거대 이빨의 동굴 포식자', drawFn:(x,y)=>drawToothFishIcon(x,y)},
];

function drawInventory() {
  const visible=ALL_SPECIES.filter(sp=>(playerData.inventory[sp.key]||0)>0);
  const pw=Math.min(560,canvas.width-40);
  const cardH=80,cardMargin=6;
  const contentH=visible.length>0?visible.length*(cardH+cardMargin)-cardMargin:36;
  const HEADER_H=58,FOOTER_H=24;
  const visibleH=Math.min(contentH,canvas.height-140);
  const ph=Math.max(140,HEADER_H+visibleH+FOOTER_H);
  const px=Math.round(canvas.width/2-pw/2);
  const py=Math.round(canvas.height/2-ph/2);
  const maxScroll=Math.max(0,contentH-visibleH);
  inventoryScrollY=Math.max(0,Math.min(inventoryScrollY,maxScroll));

  ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.fillStyle='rgba(5,18,48,0.97)';ctx.strokeStyle='#4fc3f7';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(px,py,pw,ph,14);ctx.fill();ctx.stroke();
  ctx.font='bold 18px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='center';ctx.fillText('인벤토리',px+pw/2,py+34);
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.roundRect(px+pw-46,py+12,34,26,5);ctx.fill();
  ctx.fillStyle='#eceff1';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText('✕',px+pw-29,py+30);
  ctx.strokeStyle='rgba(79,195,247,0.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+20,py+46);ctx.lineTo(px+pw-20,py+46);ctx.stroke();

  if(visible.length===0){
    ctx.font='14px sans-serif';ctx.fillStyle='rgba(100,180,200,0.5)';ctx.textAlign='center';ctx.fillText('아직 잡은 물고기가 없습니다',px+pw/2,py+ph/2);
  } else {
    ctx.save();
    ctx.beginPath();ctx.rect(px,py+HEADER_H,pw,visibleH);ctx.clip();
    const cardY0=py+HEADER_H-inventoryScrollY;
    visible.forEach((sp,i)=>{
      const count=playerData.inventory[sp.key]||0;
      const cy=cardY0+i*(cardH+cardMargin);
      ctx.fillStyle='rgba(79,195,247,0.07)';ctx.strokeStyle='rgba(79,195,247,0.4)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(px+14,cy,pw-28,cardH,8);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(0,40,80,0.5)';ctx.beginPath();ctx.roundRect(px+22,cy+6,84,68,6);ctx.fill();
      sp.drawFn(px+64,cy+40);
      const tx=px+120;ctx.textAlign='left';
      ctx.font='bold 14px sans-serif';ctx.fillStyle='#e0f7fa';ctx.fillText(sp.name,tx,cy+20);
      ctx.font='11px sans-serif';ctx.fillStyle='#cfd8dc';ctx.fillText(sp.desc,tx,cy+36);
      ctx.font='bold 12px sans-serif';ctx.fillStyle='#fff';ctx.fillText(`보유: ${count}마리`,tx,cy+52);
      ctx.font='12px sans-serif';ctx.fillStyle='#ffe082';ctx.fillText(`${sp.coinValue}코인/마리`,tx+100,cy+52);
      ctx.fillStyle='#a5d6a7';ctx.fillText(`총 ${count*sp.coinValue}코인`,tx+190,cy+52);
    });
    ctx.restore();
    if(contentH>visibleH){
      const sbx=px+pw-8,sby=py+HEADER_H;
      const ratio=visibleH/contentH;
      const thumbH=Math.max(20,visibleH*ratio);
      const thumbY=sby+(inventoryScrollY/maxScroll)*(visibleH-thumbH);
      ctx.fillStyle='rgba(79,195,247,0.2)';ctx.beginPath();ctx.roundRect(sbx,sby,4,visibleH,2);ctx.fill();
      ctx.fillStyle='rgba(79,195,247,0.6)';ctx.beginPath();ctx.roundRect(sbx,thumbY,4,thumbH,2);ctx.fill();
    }
  }
  ctx.font='11px sans-serif';ctx.fillStyle='rgba(100,180,200,0.5)';ctx.textAlign='center';ctx.fillText('[ I ] 또는 클릭으로 닫기',px+pw/2,py+ph-10);
  ctx.restore();
}

// ── 인벤토리 아이콘 ───────────────────────────────
function drawAnchovyIcon(sx,sy){
  const W=ANCHOVY_W,H=ANCHOVY_H;ctx.save();
  ctx.fillStyle='#a0a0a0';ctx.strokeStyle='#777';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx-W/2+2,sy);ctx.lineTo(sx-W/2-9,sy-7);ctx.lineTo(sx-W/2-9,sy+7);ctx.closePath();ctx.fill();
  ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,W/2,H/2,0,0,Math.PI*2);ctx.clip();
  const g=ctx.createLinearGradient(sx,sy-H/2,sx,sy+H/2);g.addColorStop(0,'#dde');g.addColorStop(0.4,'#c8c8d0');g.addColorStop(1,'#909090');
  ctx.fillStyle=g;ctx.fillRect(sx-W/2,sy-H/2,W,H);ctx.restore();
  ctx.strokeStyle='#888';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(sx,sy,W/2,H/2,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+W/2-5,sy-1,3.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(sx+W/2-4.5,sy-1,2,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawClownfishIcon(sx,sy){drawClownfishSprite(sx,sy,true,1);}
function drawSalmonIcon(sx,sy){drawSalmonSprite(sx,sy,true,1,SALMON_HP,SALMON_HP,false);}
function drawTropicalfishIcon(sx,sy){drawTropicalFishSprite(sx,sy,true,1,TROPICALFISH_HP,TROPICALFISH_HP,false);}
function drawTurtleIcon(sx,sy){drawTurtleSprite(sx,sy,true,1,TURTLE_HP,TURTLE_HP,false);}
function drawButterflyfishIcon(sx,sy){drawButterflyFishSprite(sx,sy,true,1,BUTTERFLYFISH_HP,BUTTERFLYFISH_HP,false,false);}
function drawBarracudaIcon(sx,sy){drawBarracudaSprite(sx,sy,true,1,BARRACUDA_HP,BARRACUDA_HP,false);}
function drawOctopusIcon(sx,sy){drawOctopusSprite(sx,sy,true,1,OCTOPUS_HP,OCTOPUS_HP,false);}
function drawMorayIcon(sx,sy){drawMoraySprite(sx,sy,true,1,MORAY_HP,MORAY_HP,false);}
function drawSunfishIcon(sx,sy){drawSunfishSprite(sx,sy,true,1,SUNFISH_HP,SUNFISH_HP,false);}
function drawHolefishIcon(sx,sy){
  ctx.save();ctx.translate(sx,sy);ctx.scale(0.1,0.1);
  drawHolefishSprite(0,0,true,1,HOLEFISH_HP,HOLEFISH_HP,false);
  ctx.restore();
}
function drawPlesioIcon(sx,sy){
  ctx.save();ctx.translate(sx-20,sy);ctx.scale(0.10,0.10);
  drawPlesioSprite({vx:1,trail:Array(30).fill({x:0,y:0})},0,0,1,PLESIO_HP,PLESIO_HP,false);
  ctx.restore();
}
function drawWhaleIcon(sx,sy){
  ctx.save();ctx.translate(sx,sy);ctx.scale(0.15,0.15);
  drawWhaleSprite(0,0,true,1,WHALE_HP,WHALE_HP,false);
  ctx.restore();
}
function drawBalloonEelIcon(sx,sy) {
  ctx.save();
  // 몸통
  const g=ctx.createLinearGradient(sx-22,sy,sx+22,sy);
  g.addColorStop(0,'#1a237e');g.addColorStop(1,'#3949ab');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(sx-8,sy,20,6,0,0,Math.PI*2);ctx.fill();
  // 발광점
  ctx.fillStyle='rgba(0,229,255,0.6)';
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(sx-18+i*8,sy,2,0,Math.PI*2);ctx.fill();}
  // 풍선 입
  const mg=ctx.createRadialGradient(sx+14,sy,0,sx+14,sy,16);
  mg.addColorStop(0,'#4a148c');mg.addColorStop(1,'#0d0050');
  ctx.fillStyle=mg;ctx.beginPath();ctx.arc(sx+14,sy,16,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#060008';ctx.beginPath();ctx.arc(sx+17,sy,8,0,Math.PI*2);ctx.fill();
  // 눈
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx+7,sy-6,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.arc(sx+8,sy-6,2.5,0,Math.PI*2);ctx.fill();
  // 꼬리
  ctx.fillStyle='#3949ab';ctx.beginPath();ctx.moveTo(sx-28,sy);ctx.lineTo(sx-36,sy-8);ctx.lineTo(sx-38,sy);ctx.lineTo(sx-36,sy+8);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawToothFishIcon(sx,sy) {
  ctx.save();ctx.translate(sx,sy);ctx.scale(0.17,0.17);
  const W=200,H=80;
  // 몸통
  const g=ctx.createLinearGradient(0,-H,0,H);
  g.addColorStop(0,'#37474f');g.addColorStop(1,'#1a2326');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(-10,-4,W*0.87,H*0.78,0,0,Math.PI*2);ctx.fill();
  // 꼬리
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.moveTo(-W*0.88,0);ctx.lineTo(-(W+48),-H*0.66);ctx.lineTo(-(W+26),0);ctx.lineTo(-(W+48),H*0.66);ctx.closePath();ctx.fill();
  // 머리
  const hg=ctx.createRadialGradient(W*0.8-30,0,3,W*0.8,0,H);
  hg.addColorStop(0,'#455a64');hg.addColorStop(1,'#263238');
  ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(W*0.8,0,H*0.74,H*0.88,0,0,Math.PI*2);ctx.fill();
  // 입
  ctx.fillStyle='#070d0e';ctx.beginPath();ctx.moveTo(W*0.8+H*0.72,0);ctx.lineTo(W*0.8+H*0.18,-H*0.74);ctx.lineTo(W*0.8-H*0.42,-H*0.56);ctx.lineTo(W*0.8-H*0.32,H*0.56);ctx.lineTo(W*0.8+H*0.18,H*0.74);ctx.closePath();ctx.fill();
  // 이빨
  ctx.fillStyle='#f5f5f5';
  for(let i=0;i<4;i++){const tx=W*0.8-H*0.35+i*H*0.22;ctx.beginPath();ctx.moveTo(tx,-H*0.55);ctx.lineTo(tx+H*0.08,-H*0.25);ctx.lineTo(tx+H*0.16,-H*0.55);ctx.closePath();ctx.fill();}
  for(let i=0;i<3;i++){const tx=W*0.8-H*0.28+i*H*0.22;ctx.beginPath();ctx.moveTo(tx,H*0.55);ctx.lineTo(tx+H*0.08,H*0.25);ctx.lineTo(tx+H*0.16,H*0.55);ctx.closePath();ctx.fill();}
  // 눈
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(W*0.58,-H*0.42,H*0.26,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b71c1c';ctx.beginPath();ctx.arc(W*0.58,-H*0.42,H*0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.arc(W*0.59,-H*0.42,H*0.11,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

// ── 판매 UI ──────────────────────────────────────
function buildSellRows() {
  const defs=[
    {label:'멸치 ×1코인',      inv:'anchovy',       key:'amount',              col:'#b3e5fc'},
    {label:'흰동가리 ×2코인',  inv:'clownfish',     key:'clownfishAmount',     col:'#ffcc80'},
    {label:'연어 ×5코인',      inv:'salmon',        key:'salmonAmount',        col:'#f48fb1'},
    {label:'열대어 ×3코인',    inv:'tropicalfish',  key:'tropicalfishAmount',  col:'#80deea'},
    {label:'거북이 ×24코인',   inv:'turtle',        key:'turtleAmount',        col:'#a5d6a7'},
    {label:'나비고기 ×5코인',  inv:'butterflyfish', key:'butterflyfishAmount', col:'#fff176'},
    {label:'참치 ×32코인',     inv:'tuna',          key:'tunaAmount',          col:'#7986cb'},
    {label:'상어 ×80코인',     inv:'shark',         key:'sharkAmount',         col:'#90a4ae'},
    {label:'고래 ×300코인',    inv:'whale',         key:'whaleAmount',         col:'#64b5f6'},
    {label:'바라쿠다 ×10코인', inv:'barracuda',     key:'barracudaAmount',     col:'#90caf9'},
    {label:'문어 ×20코인',     inv:'octopus',       key:'octopusAmount',       col:'#ce93d8'},
    {label:'곰치 ×15코인',     inv:'moray',         key:'morayAmount',         col:'#dce775'},
    {label:'해초 ×1코인',     inv:'seaweed',       key:'seaweedAmount',       col:'#81c784'},
    {label:'말미잘 ×2코인',   inv:'anemone',       key:'anemoneAmount',       col:'#f48fb1'},
    {label:'해파리 ×3코인',   inv:'jellyfish',     key:'jellyfishAmount',     col:'#ce93d8'},
    {label:'돌 ×1코인',       inv:'stone',         key:'stoneAmount',         col:'#b0bec5'},
    {label:'철 ×3코인',       inv:'iron',          key:'ironAmount',          col:'#eceff1'},
    {label:'금 ×10코인',      inv:'gold',          key:'goldAmount',          col:'#ffd700'},
    {label:'알루미늄 ×5코인', inv:'aluminum',      key:'aluminumAmount',      col:'#b3e5fc'},
    {label:'개복치 ×18코인',  inv:'sunfish',       key:'sunfishAmount',       col:'#aaf0d1'},
    {label:'구멍고기 ×10코인',inv:'holefish',      key:'holefishAmount',      col:'#00e5ff'},
    {label:'수장룡 ×200코인', inv:'plesio',        key:'plesioAmount',        col:'#7c4dff'},
    {label:'풍선입 장어 ×30코인',inv:'ballooneel', key:'balloneelAmount',     col:'#7986cb'},
    {label:'이빨고기 ×150코인',inv:'toothfish',    key:'toothfishAmount',     col:'#ef9a9a'},
  ].filter(r=>(playerData.inventory[r.inv]||0)>0);
  const sellTotal=Object.values(sellUI).filter((v,i)=>typeof v==='number'&&i>0&&i<10).reduce((a,b)=>a+b,0);
  const total=['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','tunaAmount','sharkAmount','whaleAmount','barracudaAmount','octopusAmount','morayAmount','seaweedAmount','anemoneAmount','jellyfishAmount','stoneAmount','ironAmount','goldAmount','aluminumAmount','sunfishAmount','holefishAmount','plesioAmount','balloneelAmount','toothfishAmount'].reduce((s,k)=>s+(sellUI[k]||0),0);
  return defs.map(r=>{
    const count=playerData.inventory[r.inv]||0;
    const amt=sellUI[r.key]||0;
    const max=Math.min(10-(total-amt),count);
    return{...r,count,amt,max,ok:max>0&&!sellUI.delivering};
  });
}


function onSellUIClick(e) {
  const rect=canvas.getBoundingClientRect();
  const cx=e.clientX-rect.left,cy=e.clientY-rect.top;

  // 도감 열림 → 도감만 처리
  if(logOpen){
    if(logBounds){
      const{px,py,pw,ph}=logBounds;
      if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){
        logOpen=false;
        const se=document.getElementById('log-search');se.style.display='none';se.value='';logSearchText='';
        return;
      }
      if(!(cx>=px&&cx<=px+pw&&cy>=py&&cy<=py+ph)){
        logOpen=false;
        const se=document.getElementById('log-search');se.style.display='none';se.value='';logSearchText='';
      }
    }
    return;
  }

  // 판매 패널 열림 → 판매 패널만 처리
  if(sellPanelOpen){
    if(sellPanelBounds){
      const{px,py,pw,ph,btnY,rowsMeta,HEADER_H,visibleH}=sellPanelBounds;
      if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){sellPanelOpen=false;return;}
      if(!(cx>=px&&cx<=px+pw&&cy>=py&&cy<=py+ph)){sellPanelOpen=false;return;}
      const KEYS=['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','tunaAmount','sharkAmount','whaleAmount','barracudaAmount','octopusAmount','morayAmount','seaweedAmount','anemoneAmount','jellyfishAmount','stoneAmount','ironAmount','goldAmount','aluminumAmount','sunfishAmount','holefishAmount','plesioAmount','balloneelAmount','toothfishAmount'];
      const total=KEYS.reduce((s,k)=>s+(sellUI[k]||0),0);
      if(cy>=py+HEADER_H&&cy<=py+HEADER_H+(visibleH||0)){
        (rowsMeta||[]).forEach(row=>{
          const bx2=px+pw-110;
          if(cy>=row.ry+12&&cy<=row.ry+34){
            const mx=Math.min(10-(total-sellUI[row.key]),playerData.inventory[row.inv]||0);
            if(cx>=bx2+22&&cx<=bx2+48){if(sellUI[row.key]<mx&&total<10)sellUI[row.key]++;}
            else if(cx>=bx2+50&&cx<=bx2+76){if(sellUI[row.key]>0)sellUI[row.key]--;}
          }
        });
      }
      if(cx>=px+14&&cx<=px+pw-14&&cy>=btnY&&cy<=btnY+36&&!sellUI.delivering){
        const t=KEYS.reduce((s,k)=>s+(sellUI[k]||0),0); if(t>0) doSell();
      }
    }
    return;
  }

  // 인벤토리 열림 → 인벤토리만 처리
  if(inventoryOpen){
    const pw=Math.min(560,canvas.width-40);
    const visible=ALL_SPECIES.filter(sp=>(playerData.inventory[sp.key]||0)>0);
    const cardH=80,cardMargin=6;
    const contentH=visible.length>0?visible.length*(cardH+cardMargin)-cardMargin:36;
    const HEADER_H=58,FOOTER_H=24;
    const visibleH=Math.min(contentH,canvas.height-140);
    const ph=Math.max(140,HEADER_H+visibleH+FOOTER_H);
    const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
    if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){inventoryOpen=false;return;}
    if(!(cx>=px&&cx<=px+pw&&cy>=py&&cy<=py+ph)) inventoryOpen=false;
    return;
  }

  // 판매 프롬프트 버튼 클릭 → 판매 패널 열기
  if(sellUI.visible && sellPromptBounds){
    const{x,y,w,h}=sellPromptBounds;
    if(cx>=x&&cx<=x+w&&cy>=y&&cy<=y+h){
      sellPanelOpen=true; sellScrollY=0; return;
    }
  }
}

async function doSell() {
  const amts={
    anchovy:sellUI.amount, clownfish:sellUI.clownfishAmount, salmon:sellUI.salmonAmount,
    tropicalfish:sellUI.tropicalfishAmount, turtle:sellUI.turtleAmount,
    butterflyfish:sellUI.butterflyfishAmount, barracuda:sellUI.barracudaAmount,
    octopus:sellUI.octopusAmount, moray:sellUI.morayAmount,
    tuna:sellUI.tunaAmount, shark:sellUI.sharkAmount, whale:sellUI.whaleAmount,
    seaweed:sellUI.seaweedAmount, anemone:sellUI.anemoneAmount, jellyfish:sellUI.jellyfishAmount,
    stone:sellUI.stoneAmount, iron:sellUI.ironAmount, gold:sellUI.goldAmount, aluminum:sellUI.aluminumAmount,
    sunfish:sellUI.sunfishAmount, holefish:sellUI.holefishAmount, plesio:sellUI.plesioAmount,
    ballooneel:sellUI.balloneelAmount, toothfish:sellUI.toothfishAmount,
  };
  const total=Object.values(amts).reduce((s,v)=>s+v,0);
  if(total<=0)return;
  for(const[k,v]of Object.entries(amts)){if(v>(playerData.inventory[k]||0))return;}
  for(const[k,v]of Object.entries(amts)) playerData.inventory[k]=(playerData.inventory[k]||0)-v;
  await savePlayerData();
  let data;
  try {
    const res=await fetch('/api/sell',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nickname,...Object.fromEntries(Object.entries(amts).map(([k,v])=>[k+'Amount',v]))})});
    data=await res.json();
    if(!res.ok)throw new Error(data.error||'sell failed');
  } catch(err) {
    for(const[k,v]of Object.entries(amts)) playerData.inventory[k]=(playerData.inventory[k]||0)+v;
    await savePlayerData();return;
  }
  if(data.newCoins!==undefined)playerData.coins=data.newCoins;
  sellUI.delivering=true;sellUI.countdown=data.deliverySeconds||60;
  ['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','tunaAmount','sharkAmount','whaleAmount','barracudaAmount','octopusAmount','morayAmount','seaweedAmount','anemoneAmount','jellyfishAmount','stoneAmount','ironAmount','goldAmount','aluminumAmount','sunfishAmount','holefishAmount','plesioAmount','balloneelAmount','toothfishAmount'].forEach(k=>sellUI[k]=0);
}

function drawFadeOverlay() {
  if(fadeOpacity<=0)return;
  ctx.save();ctx.fillStyle=`rgba(0,0,0,${fadeOpacity})`;ctx.fillRect(0,0,canvas.width,canvas.height);
  if(gameOverState==='falling'&&fadeOpacity>0.5){ctx.font='bold 36px sans-serif';ctx.fillStyle=`rgba(255,100,100,${(fadeOpacity-0.5)*2})`;ctx.textAlign='center';ctx.fillText('익사...',canvas.width/2,canvas.height/2);}
  ctx.restore();
}

// ── 치트 명령어 ──────────────────────────────────
const FISH_NAME_MAP={
  '멸치':'anchovy','흰동가리':'clownfish','연어':'salmon','열대어':'tropicalfish',
  '거북이':'turtle','나비고기':'butterflyfish','바라쿠다':'barracuda','문어':'octopus','곰치':'moray',
  '참치':'tuna','상어':'shark','고래':'whale',
  '개복치':'sunfish','구멍고기':'holefish','수장룡':'plesio'
};

function isCommand(text) {
  if(!text) return false;
  return text.startsWith('스폰 ')||text.startsWith('돈 ')||text==='무한';
}

function processCommand(text) {
  if(!text) return;
  if(text.startsWith('스폰 ')) {
    const name=text.slice(3).trim();
    const key=FISH_NAME_MAP[name];
    if(key) forceSpawnFish(key);
    return;
  }
  if(text.startsWith('돈 ')) {
    const amount=parseInt(text.slice(2).trim());
    if(!isNaN(amount)&&amount>0){playerData.coins+=amount;savePlayerData();}
    return;
  }
  if(text==='무한'){infiniteOxygen=!infiniteOxygen;return;}
}

function forceSpawnFish(key) {
  const x=player.x+80+(Math.random()-0.5)*100;
  const y=player.y+(Math.random()-0.5)*80;
  switch(key){
    case 'anchovy':     anchovies.push(mkFish({id:anchovyIdCounter++,hp:ANCHOVY_HP,collectDur:0.4,x,y,vx:ANCHOVY_SPEED,vy:0})); break;
    case 'clownfish':   clownfishes.push(mkFish({id:clownfishIdCounter++,hp:CLOWNFISH_HP,collectDur:0.5,x,y,vx:CLOWNFISH_SPEED,vy:0})); break;
    case 'salmon':      salmons.push(mkFish({id:salmonIdCounter++,hp:SALMON_HP,collectDur:0.55,x,y,vx:SALMON_SPEED,vy:0})); break;
    case 'tropicalfish':tropicalfishes.push(mkFish({id:tropicalfishIdCounter++,hp:TROPICALFISH_HP,collectDur:0.45,x,y,vx:TROPICALFISH_SPEED,vy:0})); break;
    case 'turtle':      turtles.push(mkFish({id:turtleIdCounter++,hp:TURTLE_HP,collectDur:0.8,x,y,vx:TURTLE_SPEED,vy:0})); break;
    case 'butterflyfish':butterflyfishes.push(mkFish({id:butterflyfishIdCounter++,hp:BUTTERFLYFISH_HP,collectDur:0.45,x,y,vx:BUTTERFLYFISH_SPEED,vy:0,touchCooldown:0})); break;
    case 'barracuda':   barracudas.push(mkFish({id:barracudaIdCounter++,hp:BARRACUDA_HP,collectDur:0.5,x,y,vx:BARRACUDA_SPEED,vy:0})); break;
    case 'octopus':     octopuses.push(mkFish({id:octopusIdCounter++,hp:OCTOPUS_HP,collectDur:0.7,x,y,vx:OCTOPUS_SPEED,vy:0})); break;
    case 'moray':       morays.push(mkFish({id:morayIdCounter++,hp:MORAY_HP,collectDur:0.55,x,y,vx:MORAY_SPEED,vy:0})); break;
    case 'tuna':        tunas.push(mkFish({id:tunaIdCounter++,hp:TUNA_HP,collectDur:0.5,x,y,vx:TUNA_SPEED,vy:0})); break;
    case 'shark':       sharks.push(mkFish({id:sharkIdCounter++,hp:SHARK_HP,collectDur:0.7,x,y,vx:SHARK_SPEED,vy:0})); break;
    case 'whale':       whales.push(mkFish({id:whaleIdCounter++,hp:WHALE_HP,collectDur:1.2,x,y,vx:WHALE_SPEED,vy:0})); break;
    case 'sunfish':     sunfishes.push(mkFish({id:sunfishIdCounter++,hp:SUNFISH_HP,collectDur:0.9,x,y,vx:SUNFISH_SPEED,vy:0})); break;
    case 'holefish':    holefishes.push(mkFish({id:holefishIdCounter++,hp:HOLEFISH_HP,collectDur:0.5,x,y,vx:HOLEFISH_SPEED,vy:0})); break;
    case 'plesio':      plesios.push({...mkFish({id:plesioIdCounter++,hp:PLESIO_HP,collectDur:2.5,x,y,vx:PLESIO_SPEED,vy:0}),trail:Array.from({length:30},()=>({x,y}))}); break;
  }
}

// ── 도감 데이터 ──────────────────────────────────
const FISH_CATALOG=[
  { region:'얕은 바다',   keys:['anchovy','clownfish','tuna','shark','whale'] },
  { region:'중간 수심',   keys:['salmon'] },
  { region:'동굴',        keys:['barracuda','octopus','moray','ballooneel','toothfish'] },
  { region:'청록빛 바다', keys:['tropicalfish','butterflyfish','turtle','sunfish','holefish','plesio'] },
];
const FISH_DATA={
  anchovy:      {name:'멸치',    hp:20,  trait:'무리 지어 유영하며 해초를 먹는다',           habitat:'일반 바다 전역',      coinValue:1,  drawFn:(x,y)=>drawAnchovyIcon(x,y)},
  clownfish:    {name:'흰동가리',hp:20,  trait:'산호초 근처를 맴돌며 말미잘과 공생한다',     habitat:'일반 바다 전역',      coinValue:2,  drawFn:(x,y)=>drawClownfishIcon(x,y)},
  tuna:         {name:'참치',    hp:160, trait:'5초 주기로 배가 고파지며 먹잇감을 추격한다', habitat:'일반 바다 전역',      coinValue:32, drawFn:(x,y)=>drawTunaSprite(x,y,true,1,TUNA_HP,TUNA_HP,false)},
  shark:        {name:'상어',    hp:300, trait:'날카로운 이빨의 최상위 포식자',              habitat:'일반 바다 전역',      coinValue:80, drawFn:(x,y)=>drawSharkSprite(x,y,true,1,SHARK_HP,SHARK_HP,false)},
  whale:        {name:'고래',    hp:1000,trait:'거대한 몸집으로 천천히 유영한다',            habitat:'일반 바다 전역',      coinValue:300,drawFn:(x,y)=>drawWhaleIcon(x,y)},
  salmon:       {name:'연어',    hp:40,  trait:'중간 수심 600~1600m를 빠르게 유영한다',     habitat:'중간 수심 600~1600m', coinValue:5,  drawFn:(x,y)=>drawSalmonIcon(x,y)},
  barracuda:    {name:'바라쿠다',hp:100, trait:'동굴에서만 서식하며 매우 빠르다',            habitat:'해저 동굴',           coinValue:10, drawFn:(x,y)=>drawBarracudaIcon(x,y)},
  octopus:      {name:'문어',    hp:150, trait:'동굴 바닥을 기어다닌다',                    habitat:'동굴 깊은 곳',        coinValue:20, drawFn:(x,y)=>drawOctopusIcon(x,y)},
  moray:        {name:'곰치',    hp:80,  trait:'날카로운 이빨로 굴 속에 몸을 숨긴다',       habitat:'동굴 암석 사이',      coinValue:15, drawFn:(x,y)=>drawMorayIcon(x,y)},
  ballooneel:   {name:'풍선입 장어',hp:250,trait:'생체발광 점이 있는 심해 거대 장어',       habitat:'해저 동굴 심층',      coinValue:30, drawFn:(x,y)=>drawBalloonEelIcon(x,y)},
  toothfish:    {name:'이빨고기',hp:900, trait:'고래만한 몸집의 최강 동굴 포식자',          habitat:'해저 동굴 심층',      coinValue:450,drawFn:(x,y)=>drawToothFishIcon(x,y)},
  tropicalfish: {name:'열대어',  hp:30,  trait:'무리 지어 유영하며 나비고기의 먹이가 된다', habitat:'청록빛 바다 전역',    coinValue:3,  drawFn:(x,y)=>drawTropicalfishIcon(x,y)},
  butterflyfish:{name:'나비고기',hp:30,  trait:'열대어를 사냥하며 자극 시 산소를 빼앗는다', habitat:'청록빛 바다 전역',    coinValue:5,  drawFn:(x,y)=>drawButterflyfishIcon(x,y)},
  turtle:       {name:'거북이',  hp:200, trait:'해파리를 먹으며 단단한 껍질로 높은 맷집',   habitat:'청록빛 바다 전역',    coinValue:24, drawFn:(x,y)=>drawTurtleIcon(x,y)},
  sunfish:      {name:'개복치',  hp:200, trait:'거대한 원반 몸통으로 천천히 유영한다',      habitat:'청록빛 바다 전역',    coinValue:32, drawFn:(x,y)=>drawSunfishIcon(x,y)},
  holefish:     {name:'구멍고기',hp:50,  trait:'나비고기의 곁을 좋아하며 함께 추격한다',   habitat:'청록빛 바다 전역',    coinValue:70, drawFn:(x,y)=>drawHolefishIcon(x,y)},
  plesio:       {name:'수장룡',  hp:800, trait:'유연한 목으로 먹잇감을 낚아챈다',           habitat:'청록빛 바다 심층',    coinValue:600,drawFn:(x,y)=>drawPlesioIcon(x,y)},
};

function positionLogSearch() {
  const searchEl=document.getElementById('log-search');
  if(!logOpen){searchEl.style.display='none';return;}
  const pw=Math.min(620,canvas.width-40);
  const px=Math.round(canvas.width/2-pw/2);
  const HEADER_H=88;
  const cardH=76,cardM=4,secM=8;
  let totalH=0;
  FISH_CATALOG.forEach(sec=>{totalH+=20+secM+sec.keys.length*(cardH+cardM);});
  const visibleH=Math.min(totalH,canvas.height-120);
  const ph=HEADER_H+visibleH+24;
  const py=Math.round(canvas.height/2-ph/2);
  const rect=canvas.getBoundingClientRect();
  searchEl.style.left=(rect.left+px+14)+'px';
  searchEl.style.top=(rect.top+py+46)+'px';
  searchEl.style.width=(pw-80)+'px';
  searchEl.style.display='block';
}

function drawLog() {
  const pw=Math.min(620,canvas.width-40);
  const px=Math.round(canvas.width/2-pw/2);
  const HEADER_H=88, FOOTER_H=24;
  const cardH=76, cardM=4, secM=8;

  // 검색 필터 적용
  const filteredCatalog=FISH_CATALOG.map(sec=>({
    region:sec.region,
    keys:sec.keys.filter(key=>{
      if(!logSearchText) return true;
      const d=FISH_DATA[key];
      return d.name.includes(logSearchText)||key.toLowerCase().includes(logSearchText.toLowerCase());
    })
  })).filter(sec=>sec.keys.length>0);

  let totalH=0;
  filteredCatalog.forEach(sec=>{totalH+=20+secM+sec.keys.length*(cardH+cardM);});
  const contentH=Math.max(totalH,1);
  const visibleH=Math.min(contentH,canvas.height-120);
  const ph=HEADER_H+visibleH+FOOTER_H;
  const py=Math.round(canvas.height/2-ph/2);

  const maxScroll=Math.max(0,contentH-visibleH);
  logScrollY=Math.max(0,Math.min(logScrollY,maxScroll));

  positionLogSearch();

  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.fillStyle='rgba(5,18,48,0.97)';ctx.strokeStyle='#4fc3f7';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(px,py,pw,ph,14);ctx.fill();ctx.stroke();

  ctx.font='bold 18px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='center';
  ctx.fillText('도감',px+pw/2,py+30);
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.roundRect(px+pw-46,py+12,34,26,5);ctx.fill();
  ctx.fillStyle='#eceff1';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
  ctx.fillText('✕',px+pw-29,py+30);

  // 검색창 배경 (HTML input이 위에 올려짐)
  ctx.fillStyle='rgba(0,20,50,0.9)';ctx.strokeStyle='rgba(79,195,247,0.5)';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(px+14,py+44,pw-28-46,28,5);ctx.fill();ctx.stroke();
  ctx.font='13px sans-serif';ctx.fillStyle='rgba(100,180,200,0.5)';ctx.textAlign='left';
  if(!logSearchText) ctx.fillText('물고기 검색...',px+22,py+63);

  ctx.strokeStyle='rgba(79,195,247,0.25)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(px+20,py+HEADER_H-6);ctx.lineTo(px+pw-20,py+HEADER_H-6);ctx.stroke();

  // 스크롤 클립
  ctx.save();
  ctx.beginPath();ctx.rect(px,py+HEADER_H,pw,visibleH);ctx.clip();

  let oy=py+HEADER_H-logScrollY;
  filteredCatalog.forEach(section=>{
    ctx.font='bold 12px sans-serif';ctx.fillStyle='#4dd0e1';ctx.textAlign='left';
    ctx.fillText('━ '+section.region,px+18,oy+14);
    oy+=20+secM;
    section.keys.forEach(key=>{
      const data=FISH_DATA[key];
      const caught=playerData.fishLog[key]||0;
      const cy=oy;
      ctx.fillStyle=caught>0?'rgba(79,195,247,0.07)':'rgba(40,40,40,0.5)';
      ctx.strokeStyle=caught>0?'rgba(79,195,247,0.35)':'rgba(80,80,80,0.3)';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(px+14,cy,pw-28,cardH,7);ctx.fill();ctx.stroke();

      ctx.fillStyle=caught>0?'rgba(0,40,80,0.55)':'rgba(15,15,15,0.6)';
      ctx.beginPath();ctx.roundRect(px+20,cy+5,74,cardH-10,5);ctx.fill();

      if(caught>0){
        data.drawFn(px+57,cy+cardH/2);
      } else {
        ctx.font='bold 22px sans-serif';ctx.fillStyle='#37474f';ctx.textAlign='center';
        ctx.fillText('?',px+57,cy+cardH/2+8);
      }

      const tx=px+104;ctx.textAlign='left';
      if(caught>0){
        ctx.font='bold 13px sans-serif';ctx.fillStyle='#e0f7fa';ctx.fillText(data.name,tx,cy+16);
        ctx.font='9.5px sans-serif';ctx.fillStyle='#80cbc4';
        ctx.fillText('HP: '+data.hp+'  서식지: '+data.habitat,tx,cy+30);
        ctx.fillStyle='#90a4ae';ctx.fillText('특이점: '+data.trait,tx,cy+43);
        ctx.font='bold 11px sans-serif';ctx.fillStyle='#ffe082';
        ctx.fillText(data.coinValue+'코인/마리',tx,cy+58);
        ctx.fillStyle='#a5d6a7';
        ctx.fillText('총 '+caught+'마리 포획',tx+90,cy+58);
      } else {
        ctx.font='bold 13px sans-serif';ctx.fillStyle='#455a64';ctx.fillText('???',tx,cy+16);
        ctx.font='9.5px sans-serif';ctx.fillStyle='#37474f';ctx.fillText('아직 발견하지 못한 생물',tx,cy+30);
      }
      oy+=cardH+cardM;
    });
  });

  ctx.restore();

  // 스크롤바
  if(contentH>visibleH){
    const sbx=px+pw-8,sby=py+HEADER_H;
    const ratio=visibleH/contentH;
    const thumbH=Math.max(20,visibleH*ratio);
    const thumbY=sby+(logScrollY/maxScroll)*(visibleH-thumbH);
    ctx.fillStyle='rgba(79,195,247,0.2)';ctx.beginPath();ctx.roundRect(sbx,sby,4,visibleH,2);ctx.fill();
    ctx.fillStyle='rgba(79,195,247,0.6)';ctx.beginPath();ctx.roundRect(sbx,thumbY,4,thumbH,2);ctx.fill();
  }

  ctx.font='11px sans-serif';ctx.fillStyle='rgba(100,180,200,0.5)';ctx.textAlign='center';
  ctx.fillText('[ J ] 또는 ✕ 로 닫기  |  스크롤로 탐색',px+pw/2,py+ph-8);
  ctx.restore();
  logBounds={px,py,pw,ph};
}

// ── 판매 프롬프트 (보트 근처 힌트) ─────────────────
function drawSellPrompt() {
  const bx=SHIP_WORLD_X+SHIP_W/2+SMALL_BOAT_OFFSET;
  const {sx,sy}=ws(bx,surfaceY()-55);
  ctx.save();
  ctx.fillStyle='rgba(10,30,70,0.88)';ctx.strokeStyle='#4fc3f7';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(sx-48,sy-14,96,24,5);ctx.fill();ctx.stroke();
  ctx.font='bold 11px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='center';
  ctx.fillText('클릭하여 판매',sx,sy+2);
  ctx.restore();
  sellPromptBounds={x:sx-48,y:sy-14,w:96,h:24};
}

// ── 판매 패널 (모달) ─────────────────────────────
function drawSellPanel() {
  const rows=buildSellRows();
  const cardH=52,cardM=4;
  const pw=Math.min(480,canvas.width-40);
  const HEADER_H=58,FOOTER_H=80;
  const contentH=rows.length>0?rows.length*(cardH+cardM):34;
  const maxVisibleH=canvas.height-80-HEADER_H-FOOTER_H;
  const visibleH=Math.min(contentH,maxVisibleH);
  const ph=HEADER_H+visibleH+FOOTER_H;
  const maxScroll=Math.max(0,contentH-visibleH);
  sellScrollY=Math.max(0,Math.min(sellScrollY,maxScroll));
  const px=Math.round(canvas.width/2-pw/2);
  const py=Math.round(canvas.height/2-ph/2);

  const KEYS=['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','tunaAmount','sharkAmount','whaleAmount','barracudaAmount','octopusAmount','morayAmount','seaweedAmount','anemoneAmount','jellyfishAmount','stoneAmount','ironAmount','goldAmount','aluminumAmount','sunfishAmount','holefishAmount','plesioAmount','balloneelAmount','toothfishAmount'];
  const total=KEYS.reduce((s,k)=>s+(sellUI[k]||0),0);
  const coinDefs={amount:1,clownfishAmount:2,salmonAmount:5,tropicalfishAmount:3,turtleAmount:24,butterflyfishAmount:5,tunaAmount:32,sharkAmount:80,whaleAmount:300,barracudaAmount:10,octopusAmount:20,morayAmount:15,seaweedAmount:1,anemoneAmount:2,jellyfishAmount:3,stoneAmount:1,ironAmount:3,goldAmount:10,aluminumAmount:5,sunfishAmount:32,holefishAmount:70,plesioAmount:600,balloneelAmount:30,toothfishAmount:450};
  const totalCoins=Object.entries(coinDefs).reduce((s,[k,v])=>s+(sellUI[k]||0)*v,0);
  const canSell=!sellUI.delivering&&total>0;

  ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.fillStyle='rgba(5,18,48,0.97)';ctx.strokeStyle='#4fc3f7';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(px,py,pw,ph,14);ctx.fill();ctx.stroke();
  ctx.font='bold 18px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='center';
  ctx.fillText('판매',px+pw/2,py+30);
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.roundRect(px+pw-46,py+12,34,26,5);ctx.fill();
  ctx.fillStyle='#eceff1';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
  ctx.fillText('✕',px+pw-29,py+30);
  ctx.strokeStyle='rgba(79,195,247,0.25)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(px+20,py+HEADER_H-6);ctx.lineTo(px+pw-20,py+HEADER_H-6);ctx.stroke();

  const rowsMeta=[];
  if(rows.length===0){
    ctx.font='13px sans-serif';ctx.fillStyle='rgba(100,180,200,0.5)';ctx.textAlign='center';
    ctx.fillText('판매할 물고기가 없습니다',px+pw/2,py+HEADER_H+26);
  } else {
    ctx.save();
    ctx.beginPath();ctx.rect(px,py+HEADER_H,pw,visibleH);ctx.clip();
    const cardY0=py+HEADER_H-sellScrollY;
    rows.forEach((row,i)=>{
      const ry=cardY0+i*(cardH+cardM);
      rowsMeta.push({...row,ry});
      ctx.fillStyle='rgba(79,195,247,0.05)';ctx.strokeStyle='rgba(79,195,247,0.18)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(px+14,ry,pw-28,cardH,6);ctx.fill();ctx.stroke();
      ctx.font='12px sans-serif';ctx.fillStyle=row.col;ctx.textAlign='left';
      ctx.fillText(row.label,px+20,ry+16);
      ctx.font='10px sans-serif';ctx.fillStyle='#78909c';
      ctx.fillText('보유: '+row.count+'마리  |  최대 10마리',px+20,ry+30);
      const bx2=px+pw-110;
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';
      ctx.fillText(row.amt+'마리',bx2,ry+32);
      ctx.fillStyle=row.ok?'#00838f':'#37474f';
      ctx.beginPath();ctx.roundRect(bx2+22,ry+12,26,22,4);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.fillText('▲',bx2+35,ry+27);
      ctx.fillStyle=row.amt>0?'#bf360c':'#37474f';
      ctx.beginPath();ctx.roundRect(bx2+50,ry+12,26,22,4);ctx.fill();
      ctx.fillStyle='#fff';ctx.fillText('▼',bx2+63,ry+27);
    });
    ctx.restore();
    if(contentH>visibleH){
      const sbx=px+pw-8,sby=py+HEADER_H;
      const ratio=visibleH/contentH;
      const thumbH=Math.max(20,visibleH*ratio);
      const thumbY=sby+(sellScrollY/maxScroll)*(visibleH-thumbH);
      ctx.fillStyle='rgba(79,195,247,0.2)';ctx.beginPath();ctx.roundRect(sbx,sby,4,visibleH,2);ctx.fill();
      ctx.fillStyle='rgba(79,195,247,0.6)';ctx.beginPath();ctx.roundRect(sbx,thumbY,4,thumbH,2);ctx.fill();
    }
  }

  const footY=py+HEADER_H+visibleH+8;
  ctx.font='bold 13px sans-serif';ctx.fillStyle='#a5d6a7';ctx.textAlign='left';
  ctx.fillText('합계: '+totalCoins+' 코인',px+20,footY);
  if(sellUI.delivering){
    ctx.font='11px sans-serif';ctx.fillStyle='#ffcc02';
    ctx.fillText('나룻배 출항중: '+Math.ceil(sellUI.countdown)+'초',px+20,footY+18);
  }
  const btnY=py+ph-52;
  ctx.fillStyle=canSell?'#00acc1':'#455a64';
  ctx.beginPath();ctx.roundRect(px+14,btnY,pw-28,36,8);ctx.fill();
  ctx.font='bold 14px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';
  ctx.fillText(sellUI.delivering?'출항 중...':'판매하기',px+pw/2,btnY+23);
  ctx.font='11px sans-serif';ctx.fillStyle='rgba(100,180,200,0.5)';
  ctx.fillText('[S] 또는 ✕ 로 닫기',px+pw/2,py+ph-8);
  ctx.restore();
  sellPanelBounds={px,py,pw,ph,btnY,rowsMeta,cardH,cardM,HEADER_H,visibleH};
}

// ── 부유석 렌더 ──────────────────────────────────
function drawFloatingRocks() {
  const rocks=getVisibleFloatingRocks();
  for(const rock of rocks) {
    const{sx,sy}=ws(rock.x,rock.y);
    const nv=7+Math.floor(seededRandFR(rock.seed*1.7)*4);
    ctx.save();
    const grad=ctx.createRadialGradient(sx-rock.r*0.25,sy-rock.r*0.2,1,sx,sy,rock.r*1.1);
    grad.addColorStop(0,'#546e7a');grad.addColorStop(0.5,'#37474f');grad.addColorStop(1,'#1c2c35');
    ctx.fillStyle=grad;ctx.strokeStyle='rgba(100,160,180,0.28)';ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let j=0;j<nv;j++){
      const ang=(j/nv)*Math.PI*2;
      const jit=0.68+seededRandFR(rock.seed*(j+2)*4.3)*0.65;
      const px2=sx+Math.cos(ang)*rock.r*jit, py2=sy+Math.sin(ang)*rock.r*jit;
      j===0?ctx.moveTo(px2,py2):ctx.lineTo(px2,py2);
    }
    ctx.closePath();ctx.fill();ctx.stroke();
    // 작은 표면 하이라이트
    ctx.fillStyle='rgba(100,160,180,0.15)';
    ctx.beginPath();ctx.ellipse(sx-rock.r*0.3,sy-rock.r*0.3,rock.r*0.35,rock.r*0.2,-0.4,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

function drawTealRocks() {
  if (playerZone !== 'teal') return;
  const rocks = getVisibleTealRocks().filter(r => !rockRespawning.has(r.key));
  for (const rock of rocks) {
    const state = rockHitStates.get(rock.key);
    const flash = !!(state && state.flashTimer > 0);
    const { sx, sy } = ws(rock.x, rock.y);
    const nv = 7 + Math.floor(seededRandFR(rock.seed * 1.7) * 4);
    ctx.save();
    if (flash) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    } else {
      const grad = ctx.createRadialGradient(sx - rock.r * 0.25, sy - rock.r * 0.2, 1, sx, sy, rock.r * 1.1);
      grad.addColorStop(0, '#2e4a40'); grad.addColorStop(0.5, '#1a3530'); grad.addColorStop(1, '#0d1f1a');
      ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(0,180,130,0.22)'; ctx.lineWidth = 1.5;
    }
    ctx.beginPath();
    for (let j = 0; j < nv; j++) {
      const ang = (j / nv) * Math.PI * 2;
      const jit = 0.68 + seededRandFR(rock.seed * (j + 2) * 4.3) * 0.65;
      const px2 = sx + Math.cos(ang) * rock.r * jit, py2 = sy + Math.sin(ang) * rock.r * jit;
      j === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!flash) {
      ctx.fillStyle = 'rgba(0,180,130,0.10)';
      ctx.beginPath(); ctx.ellipse(sx - rock.r * 0.3, sy - rock.r * 0.3, rock.r * 0.35, rock.r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
      // 광맥 힌트 (ore vein)
      const oreCol = rock.invKey === 'gold' ? '#ffd700' : rock.invKey === 'iron' ? '#cfd8dc' : '#90a4ae';
      ctx.fillStyle = oreCol + '55'; ctx.strokeStyle = oreCol + '88'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx - rock.r*0.2, sy); ctx.lineTo(sx, sy - rock.r*0.35); ctx.lineTo(sx + rock.r*0.2, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // HP바
    if (state && state.hp < rock.hp && !state.done) {
      const bw = rock.r * 1.4, bh = 5, bx = sx - bw / 2, by2 = sy - rock.r - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by2, bw, bh);
      ctx.fillStyle = '#4fc3f7'; ctx.fillRect(bx, by2, bw * (state.hp / rock.hp), bh);
    }
  }
}

function drawNonMineableTealRocks() {
  if (playerZone !== 'teal') return;
  const rocks = getVisibleNonMineableTealRocks();
  for (const rock of rocks) {
    const { sx, sy } = ws(rock.x, rock.y);
    const nv = 7 + Math.floor(seededRandFR(rock.seed * 1.7) * 4);
    ctx.save();
    const grad = ctx.createRadialGradient(sx - rock.r * 0.25, sy - rock.r * 0.2, 1, sx, sy, rock.r * 1.1);
    grad.addColorStop(0, '#2e4a40'); grad.addColorStop(0.5, '#1a3530'); grad.addColorStop(1, '#0d1f1a');
    ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(0,200,160,0.22)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = 0; j < nv; j++) {
      const ang = (j / nv) * Math.PI * 2;
      const jit = 0.68 + seededRandFR(rock.seed * (j + 2) * 4.3) * 0.65;
      const px2 = sx + Math.cos(ang) * rock.r * jit, py2 = sy + Math.sin(ang) * rock.r * jit;
      j === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,220,160,0.10)';
    ctx.beginPath(); ctx.ellipse(sx - rock.r * 0.3, sy - rock.r * 0.3, rock.r * 0.35, rock.r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawCamp() {
  if (!campObject) return;
  const { sx, sy } = ws(campObject.x, campObject.y);
  const t = Date.now() / 1000;
  ctx.save();
  // 기둥 (앵커)
  ctx.strokeStyle = '#0a5a38'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sx, sy + 10); ctx.lineTo(sx, sy + 30); ctx.stroke();
  // 돔 기반
  const baseGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 42);
  baseGrad.addColorStop(0, '#1a6a4a'); baseGrad.addColorStop(0.6, '#0d4a30'); baseGrad.addColorStop(1, '#061f14');
  ctx.fillStyle = baseGrad;
  ctx.beginPath(); ctx.ellipse(sx, sy, 42, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = campObject.used ? 'rgba(0,150,80,0.4)' : 'rgba(0,230,140,0.55)'; ctx.lineWidth = 1.5;
  ctx.stroke();
  // 돔 상단
  ctx.fillStyle = '#0a5038';
  ctx.beginPath(); ctx.ellipse(sx, sy - 14, 28, 18, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = campObject.used ? 'rgba(0,120,70,0.4)' : 'rgba(0,220,140,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  // 창문
  ctx.fillStyle = campObject.used ? 'rgba(0,80,50,0.5)' : 'rgba(0,220,180,0.4)';
  ctx.beginPath(); ctx.ellipse(sx, sy - 18, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  // 발광 (미사용시)
  if (!campObject.used) {
    const pulse = 0.35 + Math.sin(t * 2.2) * 0.1;
    ctx.globalAlpha = pulse;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 65);
    glow.addColorStop(0, 'rgba(0,255,160,0.28)'); glow.addColorStop(1, 'rgba(0,255,160,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(sx, sy, 65, 42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 라벨
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = campObject.used ? 'rgba(100,180,130,0.7)' : '#00e896';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,150,80,0.9)'; ctx.shadowBlur = 6;
  ctx.fillText(campObject.used ? '간이 캠프 (사용됨)' : '간이 캠프', sx, sy - 42);
  if (!campObject.used) { ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(0,220,140,0.8)'; ctx.fillText('클릭하여 입장', sx, sy - 28); }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── 부유석 충돌 ──────────────────────────────────
function resolveFloatingRockCollision() {
  const seaRocks = playerZone==='teal'
    ? getVisibleNonMineableTealRocks()
    : getVisibleFloatingRocks();
  const pr = 16;
  for(const rock of seaRocks){
    const dx=player.x-rock.x, dy=player.y-rock.y;
    const dist=Math.sqrt(dx*dx+dy*dy)||1;
    const minD=rock.r+pr;
    if(dist<minD){
      const nx=dx/dist,ny=dy/dist;
      player.x+=nx*(minD-dist);player.y+=ny*(minD-dist);
      const dot=player.vx*nx+player.vy*ny;
      if(dot<0){
        player.vx-=dot*nx;player.vy-=dot*ny;
        const spd=Math.sqrt(player.vx**2+player.vy**2);
        const maxS=effectiveSpeed()*1.2;
        if(spd>maxS){player.vx=player.vx/spd*maxS;player.vy=player.vy/spd*maxS;}
      }
    }
  }
}

// ── 채집 노드 렌더 ──────────────────────────────────
function drawGatherNodes() {
  const nodes = getVisibleGatherNodes();
  const drawnKeys = new Set();
  for (const node of nodes) {
    const state = nodeHitStates.get(node.key);
    drawnKeys.add(node.key);
    if (state && state.collecting) {
      const t = Math.min(state.collectT / 0.5, 1);
      const cx = state.startX + (player.x - state.startX) * t;
      const cy2 = state.startY + (player.y - state.startY) * t;
      const { sx, sy } = ws(cx, cy2);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
      drawNodeShape(sx, sy, node.type, false);
      ctx.restore();
      continue;
    }
    const flash = !!(state && state.flashTimer > 0);
    const { sx, sy } = ws(node.x, node.y);
    drawNodeShape(sx, sy, node.type, flash);
    if (state && state.hp < NODE_DEFS[node.type].hp && !state.collecting) {
      const def = NODE_DEFS[node.type];
      const bw = def.r * 2, bh = 4, bx = sx - def.r, by2 = sy - def.r - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by2, bw, bh);
      ctx.fillStyle = '#f44336'; ctx.fillRect(bx, by2, bw * (state.hp / def.hp), bh);
    }
  }
  // 화면 밖으로 나간 노드 애니메이션 마무리
  for (const [key, state] of nodeHitStates.entries()) {
    if (state.collecting && !drawnKeys.has(key) && !state.done) {
      const t = Math.min(state.collectT / 0.5, 1);
      const cx = state.startX + (player.x - state.startX) * t;
      const cy2 = state.startY + (player.y - state.startY) * t;
      const { sx, sy } = ws(cx, cy2);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
      drawNodeShape(sx, sy, state.type, false);
      ctx.restore();
    }
  }
}

function drawNodeShape(sx, sy, type, flash) {
  ctx.save();
  switch (type) {
    case 'seaweed':      drawSeaweedNode(sx, sy, flash); break;
    case 'anemone':      drawAnemoneNode(sx, sy, flash); break;
    case 'jellyfish':    drawJellyfishNode(sx, sy, flash); break;
    case 'stone_ore':    drawOreNode(sx, sy, '#90a4ae', '#546e7a', flash); break;
    case 'iron_ore':     drawOreNode(sx, sy, '#cfd8dc', '#90a4ae', flash); break;
    case 'gold_ore':     drawOreNode(sx, sy, '#ffd700', '#f9a825', flash); break;
    case 'aluminum_ore': drawOreNode(sx, sy, '#b3e5fc', '#4fc3f7', flash); break;
  }
  ctx.restore();
}

function drawSeaweedNode(sx, sy, flash) {
  const t = Date.now() / 1000;
  const sway = Math.sin(t * 1.5 + sx * 0.01) * 9;
  ctx.strokeStyle = flash ? '#fff' : '#388e3c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const ox = i * 9;
    ctx.beginPath();
    ctx.moveTo(sx + ox, sy);
    ctx.quadraticCurveTo(sx + ox + sway * 0.5, sy - 22, sx + ox + sway, sy - 44);
    ctx.stroke();
  }
  ctx.fillStyle = flash ? '#fff' : '#2e7d32';
  ctx.beginPath(); ctx.ellipse(sx + sway, sy - 44, 9, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx - 9 + sway * 0.7, sy - 27, 7, 4, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawAnemoneNode(sx, sy, flash) {
  const t = Date.now() / 1000;
  const pulse = 1 + Math.sin(t * 2 + sx * 0.01) * 0.08;
  ctx.fillStyle = flash ? '#fff' : '#c2185b';
  ctx.beginPath(); ctx.ellipse(sx, sy, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = flash ? '#fff' : '#e91e63'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    const wa = ang + Math.sin(t * 2 + i) * 0.3;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(ang) * 9, sy - 2);
    ctx.quadraticCurveTo(sx + Math.cos(wa) * 14 * pulse, sy - 16, sx + Math.cos(wa) * 7 * pulse, sy - 28 * pulse);
    ctx.stroke();
  }
  ctx.fillStyle = flash ? '#fff' : '#ff80ab';
  ctx.beginPath(); ctx.arc(sx, sy - 2, 5, 0, Math.PI * 2); ctx.fill();
}

function drawJellyfishNode(sx, sy, flash) {
  const t = Date.now() / 1000;
  const bob = Math.sin(t * 1.8 + sx * 0.01) * 5;
  const syb = sy + bob;
  ctx.save();
  const jg = ctx.createRadialGradient(sx, syb - 10, 2, sx, syb, 18);
  jg.addColorStop(0, flash ? '#fff' : 'rgba(225,190,231,0.85)');
  jg.addColorStop(1, flash ? 'rgba(255,255,255,0.4)' : 'rgba(171,71,188,0.35)');
  ctx.fillStyle = jg;
  ctx.beginPath(); ctx.ellipse(sx, syb - 8, 16, 12, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = flash ? '#fff' : 'rgba(171,71,188,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx, syb - 8, 16, 12, 0, Math.PI, 0); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = flash ? '#fff' : 'rgba(206,147,216,0.6)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const ox = i * 5;
    const len = 18 + Math.abs(i) * 4;
    ctx.beginPath();
    ctx.moveTo(sx + ox, syb - 4);
    ctx.quadraticCurveTo(sx + ox + Math.sin(t * 2 + i) * 6, syb + len * 0.5, sx + ox + Math.sin(t * 1.5 + i) * 4, syb + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOreNode(sx, sy, mainColor, darkColor, flash) {
  ctx.fillStyle = flash ? '#fff' : '#455a64'; ctx.strokeStyle = flash ? '#fff' : '#263238'; ctx.lineWidth = 1.5;
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

// ── 청록빛 바다 입장 차단 메시지 ──────────────────
function drawTealBlockedMsg() {
  ctx.save();
  ctx.globalAlpha=Math.min(1,tealBlockedTimer);
  ctx.fillStyle='rgba(0,0,0,0.6)';
  const tw=320,th=52,tx=canvas.width/2-tw/2,ty=canvas.height/2-th/2-40;
  ctx.beginPath();ctx.roundRect(tx,ty,tw,th,10);ctx.fill();
  ctx.font='bold 14px sans-serif';ctx.fillStyle='#ff8a65';ctx.textAlign='center';
  ctx.fillText('산소통 10레벨 이상이 필요합니다!',canvas.width/2,ty+20);
  ctx.font='12px sans-serif';ctx.fillStyle='#ffcc80';
  ctx.fillText('배 상점에서 업그레이드하세요',canvas.width/2,ty+38);
  ctx.restore();
}

// ── 제작대 패널 ────────────────────────────────────
function drawCraftPanel() {
  const pw=Math.min(420,canvas.width-40),ph=560;
  const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.fillStyle='rgba(5,20,35,0.97)';ctx.strokeStyle='#00bcd4';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(px,py,pw,ph,14);ctx.fill();ctx.stroke();
  ctx.font='bold 18px sans-serif';ctx.fillStyle='#80deea';ctx.textAlign='center';
  ctx.fillText('⚙ 제작대',px+pw/2,py+34);
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.roundRect(px+pw-46,py+12,34,26,5);ctx.fill();
  ctx.fillStyle='#eceff1';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText('✕',px+pw-29,py+30);

  const inv=playerData.inventory||{};
  craftConfirmBounds=null;
  craftSeamouseBounds=null;
  craftCampBounds=null;

  // ── 레시피 1: 스코프 작살 ──
  {
    const hasIt=!!playerData.hasScope;
    const hasIron=(inv.iron||0)>=20,hasGold=(inv.gold||0)>=10,hasSeaweed=(inv.seaweed||0)>=20;
    const canCraft=!hasIt&&hasIron&&hasGold&&hasSeaweed;
    const ry=py+56;
    ctx.fillStyle='rgba(255,255,255,0.04)';ctx.strokeStyle='rgba(0,188,212,0.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(px+12,ry,pw-24,120,8);ctx.fill();ctx.stroke();
    ctx.font='bold 15px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='left';
    ctx.fillText('🔭 스코프 작살',px+24,ry+24);
    ctx.font='11px sans-serif';ctx.fillStyle='#80cbc4';
    ctx.fillText('사정거리 ×2.5  위력 ×1.5  연사속도 느림(3초)',px+24,ry+40);
    const mats1=[{label:'철 ×20',have:inv.iron||0,ok:hasIron},{label:'금 ×10',have:inv.gold||0,ok:hasGold},{label:'해초 ×20',have:inv.seaweed||0,ok:hasSeaweed}];
    const matW=(pw-48)/3;
    mats1.forEach((m,i)=>{ctx.font='12px sans-serif';ctx.fillStyle=m.ok?'#a5d6a7':'#ef9a9a';ctx.textAlign='left';ctx.fillText(`${m.label} (${m.have})`,px+24+i*matW,ry+62);});
    const bx=px+pw/2-60,by2=ry+80,bw=120,bh=32;
    if(hasIt){
      ctx.fillStyle='#37474f';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,6);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#80cbc4';ctx.textAlign='center';ctx.fillText('이미 제작됨',bx+bw/2,by2+21);
    } else {
      ctx.fillStyle=canCraft?'#0097a7':'#37474f';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,6);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('제작',bx+bw/2,by2+21);
      craftConfirmBounds={x:bx,y:by2,w:bw,h:bh,canCraft};
    }
  }

  // ── 레시피 2: 시마우스 ──
  {
    const hasIt=!!playerData.hasSeamouse;
    const hasStone=(inv.stone||0)>=20,hasIron2=(inv.iron||0)>=30,hasJelly=(inv.jellyfish||0)>=20,hasGold2=(inv.gold||0)>=20,hasAlum=(inv.aluminum||0)>=30;
    const canCraft=!hasIt&&hasStone&&hasIron2&&hasJelly&&hasGold2&&hasAlum;
    const ry=py+200;
    ctx.fillStyle='rgba(255,255,255,0.04)';ctx.strokeStyle='rgba(0,188,212,0.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(px+12,ry,pw-24,170,8);ctx.fill();ctx.stroke();
    ctx.font='bold 15px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='left';
    ctx.fillText('🐭 시마우스',px+24,ry+24);
    ctx.font='11px sans-serif';ctx.fillStyle='#80cbc4';
    ctx.fillText('1인승 탑승 장비  산소 100  [E] 탑승/하차',px+24,ry+40);
    const mats2=[{label:'돌 ×20',have:inv.stone||0,ok:hasStone},{label:'철 ×30',have:inv.iron||0,ok:hasIron2},{label:'해파리 ×20',have:inv.jellyfish||0,ok:hasJelly},{label:'금 ×20',have:inv.gold||0,ok:hasGold2},{label:'알루미늄 ×30',have:inv.aluminum||0,ok:hasAlum}];
    const matW2=(pw-48)/3;
    mats2.forEach((m,i)=>{
      const row=Math.floor(i/3),col=i%3;
      ctx.font='12px sans-serif';ctx.fillStyle=m.ok?'#a5d6a7':'#ef9a9a';ctx.textAlign='left';
      ctx.fillText(`${m.label} (${m.have})`,px+24+col*matW2,ry+62+row*20);
    });
    const bx=px+pw/2-60,by2=ry+110,bw=120,bh=32;
    if(hasIt){
      ctx.fillStyle='#37474f';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,6);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#80cbc4';ctx.textAlign='center';ctx.fillText('이미 제작됨',bx+bw/2,by2+21);
    } else {
      ctx.fillStyle=canCraft?'#0097a7':'#37474f';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,6);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('제작',bx+bw/2,by2+21);
      craftSeamouseBounds={x:bx,y:by2,w:bw,h:bh,canCraft};
    }
  }

  // ── 레시피 3: 바닷속 간이 캠프 ──
  {
    const hasIt=!!playerData.hasCamp;
    const hasStone=(inv.stone||0)>=20,hasIron2=(inv.iron||0)>=30,hasJelly=(inv.jellyfish||0)>=20,hasGold2=(inv.gold||0)>=20,hasAlum=(inv.aluminum||0)>=30;
    const canCraft=!hasIt&&hasStone&&hasIron2&&hasJelly&&hasGold2&&hasAlum;
    const ry=py+395;
    ctx.fillStyle='rgba(255,255,255,0.04)';ctx.strokeStyle='rgba(0,188,212,0.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(px+12,ry,pw-24,170,8);ctx.fill();ctx.stroke();
    ctx.font='bold 15px sans-serif';ctx.fillStyle='#e0f7fa';ctx.textAlign='left';
    ctx.fillText('🏕 바닷속 간이 캠프',px+24,ry+24);
    ctx.font='11px sans-serif';ctx.fillStyle='#80cbc4';
    ctx.fillText('잠수당 1회  [F] 설치  클릭 입장  산소 충전 + 제작 가능',px+24,ry+40);
    const mats3=[{label:'돌 ×20',have:inv.stone||0,ok:hasStone},{label:'철 ×30',have:inv.iron||0,ok:hasIron2},{label:'해파리 ×20',have:inv.jellyfish||0,ok:hasJelly},{label:'금 ×20',have:inv.gold||0,ok:hasGold2},{label:'알루미늄 ×30',have:inv.aluminum||0,ok:hasAlum}];
    const matW3=(pw-48)/3;
    mats3.forEach((m,i)=>{
      const row=Math.floor(i/3),col=i%3;
      ctx.font='12px sans-serif';ctx.fillStyle=m.ok?'#a5d6a7':'#ef9a9a';ctx.textAlign='left';
      ctx.fillText(`${m.label} (${m.have})`,px+24+col*matW3,ry+62+row*20);
    });
    const bx=px+pw/2-60,by2=ry+110,bw=120,bh=32;
    if(hasIt){
      ctx.fillStyle='#37474f';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,6);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#80cbc4';ctx.textAlign='center';ctx.fillText('이미 제작됨',bx+bw/2,by2+21);
    } else {
      ctx.fillStyle=canCraft?'#0097a7':'#37474f';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,6);ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('제작',bx+bw/2,by2+21);
      craftCampBounds={x:bx,y:by2,w:bw,h:bh,canCraft};
    }
  }

  ctx.font='11px sans-serif';ctx.fillStyle='rgba(150,180,200,0.5)';ctx.textAlign='center';
  ctx.fillText('[ESC] 또는 ✕ 닫기',px+pw/2,py+ph-12);
  ctx.restore();
}

function handleCraftClick(e) {
  const r=canvas.getBoundingClientRect();
  const cx=e.clientX-r.left,cy=e.clientY-r.top;
  const pw=Math.min(420,canvas.width-40),ph=560;
  const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
  if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){craftOpen=false;return;}
  if(craftConfirmBounds&&cx>=craftConfirmBounds.x&&cx<=craftConfirmBounds.x+craftConfirmBounds.w&&cy>=craftConfirmBounds.y&&cy<=craftConfirmBounds.y+craftConfirmBounds.h){
    if(craftConfirmBounds.canCraft){
      playerData.inventory.iron-=20;
      playerData.inventory.gold-=10;
      playerData.inventory.seaweed-=20;
      playerData.hasScope=true;
      playerData.activeHarpoon='scope';
      if(!playerData.scopeUpgrades) playerData.scopeUpgrades={harpoon:0};
      savePlayerData();
    }
    return;
  }
  if(craftSeamouseBounds&&cx>=craftSeamouseBounds.x&&cx<=craftSeamouseBounds.x+craftSeamouseBounds.w&&cy>=craftSeamouseBounds.y&&cy<=craftSeamouseBounds.y+craftSeamouseBounds.h){
    if(craftSeamouseBounds.canCraft){
      const inv=playerData.inventory;
      inv.stone-=20; inv.iron-=30; inv.jellyfish-=20; inv.gold-=20; inv.aluminum-=30;
      playerData.hasSeamouse=true;
      savePlayerData();
      spawnSeamouse();
    }
    return;
  }
  if(craftCampBounds&&cx>=craftCampBounds.x&&cx<=craftCampBounds.x+craftCampBounds.w&&cy>=craftCampBounds.y&&cy<=craftCampBounds.y+craftCampBounds.h){
    if(craftCampBounds.canCraft){
      const inv=playerData.inventory;
      inv.stone-=20; inv.iron-=30; inv.jellyfish-=20; inv.gold-=20; inv.aluminum-=30;
      playerData.hasCamp=true;
      savePlayerData();
    }
    return;
  }
}

// ── 상점 패널 ─────────────────────────────────────
let shopBuyBtnBounds=[];

function drawShopPanel() {
  const hasScope=!!playerData.hasScope;
  const pw=Math.min(480,canvas.width-40);
  const ph=hasScope?500:380;
  const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.fillStyle='rgba(10,25,45,0.97)';ctx.strokeStyle='#fbc02d';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(px,py,pw,ph,14);ctx.fill();ctx.stroke();
  ctx.font='bold 18px sans-serif';ctx.fillStyle='#ffd54f';ctx.textAlign='center';
  ctx.fillText('⚓ 배 상점',px+pw/2,py+34);
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.roundRect(px+pw-46,py+12,34,26,5);ctx.fill();
  ctx.fillStyle='#eceff1';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText('✕',px+pw-29,py+30);

  shopBuyBtnBounds=[];
  let cardY0=py+52;

  if(hasScope) {
    const sw=py+52;
    ctx.font='bold 12px sans-serif';ctx.fillStyle='#90a4ae';ctx.textAlign='left';
    ctx.fillText('장착 작살:',px+18,sw+17);
    const active=playerData.activeHarpoon||'normal';
    [{label:'일반 작살',val:'normal'},{label:'스코프 작살',val:'scope'}].forEach((sb,i)=>{
      const bx=px+100+i*110,by=sw,bw=100,bh=28;
      ctx.fillStyle=active===sb.val?'#0097a7':'#37474f';
      ctx.beginPath();ctx.roundRect(bx,by,bw,bh,5);ctx.fill();
      ctx.font='bold 11px sans-serif';ctx.fillStyle=active===sb.val?'#e0f7fa':'#90a4ae';ctx.textAlign='center';
      ctx.fillText(sb.label,bx+bw/2,by+18);
      shopBuyBtnBounds.push({x:bx,y:by,w:bw,h:bh,action:'switch',val:sb.val});
    });
    cardY0=py+96;
  }

  const upgrades=[
    {key:'flipper',     label:'물갈퀴',     icon:'🦈', desc:'수영 속도 증가',              unit:'+8 속도/레벨', isScope:false},
    {key:'oxygen',      label:'산소통',     icon:'🫧', desc:'최대 산소 증가 (lv10 청록 입장)', unit:'+6초/레벨',   isScope:false},
    {key:'harpoon',     label:'작살',       icon:'🔱', desc:'작살 위력 증가',              unit:'+4 위력/레벨', isScope:false},
  ];
  if(hasScope) upgrades.push({key:'scopeHarpoon',label:'스코프 작살',icon:'🔭',desc:'스코프 작살 위력 증가',unit:'+4 위력/레벨',isScope:true});

  const cardH=86,cardM=8;
  upgrades.forEach((upg,i)=>{
    const lv=upg.isScope?(playerData.scopeUpgrades?.harpoon||0):(playerData.upgrades?.[upg.key]||0);
    const tier=upgradeTier(lv);
    const cost=lv<50?upgradeCost(lv):null;
    const canBuy=lv<50&&cost!==null&&(playerData.coins||0)>=cost;
    const cy=cardY0+i*(cardH+cardM);

    ctx.fillStyle='rgba(255,200,0,0.05)';ctx.strokeStyle='rgba(255,200,0,0.25)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(px+12,cy,pw-24,cardH,8);ctx.fill();ctx.stroke();

    ctx.font='22px sans-serif';ctx.textAlign='left';ctx.fillText(upg.icon,px+22,cy+30);
    ctx.font='bold 14px sans-serif';ctx.fillStyle='#ffd54f';ctx.fillText(upg.label,px+50,cy+20);
    ctx.font='11px sans-serif';ctx.fillStyle='#90a4ae';ctx.fillText(upg.desc,px+50,cy+35);
    ctx.font='10px sans-serif';ctx.fillStyle='#78909c';ctx.fillText(upg.unit,px+50,cy+48);

    const tierColorKey=upg.key==='flipper'?'flipper':upg.key==='oxygen'?'tank':'harpoon';
    const tierColor=UPGRADE_COLORS[tierColorKey][tier];
    ctx.font='bold 13px sans-serif';ctx.fillStyle=tierColor;ctx.textAlign='right';
    ctx.fillText(`Lv.${lv}/50`,px+pw-130,cy+24);
    if(lv>0){ctx.font='10px sans-serif';ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillText(`Tier ${tier}`,px+pw-130,cy+38);}

    const bx=px+pw-120,by=cy+cardH/2-18,bw=100,bh=36;
    if(lv>=50){
      ctx.fillStyle='#37474f';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();
      ctx.font='bold 12px sans-serif';ctx.fillStyle='#ffd700';ctx.textAlign='center';ctx.fillText('MAX',bx+bw/2,by+22);
    } else {
      ctx.fillStyle=canBuy?'#f57f17':'#37474f';
      ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();
      ctx.font='bold 12px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';
      ctx.fillText(`${cost} 코인`,bx+bw/2,by+22);
      shopBuyBtnBounds.push({x:bx,y:by,w:bw,h:bh,key:upg.key,cost,lv,action:'upgrade',isScope:upg.isScope});
    }
  });

  ctx.font='bold 13px sans-serif';ctx.fillStyle='#ffe082';ctx.textAlign='left';
  ctx.fillText(`보유 코인: ${playerData.coins||0}`,px+20,py+ph-14);
  ctx.font='11px sans-serif';ctx.fillStyle='rgba(150,180,200,0.5)';ctx.textAlign='center';
  ctx.fillText('[ESC] 또는 ✕ 닫기',px+pw/2,py+ph-14);
  ctx.restore();
}

function handleShopClick(e) {
  const r=canvas.getBoundingClientRect();
  const cx=e.clientX-r.left,cy=e.clientY-r.top;
  const pw=Math.min(480,canvas.width-40);
  const ph=playerData.hasScope?500:380;
  const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
  if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){shopOpen=false;return;}
  for(const btn of shopBuyBtnBounds){
    if(cx>=btn.x&&cx<=btn.x+btn.w&&cy>=btn.y&&cy<=btn.y+btn.h){
      if(btn.action==='switch'){
        playerData.activeHarpoon=btn.val;
        savePlayerData();
      } else if(btn.action==='upgrade'){
        if((playerData.coins||0)>=btn.cost&&btn.lv<50){
          playerData.coins-=btn.cost;
          if(btn.isScope){
            if(!playerData.scopeUpgrades) playerData.scopeUpgrades={harpoon:0};
            playerData.scopeUpgrades.harpoon=(playerData.scopeUpgrades.harpoon||0)+1;
          } else {
            playerData.upgrades[btn.key]=(playerData.upgrades[btn.key]||0)+1;
          }
          savePlayerData();
        }
      }
      return;
    }
  }
}

// ── 시작 ─────────────────────────────────────────
init();
