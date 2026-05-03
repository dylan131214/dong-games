const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 6010;
const PLAYERS_DIR = path.join(__dirname, 'data', 'players');

if (!fs.existsSync(PLAYERS_DIR)) {
  fs.mkdirSync(PLAYERS_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function playerFilePath(nickname) { return path.join(PLAYERS_DIR, `${nickname}.json`); }

function loadPlayer(nickname) {
  const fp = playerFilePath(nickname);
  if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
  return null;
}

function savePlayer(data) {
  fs.writeFileSync(playerFilePath(data.nickname), JSON.stringify(data, null, 2), 'utf8');
}

app.post('/api/login', (req, res) => {
  const { nickname } = req.body;
  if (!nickname || typeof nickname !== 'string' || !nickname.trim())
    return res.status(400).json({ error: '닉네임이 없습니다.' });
  const trimmed = nickname.trim();
  let player = loadPlayer(trimmed);
  if (!player) {
    player = { nickname: trimmed, coins: 0, inventory: {
      anchovy: 0, clownfish: 0, salmon: 0, barracuda: 0,
      tropicalfish: 0, turtle: 0, butterflyfish: 0, octopus: 0, moray: 0,
      tuna: 0, shark: 0, whale: 0,
      seaweed: 0, anemone: 0, jellyfish: 0, stone: 0, iron: 0, gold: 0, aluminum: 0,
      sunfish: 0, holefish: 0, plesio: 0,
      ballooneel: 0, toothfish: 0
    }, fishLog: {
      anchovy: 0, clownfish: 0, salmon: 0, barracuda: 0,
      tropicalfish: 0, turtle: 0, butterflyfish: 0, octopus: 0, moray: 0,
      tuna: 0, shark: 0, whale: 0,
      sunfish: 0, holefish: 0, plesio: 0,
      ballooneel: 0, toothfish: 0
    }};
    savePlayer(player);
  }
  res.json(player);
});

app.post('/api/save', (req, res) => {
  const { nickname } = req.body;
  if (!nickname) return res.status(400).json({ error: '닉네임 없음' });
  const player = loadPlayer(nickname) || { nickname, coins: 0, inventory: {} };
  const { nickname: _n, ...fields } = req.body;
  Object.assign(player, fields);
  savePlayer(player);
  res.json({ ok: true });
});

const COIN_VALUES = {
  anchovy: 1, clownfish: 2, salmon: 5, barracuda: 10,
  tropicalfish: 3, turtle: 24, butterflyfish: 5, octopus: 20, moray: 15,
  tuna: 32, shark: 80, whale: 300,
  seaweed: 1, anemone: 2, jellyfish: 3, stone: 1, iron: 3, gold: 10, aluminum: 5,
  sunfish: 32, holefish: 70, plesio: 600,
  ballooneel: 30, toothfish: 450,
};

app.post('/api/sell', (req, res) => {
  const body = req.body;
  if (!body.nickname) return res.status(400).json({ error: '잘못된 요청' });

  const amounts = {};
  let totalItems = 0;
  let coinsToAdd = 0;

  for (const [fish, coinVal] of Object.entries(COIN_VALUES)) {
    const amt = body[fish + 'Amount'] || 0;
    if (!Number.isInteger(amt) || amt < 0)
      return res.status(400).json({ error: '잘못된 요청' });
    amounts[fish] = amt;
    totalItems += amt;
    coinsToAdd += amt * coinVal;
  }

  if (totalItems < 1 || totalItems > 10)
    return res.status(400).json({ error: '잘못된 요청' });

  const player = loadPlayer(body.nickname);
  if (!player) return res.status(404).json({ error: '플레이어 없음' });
  player.coins = (player.coins || 0) + coinsToAdd;
  savePlayer(player);

  res.json({ ok: true, deliverySeconds: 60, newCoins: player.coins });
});

app.get('/api/player/:nickname', (req, res) => {
  const player = loadPlayer(req.params.nickname);
  if (!player) return res.status(404).json({ error: '플레이어 없음' });
  res.json(player);
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
