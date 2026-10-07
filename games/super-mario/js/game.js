var requestAnimFrame = (function(){
  return window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function(callback){
      window.setTimeout(callback, 1000 / 60);
    };
})();

var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');
var updateables = [];
var fireballs = [];
var player = null;

canvas.width = 762;
canvas.height = 720;
ctx.scale(3,3);
document.body.appendChild(canvas);

var vX = 0, vY = 0, vWidth = 256, vHeight = 240;

var ASSET_BASE = 'https://cdn.jsdelivr.net/gh/reruns/mario@gh-pages/';

resources.load([
  'sprites/player.png',
  'sprites/enemy.png',
  'sprites/tiles.png',
  'sprites/playerl.png',
  'sprites/items.png',
  'sprites/enemyr.png',
]);

resources.onReady(init);
var level;
var sounds;
var music;

var lastTime;
function init() {
  player = new Mario.Player([0,0]);

  music = {
    overworld: new Audio(ASSET_BASE + 'sounds/aboveground_bgm.ogg'),
    underground: new Audio(ASSET_BASE + 'sounds/underground_bgm.ogg'),
    clear: new Audio(ASSET_BASE + 'sounds/stage_clear.wav'),
    death: new Audio(ASSET_BASE + 'sounds/mariodie.wav')
  };
  sounds = {
    smallJump: new Audio(ASSET_BASE + 'sounds/jump-small.wav'),
    bigJump: new Audio(ASSET_BASE + 'sounds/jump-super.wav'),
    breakBlock: new Audio(ASSET_BASE + 'sounds/breakblock.wav'),
    bump: new Audio(ASSET_BASE + 'sounds/bump.wav'),
    coin: new Audio(ASSET_BASE + 'sounds/coin.wav'),
    fireball: new Audio(ASSET_BASE + 'sounds/fireball.wav'),
    flagpole: new Audio(ASSET_BASE + 'sounds/flagpole.wav'),
    kick: new Audio(ASSET_BASE + 'sounds/kick.wav'),
    pipe: new Audio(ASSET_BASE + 'sounds/pipe.wav'),
    itemAppear: new Audio(ASSET_BASE + 'sounds/itemAppear.wav'),
    powerup: new Audio(ASSET_BASE + 'sounds/powerup.wav'),
    stomp: new Audio(ASSET_BASE + 'sounds/stomp.wav')
  };

  try {
    if (typeof Mario.angryLevel === 'function') {
      Mario.angryLevel();
    } else {
      Mario.oneone();
    }
  } catch (e) {
    console.error('Level load error:', e);
    Mario.oneone();
  }

  lastTime = Date.now();
  main();
}

var gameTime = 0;

function main() {
  var now = Date.now();
  var dt = (now - lastTime) / 1000.0;
  try {
    update(dt);
  } catch (e) {
    console.error('update error:', e);
  }
  try {
    render();
  } catch (e) {
    console.error('render error:', e);
  }
  lastTime = now;
  requestAnimFrame(main);
}

function update(dt) {
  gameTime += dt;
  handleInput(dt);
  updateEntities(dt);
  checkCollisions();

  if (typeof Mario !== 'undefined' && Mario.AngryPhysics && Mario.AngryPhysics.isEnabled()) {
    Mario.AngryPhysics.update(dt);
  }

  if (player && player.pos[0] > vX + 80) {
    vX = player.pos[0] - 80;
  }
}

function handleInput(dt) {
  if (!player || player.piping || player.dying || player.noInput) return;

  if (input.isDown('RUN')) player.run();
  else player.noRun();

  if (input.isDown('JUMP')) player.jump();
  else player.noJump();

  if (input.isDown('DOWN')) player.crouch();
  else player.noCrouch();

  if (input.isDown('LEFT')) player.moveLeft();
  else if (input.isDown('RIGHT')) player.moveRight();
  else player.noWalk();
}

function updateEntities(dt) {
  if (!player) return;
  player.update(dt, vX);
  for (var i = 0; i < updateables.length; i++) {
    if (updateables[i] && typeof updateables[i].update === 'function') {
      updateables[i].update(dt, vX);
    }
  }
  for (var i = fireballs.length - 1; i >= 0; i--) {
    if (fireballs[i] && typeof fireballs[i].update === 'function') {
      fireballs[i].update(dt, vX);
    }
  }
}

function checkCollisions() {
  if (!player || player.piping || player.dying) return;
  if (typeof player.checkCollisions === 'function') player.checkCollisions();
  for (var i = fireballs.length - 1; i >= 0; i--) {
    if (fireballs[i] && typeof fireballs[i].checkCollisions === 'function') {
      fireballs[i].checkCollisions();
    }
  }
  for (var i = updateables.length - 1; i >= 0; i--) {
    if (updateables[i] && typeof updateables[i].checkCollisions === 'function') {
      updateables[i].checkCollisions();
    }
  }
}

function render() {
  updateables = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = (level && level.background) ? level.background : "#5C94FC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!level) return;

  for (var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++) {
      if (level.scenery && level.scenery[i] && level.scenery[i][j]) {
        renderEntity(level.scenery[i][j]);
      }
    }
  }

  if (level.items) {
    level.items.forEach(function(item) { if (item) renderEntity(item); });
  }

  if (level.enemies) {
    level.enemies.forEach(function(enemy) { if (enemy) renderEntity(enemy); });
  }

  fireballs.forEach(function(fireball) { renderEntity(fireball); });

  for (var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++) {
      if (level.statics && level.statics[i] && level.statics[i][j]) {
        renderEntity(level.statics[i][j]);
      }
      if (level.blocks && level.blocks[i] && level.blocks[i][j]) {
        renderEntity(level.blocks[i][j]);
        updateables.push(level.blocks[i][j]);
      }
    }
  }

  if (player && (player.invincibility % 2 === 0)) {
    renderEntity(player);
  }

  if (level.pipes) {
    level.pipes.forEach(function(pipe) { renderEntity(pipe); });
  }

  if (typeof Mario !== 'undefined' && Mario.AngryPhysics && Mario.AngryPhysics.isEnabled()) {
    Mario.AngryPhysics.render(ctx, vX, vY);
  }
}

function renderEntity(entity) {
  if (entity && entity.render) entity.render(ctx, vX, vY);
}
