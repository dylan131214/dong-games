// ────────────────────────────────────────────────
//  바다 낚시 게임  game.js
// ────────────────────────────────────────────────

// ── 캔버스 설정 ──────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── 플레이어 데이터 (서버에서 로드) ──────────────
const nickname = localStorage.getItem('nickname');
if (!nickname) { window.location.href = 'index.html'; }

let playerData = { nickname, coins: 0, inventory: { anchovy: 0 } };

async function loadPlayerData() {
  const res = await fetch('/api/player/' + encodeURIComponent(nickname));
  if (res.ok) playerData = await res.json();
}

async function savePlayerData() {
  await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playerData)
  });
}

window.addEventListener('beforeunload', () => {
  // 동기 beacon으로 저장
  const blob = new Blob([JSON.stringify(playerData)], { type: 'application/json' });
  navigator.sendBeacon('/api/save', blob);
});

// ── 상수 ────────────────────────────────────────
const SURFACE_RATIO = 0.3;          // 수면 위치 비율
const SHIP_W = 120, SHIP_H = 50;
const SMALL_BOAT_OFFSET = 150;      // 배 우측
const SMALL_W = 80, SMALL_H = 35;
const PLAYER_W = 30, PLAYER_H = 40;
const PLAYER_SPEED_SURFACE = 200;
const PLAYER_SPEED_WATER = 150;
const HARPOON_SPEED = 600;
const HARPOON_MAX_DIST = 300;
const HARPOON_HIT_RADIUS = 10;
const ANCHOVY_MAX = 20;
const ANCHOVY_SPEED = 80;
const ANCHOVY_W = 15, ANCHOVY_H = 8;
const ANCHOVY_HP = 20;
const ANCHOVY_REGEN_MS = 10000;
const MAX_OXYGEN_SEC = 60;
const MAX_GRACE_SEC = 10;
const SELL_BOAT_RADIUS = 50;
const CLOWNFISH_MAX = 8;
const CLOWNFISH_W = 22, CLOWNFISH_H = 13;
const CLOWNFISH_SPEED = 55;

// 물리
const GRAVITY = 500;          // 공중 중력 (px/s²)
const JUMP_VY = -380;         // 점프 초기 속도 (음수 = 위)
const BUOYANCY_ACCEL = 70;    // 수중 부력 가속도 (px/s², 위 방향)
const SWIM_ACCEL = 12;        // 수영 가속도 계수
const SWIM_DRAG = 3.5;        // 수중 저항 계수

// ── 월드 고정 좌표 ───────────────────────────────
// 배: 월드 (0, 수면선) → 수면선은 canvas 높이에 따라 변하므로 렌더 시 계산
const SHIP_WORLD_X = 0;

// ── 게임 상태 ────────────────────────────────────
let lastTime = 0;

const camera = { x: 0, y: 0 };

const player = {
  x: SHIP_WORLD_X,
  y: 0,            // 초기화는 init()에서
  vx: 0,
  vy: 0,
  alive: true,
  onShip: false,
};

const harpoon = {
  active: false,
  x: 0, y: 0,
  vx: 0, vy: 0,
  dist: 0,
};

let anchovies = [];
let anchovyIdCounter = 0;

// 산소
let oxygenTimer = MAX_OXYGEN_SEC;
let graceTimer = MAX_GRACE_SEC;
let isUnderwater = false;
let graceBlinkTimer = 0;

// 게임오버 페이드
let gameOverState = null; // null | 'falling' | 'fadeout' | 'fadein'
let fadeOpacity = 0;
let fallVelocity = 0;

// 판매 UI 상태
const sellUI = {
  visible: false,
  amount: 0,
  clownfishAmount: 0,
  delivering: false,
  countdown: 0,
};

// 입력
const keys = {};
let mouseWorld = { x: 0, y: 0 };

// 귀환 애니메이션 (멸치 획득)
let collectAnims = [];

// 플레이어 방향 + 공기방울
let playerFacingRight = true;
let bubbles = [];   // {x,y,r,vx,vy,life}
let bubbleTimer = 0;

// 흰동가리 + 장애물
let clownfishes = [];
let clownfishIdCounter = 0;
let obstacles = [];

// 인벤토리 UI
let inventoryOpen = false;
let inventoryBounds = null;

// ── 초기화 ───────────────────────────────────────
async function init() {
  await loadPlayerData();

  // 플레이어 초기 위치: 갑판 위 (center y = deckTopY - PLAYER_H/2)
  player.x = SHIP_WORLD_X;
  player.y = deckTopY() - PLAYER_H / 2;

  spawnAnchovies(ANCHOVY_MAX);
  generateObstacles();
  spawnClownfishes(CLOWNFISH_MAX);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyI') inventoryOpen = !inventoryOpen;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  requestAnimationFrame(loop);
}

// 수면 y (월드 좌표 = 화면 좌표 - camera.y, but 수면선은 화면 비율로 고정)
// 카메라가 움직여도 수면선의 월드 y는 변한다 → 수면선을 월드에서 고정.
// 여기서는 "수면선 월드 y = 0"으로 단순화하고,
// 렌더 시 화면 y = world y - camera.y + SURFACE_RATIO*canvas.height 로 변환.
// → 실제로 camera.y = player.y - canvas.height*0.5 이므로
//   screenY = worldY - camera.y
function surfaceY() { return 0; }
function deckTopY() { return surfaceY() - 12; }

// 결정적 의사난수 (위치 기반 시드)
function seededRand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// 해저 지형 높이 (월드 y, 수면=0 기준 아래가 양수)
function terrainY(wx) {
  let y = 380;
  y += Math.sin(wx * 0.006) * 55;
  y += Math.sin(wx * 0.018 + 2.1) * 28;
  y += Math.sin(wx * 0.055 + 4.7) * 14;
  y += Math.sin(wx * 0.13  + 1.2) * 7;
  return Math.max(300, Math.min(460, y));
}

// ── 월드↔화면 변환 ───────────────────────────────
function toScreen(wx, wy) {
  return {
    sx: wx - camera.x + canvas.width * 0.5,
    sy: wy - camera.y + canvas.height * SURFACE_RATIO
  };
}

function toWorld(sx, sy) {
  return {
    wx: sx - canvas.width * 0.5 + camera.x,
    wy: sy - canvas.height * SURFACE_RATIO + camera.y
  };
}

// ── 멸치 스폰 ────────────────────────────────────
function spawnAnchovies(count) {
  for (let i = 0; i < count; i++) spawnAnchovy();
}

function spawnAnchovy() {
  if (anchovies.length >= ANCHOVY_MAX) return;
  const wRange = 1200;
  anchovies.push({
    id: anchovyIdCounter++,
    x: SHIP_WORLD_X + (Math.random() - 0.5) * wRange,
    y: surfaceY() + 50 + Math.random() * 230,
    vx: (Math.random() < 0.5 ? 1 : -1) * ANCHOVY_SPEED,
    vy: (Math.random() - 0.5) * 40,
    dirTimer: Math.random() * 3,
    hp: ANCHOVY_HP,
    dead: false,
    collecting: false,
    collectT: 0,
    collectDur: 0.4,
    startX: 0, startY: 0,
  });
}

// ── 장애물 생성 (지형 위에 배치) ────────────────────
function generateObstacles() {
  obstacles = [];
  const colors = ['#ff5722','#e91e63','#9c27b0','#ff9800','#f44336','#ce93d8','#ff7043','#ad1457'];

  // 돌 — 지형 표면에 올림
  const rockXList = [-720,-580,-440,-300,-180,-90, 90, 180, 310, 450, 590, 720, 820,-820];
  for (const rx of rockXList) {
    const ty = terrainY(rx);
    const w  = 52 + seededRand(rx)      * 68;
    const h  = 32 + seededRand(rx + 1)  * 48;
    obstacles.push({ x: rx - w/2, y: ty - h, w, h, type: 'rock' });
  }

  // 산호 — 돌 사이 빈 공간에 배치
  const coralXList = [-760,-640,-510,-380,-240,-130, 130, 250, 390, 530, 660, 770];
  coralXList.forEach((cx, i) => {
    const ty = terrainY(cx);
    const h  = 52 + seededRand(cx + 2) * 42;
    obstacles.push({
      x: cx - 7, y: ty - h, w: 14, h,
      type: 'coral',
      color: colors[i % colors.length],
      drawX: cx, drawY: ty,
    });
  });
}

// ── 흰동가리 스폰 ─────────────────────────────────
function spawnClownfish() {
  if (clownfishes.length >= CLOWNFISH_MAX) return;
  const zones = [-490,-330,-170,-80,80,170,330,490];
  const bx = zones[Math.floor(Math.random() * zones.length)];
  clownfishes.push({
    id: clownfishIdCounter++,
    x: bx + (Math.random() - 0.5) * 70,
    y: surfaceY() + 240 + Math.random() * 60,
    vx: (Math.random() < 0.5 ? 1 : -1) * CLOWNFISH_SPEED,
    vy: (Math.random() - 0.5) * 25,
    dirTimer: Math.random() * 2.5,
    hp: ANCHOVY_HP,
    dead: false,
    collecting: false,
    collectT: 0, collectDur: 0.5,
    startX: 0, startY: 0,
  });
}

function spawnClownfishes(count) {
  for (let i = 0; i < count; i++) spawnClownfish();
}

// ── 입력 처리 ────────────────────────────────────
function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const w = toWorld(sx, sy);
  mouseWorld.x = w.wx;
  mouseWorld.y = w.wy;
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  if (!player.alive || gameOverState) return;
  if (harpoon.active) return;

  const dx = mouseWorld.x - player.x;
  const dy = mouseWorld.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  harpoon.active = true;
  harpoon.x = player.x;
  harpoon.y = player.y;
  harpoon.vx = (dx / dist) * HARPOON_SPEED;
  harpoon.vy = (dy / dist) * HARPOON_SPEED;
  harpoon.dist = 0;
}

// ── 메인 루프 ────────────────────────────────────
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

// ── 업데이트 ─────────────────────────────────────
function update(dt) {
  if (inventoryOpen) return;  // 인벤토리 열림 시 게임 정지
  if (gameOverState) {
    updateGameOver(dt);
    return;
  }

  updatePlayer(dt);
  updateOxygen(dt);
  updateHarpoon(dt);
  updateAnchovies(dt);
  updateClownfishes(dt);
  updateCollectAnims(dt);
  updateBubbles(dt);
  updateSellUI(dt);
  updateCamera();
}

function isOnDeck() {
  const deck = deckTopY();
  const playerBottom = player.y + PLAYER_H / 2;
  return (
    player.x + PLAYER_W / 2 > SHIP_WORLD_X - SHIP_W / 2 &&
    player.x - PLAYER_W / 2 < SHIP_WORLD_X + SHIP_W / 2 &&
    playerBottom >= deck - 2 &&
    playerBottom <= deck + 10 &&
    player.vy >= 0
  );
}

function updatePlayer(dt) {
  if (!player.alive) return;

  const inWater = player.y > surfaceY();

  let inputX = 0, inputY = 0;
  if (keys['KeyW'] || keys['ArrowUp'])    inputY -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  inputY += 1;
  if (keys['KeyA'] || keys['ArrowLeft'])  inputX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) inputX += 1;

  if (inWater) {
    // ── 수중 물리 ──
    const targetVx = inputX * PLAYER_SPEED_WATER;
    const targetVy = inputY * PLAYER_SPEED_WATER;

    // 목표 속도로 부드럽게 가속
    player.vx += (targetVx - player.vx) * Math.min(SWIM_ACCEL * dt, 1);
    player.vy += (targetVy - player.vy) * Math.min(SWIM_ACCEL * dt, 1);

    // 부력 (수면 방향으로 서서히 밀림)
    player.vy -= BUOYANCY_ACCEL * dt;

    // 수중 저항 (입력 없는 축은 감속)
    if (inputX === 0) player.vx *= Math.max(0, 1 - SWIM_DRAG * dt);
    if (inputY === 0) player.vy *= Math.max(0, 1 - SWIM_DRAG * dt);

  } else {
    // ── 지상/공중 물리 ──
    const onDeck = isOnDeck();

    if (onDeck) {
      // 갑판 위: 수평 이동 + 점프
      player.vy = 0;
      player.y = deckTopY() - PLAYER_H / 2; // 갑판에 스냅
      player.vx = inputX * PLAYER_SPEED_SURFACE;
      if (inputY < 0) player.vy = JUMP_VY;   // W/↑ 점프
    } else {
      // 공중: 중력 + 제한적 수평 조작
      player.vy += GRAVITY * dt;
      if (inputX !== 0) {
        player.vx += (inputX * PLAYER_SPEED_SURFACE - player.vx) * Math.min(8 * dt, 1);
      } else {
        player.vx *= Math.max(0, 1 - 4 * dt);
      }
    }
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // 갑판 착지 — 낙하 중 통과 방지
  if (!inWater) {
    const deck = deckTopY();
    const playerBottom = player.y + PLAYER_H / 2;
    if (player.x + PLAYER_W / 2 > SHIP_WORLD_X - SHIP_W / 2 &&
        player.x - PLAYER_W / 2 < SHIP_WORLD_X + SHIP_W / 2 &&
        playerBottom > deck && player.vy >= 0) {
      player.y = deck - PLAYER_H / 2;
      player.vy = 0;
    }
  }

  // 깊이/높이 제한
  if (player.y < surfaceY() - 220) { player.y = surfaceY() - 220; player.vy = 0; }
  if (player.y > surfaceY() + 500) { player.y = surfaceY() + 500; player.vy = 0; }

  resolveTerrainCollision();
  resolveObstacleCollisions();

  // 수면 위(배 포함) 산소 회복
  const shipLeft  = SHIP_WORLD_X - SHIP_W / 2;
  const shipRight = SHIP_WORLD_X + SHIP_W / 2;
  player.onShip = player.x + PLAYER_W / 2 > shipLeft &&
                  player.x - PLAYER_W / 2 < shipRight &&
                  player.y < surfaceY();

  if (player.onShip) {
    if (oxygenTimer < MAX_OXYGEN_SEC || graceTimer < MAX_GRACE_SEC) {
      oxygenTimer = MAX_OXYGEN_SEC;
      graceTimer = MAX_GRACE_SEC;
      savePlayerData();
    }
  }

  // 마우스 방향으로 얼굴 전환
  playerFacingRight = mouseWorld.x >= player.x;
}

function updateBubbles(dt) {
  const inWater = player.y > surfaceY();

  if (inWater && player.alive && !gameOverState) {
    bubbleTimer += dt;
    if (bubbleTimer >= 0.35) {
      bubbleTimer = 0;
      const mouthX = player.x + (playerFacingRight ? 10 : -10);
      const mouthY = player.y - PLAYER_H / 2 + 22;
      bubbles.push({
        x: mouthX, y: mouthY,
        r: 1.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -(22 + Math.random() * 18),
        life: 1.0,
      });
    }
  }

  for (const b of bubbles) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.r  += 1.2 * dt;
    b.life -= 0.38 * dt;
  }
  bubbles = bubbles.filter(b => b.life > 0 && b.y > surfaceY() - 5);
}

function resolveTerrainCollision() {
  const playerBottom = player.y + PLAYER_H / 2;
  const ty = terrainY(player.x);
  if (playerBottom > ty) {
    player.y = ty - PLAYER_H / 2;
    if (player.vy > 0) player.vy = 0;
  }
}

function resolveObstacleCollisions() {
  const pw = PLAYER_W / 2, ph = PLAYER_H / 2;
  for (const obs of obstacles) {
    const ox = obs.x, oy = obs.y, ow = obs.w, oh = obs.h;
    if (player.x + pw <= ox || player.x - pw >= ox + ow) continue;
    if (player.y + ph <= oy || player.y - ph >= oy + oh) continue;

    const oL = (player.x + pw) - ox;
    const oR = (ox + ow) - (player.x - pw);
    const oT = (player.y + ph) - oy;
    const oB = (oy + oh) - (player.y - ph);
    const min = Math.min(oL, oR, oT, oB);

    if (min === oL) { player.x = ox - pw;       if (player.vx > 0) player.vx = 0; }
    else if (min === oR) { player.x = ox + ow + pw; if (player.vx < 0) player.vx = 0; }
    else if (min === oT) { player.y = oy - ph;       if (player.vy > 0) player.vy = 0; }
    else                 { player.y = oy + oh + ph;  if (player.vy < 0) player.vy = 0; }
  }
}

function updateOxygen(dt) {
  isUnderwater = player.y > surfaceY() + 5;

  if (!isUnderwater) return;
  if (player.onShip) return;

  if (oxygenTimer > 0) {
    oxygenTimer -= dt;
    if (oxygenTimer < 0) oxygenTimer = 0;
  } else {
    graceTimer -= dt;
    if (graceTimer < 0) graceTimer = 0;
  }

  graceBlinkTimer += dt;

  if (graceTimer <= 0) {
    triggerGameOver();
  }
}

function updateHarpoon(dt) {
  if (!harpoon.active) return;

  harpoon.x += harpoon.vx * dt;
  harpoon.y += harpoon.vy * dt;
  harpoon.dist += Math.sqrt(harpoon.vx * harpoon.vx + harpoon.vy * harpoon.vy) * dt;

  if (harpoon.dist >= HARPOON_MAX_DIST) {
    harpoon.active = false;
    return;
  }

  // 장애물 충돌 (작살 차단)
  for (const obs of obstacles) {
    if (harpoon.x > obs.x && harpoon.x < obs.x + obs.w &&
        harpoon.y > obs.y && harpoon.y < obs.y + obs.h) {
      harpoon.active = false;
      return;
    }
  }

  // 멸치 충돌
  for (const a of anchovies) {
    if (a.dead || a.collecting) continue;
    const dx = harpoon.x - a.x, dy = harpoon.y - a.y;
    if (Math.sqrt(dx * dx + dy * dy) <= HARPOON_HIT_RADIUS) {
      a.hp = 0; a.dead = true;
      harpoon.active = false;
      startCollectAnim(a);
      return;
    }
  }

  // 흰동가리 충돌
  for (const c of clownfishes) {
    if (c.dead || c.collecting) continue;
    const dx = harpoon.x - c.x, dy = harpoon.y - c.y;
    if (Math.sqrt(dx * dx + dy * dy) <= HARPOON_HIT_RADIUS + 4) {
      c.hp = 0; c.dead = true;
      harpoon.active = false;
      startCollectAnim(c);
      return;
    }
  }
}

function updateAnchovies(dt) {
  for (const a of anchovies) {
    if (a.dead) continue;
    if (a.collecting) continue;

    a.dirTimer -= dt;
    if (a.dirTimer <= 0) {
      a.dirTimer = 2 + Math.random() * 3;
      a.vx = (Math.random() < 0.5 ? 1 : -1) * ANCHOVY_SPEED;
      a.vy = (Math.random() - 0.5) * 40;
    }

    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // 수면 아래 유지
    if (a.y < surfaceY() + 30) {
      a.y = surfaceY() + 30;
      a.vy = Math.abs(a.vy);
    }
    const aCeil = terrainY(a.x) - ANCHOVY_H - 6;
    if (a.y > aCeil) { a.y = aCeil; a.vy = -Math.abs(a.vy); }

    // 장애물 회피
    for (const obs of obstacles) {
      if (a.x + ANCHOVY_W/2 > obs.x - 4 && a.x - ANCHOVY_W/2 < obs.x + obs.w + 4 &&
          a.y + ANCHOVY_H/2 > obs.y - 4 && a.y - ANCHOVY_H/2 < obs.y + obs.h + 4) {
        a.vx = -a.vx;
        a.dirTimer = 1 + Math.random() * 2;
        a.x += a.vx * 0.05;
        break;
      }
    }
  }

  // 수집 애니메이션 완료된 것 제거
  const before = anchovies.length;
  anchovies = anchovies.filter(a => {
    if (a.collecting) {
      a.collectT += dt;
      const t = Math.min(a.collectT / a.collectDur, 1);
      a.x = a.startX + (player.x - a.startX) * t;
      a.y = a.startY + (player.y - a.startY) * t;
      if (t >= 1) {
        // 인벤토리 추가
        playerData.inventory.anchovy = (playerData.inventory.anchovy || 0) + 1;
        savePlayerData();
        // 리젠
        setTimeout(spawnAnchovy, ANCHOVY_REGEN_MS);
        return false; // 배열에서 제거
      }
    }
    return true;
  });
}

function startCollectAnim(a) {
  a.collecting = true;
  a.collectT = 0;
  a.startX = a.x;
  a.startY = a.y;
}

function updateClownfishes(dt) {
  for (const c of clownfishes) {
    if (c.dead || c.collecting) continue;

    c.dirTimer -= dt;
    if (c.dirTimer <= 0) {
      c.dirTimer = 1.5 + Math.random() * 2.5;
      c.vx = (Math.random() < 0.5 ? 1 : -1) * CLOWNFISH_SPEED;
      c.vy = (Math.random() - 0.5) * 35;
    }

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    if (c.y < surfaceY() + 220) { c.y = surfaceY() + 220; c.vy = Math.abs(c.vy); }
    const cCeil = terrainY(c.x) - CLOWNFISH_H - 6;
    if (c.y > cCeil) { c.y = cCeil; c.vy = -Math.abs(c.vy); }

    // 장애물 회피
    for (const obs of obstacles) {
      if (c.x + CLOWNFISH_W/2 > obs.x - 4 && c.x - CLOWNFISH_W/2 < obs.x + obs.w + 4 &&
          c.y + CLOWNFISH_H/2 > obs.y - 4 && c.y - CLOWNFISH_H/2 < obs.y + obs.h + 4) {
        c.vx = -c.vx;
        c.dirTimer = 1 + Math.random() * 2;
        c.x += c.vx * 0.05;
        break;
      }
    }
  }

  clownfishes = clownfishes.filter(c => {
    if (c.collecting) {
      c.collectT += dt;
      const t = Math.min(c.collectT / c.collectDur, 1);
      c.x = c.startX + (player.x - c.startX) * t;
      c.y = c.startY + (player.y - c.startY) * t;
      if (t >= 1) {
        playerData.inventory.clownfish = (playerData.inventory.clownfish || 0) + 1;
        savePlayerData();
        setTimeout(spawnClownfish, ANCHOVY_REGEN_MS * 1.5);
        return false;
      }
    }
    return true;
  });
}

function updateCollectAnims(dt) {
  // anchovies / clownfishes 내부에서 처리
}

function updateSellUI(dt) {
  const sbx = SHIP_WORLD_X + SHIP_W / 2 + SMALL_BOAT_OFFSET;
  const sby = surfaceY();
  const dx = player.x - sbx;
  const dy = player.y - sby;
  const dist = Math.sqrt(dx * dx + dy * dy);
  sellUI.visible = dist <= SELL_BOAT_RADIUS;

  if (sellUI.delivering) {
    sellUI.countdown -= dt;
    if (sellUI.countdown <= 0) {
      sellUI.delivering = false;
      sellUI.countdown = 0;
      // 서버에서 최신 코인 가져오기
      fetch('/api/player/' + encodeURIComponent(nickname))
        .then(r => r.json())
        .then(data => {
          playerData.coins = data.coins;
        });
    }
  }

  // 판매수량이 인벤토리 초과 또는 합계 10 초과 시 조정
  const anchMax  = Math.min(10, playerData.inventory.anchovy    || 0);
  const clownMax = Math.min(10, playerData.inventory.clownfish  || 0);
  if (sellUI.amount > anchMax) sellUI.amount = Math.max(0, anchMax);
  if (sellUI.clownfishAmount > clownMax) sellUI.clownfishAmount = Math.max(0, clownMax);
  const total = sellUI.amount + sellUI.clownfishAmount;
  if (total > 10) sellUI.amount = Math.max(0, sellUI.amount - (total - 10));
}

function updateCamera() {
  camera.x = player.x;
  camera.y = player.y;
}

// ── 게임오버 ─────────────────────────────────────
function triggerGameOver() {
  player.alive = false;
  gameOverState = 'falling';
  fadeOpacity = 0;
  fallVelocity = 50;
}

function updateGameOver(dt) {
  if (gameOverState === 'falling') {
    fallVelocity += 200 * dt;
    player.y += fallVelocity * dt;
    fadeOpacity = Math.min(fadeOpacity + dt / 3, 1);
    camera.x = player.x;
    camera.y = player.y;
    if (fadeOpacity >= 1) {
      gameOverState = 'reset';
      // 인벤토리 초기화 (코인 유지)
      playerData.inventory.anchovy = 0;
      savePlayerData().then(() => {
        // 위치/속도 초기화
        player.x = SHIP_WORLD_X;
        player.y = deckTopY() - PLAYER_H / 2;
        player.vx = 0;
        player.vy = 0;
        oxygenTimer = MAX_OXYGEN_SEC;
        graceTimer = MAX_GRACE_SEC;
        player.alive = true;
        gameOverState = 'fadein';
      });
    }
  } else if (gameOverState === 'fadein') {
    fadeOpacity = Math.max(fadeOpacity - dt / 1.5, 0);
    camera.x = player.x;
    camera.y = player.y;
    if (fadeOpacity <= 0) {
      gameOverState = null;
    }
  }
}

// ── 렌더링 ───────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawTerrain();
  drawObstacles();
  drawShip();
  drawSmallBoat();
  drawAnchovies();
  drawClownfishes();
  drawHarpoon();
  drawPlayer();
  drawHUD();
  if (sellUI.visible) drawSellUI();
  drawFadeOverlay();
  if (inventoryOpen) drawInventory();
}

// 월드→화면 좌표 변환 헬퍼
function ws(wx, wy) { return toScreen(wx, wy); }

// ── 장애물 렌더링 ──────────────────────────────────
function drawObstacles() {
  for (const obs of obstacles) {
    if (obs.type === 'rock') drawRock(obs);
    else if (obs.type === 'coral') drawCoral(obs);
  }
}

function drawRock(obs) {
  const cx = obs.x + obs.w / 2;
  const cy = obs.y + obs.h / 2;
  const { sx, sy } = ws(cx, cy);
  const sw = obs.w, sh = obs.h;

  ctx.save();
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(sx + 4, sy + sh/2 + 5, sw/2, 6, 0, 0, Math.PI*2);
  ctx.fill();

  // 돌 몸체 (불규칙 다각형)
  ctx.fillStyle = '#546e7a';
  ctx.strokeStyle = '#37474f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - sw/2,       sy + sh/4);
  ctx.lineTo(sx - sw/2.5,     sy - sh/2);
  ctx.lineTo(sx + sw/6,       sy - sh/2 - 6);
  ctx.lineTo(sx + sw/2,       sy - sh/4);
  ctx.lineTo(sx + sw/2 - 2,   sy + sh/2.5);
  ctx.lineTo(sx + sw/4,       sy + sh/2);
  ctx.lineTo(sx - sw/4,       sy + sh/2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(sx - sw/2.5, sy - sh/2);
  ctx.lineTo(sx - sw/8,   sy - sh/3);
  ctx.lineTo(sx - sw/2,   sy + sh/5);
  ctx.closePath();
  ctx.fill();

  // 균열 선
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - sw/6, sy - sh/4);
  ctx.lineTo(sx + sw/8, sy + sh/6);
  ctx.stroke();

  ctx.restore();
}

function drawCoral(obs) {
  const { sx: bx, sy: by } = ws(obs.drawX, obs.drawY);
  const topWorldY = obs.drawY - obs.h;
  const { sy: ty } = ws(obs.drawX, topWorldY);
  const h = by - ty;
  const color = obs.color;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = color;

  // 메인 줄기
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h*0.55); ctx.stroke();

  // 왼쪽 가지
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(bx, by - h*0.32);
  ctx.lineTo(bx - h*0.38, by - h*0.78);
  ctx.stroke();
  // 오른쪽 가지
  ctx.beginPath();
  ctx.moveTo(bx, by - h*0.44);
  ctx.lineTo(bx + h*0.32, by - h*0.82);
  ctx.stroke();

  // 소가지들
  ctx.lineWidth = 2;
  const lbx = bx - h*0.38, lby = by - h*0.78;
  ctx.beginPath(); ctx.moveTo(lbx, lby); ctx.lineTo(lbx - h*0.18, ty + h*0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lbx, lby); ctx.lineTo(lbx + h*0.12, ty + h*0.05); ctx.stroke();
  const rbx = bx + h*0.32, rby = by - h*0.82;
  ctx.beginPath(); ctx.moveTo(rbx, rby); ctx.lineTo(rbx + h*0.18, ty + h*0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rbx, rby); ctx.lineTo(rbx - h*0.1,  ty); ctx.stroke();

  // 끝부분 원형 꽃봉오리
  const tips = [
    [bx, by - h*0.55],
    [lbx - h*0.18, ty + h*0.12],
    [lbx + h*0.12, ty + h*0.05],
    [rbx + h*0.18, ty + h*0.08],
    [rbx - h*0.1,  ty],
  ];
  for (const [tx, tipY] of tips) {
    ctx.beginPath();
    ctx.arc(tx, tipY, 4.5, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

// ── 흰동가리 렌더링 ───────────────────────────────
function drawClownfishes() {
  for (const c of clownfishes) {
    if (c.dead && !c.collecting) continue;
    const { sx, sy } = ws(c.x, c.y);
    const facing = c.vx >= 0;
    const alpha = c.collecting ? 0.5 : 1;
    drawClownfishSprite(sx, sy, facing, alpha);
  }
}

function drawClownfishSprite(sx, sy, facingRight, alpha) {
  const f = facingRight ? 1 : -1;
  const W = CLOWNFISH_W / 2, H = CLOWNFISH_H / 2;

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;

  // 꼬리
  ctx.fillStyle = '#ff9800';
  ctx.strokeStyle = '#4a2000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - f*W,       sy);
  ctx.lineTo(sx - f*(W+9),   sy - 7);
  ctx.lineTo(sx - f*(W+9),   sy + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 몸통 (클리핑 후 채색 + 줄무늬)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(sx, sy, W, H, 0, 0, Math.PI*2);
  ctx.clip();

  ctx.fillStyle = '#ff6d00';
  ctx.fillRect(sx - W, sy - H, W*2, H*2);

  // 흰 줄무늬 2개 (면적 기준)
  ctx.fillStyle = '#fff';
  const s1 = sx + f*4;
  const s2 = sx - f*1;
  ctx.fillRect(s1 - 2, sy - H, 4, H*2);
  ctx.fillRect(s2 - 1.5, sy - H, 3, H*2);

  ctx.restore();

  // 몸통 외곽선
  ctx.strokeStyle = '#3a1000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(sx, sy, W, H, 0, 0, Math.PI*2);
  ctx.stroke();

  // 등지느러미
  ctx.fillStyle = '#ff6d00';
  ctx.strokeStyle = '#3a1000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - W/2, sy - H);
  ctx.lineTo(sx,       sy - H - 6);
  ctx.lineTo(sx + W/2, sy - H);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 눈 (흰자 + 검은자)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sx + f*6, sy - 2, 3.2, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(sx + f*6.5, sy - 2, 1.8, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

// ── 해저 지형 렌더링 ─────────────────────────────
function drawTerrain() {
  const leftWX  = camera.x - canvas.width;
  const rightWX = camera.x + canvas.width;
  const step = 10;

  ctx.save();

  // 지형 본체 (암석 그라디언트)
  const surfSY = surfaceY() - camera.y + canvas.height * SURFACE_RATIO;
  const grad = ctx.createLinearGradient(0, surfSY, 0, canvas.height);
  grad.addColorStop(0,   '#37474f');
  grad.addColorStop(0.3, '#2e3c43');
  grad.addColorStop(1,   '#1a2529');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(-10, canvas.height + 10);
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, terrainY(wx));
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(canvas.width + 10, canvas.height + 10);
  ctx.closePath();
  ctx.fill();

  // 지형 표면 하이라이트
  ctx.strokeStyle = 'rgba(100,160,180,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, terrainY(wx));
    first ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    first = false;
  }
  ctx.stroke();

  ctx.restore();
}

// ── 인벤토리 패널 ─────────────────────────────────
function getInventoryPanelBounds() {
  if (!inventoryBounds) return null;
  const pw = Math.min(560, canvas.width - 40);
  const ph = 360;
  const px = Math.round(canvas.width  / 2 - pw / 2);
  const py = Math.round(canvas.height / 2 - ph / 2);
  return { px, py, pw, ph };
}

function drawInventory() {
  const ib = getInventoryPanelBounds();
  if (!ib) return;
  const { px, py, pw, ph } = ib;

  // 딤 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 패널
  ctx.save();
  ctx.fillStyle = 'rgba(5,18,48,0.97)';
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fill();
  ctx.stroke();

  // 제목
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#e0f7fa';
  ctx.textAlign = 'center';
  ctx.fillText('🎒 인벤토리', px + pw / 2, py + 38);

  // 닫기 버튼
  ctx.fillStyle = '#455a64';
  ctx.beginPath();
  ctx.roundRect(px + pw - 46, py + 12, 34, 28, 5);
  ctx.fill();
  ctx.fillStyle = '#eceff1';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✕', px + pw - 29, py + 31);

  // 구분선
  ctx.strokeStyle = 'rgba(79,195,247,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 20, py + 50);
  ctx.lineTo(px + pw - 20, py + 50);
  ctx.stroke();

  // 어종 카드
  const species = [
    {
      key: 'anchovy', name: '멸치', nameEn: 'Anchovy',
      coinValue: 1, color: '#b0bec5',
      desc: '얕은 수심에 서식하는 작은 은빛 물고기',
      drawFn: (sx, sy) => drawAnchovyIcon(sx, sy),
    },
    {
      key: 'clownfish', name: '흰동가리', nameEn: 'Clownfish',
      coinValue: 2, color: '#ff9800',
      desc: '깊은 산호 근처에 사는 주황 줄무늬 물고기',
      drawFn: (sx, sy) => drawClownfishIcon(sx, sy),
    },
  ];

  const cardH = 118, cardMargin = 12;
  const cardY0 = py + 60;

  species.forEach((sp, i) => {
    const count = playerData.inventory[sp.key] || 0;
    const cy = cardY0 + i * (cardH + cardMargin);
    const hasItem = count > 0;

    // 카드 배경
    ctx.fillStyle = hasItem ? 'rgba(79,195,247,0.07)' : 'rgba(0,0,0,0.25)';
    ctx.strokeStyle = hasItem ? 'rgba(79,195,247,0.4)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px + 16, cy, pw - 32, cardH, 8);
    ctx.fill();
    ctx.stroke();

    // 물고기 일러스트 영역
    ctx.fillStyle = hasItem ? 'rgba(0,40,80,0.5)' : 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(px + 24, cy + 10, 110, 98, 6);
    ctx.fill();

    ctx.save();
    if (!hasItem) ctx.globalAlpha = 0.3;
    sp.drawFn(px + 79, cy + 59);
    ctx.restore();

    // 텍스트 정보
    ctx.textAlign = 'left';
    const tx = px + 150;

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = hasItem ? '#e0f7fa' : '#546e7a';
    ctx.fillText(sp.name, tx, cy + 30);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#78909c';
    ctx.fillText(sp.nameEn, tx, cy + 48);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = hasItem ? '#cfd8dc' : '#455a64';
    ctx.fillText(sp.desc, tx, cy + 68);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = hasItem ? '#fff' : '#546e7a';
    ctx.fillText(`보유: ${count}마리`, tx, cy + 90);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = hasItem ? '#ffe082' : '#546e7a';
    ctx.fillText(`판매가: ${sp.coinValue}코인/마리`, tx + 110, cy + 90);

    if (hasItem) {
      ctx.fillStyle = '#a5d6a7';
      ctx.fillText(`총 가치: ${count * sp.coinValue}코인`, tx, cy + 108);
    }
  });

  // 하단 힌트
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(100,180,200,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('[ I ] 또는 인벤토리 클릭으로 닫기', px + pw / 2, py + ph - 14);

  ctx.restore();
}

// ── 물고기 아이콘 (인벤토리용, 확대) ────────────────
function drawAnchovyIcon(sx, sy) {
  const W = ANCHOVY_W, H = ANCHOVY_H;
  ctx.save();

  // 꼬리
  ctx.fillStyle = '#a0a0a0';
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - W/2 + 2, sy);
  ctx.lineTo(sx - W/2 - 9, sy - 7);
  ctx.lineTo(sx - W/2 - 9, sy + 7);
  ctx.closePath();
  ctx.fill();

  // 몸통
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(sx, sy, W/2, H/2, 0, 0, Math.PI*2);
  ctx.clip();
  // 은빛 그라디언트
  const g = ctx.createLinearGradient(sx, sy - H/2, sx, sy + H/2);
  g.addColorStop(0, '#dde'); g.addColorStop(0.4, '#c8c8d0'); g.addColorStop(1, '#909090');
  ctx.fillStyle = g;
  ctx.fillRect(sx - W/2, sy - H/2, W, H);
  // 측선
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx - W/2+4, sy); ctx.lineTo(sx + W/2-4, sy); ctx.stroke();
  ctx.restore();

  // 외곽
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(sx, sy, W/2, H/2, 0, 0, Math.PI*2);
  ctx.stroke();

  // 등지느러미
  ctx.fillStyle = 'rgba(150,150,160,0.7)';
  ctx.beginPath();
  ctx.moveTo(sx - W/5, sy - H/2);
  ctx.lineTo(sx + W/10, sy - H/2 - 8);
  ctx.lineTo(sx + W/4, sy - H/2);
  ctx.closePath();
  ctx.fill();

  // 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(sx + W/2 - 5, sy - 1, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(sx + W/2 - 4.5, sy - 1, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(sx + W/2 - 5.5, sy - 2, 0.8, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawClownfishIcon(sx, sy) {
  const W = CLOWNFISH_W * 1.5, H = CLOWNFISH_H * 1.5;
  const hw = W/2, hh = H/2;
  ctx.save();

  // 꼬리
  ctx.fillStyle = '#ff9800';
  ctx.strokeStyle = '#3a1000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - hw + 2, sy);
  ctx.lineTo(sx - hw - 16, sy - 11);
  ctx.lineTo(sx - hw - 16, sy + 11);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 몸통 (clip + 줄무늬)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(sx, sy, hw, hh, 0, 0, Math.PI*2);
  ctx.clip();
  ctx.fillStyle = '#ff6d00';
  ctx.fillRect(sx - hw, sy - hh, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx + hw*0.18 - 4, sy - hh, 7, H);
  ctx.fillRect(sx - hw*0.12 - 3, sy - hh, 6, H);
  // 꼬리 쪽 흰띠
  ctx.fillRect(sx - hw + 3, sy - hh, 5, H);
  ctx.restore();

  // 외곽
  ctx.strokeStyle = '#3a1000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(sx, sy, hw, hh, 0, 0, Math.PI*2);
  ctx.stroke();

  // 등지느러미
  ctx.fillStyle = '#ff6d00';
  ctx.strokeStyle = '#3a1000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - hw*0.5, sy - hh);
  ctx.lineTo(sx, sy - hh - 10);
  ctx.lineTo(sx + hw*0.5, sy - hh);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(sx + hw - 10, sy - 3, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(sx + hw - 9, sy - 3, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(sx + hw - 11, sy - 5, 1.2, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawBackground() {
  // 수면선의 실제 화면 y — 카메라 오프셋 반영
  const surfSY = surfaceY() - camera.y + canvas.height * SURFACE_RATIO;

  // 하늘 (수면선 위)
  if (surfSY > 0) {
    const skyTop = Math.max(0, surfSY);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, skyTop);
    skyGrad.addColorStop(0, '#87ceeb');
    skyGrad.addColorStop(1, '#b3e0f7');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, skyTop);
  }

  // 바다 (수면선 아래)
  const seaTop = Math.max(0, surfSY);
  if (seaTop < canvas.height) {
    const seaGrad = ctx.createLinearGradient(0, seaTop, 0, canvas.height);
    seaGrad.addColorStop(0, '#0277bd');
    seaGrad.addColorStop(0.4, '#01579b');
    seaGrad.addColorStop(1, '#002f6c');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, seaTop, canvas.width, canvas.height - seaTop);
  }

  // 수면선 + 파도 (화면 안에 있을 때만)
  if (surfSY >= 0 && surfSY <= canvas.height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, surfSY);
    ctx.lineTo(canvas.width, surfSY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    const waveOffset = (Date.now() / 500) % (Math.PI * 2);
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 4) {
      const y = surfSY + Math.sin(x / 40 + waveOffset) * 3;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawShip() {
  const { sx, sy } = ws(SHIP_WORLD_X, surfaceY());
  // 선체
  ctx.save();
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.moveTo(sx - SHIP_W / 2, sy);
  ctx.lineTo(sx - SHIP_W / 2 + 10, sy + SHIP_H);
  ctx.lineTo(sx + SHIP_W / 2 - 10, sy + SHIP_H);
  ctx.lineTo(sx + SHIP_W / 2, sy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4e342e';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 갑판
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(sx - SHIP_W / 2, sy - 12, SHIP_W, 12);

  // 돛대
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 12);
  ctx.lineTo(sx, sy - 70);
  ctx.stroke();

  // 돛
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 65);
  ctx.lineTo(sx + 40, sy - 40);
  ctx.lineTo(sx, sy - 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 배 이름
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(nickname + '호', sx, sy - 78);
  ctx.restore();
}

function drawSmallBoat() {
  const bx = SHIP_WORLD_X + SHIP_W / 2 + SMALL_BOAT_OFFSET;
  const by = surfaceY();
  const { sx, sy } = ws(bx, by);

  ctx.save();
  // 선체
  ctx.fillStyle = '#a1887f';
  ctx.beginPath();
  ctx.moveTo(sx - SMALL_W / 2, sy);
  ctx.lineTo(sx - SMALL_W / 2 + 8, sy + SMALL_H);
  ctx.lineTo(sx + SMALL_W / 2 - 8, sy + SMALL_H);
  ctx.lineTo(sx + SMALL_W / 2, sy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 갑판
  ctx.fillStyle = '#bcaaa4';
  ctx.fillRect(sx - SMALL_W / 2, sy - 8, SMALL_W, 8);

  // 상자 아이콘
  ctx.fillStyle = '#ffcc02';
  ctx.fillRect(sx - 14, sy - 26, 28, 20);
  ctx.strokeStyle = '#e65100';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx - 14, sy - 26, 28, 20);
  ctx.beginPath();
  ctx.moveTo(sx, sy - 26);
  ctx.lineTo(sx, sy - 6);
  ctx.moveTo(sx - 14, sy - 16);
  ctx.lineTo(sx + 14, sy - 16);
  ctx.stroke();

  // 라벨
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('판매', sx, sy - 32);
  ctx.restore();
}

function drawAnchovies() {
  for (const a of anchovies) {
    if (a.dead && !a.collecting) continue;
    const { sx, sy } = ws(a.x, a.y);
    ctx.save();
    ctx.fillStyle = a.collecting ? 'rgba(192,192,192,0.5)' : '#c0c0c0';
    ctx.strokeStyle = '#9e9e9e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy, ANCHOVY_W / 2, ANCHOVY_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 눈
    ctx.fillStyle = '#333';
    const eyeOffX = a.vx >= 0 ? ANCHOVY_W / 2 - 4 : -(ANCHOVY_W / 2 - 4);
    ctx.beginPath();
    ctx.arc(sx + eyeOffX, sy - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHarpoon() {
  if (!harpoon.active) return;
  const { sx: px, sy: py } = ws(player.x, player.y);
  const { sx: hx, sy: hy } = ws(harpoon.x, harpoon.y);

  ctx.save();
  // 줄
  ctx.strokeStyle = 'rgba(200,200,200,0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.setLineDash([]);

  // 작살 촉
  ctx.fillStyle = '#bdbdbd';
  ctx.strokeStyle = '#757575';
  ctx.lineWidth = 2;
  const angle = Math.atan2(harpoon.vy, harpoon.vx);
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -4);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const { sx, sy } = ws(player.x, player.y);
  const inWater = player.y > surfaceY();
  const f = playerFacingRight ? 1 : -1;  // 방향 부호

  ctx.save();

  // ── 오리발 (수중에서만) ──
  if (inWater) {
    ctx.fillStyle = '#fdd835';
    // 앞발
    ctx.beginPath();
    ctx.ellipse(sx + f * 10, sy + 18, 12, 4, f * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // 뒷발
    ctx.beginPath();
    ctx.ellipse(sx - f * 2, sy + 18, 9, 3, -f * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 다리 ──
  ctx.fillStyle = inWater ? '#0d47a1' : '#bf360c';
  ctx.fillRect(sx - 11, sy + 7, 9, 12);
  ctx.fillRect(sx + 2,  sy + 7, 9, 12);

  // ── 몸통 (다이빙 슈트) ──
  ctx.fillStyle = inWater ? '#1565c0' : '#e65100';
  ctx.fillRect(sx - 12, sy - 8, 24, 15);
  // 슈트 선
  ctx.strokeStyle = inWater ? '#0a3880' : '#8d1a00';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 7);
  ctx.stroke();

  // ── 산소통 (등 방향) ──
  const tx = sx - f * 15;
  ctx.fillStyle = '#455a64';
  ctx.fillRect(tx - 4, sy - 8, 9, 14);
  ctx.fillStyle = '#b0bec5';
  ctx.fillRect(tx - 2, sy - 5, 4, 10);  // 반사광
  ctx.fillStyle = '#607d8b';
  ctx.fillRect(tx - 3, sy - 12, 7, 6);   // 밸브
  ctx.fillStyle = '#90a4ae';
  ctx.fillRect(tx - 1, sy - 11, 3, 3);   // 밸브 반사

  // ── 공기 호스 (산소통 → 레귤레이터, 수중) ──
  if (inWater) {
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tx + f * 5, sy - 5);
    ctx.quadraticCurveTo(sx + f * 2, sy - 22, sx + f * 11, sy - 14);
    ctx.stroke();
  }

  // ── 머리 ──
  ctx.fillStyle = '#ffcc80';
  ctx.beginPath();
  ctx.arc(sx, sy - 17, 10, 0, Math.PI * 2);
  ctx.fill();

  // ── 다이빙 마스크 ──
  // 프레임 (검정)
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.ellipse(sx + f * 3, sy - 18, 8.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // 렌즈 (하늘색 유리)
  ctx.fillStyle = 'rgba(100,200,255,0.62)';
  ctx.beginPath();
  ctx.ellipse(sx + f * 3, sy - 18, 6.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 렌즈 반사광
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(sx + f * 5, sy - 21, 2.5, 1.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // 마스크 스트랩
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - f * 5, sy - 18);
  ctx.lineTo(sx - f * 10, sy - 18);
  ctx.stroke();

  // ── 레귤레이터 (수중) ──
  if (inWater) {
    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.arc(sx + f * 10, sy - 13, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#546e7a';
    ctx.beginPath();
    ctx.arc(sx + f * 10, sy - 13, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 작살총 ──
  const aimAngle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  const gx = sx + Math.cos(aimAngle) * 10;
  const gy = sy - 2 + Math.sin(aimAngle) * 6;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(aimAngle);
  // 총신
  ctx.fillStyle = '#78909c';
  ctx.fillRect(-2, -2, 26, 5);
  // 총구 나팔
  ctx.fillStyle = '#cfd8dc';
  ctx.fillRect(24, -3, 5, 7);
  // 그립
  ctx.fillStyle = '#546e7a';
  ctx.fillRect(-9, -2, 8, 10);
  // 트리거
  ctx.fillStyle = '#37474f';
  ctx.fillRect(-4, 3, 2.5, 6);
  // 총신 디테일 선
  ctx.strokeStyle = '#546e7a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, 0); ctx.lineTo(22, 0);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // ── 공기방울 ──
  drawBubbles();
}

function drawBubbles() {
  for (const b of bubbles) {
    const { sx, sy } = ws(b.x, b.y);
    ctx.save();
    ctx.globalAlpha = Math.max(0, b.life) * 0.85;
    ctx.strokeStyle = 'rgba(180,230,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
    ctx.stroke();
    // 방울 내부 반사
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(sx - b.r * 0.3, sy - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHUD() {
  drawOxygenBar();
  drawInventoryHUD();
}

function drawOxygenBar() {
  const x = 20, y = 20;
  const w = 200, h = 20;

  // 배경
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  // 산소 비율
  const ratio = oxygenTimer / MAX_OXYGEN_SEC;
  let barColor;
  if (ratio > 0.5) barColor = '#4caf50';
  else if (ratio > 0.25) barColor = '#ffeb3b';
  else barColor = '#f44336';

  ctx.fillStyle = barColor;
  ctx.fillRect(x, y, w * ratio, h);

  // 테두리 (유예 시 깜빡임)
  if (oxygenTimer <= 0) {
    const blink = Math.sin(graceBlinkTimer * 8) > 0;
    ctx.strokeStyle = blink ? '#ff1744' : '#ff8a80';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  }

  // 텍스트
  const oxyText = oxygenTimer > 0
    ? `산소: ${Math.ceil(oxygenTimer)}초`
    : `⚠ 위험! ${Math.ceil(graceTimer)}초`;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(oxyText, x + 4, y + 14);
  ctx.restore();
}

function drawInventoryHUD() {
  const x = canvas.width - 168;
  const y = 20;
  const pw = 198, ph = 112;

  ctx.save();
  // 패널 (호버 효과)
  ctx.fillStyle = inventoryOpen ? 'rgba(10,60,120,0.8)' : 'rgba(0,0,0,0.45)';
  ctx.strokeStyle = inventoryOpen ? '#4fc3f7' : 'transparent';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - 8, y - 8, pw, ph, 8);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.fillText(`🐟 멸치: ${playerData.inventory.anchovy || 0}마리`, x, y + 14);
  ctx.fillStyle = '#ffcc80';
  ctx.fillText(`🐠 흰동가리: ${playerData.inventory.clownfish || 0}마리`, x, y + 38);
  ctx.fillStyle = '#ffe082';
  ctx.fillText(`💰 코인: ${playerData.coins || 0}`, x, y + 62);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(150,220,255,0.7)';
  ctx.fillText('[ I ] 인벤토리', x, y + 84);
  ctx.restore();

  // 클릭 영역 저장
  inventoryBounds = { x: x - 8, y: y - 8, w: pw, h: ph };
}

function drawSellUI() {
  const panelW = 255, panelH = 215;
  const panelX = canvas.width - panelW - 20;
  const panelY = canvas.height - panelH - 20;

  const anchCount  = playerData.inventory.anchovy    || 0;
  const clownCount = playerData.inventory.clownfish  || 0;
  const anchMax  = Math.min(10 - sellUI.clownfishAmount, anchCount);
  const clownMax = Math.min(10 - sellUI.amount, clownCount);
  const totalCoins = sellUI.amount + sellUI.clownfishAmount * 2;
  const canSell = !sellUI.delivering && (sellUI.amount > 0 || sellUI.clownfishAmount > 0);

  ctx.save();
  ctx.fillStyle = 'rgba(10,30,70,0.9)';
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 10);
  ctx.fill();
  ctx.stroke();

  // 제목
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#e0f7fa';
  ctx.textAlign = 'left';
  ctx.fillText('📦 판매 상자', panelX + 14, panelY + 27);

  // ─ 구분선
  ctx.strokeStyle = 'rgba(79,195,247,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 10, panelY + 35);
  ctx.lineTo(panelX + panelW - 10, panelY + 35);
  ctx.stroke();

  // 멸치 행
  const aOk = anchMax > 0 && !sellUI.delivering;
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b3e5fc';
  ctx.textAlign = 'left';
  ctx.fillText(`🐟 멸치 ×1코인  (보유: ${anchCount})`, panelX + 14, panelY + 56);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${sellUI.amount}마리`, panelX + 148, panelY + 56);
  ctx.fillStyle = aOk ? '#80deea' : '#455a64';
  ctx.fillText('[▲]', panelX + 193, panelY + 56);
  ctx.fillText('[▼]', panelX + 222, panelY + 56);

  // 흰동가리 행
  const cOk = clownMax > 0 && !sellUI.delivering;
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#ffcc80';
  ctx.textAlign = 'left';
  ctx.fillText(`🐠 흰동가리 ×2코인  (보유: ${clownCount})`, panelX + 14, panelY + 86);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${sellUI.clownfishAmount}마리`, panelX + 148, panelY + 86);
  ctx.fillStyle = cOk ? '#ffcc02' : '#455a64';
  ctx.fillText('[▲]', panelX + 193, panelY + 86);
  ctx.fillText('[▼]', panelX + 222, panelY + 86);

  // 합계
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#a5d6a7';
  ctx.textAlign = 'left';
  ctx.fillText(`합계: ${totalCoins} 코인`, panelX + 14, panelY + 114);

  // 판매 버튼
  const btnY = panelY + 127;
  ctx.fillStyle = canSell ? '#00acc1' : '#455a64';
  ctx.beginPath();
  ctx.roundRect(panelX + 14, btnY, panelW - 28, 34, 7);
  ctx.fill();
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(sellUI.delivering ? '출항 중...' : '판매하기', panelX + panelW / 2, btnY + 23);

  // 카운트다운
  if (sellUI.delivering) {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffcc02';
    ctx.textAlign = 'left';
    ctx.fillText(`나룻배 출항중: ${Math.ceil(sellUI.countdown)}초`, panelX + 14, panelY + 195);
  }

  ctx.restore();

  sellUI._bounds = { panelX, panelY, panelW, panelH, btnY };
}

canvas.addEventListener('click', onSellUIClick);

function onSellUIClick(e) {
  const rect0 = canvas.getBoundingClientRect();
  const cx0 = e.clientX - rect0.left, cy0 = e.clientY - rect0.top;

  // 인벤토리 HUD 클릭
  if (inventoryBounds &&
      cx0 >= inventoryBounds.x && cx0 <= inventoryBounds.x + inventoryBounds.w &&
      cy0 >= inventoryBounds.y && cy0 <= inventoryBounds.y + inventoryBounds.h) {
    inventoryOpen = !inventoryOpen;
    return;
  }
  // 인벤토리 패널 닫기 (✕ 버튼 또는 외부 클릭)
  if (inventoryOpen) {
    const ib = getInventoryPanelBounds();
    if (!ib) { inventoryOpen = false; return; }
    // ✕ 버튼 영역
    const closeBtnX = ib.px + ib.pw - 46, closeBtnY = ib.py + 12;
    if (cx0 >= closeBtnX && cx0 <= closeBtnX + 34 && cy0 >= closeBtnY && cy0 <= closeBtnY + 28) {
      inventoryOpen = false;
      return;
    }
    // 패널 외부 클릭
    if (!(cx0 >= ib.px && cx0 <= ib.px + ib.pw && cy0 >= ib.py && cy0 <= ib.py + ib.ph)) {
      inventoryOpen = false;
    }
    return;
  }

  if (!sellUI.visible || !sellUI._bounds) return;
  if (sellUI.delivering) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const { panelX, panelY, btnY } = sellUI._bounds;

  const anchMax  = Math.min(10, playerData.inventory.anchovy   || 0);
  const clownMax = Math.min(10, playerData.inventory.clownfish || 0);
  const sellTotal = sellUI.amount + sellUI.clownfishAmount;

  // 멸치 ▲▼ (y: panelY+42 ~ +62)
  if (cy >= panelY + 42 && cy <= panelY + 62) {
    if (cx >= panelX + 186 && cx <= panelX + 214) {
      if (sellUI.amount < anchMax && sellTotal < 10) sellUI.amount++;
    } else if (cx >= panelX + 215 && cx <= panelX + 248) {
      if (sellUI.amount > 0) sellUI.amount--;
    }
  }
  // 흰동가리 ▲▼ (y: panelY+72 ~ +92)
  if (cy >= panelY + 72 && cy <= panelY + 92) {
    if (cx >= panelX + 186 && cx <= panelX + 214) {
      if (sellUI.clownfishAmount < clownMax && sellTotal < 10) sellUI.clownfishAmount++;
    } else if (cx >= panelX + 215 && cx <= panelX + 248) {
      if (sellUI.clownfishAmount > 0) sellUI.clownfishAmount--;
    }
  }
  // 판매하기 버튼
  if (cx >= panelX + 14 && cx <= panelX + 241 && cy >= btnY && cy <= btnY + 34) {
    if (sellUI.amount > 0 || sellUI.clownfishAmount > 0) doSell();
  }
}

async function doSell() {
  const anchovyAmt  = sellUI.amount;
  const clownfishAmt = sellUI.clownfishAmount;
  if (anchovyAmt + clownfishAmt <= 0) return;
  if (anchovyAmt  > (playerData.inventory.anchovy   || 0)) return;
  if (clownfishAmt > (playerData.inventory.clownfish || 0)) return;

  playerData.inventory.anchovy   = (playerData.inventory.anchovy   || 0) - anchovyAmt;
  playerData.inventory.clownfish = (playerData.inventory.clownfish || 0) - clownfishAmt;
  await savePlayerData();

  const res = await fetch('/api/sell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, anchovyAmount: anchovyAmt, clownfishAmount: clownfishAmt })
  });
  const data = await res.json();

  sellUI.delivering = true;
  sellUI.countdown = data.deliverySeconds || 60;
  sellUI.amount = 0;
  sellUI.clownfishAmount = 0;
}

function drawFadeOverlay() {
  if (fadeOpacity <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${fadeOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameOverState === 'falling' && fadeOpacity > 0.5) {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = `rgba(255,100,100,${(fadeOpacity - 0.5) * 2})`;
    ctx.textAlign = 'center';
    ctx.fillText('익사...', canvas.width / 2, canvas.height / 2);
  }
  ctx.restore();
}

// ── 시작 ─────────────────────────────────────────
init();
