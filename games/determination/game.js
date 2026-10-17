// DETERMINATION - Undertale-inspired demo (visual upgrade)

const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

const titleScreen = document.getElementById('title-screen');
const overworld = document.getElementById('overworld');
const battleScreen = document.getElementById('battle');

let state = 'title';
let keys = {};
let player = { x: 4, y: 8, speed: 0.11 };
let map = [];
let mapW = 15, mapH = 11;
let tileSize = 32;

let hp = 20, maxHp = 20;
let battlePhase = 'menu';
let soul = { x: 0.5, y: 0.5 };
let enemyHP = 40, maxEnemyHP = 40;
let selectedAction = 0;

const actions = ['fight', 'act', 'item', 'mercy'];

// Music (using your uploaded files)
const music = {
  title: new Audio('music/093. Menu (Full).mp3'),
  overworld: new Audio('music/005. Ruins.mp3'),
  battle: new Audio('music/036. Dummy!.mp3')
};
Object.values(music).forEach(a => { a.loop = true; a.volume = 0.42; });
let currentMusic = null;

function playMusic(track) {
  if (currentMusic === track) return;
  if (currentMusic) { currentMusic.pause(); currentMusic.currentTime = 0; }
  currentMusic = track;
  track.play().catch(() => {});
}

// Simple Ruins-style map
function generateMap() {
  map = [];
  for (let y = 0; y < mapH; y++) {
    map[y] = [];
    for (let x = 0; x < mapW; x++) {
      // outer walls
      if (x === 0 || y === 0 || x === mapW-1 || y === mapH-1) map[y][x] = 1;
      else map[y][x] = 0;
    }
  }
  // some pillars / walls
  map[2][3] = 1; map[2][4] = 1;
  map[2][10] = 1; map[2][11] = 1;
  map[5][7] = 1;
  map[7][2] = 1; map[8][2] = 1;
  map[7][12] = 1; map[8][12] = 1;
  // Dummy position
  map[4][7] = 2;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  tileSize = Math.floor(Math.min(canvas.width / mapW, (canvas.height - 160) / mapH));
}

// Input
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  handleKeyPress(k);
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function handleKeyPress(key) {
  if (state === 'title' && (key === 'enter' || key === ' ' || key === 'z')) startGame();
  if (state === 'dialogue' && (key === 'enter' || key === ' ' || key === 'z' || key === 'x')) closeDialogue();
  if (state === 'battle' && battlePhase === 'menu') {
    if (key === 'arrowleft' || key === 'a') selectedAction = (selectedAction + 3) % 4;
    if (key === 'arrowright' || key === 'd') selectedAction = (selectedAction + 1) % 4;
    if (key === 'enter' || key === ' ' || key === 'z') doAction(actions[selectedAction]);
    updateBattleButtons();
  }
}

// Mobile controls
function setupMobileControls() {
  const dirMap = { up:'arrowup', down:'arrowdown', left:'arrowleft', right:'arrowright' };

  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const key = dirMap[btn.dataset.dir];
    const press = e => { e.preventDefault(); keys[key] = true; btn.classList.add('active'); };
    const release = e => { e.preventDefault(); keys[key] = false; btn.classList.remove('active'); };
    btn.addEventListener('touchstart', press, {passive:false});
    btn.addEventListener('touchend', release, {passive:false});
    btn.addEventListener('touchcancel', release, {passive:false});
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });

  const btnA = document.getElementById('btn-a');
  const pressA = e => { e.preventDefault(); btnA.classList.add('active'); handleKeyPress('z'); };
  const releaseA = e => { e.preventDefault(); btnA.classList.remove('active'); };
  btnA.addEventListener('touchstart', pressA, {passive:false});
  btnA.addEventListener('touchend', releaseA, {passive:false});
  btnA.addEventListener('mousedown', pressA);
  btnA.addEventListener('mouseup', releaseA);

  const btnB = document.getElementById('btn-b');
  const pressB = e => { e.preventDefault(); btnB.classList.add('active'); handleKeyPress('x'); };
  const releaseB = e => { e.preventDefault(); btnB.classList.remove('active'); };
  btnB.addEventListener('touchstart', pressB, {passive:false});
  btnB.addEventListener('touchend', releaseB, {passive:false});
  btnB.addEventListener('mousedown', pressB);
  btnB.addEventListener('mouseup', releaseB);
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('start-btn').addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, {passive:false});

document.querySelectorAll('.battle-btn').forEach(btn => {
  const act = e => {
    e.preventDefault();
    if (state === 'battle' && battlePhase === 'menu') doAction(btn.dataset.action);
  };
  btn.addEventListener('click', act);
  btn.addEventListener('touchstart', act, {passive:false});
});

// Game flow
function startGame() {
  titleScreen.classList.remove('active');
  overworld.classList.add('active');
  state = 'overworld';
  generateMap();
  resize();
  player.x = 4; player.y = 8;
  playMusic(music.overworld);
  showDialogue("* You feel a strange sense of determination.\n* This place looks familiar...");
}

function showDialogue(text) {
  state = 'dialogue';
  document.getElementById('dialogue-text').textContent = text;
  document.getElementById('dialogue-box').classList.remove('hidden');
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

    if (dx || dy) {
      const nx = player.x + dx * player.speed;
      const ny = player.y + dy * player.speed;
      if (canMove(nx, player.y)) player.x = nx;
      if (canMove(player.x, ny)) player.y = ny;

      const tx = Math.floor(player.x), ty = Math.floor(player.y);
      if (map[ty] && map[ty][tx] === 2) startBattle();
    }
  }

  if (state === 'battle' && battlePhase === 'attack') {
    const sp = 0.013;
    if (keys['arrowup'] || keys['w']) soul.y = Math.max(0.07, soul.y - sp);
    if (keys['arrowdown'] || keys['s']) soul.y = Math.min(0.93, soul.y + sp);
    if (keys['arrowleft'] || keys['a']) soul.x = Math.max(0.07, soul.x - sp);
    if (keys['arrowright'] || keys['d']) soul.x = Math.min(0.93, soul.x + sp);
    updateSoulPosition();
  }

  draw();
  requestAnimationFrame(update);
}

function canMove(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (ty < 0 || ty >= mapH || tx < 0 || tx >= mapW) return false;
  return map[ty][tx] !== 1;
}

function draw() {
  if (state !== 'overworld' && state !== 'dialogue') return;

  // dark purple background
  ctx.fillStyle = '#1a0030';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const offsetX = (canvas.width - mapW * tileSize) / 2;
  const offsetY = (canvas.height - 160 - mapH * tileSize) / 2;

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const px = offsetX + x * tileSize;
      const py = offsetY + y * tileSize;

      if (map[y][x] === 1) {
        // brick wall
        ctx.fillStyle = '#5a2a7a';
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = '#3a1850';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        // brick lines
        ctx.strokeStyle = '#4a2060';
        ctx.beginPath();
        ctx.moveTo(px, py + tileSize/2);
        ctx.lineTo(px + tileSize, py + tileSize/2);
        ctx.stroke();
      } else {
        // floor
        ctx.fillStyle = '#3b1560';
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Dummy
      if (map[y][x] === 2) {
        // simple white dummy shape
        ctx.fillStyle = '#e8e0d0';
        // body
        ctx.fillRect(px + tileSize*0.28, py + tileSize*0.25, tileSize*0.44, tileSize*0.55);
        // head
        ctx.beginPath();
        ctx.arc(px + tileSize*0.5, py + tileSize*0.22, tileSize*0.18, 0, Math.PI*2);
        ctx.fill();
        // eyes
        ctx.fillStyle = '#222';
        ctx.fillRect(px + tileSize*0.38, py + tileSize*0.16, 3, 3);
        ctx.fillRect(px + tileSize*0.55, py + tileSize*0.16, 3, 3);
      }
    }
  }

  // Player (red soul / heart)
  const px = offsetX + player.x * tileSize;
  const py = offsetY + player.y * tileSize;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  const s = tileSize * 0.38;
  ctx.moveTo(px, py - s*0.25);
  ctx.bezierCurveTo(px + s, py - s*0.9, px + s, py + s*0.15, px, py + s*0.55);
  ctx.bezierCurveTo(px - s, py + s*0.15, px - s, py - s*0.9, px, py - s*0.25);
  ctx.fill();
}

function startBattle() {
  state = 'battle';
  overworld.classList.remove('active');
  battleScreen.classList.add('active');

  enemyHP = maxEnemyHP;
  battlePhase = 'menu';
  selectedAction = 0;
  soul = { x: 0.5, y: 0.5 };
  updateSoulPosition();
  updateBattleButtons();
  document.getElementById('battle-dialogue').classList.add('hidden');
  updateHP();
  updateEnemyHP();
  playMusic(music.battle);
}

function updateSoulPosition() {
  const el = document.getElementById('soul');
  el.style.left = (soul.x * 100) + '%';
  el.style.top = (soul.y * 100) + '%';
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

function updateEnemyHP() {
  document.getElementById('enemy-hp-fill').style.width = (enemyHP / maxEnemyHP * 100) + '%';
}

function doAction(action) {
  const dialogue = document.getElementById('battle-dialogue');
  dialogue.classList.remove('hidden');

  if (action === 'fight') {
    const dmg = 7 + Math.floor(Math.random() * 8);
    enemyHP = Math.max(0, enemyHP - dmg);
    updateEnemyHP();
    dialogue.textContent = `* You attacked the Dummy.\n* You dealt ${dmg} damage!`;
    if (enemyHP <= 0) {
      setTimeout(() => endBattle(true), 1000);
      return;
    }
    setTimeout(() => enemyTurn(), 1100);
  } else if (action === 'act') {
    dialogue.textContent = "* You talk to the Dummy.\n* It doesn't seem much for conversation.";
    setTimeout(() => enemyTurn(), 1300);
  } else if (action === 'item') {
    if (hp < maxHp) {
      hp = Math.min(maxHp, hp + 12);
      updateHP();
      dialogue.textContent = "* You used a bandage.\n* You recovered 12 HP.";
    } else {
      dialogue.textContent = "* You have no items left.";
    }
    setTimeout(() => enemyTurn(), 1100);
  } else if (action === 'mercy') {
    dialogue.textContent = "* You spare the Dummy.";
    setTimeout(() => endBattle(true), 1000);
  }
  battlePhase = 'wait';
}

function enemyTurn() {
  battlePhase = 'attack';
  document.getElementById('battle-dialogue').textContent = "* Dummy is preparing an attack!";

  setTimeout(() => {
    const dist = Math.hypot(soul.x - 0.5, soul.y - 0.5);
    if (dist < 0.23) {
      hp = Math.max(0, hp - 5);
      updateHP();
      document.getElementById('battle-dialogue').textContent = "* You got hit! -5 HP";
      if (hp <= 0) {
        setTimeout(() => endBattle(false), 900);
        return;
      }
    } else {
      document.getElementById('battle-dialogue').textContent = "* You dodged the attack!";
    }
    setTimeout(() => {
      battlePhase = 'menu';
      document.getElementById('battle-dialogue').classList.add('hidden');
    }, 1000);
  }, 1900);
}

function endBattle(won) {
  battleScreen.classList.remove('active');
  overworld.classList.add('active');
  state = 'overworld';
  map[4][7] = 0;
  playMusic(music.overworld);

  if (won) {
    showDialogue("* You won!\n* The Dummy looks a little happier.");
  } else {
    showDialogue("* You lost...\n* But you are filled with DETERMINATION.");
    hp = maxHp;
    updateHP();
  }
}

// Init
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
setupMobileControls();
generateMap();
resize();

document.body.addEventListener('touchstart', () => {
  if (state === 'title') playMusic(music.title);
}, { once: true });
document.body.addEventListener('click', () => {
  if (state === 'title') playMusic(music.title);
}, { once: true });

update();
