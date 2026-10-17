// DETERMINATION - Simple Undertale-inspired demo
// Fixed mobile controls + music support

const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

// Screens
const titleScreen = document.getElementById('title-screen');
const overworld = document.getElementById('overworld');
const battleScreen = document.getElementById('battle');

// State
let state = 'title';
let keys = {};
let player = { x: 3, y: 3, speed: 0.13 };
let map = [];
let mapW = 16, mapH = 12;
let tileSize = 32;

let hp = 20, maxHp = 20;
let battlePhase = 'menu';
let soul = { x: 0.5, y: 0.5 };
let enemyHP = 30;
let selectedAction = 0;

const actions = ['fight', 'act', 'item', 'mercy'];

// ===== MUSIC =====
// Using the exact filenames you uploaded
const music = {
  title: new Audio('music/093. Menu (Full).mp3'),
  overworld: new Audio('music/005. Ruins.mp3'),
  battle: new Audio('music/036. Dummy!.mp3'),
  shop: new Audio('music/023. Shop.mp3')
};

// Make them loop
Object.values(music).forEach(a => {
  a.loop = true;
  a.volume = 0.45;
});

let currentMusic = null;

function playMusic(track) {
  if (currentMusic === track) return;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }
  currentMusic = track;
  track.play().catch(() => {
    // Autoplay blocked until user interacts - normal on mobile
  });
}

function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

// ===== MAP =====
function generateMap() {
  map = [];
  for (let y = 0; y < mapH; y++) {
    map[y] = [];
    for (let x = 0; x < mapW; x++) {
      if (x === 0 || y === 0 || x === mapW - 1 || y === mapH - 1) {
        map[y][x] = 1;
      } else {
        map[y][x] = 0;
      }
    }
  }
  map[5][10] = 2; // Dummy
  map[3][4] = 1;
  map[3][5] = 1;
  map[7][7] = 1;
  map[8][3] = 1;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  tileSize = Math.floor(Math.min(w / mapW, (h - 160) / mapH));
}

// ===== INPUT (Keyboard) =====
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  handleKeyPress(k);
});
window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

function handleKeyPress(key) {
  if (state === 'title' && (key === 'enter' || key === ' ' || key === 'z')) {
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

// ===== MOBILE CONTROLS (fixed) =====
function setupMobileControls() {
  const dirMap = {
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright'
  };

  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const dir = btn.dataset.dir;
    const key = dirMap[dir];

    const press = (e) => {
      e.preventDefault();
      e.stopPropagation();
      keys[key] = true;
      btn.classList.add('active');
    };
    const release = (e) => {
      e.preventDefault();
      e.stopPropagation();
      keys[key] = false;
      btn.classList.remove('active');
    };

    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });

  // A button
  const btnA = document.getElementById('btn-a');
  const pressA = (e) => {
    e.preventDefault();
    e.stopPropagation();
    btnA.classList.add('active');
    handleKeyPress('z');
  };
  const releaseA = (e) => {
    e.preventDefault();
    btnA.classList.remove('active');
  };
  btnA.addEventListener('touchstart', pressA, { passive: false });
  btnA.addEventListener('touchend', releaseA, { passive: false });
  btnA.addEventListener('mousedown', pressA);
  btnA.addEventListener('mouseup', releaseA);

  // B button
  const btnB = document.getElementById('btn-b');
  const pressB = (e) => {
    e.preventDefault();
    e.stopPropagation();
    btnB.classList.add('active');
    handleKeyPress('x');
  };
  const releaseB = (e) => {
    e.preventDefault();
    btnB.classList.remove('active');
  };
  btnB.addEventListener('touchstart', pressB, { passive: false });
  btnB.addEventListener('touchend', releaseB, { passive: false });
  btnB.addEventListener('mousedown', pressB);
  btnB.addEventListener('mouseup', releaseB);
}

// Start button
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('start-btn').addEventListener('touchstart', e => {
  e.preventDefault();
  startGame();
}, { passive: false });

// Battle menu buttons
document.querySelectorAll('.battle-btn').forEach(btn => {
  const activate = (e) => {
    e.preventDefault();
    if (state === 'battle' && battlePhase === 'menu') {
      doAction(btn.dataset.action);
    }
  };
  btn.addEventListener('click', activate);
  btn.addEventListener('touchstart', activate, { passive: false });
});

// ===== GAME FLOW =====
function startGame() {
  titleScreen.classList.remove('active');
  overworld.classList.add('active');
  state = 'overworld';
  generateMap();
  resize();
  player.x = 3;
  player.y = 3;
  playMusic(music.overworld);
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
  // Overworld movement
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

      const tx = Math.floor(player.x);
      const ty = Math.floor(player.y);
      if (map[ty] && map[ty][tx] === 2) {
        startBattle();
      }
    }
  }

  // Soul movement in battle
  if (state === 'battle' && battlePhase === 'attack') {
    const speed = 0.014;
    if (keys['arrowup'] || keys['w']) soul.y = Math.max(0.06, soul.y - speed);
    if (keys['arrowdown'] || keys['s']) soul.y = Math.min(0.94, soul.y + speed);
    if (keys['arrowleft'] || keys['a']) soul.x = Math.max(0.06, soul.x - speed);
    if (keys['arrowright'] || keys['d']) soul.x = Math.min(0.94, soul.x + speed);
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
  const offsetY = (canvas.height - 160 - mapH * tileSize) / 2; // leave space for controls

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
        ctx.fillStyle = '#f5c6a5';
        ctx.fillRect(px + 6, py + 4, tileSize - 12, tileSize - 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + 10, py + 10, 4, 4);
        ctx.fillRect(px + tileSize - 14, py + 10, 4, 4);
      }
    }
  }

  // Player heart
  const px = offsetX + player.x * tileSize;
  const py = offsetY + player.y * tileSize;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  const s = tileSize * 0.42;
  ctx.moveTo(px, py - s * 0.3);
  ctx.bezierCurveTo(px + s, py - s, px + s, py + s * 0.2, px, py + s * 0.6);
  ctx.bezierCurveTo(px - s, py + s * 0.2, px - s, py - s, px, py - s * 0.3);
  ctx.fill();
}

function startBattle() {
  state = 'battle';
  overworld.classList.remove('active');
  battleScreen.classList.add('active');

  enemyHP = 30;
  battlePhase = 'menu';
  selectedAction = 0;
  soul.x = 0.5;
  soul.y = 0.5;
  updateSoulPosition();
  updateBattleButtons();
  document.getElementById('battle-dialogue').classList.add('hidden');
  updateHP();
  playMusic(music.battle);
}

function updateSoulPosition() {
  const soulEl = document.getElementById('soul');
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
  } else if (action === 'act') {
    dialogue.textContent = "You talk to the Dummy...\nIt seems lonely.";
    setTimeout(() => enemyTurn(), 1200);
  } else if (action === 'item') {
    if (hp < maxHp) {
      hp = Math.min(maxHp, hp + 10);
      updateHP();
      dialogue.textContent = "You used a bandage. +10 HP";
    } else {
      dialogue.textContent = "You have no items left.";
    }
    setTimeout(() => enemyTurn(), 1000);
  } else if (action === 'mercy') {
    dialogue.textContent = "You spare the Dummy.";
    setTimeout(() => endBattle(true), 900);
  }

  battlePhase = 'wait';
}

function enemyTurn() {
  battlePhase = 'attack';
  document.getElementById('battle-dialogue').textContent = "Dummy attacks!";

  setTimeout(() => {
    const dist = Math.hypot(soul.x - 0.5, soul.y - 0.5);
    if (dist < 0.25) {
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
  state = 'overworld';
  map[5][10] = 0;
  playMusic(music.overworld);

  if (won) {
    showDialogue("You won!\nThe Dummy looks happier somehow.");
  } else {
    showDialogue("You lost...\nBut determination brings you back.");
    hp = maxHp;
    updateHP();
  }
}

// ===== INIT =====
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

setupMobileControls();
generateMap();
resize();

// Try to play title music after first interaction
document.body.addEventListener('touchstart', () => {
  if (state === 'title') playMusic(music.title);
}, { once: true });
document.body.addEventListener('click', () => {
  if (state === 'title') playMusic(music.title);
}, { once: true });

update();
