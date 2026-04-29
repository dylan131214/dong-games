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
  tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0
}, fishLog: {
  anchovy:0, clownfish:0, salmon:0, barracuda:0,
  tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0
}, upgrades: { flipper:0, oxygen:0, harpoon:0 }};

async function loadPlayerData() {
  const res = await fetch('/api/player/' + encodeURIComponent(nickname));
  if (res.ok) {
    playerData = await res.json();
    if (!playerData.fishLog) playerData.fishLog = {
      anchovy:0, clownfish:0, salmon:0, barracuda:0,
      tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0
    };
    if (!playerData.upgrades) playerData.upgrades = { flipper:0, oxygen:0, harpoon:0 };
  }
}

// ── 업그레이드 효과 ──────────────────────────────────
function effectiveSpeed() { return PLAYER_SPEED + (playerData.upgrades?.flipper||0) * 8; }
function effectiveOxygen() { return MAX_OXYGEN_SEC + (playerData.upgrades?.oxygen||0) * 6; }
function effectiveHarpoonDamage() { return HARPOON_DAMAGE + (playerData.upgrades?.harpoon||0) * 4; }

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

let oxygenTimer = MAX_OXYGEN_SEC, graceTimer = MAX_GRACE_SEC;
let graceBlinkTimer = 0;
let gameOverState = null, fadeOpacity = 0, fallVelocity = 0;
let playerFacingRight = true;
let bubbles = [], bubbleTimer = 0;
let inventoryOpen = false;
let harpoonCooldown = 0;

const keys = {};
let mouseWorld = { x: 0, y: 0 };

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
  await loadPlayerData();
  oxygenTimer = effectiveOxygen();
  player.x = ENTRY_X;
  player.y = caveCeilY(ENTRY_X) + 110;

  spawnBarracudas(BARRACUDA_MAX);
  spawnOctopuses(OCTOPUS_MAX);
  spawnMorays(MORAY_MAX);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyI') inventoryOpen = !inventoryOpen;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  requestAnimationFrame(loop);
}

// ── 스폰 ─────────────────────────────────────────
function mkFish(extra) {
  return { dead:false, collecting:false, collectT:0, collectDur:0.5, startX:0, startY:0, flashTimer:0, dirTimer:Math.random()*3, ...extra };
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

// ── 입력 ─────────────────────────────────────────
function onMouseMove(e) {
  const r = canvas.getBoundingClientRect();
  const w = toWorld(e.clientX - r.left, e.clientY - r.top);
  mouseWorld.x = w.wx; mouseWorld.y = w.wy;
}

function onMouseDown(e) {
  if (e.button !== 0 || !player.alive || gameOverState) return;
  if (inventoryOpen) return;

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
  harpoonCooldown = 1.0;
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
  if (inventoryOpen) return;
  if (gameOverState) { updateGameOver(dt); return; }
  if (harpoonCooldown > 0) harpoonCooldown = Math.max(0, harpoonCooldown - dt);
  updatePlayer(dt);
  updateOxygen(dt);
  updateHarpoon(dt);
  updateBarracudas(dt);
  updateOctopuses(dt);
  updateMorays(dt);
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
  if (harpoon.dist >= HARPOON_MAX_DIST) { harpoon.returning = true; return; }

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
    f.dirTimer -= dt;
    if (f.dirTimer <= 0) {
      f.dirTimer = 1.5 + Math.random() * 3;
      f.vx = (Math.random() < 0.5 ? 1 : -1) * speed;
      f.vy = (Math.random() - 0.5) * 25;
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

function updateBarracudas(dt) {
  updateCaveFish(barracudas, dt, BARRACUDA_SPEED, 2200);
  barracudas = barracudas.filter(f => filterCollect(f, dt, 'barracuda', spawnBarracuda));
}
function updateOctopuses(dt) {
  updateCaveFish(octopuses, dt, OCTOPUS_SPEED, 2000);
  octopuses = octopuses.filter(f => filterCollect(f, dt, 'octopus', spawnOctopus));
}
function updateMorays(dt) {
  updateCaveFish(morays, dt, MORAY_SPEED, 2000);
  morays = morays.filter(f => filterCollect(f, dt, 'moray', spawnMoray));
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
      playerData.inventory = { anchovy:0, clownfish:0, salmon:0, barracuda:0, tropicalfish:0, turtle:0, butterflyfish:0, octopus:0, moray:0 };
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
  drawExitPortal();
  drawBarracudas();
  drawOctopuses();
  drawMorays();
  drawHarpoon();
  drawPlayer();
  drawBubbles();
  drawHUD();
  drawFadeOverlay();
  if (inventoryOpen) drawInventory();
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
  ctx.fillStyle = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.4);
  const cg = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.4);
  cg.addColorStop(0, '#0a1e16'); cg.addColorStop(1, '#132b20');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.moveTo(-10, -10);
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveCeilY(wx)); ctx.lineTo(sx, sy);
  }
  ctx.lineTo(canvas.width + 10, -10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,200,120,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); let fc = true;
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveCeilY(wx));
    fc ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); fc = false;
  }
  ctx.stroke();
  ctx.restore();

  // 바닥
  ctx.save();
  const fg = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
  fg.addColorStop(0, '#0d1e16'); fg.addColorStop(1, '#050c0a');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(-10, canvas.height + 10);
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveFlrY(wx)); ctx.lineTo(sx, sy);
  }
  ctx.lineTo(canvas.width + 10, canvas.height + 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,160,100,0.22)'; ctx.lineWidth = 2;
  ctx.beginPath(); let ff = true;
  for (let wx = leftWX; wx <= rightWX + step; wx += step) {
    const { sx, sy } = ws(wx, caveFlrY(wx));
    ff ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); ff = false;
  }
  ctx.stroke();
  ctx.restore();
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
    { key:'barracuda', label:'바라쿠다', color:'#90caf9' },
    { key:'octopus',   label:'문어',     color:'#ce93d8' },
    { key:'moray',     label:'곰치',     color:'#dce775' },
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
    { key:'barracuda', name:'바라쿠다', coinValue:10, desc:'날카로운 이빨의 동굴 포식자' },
    { key:'octopus',   name:'문어',     coinValue:20, desc:'동굴 바닥을 기어다닌다' },
    { key:'moray',     name:'곰치',     coinValue:15, desc:'얼룩무늬 긴 뱀장어' },
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
