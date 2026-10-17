// DETERMINATION - Simple Undertale-inspired demo
// Mobile + Desktop controls

const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

// Screens
const titleScreen = document.getElementById('title-screen');
const overworld = document.getElementById('overworld');
const battleScreen = document.getElementById('battle');

// State
let state = 'title'; // title | overworld | battle | dialogue
let keys = {};
let player = { x: 8, y: 8, size: 0.12 };
let map = [];
let mapW = 16, mapH = 12;
let tileSize = 32;

let hp = 20, maxHp = 20;
let inBattle = false;
let battlePhase = 'menu'; // menu | attack | dialogue
let soul = { x: 0.5, y: 0.5 }; // normalized 0-1 inside soul-box
let enemyHP = 30;
let selectedAction = 0;

const actions = ['fight', 'act', 'item', 'mercy'];

// Simple map (1 = wall, 0 = floor, 2 = dummy encounter)
function generateMap() {
  map = [];
  for (let y = 0; y < mapH; y++) {
    map[y] = [];
    for (let x = 0; x < mapW; x++) {
      if (x === 0 || y === 0 || x === mapW - 1 || y === mapH - 1) {
        map[y][x] = 1; // wall
      } else {
        map[y][x] = 0;
      }
    }
  }
  // Dummy position
  map[5][10] = 2;
  // Some pillars
  map[3][4] = 1;
  map[3][5] = 1;
  map[7][7] = 1;
  map[8][3] = 1;
}

function resize() {
  const container = document.getElementById('game-container');
  const w = container.clientWidth;
  const h = container.clientHeight - (window.innerWidth < 600 ? 140 : 0);
  canvas.width = w;
  canvas.height = h;
  tileSize = Math.floor(Math.min(w / mapW, h / mapH));
}

// Input
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
  handleKeyPress(e.key.toLowerCase());
});
window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

function handleKeyPress(key) {
  if (state === 'title' && (key === 'enter' || key === ' ')) {
    startGame();
  }
  if (state === 'dialogue' && (key === 'enter' || key === ' ' || key === 'z' || key === 'x')) {
    closeDialogue();
  }
  if (state === 'battle' && battlePhase === 'menu') {
    if (key === 'arrowleft' || key === 'a') selectedAction = (selectedAction + 3) % 4;
    if (key === 'arrowright' || key === 'd') selectedAction = (selectedAction + 1) % 4;
    if (key === 'enter' || key === ' ' || key === 'z') doAction(actions[selectedAction]);
    updateBattleButtons();
  }
}

// Mobile D-pad
document.querySelectorAll('.dpad-btn').forEach(btn => {
  const dir = btn.dataset.dir;
  const setKey = (pressed) => {
    const mapKeys = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
    keys[mapKeys[dir]] = pressed;
  };
  btn.addEventListener('touchstart', e => { e.preventDefault(); setKey(true); }, {passive: false});
  btn.addEventListener('touchend', e => { e.preventDefault(); setKey(false); }, {passive: false});
  btn.addEventListener('mousedown', () => setKey(true));
  btn.addEventListener('mouseup', () => setKey(false));
  btn.addEventListener('mouseleave', () => setKey(false));
});

// A / B buttons
document.getElementById('btn-a').addEventListener('touchstart', e => {
  e.preventDefault();
  handleKeyPress('z');
}, {passive: false});
document.getElementById('btn-a').addEventListener('mousedown', () => handleKeyPress('z'));

document.getElementById('btn-b').addEventListener('touchstart', e => {
  e.preventDefault();
  handleKeyPress('x');
}, {passive: false});
document.getElementById('btn-b').addEventListener('mousedown', () => handleKeyPress('x'));

// Start button
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('start-btn').addEventListener('touchstart', e => {
  e.preventDefault();
  startGame();
}, {passive: false});

// Battle buttons
document.querySelectorAll('.battle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state === 'battle' && battlePhase === 'menu') {
      doAction(btn.dataset.action);
    }
  });
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state === 'battle' && battlePhase === 'menu') {
      doAction(btn.dataset.action);
    }
  }, {passive: false});
});

function startGame() {
  titleScreen.classList.remove('active');
  overworld.classList.add('active');
  state = 'overworld';
  generateMap();
  resize();
  player.x = 3;
  player.y = 3;
  showDialogue("You wake up in a purple place...\nSomething feels familiar.");
}

function showDialogue(text) {
  state = 'dialogue';
  const box = document.getElementById('dialogue-box');
  document.getElementById('dialogue-text').textContent = text;
  box.classList.remove('hidden');
}

function closeDialogue() {
  document.getElementById('dialogue-box').classList.add('hidden');
  state = 'overworld';
}

function update() {
  if (state === 'overworld') {
    let dx = 0, dy = 0;
    if (keys['arrowup'] || keys['w']) dy = -1;
    if (keys['arrowdown'] || keys['s']) dy = 1;
    if (keys['arrowleft'] || keys['a']) dx = -1;
    if (keys['arrowright'] || keys['d']) dx = 1;

    if (dx !== 0 || dy !== 0) {
      const nx = player.x + dx * player.speed;
      const ny = player.y + dy * player.speed;
      if (canMove(nx, player.y)) player.x = nx;
      if (canMove(player.x, ny)) player.y = ny;

      // Check encounter
      const tx = Math.floor(player.x);
      const ty = Math.floor(player.y);
      if (map[ty] && map[ty][tx] === 2) {
        startBattle();
      }
    }
  }

  if (state === 'battle' && battlePhase === 'attack') {
    // Move soul with keys / dpad
    const speed = 0.012;
    if (keys['arrowup'] || keys['w']) soul.y = Math.max(0.05, soul.y - speed);
    if (keys['arrowdown'] || keys['s']) soul.y = Math.min(0.95, soul.y + speed);
    if (keys['arrowleft'] || keys['a']) soul.x = Math.max(0.05, soul.x - speed);
    if (keys['arrowright'] || keys['d']) soul.x = Math.min(0.95, soul.x + speed);

    updateSoulPosition();
  }

  draw();
  requestAnimationFrame(update);
}

function canMove(x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (ty < 0 || ty >= mapH || tx < 0 || tx >= mapW) return false;
  return map[ty][tx] !== 1;
}

function draw() {
  if (state !== 'overworld' && state !== 'dialogue') return;

  ctx.fillStyle = '#1a0033';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const offsetX = (canvas.width - mapW * tileSize) / 2;
  const offsetY = (canvas.height - mapH * tileSize) / 2;

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const px = offsetX + x * tileSize;
      const py = offsetY + y * tileSize;

      if (map[y][x] === 1) {
        ctx.fillStyle = '#4a2060';
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = '#2a1040';
        ctx.strokeRect(px, py, tileSize, tileSize);
      } else {
        ctx.fillStyle = '#2b0a4a';
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      if (map[y][x] === 2) {
        // Dummy
        ctx.fillStyle = '#f5c6a5';
        ctx.fillRect(px + 6, py + 4, tileSize - 12, tileSize - 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + 10, py + 10, 4, 4);
        ctx.fillRect(px + tileSize - 14, py + 10, 4, 4);
      }
    }
  }

  // Player (red heart)
  const px = offsetX + player.x * tileSize;
  const py = offsetY + player.y * tileSize;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  const s = tileSize * 0.45;
  ctx.moveTo(px, py - s * 0.3);
  ctx.bezierCurveTo(px + s, py - s, px + s, py + s * 0.2, px, py + s * 0.6);
  ctx.bezierCurveTo(px - s, py + s * 0.2, px - s, py - s, px, py - s * 0.3);
  ctx.fill();
}

function startBattle() {
  state = 'battle';
  inBattle = true;
  overworld.classList.remove('active');
  battleScreen.classList.add('active');
  document.body.classList.add('battle-active');

  enemyHP = 30;
  battlePhase = 'menu';
  selectedAction = 0;
  soul.x = 0.5;
  soul.y = 0.5;
  updateSoulPosition();
  updateBattleButtons();
  document.getElementById('battle-dialogue').classList.add('hidden');
  updateHP();
}

function updateSoulPosition() {
  const box = document.getElementById('soul-box');
  const soulEl = document.getElementById('soul');
  const rect = box.getBoundingClientRect();
  // Use percentage so it works with flex
  soulEl.style.left = (soul.x * 100) + '%';
  soulEl.style.top = (soul.y * 100) + '%';
}

function updateBattleButtons() {
  document.querySelectorAll('.battle-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === selectedAction);
  });
}

function updateHP() {
  document.getElementById('hp-fill').style.width = (hp / maxHp * 100) + '%';
  document.getElementById('hp-text').textContent = `${hp} / ${maxHp}`;
}

function doAction(action) {
  const dialogue = document.getElementById('battle-dialogue');
  dialogue.classList.remove('hidden');

  if (action === 'fight') {
    const dmg = 8 + Math.floor(Math.random() * 6);
    enemyHP -= dmg;
    dialogue.textContent = `You attacked! Dealt ${dmg} damage.`;
    if (enemyHP <= 0) {
      setTimeout(() => endBattle(true), 900);
      return;
    }
    setTimeout(() => enemyTurn(), 1000);
  }
  else if (action === 'act') {
    dialogue.textContent = "You talk to the Dummy...\nIt seems lonely.";
    setTimeout(() => enemyTurn(), 1200);
  }
  else if (action === 'item') {
    if (hp < maxHp) {
      hp = Math.min(maxHp, hp + 10);
      updateHP();
      dialogue.textContent = "You used a bandage. +10 HP";
    } else {
      dialogue.textContent = "You have no items left.";
    }
    setTimeout(() => enemyTurn(), 1000);
  }
  else if (action === 'mercy') {
    dialogue.textContent = "You spare the Dummy.";
    setTimeout(() => endBattle(true), 900);
  }

  battlePhase = 'wait';
}

function enemyTurn() {
  battlePhase = 'attack';
  document.getElementById('battle-dialogue').textContent = "Dummy attacks!";

  // Simple attack: after 2.2s check if soul is in danger zone (center)
  setTimeout(() => {
    // Very basic hit chance if soul is near center
    const dist = Math.hypot(soul.x - 0.5, soul.y - 0.5);
    if (dist < 0.22) {
      hp = Math.max(0, hp - 4);
      updateHP();
      document.getElementById('battle-dialogue').textContent = "You got hit! -4 HP";
      if (hp <= 0) {
        setTimeout(() => endBattle(false), 800);
        return;
      }
    } else {
      document.getElementById('battle-dialogue').textContent = "You dodged!";
    }
    setTimeout(() => {
      battlePhase = 'menu';
      document.getElementById('battle-dialogue').classList.add('hidden');
    }, 900);
  }, 1800);
}

function endBattle(won) {
  battleScreen.classList.remove('active');
  overworld.classList.add('active');
  document.body.classList.remove('battle-active');
  state = 'overworld';

  // Remove dummy
  map[5][10] = 0;

  if (won) {
    showDialogue("You won!\nThe Dummy looks happier somehow.");
  } else {
    showDialogue("You lost...\nBut determination brings you back.");
    hp = maxHp;
    updateHP();
  }
}

// Init
window.addEventListener('resize', resize);
generateMap();
resize();
update();
