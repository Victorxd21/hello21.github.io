// DETERMINATION - Multi-room Undertale-inspired demo

const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

const titleScreen = document.getElementById('title-screen');
const overworld = document.getElementById('overworld');
const battleScreen = document.getElementById('battle');

let state = 'title';
let keys = {};
let player = { x: 7, y: 8, speed: 0.12 };
let currentRoom = 0;
let map = [];
let mapW = 15, mapH = 11;
let tileSize = 32;
let transitioning = false;
let fadeAlpha = 0;

let hp = 20, maxHp = 20;
let battlePhase = 'menu';
let soul = { x: 0.5, y: 0.5 };
let enemyHP = 40, maxEnemyHP = 40;
let selectedAction = 0;
let dummyDefeated = {}; // track which rooms already beat the dummy

const actions = ['fight', 'act', 'item', 'mercy'];

// Music
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

// ===== ROOMS =====
// Each room is defined by walls + special tiles
// 0 = floor, 1 = wall, 2 = dummy, 3 = door (north), 4 = door (south), 5 = door (east), 6 = door (west)

const rooms = [
  // Room 0 - Starting room
  {
    name: "Ruins Entrance",
    data: null, // generated
    doors: { north: 1, south: null, east: null, west: null }
  },
  // Room 1 - Long hallway
  {
    name: "Long Corridor",
    data: null,
    doors: { north: 2, south: 0, east: null, west: null }
  },
  // Room 2 - Dummy room
  {
    name: "Dummy Room",
    data: null,
    doors: { north: 3, south: 1, east: null, west: null }
  },
  // Room 3 - Small chamber
  {
    name: "Quiet Chamber",
    data: null,
    doors: { north: null, south: 2, east: null, west: null }
  }
];

function generateRoom(roomIndex) {
  const room = [];
  for (let y = 0; y < mapH; y++) {
    room[y] = [];
    for (let x = 0; x < mapW; x++) {
      // outer walls
      if (x === 0 || y === 0 || x === mapW - 1 || y === mapH - 1) {
        room[y][x] = 1;
      } else {
        room[y][x] = 0;
      }
    }
  }

  // Open doors based on connections
  const r = rooms[roomIndex];
  if (r.doors.north !== null) {
    // open top center
    room[0][6] = 3; room[0][7] = 3; room[0][8] = 3;
  }
  if (r.doors.south !== null) {
    room[mapH-1][6] = 4; room[mapH-1][7] = 4; room[mapH-1][8] = 4;
  }
  if (r.doors.east !== null) {
    room[4][mapW-1] = 5; room[5][mapW-1] = 5; room[6][mapW-1] = 5;
  }
  if (r.doors.west !== null) {
    room[4][0] = 6; room[5][0] = 6; room[6][0] = 6;
  }

  // Room-specific decoration
  if (roomIndex === 0) {
    // starting room - some pillars
    room[3][3] = 1; room[3][4] = 1;
    room[3][10] = 1; room[3][11] = 1;
    room[7][2] = 1; room[8][2] = 1;
    room[7][12] = 1; room[8][12] = 1;
  }
  else if (roomIndex === 1) {
    // long corridor feel - side pillars
    for (let y = 2; y < mapH - 2; y += 2) {
      room[y][3] = 1;
      room[y][11] = 1;
    }
  }
  else if (roomIndex === 2) {
    // Dummy room
    room[3][4] = 1; room[3][5] = 1;
    room[3][9] = 1; room[3][10] = 1;
    if (!dummyDefeated[2]) {
      room[5][7] = 2; // Dummy
    }
  }
  else if (roomIndex === 3) {
    // quiet chamber - more open, some decoration
    room[2][7] = 1;
    room[6][3] = 1; room[6][11] = 1;
    room[8][7] = 1;
  }

  return room;
}

function loadRoom(index, entrySide) {
  currentRoom = index;
  map = generateRoom(index);

  // Position player based on which side they entered from
  if (entrySide === 'north') {
    player.x = 7; player.y = mapH - 2;
  } else if (entrySide === 'south') {
    player.x = 7; player.y = 1.5;
  } else if (entrySide === 'east') {
    player.x = 1.5; player.y = 5;
  } else if (entrySide === 'west') {
    player.x = mapW - 2.5; player.y = 5;
  } else {
    // default start
    player.x = 7; player.y = 8;
  }
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
  dummyDefeated = {};
  loadRoom(0, null);
  resize();
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

function startTransition(toRoom, entrySide) {
  if (transitioning) return;
  transitioning = true;
  fadeAlpha = 0;

  const fadeIn = () => {
    fadeAlpha += 0.08;
    if (fadeAlpha >= 1) {
      fadeAlpha = 1;
      loadRoom(toRoom, entrySide);
      // fade out
      const fadeOut = () => {
        fadeAlpha -= 0.08;
        if (fadeAlpha <= 0) {
          fadeAlpha = 0;
          transitioning = false;
        } else {
          requestAnimationFrame(fadeOut);
        }
      };
      requestAnimationFrame(fadeOut);
    } else {
      requestAnimationFrame(fadeIn);
    }
  };
  requestAnimationFrame(fadeIn);
}

function update() {
  if (state === 'overworld' && !transitioning) {
    let dx = 0, dy = 0;
    if (keys['arrowup'] || keys['w']) dy = -1;
    if (keys['arrowdown'] || keys['s']) dy = 1;
    if (keys['arrowleft'] || keys['a']) dx = -1;
    if (keys['arrowright'] || keys['d']) dx = 1;

    if (dx || dy) {
      const nx = player.x + dx * player.speed;
      const ny = player.y + dy * player.speed;

      // Check door transitions before normal movement
      const tx = Math.floor(nx);
      const ty = Math.floor(ny);

      if (ty < 0 || (ty === 0 && map[0] && (map[0][tx] === 3))) {
        // going north
        if (rooms[currentRoom].doors.north !== null) {
          startTransition(rooms[currentRoom].doors.north, 'north');
        }
      } else if (ty >= mapH || (ty === mapH-1 && map[mapH-1] && (map[mapH-1][tx] === 4))) {
        // going south
        if (rooms[currentRoom].doors.south !== null) {
          startTransition(rooms[currentRoom].doors.south, 'south');
        }
      } else if (tx >= mapW || (tx === mapW-1 && map[ty] && map[ty][mapW-1] === 5)) {
        if (rooms[currentRoom].doors.east !== null) {
          startTransition(rooms[currentRoom].doors.east, 'east');
        }
      } else if (tx < 0 || (tx === 0 && map[ty] && map[ty][0] === 6)) {
        if (rooms[currentRoom].doors.west !== null) {
          startTransition(rooms[currentRoom].doors.west, 'west');
        }
      } else {
        // normal movement
        if (canMove(nx, player.y)) player.x = nx;
        if (canMove(player.x, ny)) player.y = ny;

        // Dummy encounter
        const ptx = Math.floor(player.x), pty = Math.floor(player.y);
        if (map[pty] && map[pty][ptx] === 2) {
          startBattle();
        }
      }
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
  const tile = map[ty][tx];
  // doors are walkable
  return tile !== 1;
}

function draw() {
  if (state !== 'overworld' && state !== 'dialogue') return;

  ctx.fillStyle = '#1a0030';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const offsetX = (canvas.width - mapW * tileSize) / 2;
  const offsetY = (canvas.height - 160 - mapH * tileSize) / 2;

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const px = offsetX + x * tileSize;
      const py = offsetY + y * tileSize;
      const tile = map[y][x];

      if (tile === 1) {
        // brick wall
        ctx.fillStyle = '#5a2a7a';
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = '#3a1850';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        ctx.strokeStyle = '#4a2060';
        ctx.beginPath();
        ctx.moveTo(px, py + tileSize/2);
        ctx.lineTo(px + tileSize, py + tileSize/2);
        ctx.stroke();
      } else if (tile === 3 || tile === 4 || tile === 5 || tile === 6) {
        // door / opening
        ctx.fillStyle = '#2a0a40';
        ctx.fillRect(px, py, tileSize, tileSize);
        // slight glow
        ctx.fillStyle = 'rgba(180, 100, 255, 0.15)';
        ctx.fillRect(px, py, tileSize, tileSize);
      } else {
        // floor
        ctx.fillStyle = '#3b1560';
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Dummy
      if (tile === 2) {
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(px + tileSize*0.28, py + tileSize*0.25, tileSize*0.44, tileSize*0.55);
        ctx.beginPath();
        ctx.arc(px + tileSize*0.5, py + tileSize*0.22, tileSize*0.18, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(px + tileSize*0.38, py + tileSize*0.16, 3, 3);
        ctx.fillRect(px + tileSize*0.55, py + tileSize*0.16, 3, 3);
      }
    }
  }

  // Player heart
  const px = offsetX + player.x * tileSize;
  const py = offsetY + player.y * tileSize;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  const s = tileSize * 0.38;
  ctx.moveTo(px, py - s*0.25);
  ctx.bezierCurveTo(px + s, py - s*0.9, px + s, py + s*0.15, px, py + s*0.55);
  ctx.bezierCurveTo(px - s, py + s*0.15, px - s, py - s*0.9, px, py - s*0.25);
  ctx.fill();

  // Fade overlay for transitions
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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

  if (won) {
    dummyDefeated[currentRoom] = true;
    // remove dummy from current map
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (map[y][x] === 2) map[y][x] = 0;
      }
    }
  }

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
loadRoom(0, null);
resize();

document.body.addEventListener('touchstart', () => {
  if (state === 'title') playMusic(music.title);
}, { once: true });
document.body.addEventListener('click', () => {
  if (state === 'title') playMusic(music.title);
}, { once: true });

update();
