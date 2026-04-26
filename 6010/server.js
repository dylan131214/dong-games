const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 6010;
const PLAYERS_DIR = path.join(__dirname, 'data', 'players');

// data/players 디렉토리 자동 생성
if (!fs.existsSync(PLAYERS_DIR)) {
  fs.mkdirSync(PLAYERS_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function playerFilePath(nickname) {
  return path.join(PLAYERS_DIR, `${nickname}.json`);
}

function loadPlayer(nickname) {
  const filePath = playerFilePath(nickname);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

function savePlayer(data) {
  const filePath = playerFilePath(data.nickname);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// POST /api/login
app.post('/api/login', (req, res) => {
  const { nickname } = req.body;
  if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
    return res.status(400).json({ error: '닉네임이 없습니다.' });
  }
  const trimmed = nickname.trim();
  let player = loadPlayer(trimmed);
  if (!player) {
    player = { nickname: trimmed, coins: 0, inventory: { anchovy: 0 } };
    savePlayer(player);
  }
  res.json(player);
});

// POST /api/save
app.post('/api/save', (req, res) => {
  const { nickname, coins, inventory } = req.body;
  if (!nickname) return res.status(400).json({ error: '닉네임 없음' });
  const player = { nickname, coins, inventory };
  savePlayer(player);
  res.json({ ok: true });
});

// POST /api/sell
app.post('/api/sell', (req, res) => {
  const { nickname, anchovyAmount = 0, clownfishAmount = 0 } = req.body;
  const coinsToAdd = anchovyAmount + clownfishAmount * 2;
  if (!nickname || !Number.isInteger(anchovyAmount) || !Number.isInteger(clownfishAmount) ||
      anchovyAmount < 0 || clownfishAmount < 0 ||
      anchovyAmount + clownfishAmount < 1 || anchovyAmount + clownfishAmount > 10) {
    return res.status(400).json({ error: '잘못된 요청' });
  }
  const deliverySeconds = 60;
  res.json({ ok: true, deliverySeconds });

  // 1분 후 코인 지급 (멸치 1코인, 흰동가리 2코인)
  setTimeout(() => {
    const player = loadPlayer(nickname);
    if (player) {
      player.coins = (player.coins || 0) + coinsToAdd;
      savePlayer(player);
    }
  }, deliverySeconds * 1000);
});

// GET /api/player/:nickname (60초 후 코인 확인용)
app.get('/api/player/:nickname', (req, res) => {
  const player = loadPlayer(req.params.nickname);
  if (!player) return res.status(404).json({ error: '플레이어 없음' });
  res.json(player);
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
