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
const HARPOON_MAX_DIST = 300;
const HARPOON_HIT_RADIUS = 10;
const HARPOON_DAMAGE = 20;
const MAX_OXYGEN_SEC = 60;
const MAX_GRACE_SEC = 10;
const SELL_BOAT_RADIUS = 50;
const ANCHOVY_REGEN_MS = 10000;

const GRAVITY = 500;
const JUMP_VY = -380;
const BUOYANCY_ACCEL = 70;
const SWIM_ACCEL = 12;
const SWIM_DRAG = 3.5;

// 물고기 상수
const ANCHOVY_MAX=20, ANCHOVY_W=15, ANCHOVY_H=8, ANCHOVY_SPEED=80, ANCHOVY_HP=20;
const CLOWNFISH_MAX=8, CLOWNFISH_W=22, CLOWNFISH_H=13, CLOWNFISH_SPEED=55, CLOWNFISH_HP=20;
const SALMON_MAX=6, SALMON_W=32, SALMON_H=16, SALMON_SPEED=90, SALMON_HP=40;
const BARRACUDA_MAX=4, BARRACUDA_W=55, BARRACUDA_H=14, BARRACUDA_SPEED=130, BARRACUDA_HP=100;
const TROPICALFISH_MAX=7, TROPICALFISH_W=22, TROPICALFISH_H=13, TROPICALFISH_SPEED=65, TROPICALFISH_HP=30;
const TURTLE_MAX=4, TURTLE_W=44, TURTLE_H=30, TURTLE_SPEED=35, TURTLE_HP=200;
const BUTTERFLYFISH_MAX=4, BUTTERFLYFISH_W=20, BUTTERFLYFISH_H=20, BUTTERFLYFISH_SPEED=70, BUTTERFLYFISH_CHASE_SPEED=130, BUTTERFLYFISH_HP=30;
const OCTOPUS_MAX=4, OCTOPUS_W=36, OCTOPUS_H=26, OCTOPUS_SPEED=50, OCTOPUS_HP=150;
const MORAY_MAX=4, MORAY_W=58, MORAY_H=10, MORAY_SPEED=90, MORAY_HP=80;

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
let inventoryOpen=false, inventoryBounds=null;
let logOpen=false, logBounds=null, logScrollY=0;
let sellPanelOpen=false, sellPanelBounds=null, sellPromptBounds=null;
let shopOpen=false, shopBtnBounds=null;
let tealBlockedTimer=0;
let harpoonCooldown=0;
let butterflyfishAgro=false;

// ── 업그레이드 효과 ──────────────────────────────────
function effectiveSpeed() { return PLAYER_SPEED_WATER + (playerData.upgrades?.flipper||0) * 8; }
function effectiveOxygen() { return MAX_OXYGEN_SEC + (playerData.upgrades?.oxygen||0) * 6; }
function effectiveHarpoonDamage() { return HARPOON_DAMAGE + (playerData.upgrades?.harpoon||0) * 4; }

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
    const r = 22 + seededRandFR(seed * 7.3) * 36;
    rocks.push({ x: rx, y: ry, r, seed });
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

// ── 서식지별 범위 헬퍼 ────────────────────────────
function randomSea1Y(sx, H) {
  const ty=terrainY(sx);
  return surfaceY()+30+Math.random()*Math.max(50,ty-surfaceY()-H-60);
}
function randomTealY(sx, H) {
  const ty=terrainY(sx), t2y=terrain2Y(sx);
  return ty+SHAFT_DEPTH+30+Math.random()*Math.max(50,t2y-ty-SHAFT_DEPTH-H-60);
}
function clampSea1Fish(f, H) {
  if(f.y<surfaceY()+30){f.y=surfaceY()+30;f.vy=Math.abs(f.vy);}
  const ceil=terrainY(f.x)-H-6; if(f.y>ceil){f.y=ceil;f.vy=-Math.abs(f.vy);}
}
function clampTealFish(f, H) {
  const ty=terrainY(f.x), t2y=terrain2Y(f.x);
  if(f.y<ty+SHAFT_DEPTH+30){f.y=ty+SHAFT_DEPTH+30;f.vy=Math.abs(f.vy);}
  if(f.y>t2y-H-6){f.y=t2y-H-6;f.vy=-Math.abs(f.vy);}
}

const keys={};
let mouseWorld={x:0,y:0};

const sellUI={
  visible:false, delivering:false, countdown:0,
  amount:0, clownfishAmount:0, salmonAmount:0, barracudaAmount:0,
  tropicalfishAmount:0, turtleAmount:0, butterflyfishAmount:0, octopusAmount:0, morayAmount:0,
};

// ── 초기화 ───────────────────────────────────────
async function init() {
  await loadPlayerData();
  oxygenTimer = effectiveOxygen();
  player.x = SHIP_WORLD_X;
  player.y = deckTopY() - PLAYER_H/2;

  spawnAnchovies(ANCHOVY_MAX);
  spawnClownfishes(CLOWNFISH_MAX);
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
    if(e.code==='KeyJ'||e.code==='Escape'){logOpen=false;searchEl.style.display='none';searchEl.value='';logSearchText='';}
    e.stopPropagation();
  });

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', e => {
    keys[e.code]=true;
    if(e.code==='KeyI') { inventoryOpen=!inventoryOpen; if(inventoryOpen){logOpen=false;sellPanelOpen=false;shopOpen=false;} }
    if(e.code==='KeyJ') {
      logOpen=!logOpen;
      const se=document.getElementById('log-search');
      if(logOpen){inventoryOpen=false;sellPanelOpen=false;shopOpen=false;logScrollY=0;positionLogSearch();se.style.display='block';setTimeout(()=>se.focus(),10);}
      else{se.style.display='none';se.value='';logSearchText='';}
    }
    if(e.code==='Enter') {
      const ce=document.getElementById('cmd-input');
      if(document.activeElement!==ce){ce.style.display='block';ce.focus();}
    }
    if(e.code==='Escape') { shopOpen=false; const ce=document.getElementById('cmd-input');ce.style.display='none';ce.value=''; }
  });
  window.addEventListener('keyup', e => { keys[e.code]=false; });
  window.addEventListener('resize', ()=>{ if(logOpen) positionLogSearch(); });
  canvas.addEventListener('click', onSellUIClick);
  canvas.addEventListener('wheel', e => {
    if(logOpen) { logScrollY+=e.deltaY*0.8; e.preventDefault(); }
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

// 해저 지형 2 (청록빛 바다 바닥 / 동굴 천장) — 샤프트 끝(+400)에서 400유닛 아래
function terrain2Y(wx) {
  let y=terrainY(wx)+800;
  y+=Math.sin(wx*0.0055+1.8)*55;
  y+=Math.sin(wx*0.017+3.2)*28;
  y+=Math.sin(wx*0.048+0.7)*14;
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
    if(x!==null&&x>=fromWX-200&&x<=toWX+200) objs.push({x,y:terrainY(x)+650});
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
  return { dead:false, collecting:false, collectT:0, collectDur:0.5, startX:0, startY:0, flashTimer:0, dirTimer:Math.random()*3, ...extra };
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

// ── 입력 ─────────────────────────────────────────
function onMouseMove(e) {
  const r=canvas.getBoundingClientRect();
  const w=toWorld(e.clientX-r.left,e.clientY-r.top);
  mouseWorld.x=w.wx; mouseWorld.y=w.wy;
}
function onMouseDown(e) {
  if(e.button!==0||!player.alive||gameOverState) return;

  // 상점 패널 열린 상태면 패널 내 클릭 처리
  if(shopOpen) { handleShopClick(e); return; }

  if(inventoryOpen||logOpen||sellPanelOpen) return;

  // 상점 버튼 클릭 (화면 좌표 기준)
  if(shopBtnBounds) {
    const r=canvas.getBoundingClientRect();
    const cx=e.clientX-r.left, cy=e.clientY-r.top;
    if(cx>=shopBtnBounds.x&&cx<=shopBtnBounds.x+shopBtnBounds.w&&cy>=shopBtnBounds.y&&cy<=shopBtnBounds.y+shopBtnBounds.h) {
      shopOpen=true; return;
    }
  }

  // 동굴 입구 클릭 → 전용 맵으로 이동
  if(playerZone==='teal') {
    const caveObjs=getVisibleCaveObjs(player.x-canvas.width,player.x+canvas.width);
    for(const obj of caveObjs){
      const dx=mouseWorld.x-obj.x, dy=mouseWorld.y-obj.y;
      if(Math.sqrt(dx*dx+dy*dy)<90){
        savePlayerData().then(()=>{ window.location.href='cave.html'; });
        return;
      }
    }
  }

  if(harpoonCooldown>0) return;
  const dx=mouseWorld.x-player.x, dy=mouseWorld.y-player.y;
  const dist=Math.sqrt(dx*dx+dy*dy)||1;
  harpoon.active=true; harpoon.returning=false;
  harpoon.x=player.x; harpoon.y=player.y;
  harpoon.vx=(dx/dist)*HARPOON_SPEED; harpoon.vy=(dy/dist)*HARPOON_SPEED;
  harpoon.dist=0;
  harpoonCooldown=1.0;
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
  if(inventoryOpen||logOpen||sellPanelOpen||shopOpen) return;
  if(gameOverState) { updateGameOver(dt); return; }
  if(harpoonCooldown>0) harpoonCooldown=Math.max(0,harpoonCooldown-dt);
  if(tealBlockedTimer>0) tealBlockedTimer=Math.max(0,tealBlockedTimer-dt);
  updatePlayer(dt);
  updateOxygen(dt);
  updateHarpoon(dt);
  updateAnchovies(dt);
  updateClownfishes(dt);
  updateSalmons(dt);
  updateTropicalFishes(dt);
  updateTurtles(dt);
  updateButterflyfishes(dt);
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
  const inWater=player.y>surfaceY();
  let ix=0,iy=0;
  if(keys['KeyW']||keys['ArrowUp']) iy-=1;
  if(keys['KeyS']||keys['ArrowDown']) iy+=1;
  if(keys['KeyA']||keys['ArrowLeft']) ix-=1;
  if(keys['KeyD']||keys['ArrowRight']) ix+=1;

  if(inWater) {
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
  if(playerZone==='sea1') resolveFloatingRockCollision();
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

  if(playerZone==='sea1') {
    const ty=terrainY(px);
    const inHole=isInHoleAt(px);
    if(!inHole) {
      // 지형 표면: 위에서 내려오면 막기
      if(player.y+ph>ty) { player.y=ty-ph; if(player.vy>0) player.vy=0; }
    } else {
      // 샤프트 구간: 횡방향 벽 제한
      if(player.y>ty&&player.y<ty+SHAFT_DEPTH) constrainToShaft(px);
      // 샤프트 끝(SHAFT_DEPTH)에서 청록빛 바다로 전환 (산소통 10레벨 이상 필요)
      if(player.y>ty+SHAFT_DEPTH+30) {
        if((playerData.upgrades?.oxygen||0)>=10) {
          playerZone='teal';
        } else {
          player.y=ty+SHAFT_DEPTH+30; if(player.vy>0) player.vy=-80;
          tealBlockedTimer=2.5;
        }
      }
    }
  } else if(playerZone==='teal') {
    const ty=terrainY(px);
    const rockBottom=ty+SHAFT_DEPTH; // 암석 밴드 하단
    const inHole=isInHoleAt(px);
    if(!inHole) {
      if(player.y-ph<rockBottom) { player.y=rockBottom+ph; if(player.vy<0) player.vy=0; }
    } else {
      if(player.y>ty&&player.y<rockBottom) constrainToShaft(px);
      if(player.y<ty-100) playerZone='sea1';
    }
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
  if(infiniteOxygen){oxygenTimer=effectiveOxygen();graceTimer=MAX_GRACE_SEC;return;}
  if(oxygenTimer>0) { oxygenTimer=Math.max(0,oxygenTimer-dt); }
  else { graceTimer=Math.max(0,graceTimer-dt); }
  graceBlinkTimer+=dt;
  if(graceTimer<=0) triggerGameOver();
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
  harpoon.x+=harpoon.vx*dt;
  harpoon.y+=harpoon.vy*dt;
  harpoon.dist+=Math.sqrt(harpoon.vx*harpoon.vx+harpoon.vy*harpoon.vy)*dt;
  if(harpoon.dist>=HARPOON_MAX_DIST) { harpoon.returning=true; return; }

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
  if(hitCheck(butterflyfishes,4,
    ()=>{ butterflyfishAgro=true; },
    ()=>{ butterflyfishAgro=true; })) return;
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

function updateAnchovies(dt) {
  for(const a of anchovies) {
    if(a.dead||a.collecting) continue;
    a.dirTimer-=dt;
    if(a.dirTimer<=0) { a.dirTimer=2+Math.random()*3; a.vx=(Math.random()<0.5?1:-1)*ANCHOVY_SPEED; a.vy=(Math.random()-0.5)*40; }
    a.x+=a.vx*dt; a.y+=a.vy*dt;
    clampSea1Fish(a,ANCHOVY_H);
    if(Math.abs(a.x-player.x)>2000){a.x=player.x+(Math.random()-0.5)*1400;a.y=randomSea1Y(a.x,ANCHOVY_H);}
  }
  anchovies=anchovies.filter(a=>{
    if(!a.collecting) return true;
    a.collectT+=dt;
    const t=Math.min(a.collectT/a.collectDur,1);
    a.x=a.startX+(player.x-a.startX)*t; a.y=a.startY+(player.y-a.startY)*t;
    if(t>=1){playerData.inventory.anchovy=(playerData.inventory.anchovy||0)+1;playerData.fishLog.anchovy=(playerData.fishLog.anchovy||0)+1;savePlayerData();setTimeout(spawnAnchovy,ANCHOVY_REGEN_MS);return false;}
    return true;
  });
}

function updateClownfishes(dt) {
  for(const c of clownfishes) {
    if(c.dead||c.collecting) continue;
    if(c.flashTimer>0)c.flashTimer-=dt;
    c.dirTimer-=dt;
    if(c.dirTimer<=0){c.dirTimer=1.5+Math.random()*2.5;c.vx=(Math.random()<0.5?1:-1)*CLOWNFISH_SPEED;c.vy=(Math.random()-0.5)*35;}
    c.x+=c.vx*dt;c.y+=c.vy*dt;
    clampSea1Fish(c,CLOWNFISH_H);
    if(Math.abs(c.x-player.x)>2000){c.x=player.x+(Math.random()-0.5)*1400;c.y=randomSea1Y(c.x,CLOWNFISH_H);}
  }
  clownfishes=clownfishes.filter(c=>{
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
  for(const f of tropicalfishes) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0){f.dirTimer=2+Math.random()*3;f.vx=(Math.random()<0.5?1:-1)*TROPICALFISH_SPEED;f.vy=(Math.random()-0.5)*35;}
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,TROPICALFISH_H);
    if(Math.abs(f.x-player.x)>2000){f.x=player.x+(Math.random()-0.5)*1600;f.y=randomTealY(f.x,TROPICALFISH_H);}
  }
  tropicalfishes=tropicalfishes.filter(f=>{
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.tropicalfish=(playerData.inventory.tropicalfish||0)+1;playerData.fishLog.tropicalfish=(playerData.fishLog.tropicalfish||0)+1;savePlayerData();setTimeout(spawnTropicalFish,ANCHOVY_REGEN_MS*1.5);return false;}
    return true;
  });
}

function updateTurtles(dt) {
  for(const f of turtles) {
    if(f.dead||f.collecting)continue;
    if(f.flashTimer>0)f.flashTimer-=dt;
    f.dirTimer-=dt;
    if(f.dirTimer<=0){f.dirTimer=3+Math.random()*4;f.vx=(Math.random()<0.5?1:-1)*TURTLE_SPEED;f.vy=(Math.random()-0.5)*15;}
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
      // 플레이어 추적
      const dx=player.x-f.x, dy=player.y-f.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      if(dist<28) {
        // 산소 10초 감소
        oxygenTimer=Math.max(0,oxygenTimer-10);
        f.touchCooldown=6;
        f.vx=-f.vx; f.vy=-f.vy; // 튕겨 나감
      } else {
        f.vx=(dx/dist)*BUTTERFLYFISH_CHASE_SPEED;
        f.vy=(dy/dist)*BUTTERFLYFISH_CHASE_SPEED;
      }
    } else {
      f.dirTimer-=dt;
      if(f.dirTimer<=0){f.dirTimer=2+Math.random()*3;f.vx=(Math.random()<0.5?1:-1)*BUTTERFLYFISH_SPEED;f.vy=(Math.random()-0.5)*35;}
    }
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    clampTealFish(f,BUTTERFLYFISH_H);
    if(Math.abs(f.x-player.x)>2200){
      f.x=player.x+(Math.random()-0.5)*2000;
      f.y=randomTealY(f.x,BUTTERFLYFISH_H);
    }
  }
  butterflyfishes=butterflyfishes.filter(f=>{
    if(!f.collecting)return true;
    f.collectT+=dt;const t=Math.min(f.collectT/f.collectDur,1);
    f.x=f.startX+(player.x-f.startX)*t;f.y=f.startY+(player.y-f.startY)*t;
    if(t>=1){playerData.inventory.butterflyfish=(playerData.inventory.butterflyfish||0)+1;playerData.fishLog.butterflyfish=(playerData.fishLog.butterflyfish||0)+1;savePlayerData();setTimeout(spawnButterflyfish,ANCHOVY_REGEN_MS*2);return false;}
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
  const keys2=['amount','clownfishAmount','salmonAmount','barracudaAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','octopusAmount','morayAmount'];
  const invs=['anchovy','clownfish','salmon','barracuda','tropicalfish','turtle','butterflyfish','octopus','moray'];
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
        tropicalfish:0,turtle:0,butterflyfish:0,octopus:0,moray:0};
      // 인벤토리만 초기화 저장 (fishLog는 전송하지 않아 서버가 보존)
      fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({nickname:playerData.nickname,inventory:playerData.inventory})
      }).then(()=>{
        player.x=SHIP_WORLD_X; player.y=deckTopY()-PLAYER_H/2; player.vx=0; player.vy=0;
        oxygenTimer=effectiveOxygen(); graceTimer=MAX_GRACE_SEC;
        playerZone='sea1'; tealTransitionAlpha=0; cameraOffsetY=0;
        butterflyfishAgro=false; player.alive=true; gameOverState='fadein';
      });
    }
  } else if(gameOverState==='fadein') {
    fadeOpacity=Math.max(fadeOpacity-dt/1.5,0);
    camera.x=player.x; camera.y=player.y;
    if(fadeOpacity<=0) gameOverState=null;
  }
}

// ── 렌더링 ───────────────────────────────────────
function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground();
  drawTerrain();
  drawFloatingRocks();
  drawCaveObjects();
  drawShip();
  drawSmallBoat();
  drawAnchovies();
  drawClownfishes();
  drawSalmons();
  drawTropicalFishes();
  drawTurtles();
  drawButterflyfishes();
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

  // 지형 채우기
  const grad=ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0,'#37474f'); grad.addColorStop(0.3,'#2e3c43'); grad.addColorStop(1,'#1a2529');
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.moveTo(-10,canvas.height+10);
  for(let wx=leftWX;wx<=rightWX+step;wx+=step){const{sx,sy}=ws(wx,terrainY(wx));ctx.lineTo(sx,sy);}
  ctx.lineTo(canvas.width+10,canvas.height+10); ctx.closePath(); ctx.fill();

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

function drawHarpoon() {
  if(!harpoon.active)return;
  const{sx:px,sy:py}=ws(player.x,player.y);
  const{sx:hx,sy:hy}=ws(harpoon.x,harpoon.y);
  ctx.save();
  ctx.strokeStyle='rgba(200,200,200,0.6)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(hx,hy);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#bdbdbd';ctx.strokeStyle='#757575';ctx.lineWidth=2;
  const angle=Math.atan2(harpoon.vy,harpoon.vx);
  ctx.translate(hx,hy);ctx.rotate(angle);
  ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-6,-4);ctx.lineTo(-4,0);ctx.lineTo(-6,4);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
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
  ctx.save();ctx.translate(gx,gy);ctx.rotate(aimAngle);
  if(harpoonTier>=3){ctx.shadowColor=harpoonColor;ctx.shadowBlur=8;}
  ctx.fillStyle=harpoonColor;ctx.fillRect(-2,-2,26,5);
  ctx.fillStyle=harpoonTier>=2?harpoonColor:'#cfd8dc';ctx.fillRect(24,-3,5,7);
  ctx.fillStyle='#546e7a';ctx.fillRect(-9,-2,8,10);ctx.fillStyle='#37474f';ctx.fillRect(-4,3,2.5,6);
  ctx.strokeStyle=harpoonTier>=1?harpoonColor:'#546e7a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(22,0);ctx.stroke();
  ctx.shadowBlur=0;
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
function drawHUD() { drawOxygenBar(); drawInventoryHUD(); drawHarpoonCooldown(); }

function drawHarpoonCooldown() {
  if(harpoonCooldown<=0) return;
  const r=harpoonCooldown/1.0;
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
    {key:'barracuda',label:'바라쿠다',color:'#90caf9'},
    {key:'octopus',label:'문어',color:'#ce93d8'},
    {key:'moray',label:'곰치',color:'#dce775'},
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
  ctx.fillText('[ J ] 도감',x,oy);
  ctx.restore();
  inventoryBounds={x:x-8,y:y-8,w:pw,h:ph};
}

// ── 인벤토리 패널 ─────────────────────────────────
const ALL_SPECIES=[
  {key:'anchovy',   name:'멸치',    coinValue:1,  desc:'얕은 수심 은빛 물고기',        drawFn:(x,y)=>drawAnchovyIcon(x,y)},
  {key:'clownfish', name:'흰동가리',coinValue:2,  desc:'산호 근처 주황 줄무늬 물고기', drawFn:(x,y)=>drawClownfishIcon(x,y)},
  {key:'salmon',    name:'연어',    coinValue:5,  desc:'중간 수심 분홍빛 물고기',       drawFn:(x,y)=>drawSalmonIcon(x,y)},
  {key:'tropicalfish',name:'열대어',coinValue:3,  desc:'형형색색 줄무늬 물고기',        drawFn:(x,y)=>drawTropicalfishIcon(x,y)},
  {key:'turtle',    name:'거북이',  coinValue:24, desc:'심해를 유영하는 초록 거북이',   drawFn:(x,y)=>drawTurtleIcon(x,y)},
  {key:'butterflyfish',name:'나비고기',coinValue:5,desc:'나비 같은 날개의 희귀 물고기',drawFn:(x,y)=>drawButterflyfishIcon(x,y)},
  {key:'barracuda', name:'바라쿠다',coinValue:10, desc:'동굴 포식자 날카로운 이빨',     drawFn:(x,y)=>drawBarracudaIcon(x,y)},
  {key:'octopus',   name:'문어',    coinValue:20, desc:'동굴 바닥 적자색 문어',         drawFn:(x,y)=>drawOctopusIcon(x,y)},
  {key:'moray',     name:'곰치',    coinValue:15, desc:'동굴 얼룩무늬 긴 뱀장어',       drawFn:(x,y)=>drawMorayIcon(x,y)},
];

function drawInventory() {
  const visible=ALL_SPECIES.filter(sp=>(playerData.inventory[sp.key]||0)>0);
  const pw=Math.min(560,canvas.width-40);
  const cardH=80,cardMargin=6;
  const contentH=visible.length>0?visible.length*(cardH+cardMargin)-cardMargin:36;
  const ph=Math.max(140,60+contentH+24);
  const px=Math.round(canvas.width/2-pw/2);
  const py=Math.round(canvas.height/2-ph/2);

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
    const cardY0=py+54;
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

// ── 판매 UI ──────────────────────────────────────
function buildSellRows() {
  const defs=[
    {label:'멸치 ×1코인',      inv:'anchovy',       key:'amount',              col:'#b3e5fc'},
    {label:'흰동가리 ×2코인',  inv:'clownfish',     key:'clownfishAmount',     col:'#ffcc80'},
    {label:'연어 ×5코인',      inv:'salmon',        key:'salmonAmount',        col:'#f48fb1'},
    {label:'열대어 ×3코인',    inv:'tropicalfish',  key:'tropicalfishAmount',  col:'#80deea'},
    {label:'거북이 ×24코인',   inv:'turtle',        key:'turtleAmount',        col:'#a5d6a7'},
    {label:'나비고기 ×5코인',  inv:'butterflyfish', key:'butterflyfishAmount', col:'#fff176'},
    {label:'바라쿠다 ×10코인', inv:'barracuda',     key:'barracudaAmount',     col:'#90caf9'},
    {label:'문어 ×20코인',     inv:'octopus',       key:'octopusAmount',       col:'#ce93d8'},
    {label:'곰치 ×15코인',     inv:'moray',         key:'morayAmount',         col:'#dce775'},
  ].filter(r=>(playerData.inventory[r.inv]||0)>0);
  const sellTotal=Object.values(sellUI).filter((v,i)=>typeof v==='number'&&i>0&&i<10).reduce((a,b)=>a+b,0);
  const total=['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','barracudaAmount','octopusAmount','morayAmount'].reduce((s,k)=>s+(sellUI[k]||0),0);
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
      const{px,py,pw,ph,btnY,rowsMeta}=sellPanelBounds;
      if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){sellPanelOpen=false;return;}
      if(!(cx>=px&&cx<=px+pw&&cy>=py&&cy<=py+ph)){sellPanelOpen=false;return;}
      const KEYS=['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','barracudaAmount','octopusAmount','morayAmount'];
      const total=KEYS.reduce((s,k)=>s+(sellUI[k]||0),0);
      (rowsMeta||[]).forEach(row=>{
        const bx2=px+pw-110;
        if(cy>=row.ry+12&&cy<=row.ry+34){
          const mx=Math.min(10-(total-sellUI[row.key]),playerData.inventory[row.inv]||0);
          if(cx>=bx2+22&&cx<=bx2+48){if(sellUI[row.key]<mx&&total<10)sellUI[row.key]++;}
          else if(cx>=bx2+50&&cx<=bx2+76){if(sellUI[row.key]>0)sellUI[row.key]--;}
        }
      });
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
    const ph=Math.max(140,60+contentH+24);
    const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
    if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){inventoryOpen=false;return;}
    if(!(cx>=px&&cx<=px+pw&&cy>=py&&cy<=py+ph)) inventoryOpen=false;
    return;
  }

  // 판매 프롬프트 버튼 클릭 → 판매 패널 열기
  if(sellUI.visible && sellPromptBounds){
    const{x,y,w,h}=sellPromptBounds;
    if(cx>=x&&cx<=x+w&&cy>=y&&cy<=y+h){
      sellPanelOpen=true; return;
    }
  }
}

async function doSell() {
  const amts={
    anchovy:sellUI.amount, clownfish:sellUI.clownfishAmount, salmon:sellUI.salmonAmount,
    tropicalfish:sellUI.tropicalfishAmount, turtle:sellUI.turtleAmount,
    butterflyfish:sellUI.butterflyfishAmount, barracuda:sellUI.barracudaAmount,
    octopus:sellUI.octopusAmount, moray:sellUI.morayAmount,
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
  ['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','barracudaAmount','octopusAmount','morayAmount'].forEach(k=>sellUI[k]=0);
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
  '거북이':'turtle','나비고기':'butterflyfish','바라쿠다':'barracuda','문어':'octopus','곰치':'moray'
};

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
  }
}

// ── 도감 데이터 ──────────────────────────────────
const FISH_CATALOG=[
  { region:'얕은 바다', keys:['anchovy','clownfish','tropicalfish','butterflyfish'] },
  { region:'중간 수심', keys:['salmon','turtle'] },
  { region:'동굴',     keys:['barracuda','octopus','moray'] },
];
const FISH_DATA={
  anchovy:     {name:'멸치',    hp:20,  trait:'방향 전환이 매우 빠르다',              habitat:'일반 바다 전역',      coinValue:1,  drawFn:(x,y)=>drawAnchovyIcon(x,y)},
  clownfish:   {name:'흰동가리',hp:20,  trait:'산호초 근처를 맴돈다',                 habitat:'일반 바다 전역',      coinValue:2,  drawFn:(x,y)=>drawClownfishIcon(x,y)},
  tropicalfish:{name:'열대어',  hp:30,  trait:'화려한 줄무늬 체색',                   habitat:'청록빛 바다 전역',    coinValue:3,  drawFn:(x,y)=>drawTropicalfishIcon(x,y)},
  butterflyfish:{name:'나비고기',hp:30, trait:'자극 시 추적하며 산소를 빼앗는다',      habitat:'청록빛 바다 전역',    coinValue:5,  drawFn:(x,y)=>drawButterflyfishIcon(x,y)},
  salmon:      {name:'연어',    hp:40,  trait:'빠른 유영 속도',                       habitat:'중간 수심 600~1600m', coinValue:5,  drawFn:(x,y)=>drawSalmonIcon(x,y)},
  turtle:      {name:'거북이',  hp:200, trait:'단단한 껍질로 매우 높은 맷집',          habitat:'청록빛 바다 전역',    coinValue:24, drawFn:(x,y)=>drawTurtleIcon(x,y)},
  barracuda:   {name:'바라쿠다',hp:100, trait:'동굴에서만 서식하며 매우 빠르다',       habitat:'해저 동굴',           coinValue:10, drawFn:(x,y)=>drawBarracudaIcon(x,y)},
  octopus:     {name:'문어',    hp:150, trait:'동굴 바닥을 기어다닌다',               habitat:'동굴 깊은 곳',        coinValue:20, drawFn:(x,y)=>drawOctopusIcon(x,y)},
  moray:       {name:'곰치',    hp:80,  trait:'날카로운 이빨로 굴 속에 몸을 숨긴다',  habitat:'동굴 암석 사이',      coinValue:15, drawFn:(x,y)=>drawMorayIcon(x,y)},
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
  const ph=HEADER_H+contentH+FOOTER_H;
  const px=Math.round(canvas.width/2-pw/2);
  const py=Math.round(canvas.height/2-ph/2);

  const KEYS=['amount','clownfishAmount','salmonAmount','tropicalfishAmount','turtleAmount','butterflyfishAmount','barracudaAmount','octopusAmount','morayAmount'];
  const total=KEYS.reduce((s,k)=>s+(sellUI[k]||0),0);
  const coinDefs={amount:1,clownfishAmount:2,salmonAmount:5,tropicalfishAmount:3,turtleAmount:24,butterflyfishAmount:5,barracudaAmount:10,octopusAmount:20,morayAmount:15};
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
    rows.forEach((row,i)=>{
      const ry=py+HEADER_H+i*(cardH+cardM);
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
  }

  const footY=py+HEADER_H+contentH+8;
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
  sellPanelBounds={px,py,pw,ph,btnY,rowsMeta,cardH,cardM,HEADER_H};
}

// ── 부유석 렌더 ──────────────────────────────────
function drawFloatingRocks() {
  if(playerZone!=='sea1') return;
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

// ── 부유석 충돌 ──────────────────────────────────
function resolveFloatingRockCollision() {
  const rocks=getVisibleFloatingRocks();
  for(const rock of rocks){
    const dx=player.x-rock.x, dy=player.y-rock.y;
    const dist=Math.sqrt(dx*dx+dy*dy)||1;
    const minD=rock.r+16;
    if(dist<minD){
      const nx=dx/dist,ny=dy/dist;
      player.x+=nx*(minD-dist);player.y+=ny*(minD-dist);
      const dot=player.vx*nx+player.vy*ny;
      if(dot<0){player.vx-=dot*nx;player.vy-=dot*ny;}
    }
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

// ── 상점 패널 ─────────────────────────────────────
let shopBuyBtnBounds=[];

function drawShopPanel() {
  const pw=Math.min(480,canvas.width-40),ph=380;
  const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.fillStyle='rgba(10,25,45,0.97)';ctx.strokeStyle='#fbc02d';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(px,py,pw,ph,14);ctx.fill();ctx.stroke();
  ctx.font='bold 18px sans-serif';ctx.fillStyle='#ffd54f';ctx.textAlign='center';
  ctx.fillText('⚓ 배 상점',px+pw/2,py+34);
  ctx.fillStyle='#455a64';ctx.beginPath();ctx.roundRect(px+pw-46,py+12,34,26,5);ctx.fill();
  ctx.fillStyle='#eceff1';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText('✕',px+pw-29,py+30);

  const upgrades=[
    {key:'flipper', label:'물갈퀴', icon:'🦈', desc:'수영 속도 증가', unit:'+8 속도/레벨'},
    {key:'oxygen',  label:'산소통', icon:'🫧', desc:'최대 산소 증가 (lv10 청록 입장)', unit:'+6초/레벨'},
    {key:'harpoon', label:'작살',   icon:'🔱', desc:'작살 위력 증가', unit:'+4 위력/레벨'},
  ];

  shopBuyBtnBounds=[];
  const cardH=86,cardM=8,cardY0=py+52;
  upgrades.forEach((upg,i)=>{
    const lv=(playerData.upgrades?.[upg.key]||0);
    const tier=upgradeTier(lv);
    const cost=lv<50?upgradeCost(lv):null;
    const canBuy=lv<50&&cost!==null&&(playerData.coins||0)>=cost;
    const cy=cardY0+i*(cardH+cardM);

    ctx.fillStyle='rgba(255,200,0,0.05)';ctx.strokeStyle='rgba(255,200,0,0.25)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(px+12,cy,pw-24,cardH,8);ctx.fill();ctx.stroke();

    // 아이콘+이름
    ctx.font='22px sans-serif';ctx.textAlign='left';ctx.fillText(upg.icon,px+22,cy+30);
    ctx.font='bold 14px sans-serif';ctx.fillStyle='#ffd54f';ctx.fillText(upg.label,px+50,cy+20);
    ctx.font='11px sans-serif';ctx.fillStyle='#90a4ae';ctx.fillText(upg.desc,px+50,cy+35);
    ctx.font='10px sans-serif';ctx.fillStyle='#78909c';ctx.fillText(upg.unit,px+50,cy+48);

    // 레벨 표시 + 색상
    const tierColor=UPGRADE_COLORS[upg.key==='flipper'?'flipper':upg.key==='oxygen'?'tank':'harpoon'][tier];
    ctx.font='bold 13px sans-serif';ctx.fillStyle=tierColor;ctx.textAlign='right';
    ctx.fillText(`Lv.${lv}/50`,px+pw-130,cy+24);
    if(lv>0){ctx.font='10px sans-serif';ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillText(`Tier ${tier}`,px+pw-130,cy+38);}

    // 구매 버튼
    const bx=px+pw-120,by=cy+cardH/2-18,bw=100,bh=36;
    if(lv>=50){
      ctx.fillStyle='#37474f';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();
      ctx.font='bold 12px sans-serif';ctx.fillStyle='#ffd700';ctx.textAlign='center';ctx.fillText('MAX',bx+bw/2,by+22);
    } else {
      ctx.fillStyle=canBuy?'#f57f17':'#37474f';
      ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();
      ctx.font='bold 12px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';
      ctx.fillText(`${cost} 코인`,bx+bw/2,by+22);
      shopBuyBtnBounds.push({x:bx,y:by,w:bw,h:bh,key:upg.key,cost,lv});
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
  const cx=e.clientX-r.left, cy=e.clientY-r.top;
  const pw=Math.min(480,canvas.width-40),ph=380;
  const px=Math.round(canvas.width/2-pw/2),py=Math.round(canvas.height/2-ph/2);
  // 닫기 버튼
  if(cx>=px+pw-46&&cx<=px+pw-12&&cy>=py+12&&cy<=py+38){shopOpen=false;return;}
  // 구매 버튼
  for(const btn of shopBuyBtnBounds){
    if(cx>=btn.x&&cx<=btn.x+btn.w&&cy>=btn.y&&cy<=btn.y+btn.h){
      if((playerData.coins||0)>=btn.cost&&btn.lv<50){
        playerData.coins-=btn.cost;
        playerData.upgrades[btn.key]=(playerData.upgrades[btn.key]||0)+1;
        savePlayerData();
      }
      return;
    }
  }
}

// ── 시작 ─────────────────────────────────────────
init();
