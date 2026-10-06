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

//create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');
var updateables = [];
var fireballs = [];
var player = new Mario.Player([0,0]);

//we might have to get the size and calculate the scaling
//but this method should let us make it however big.
//Cool!
//TODO: Automatically scale the game to work and look good on widescreen.
//TODO: fiddling with scaled sprites looks BETTER, but not perfect. Hmm.
canvas.width = 762;
canvas.height = 720;
ctx.scale(3,3);
document.body.appendChild(canvas);

//viewport
var vX = 0,
    vY = 0,
    vWidth = 256,
    vHeight = 240;

//load our images
var ASSET_BASE = 'https://cdn.jsdelivr.net/gh/reruns/mario@gh-pages/';
resources.load([
  ASSET_BASE + 'sprites/player.png',
  ASSET_BASE + 'sprites/enemy.png',
  ASSET_BASE + 'sprites/tiles.png',
  ASSET_BASE + 'sprites/playerl.png',
  ASSET_BASE + 'sprites/items.png',
  ASSET_BASE + 'sprites/enemyr.png',
]);

resources.onReady(init);
var level;
var sounds;
var music;

//initialize
var lastTime;
function init() {
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
  Mario.oneone();
  lastTime = Date.now();
  main();
}

var gameTime = 0;

//set up the game loop
function main() {
  var now = Date.now();
  var dt = (now - lastTime) / 1000.0;

  update(dt);
  render();

  lastTime = now;
  requestAnimFrame(main);
}

function update(dt) {
  gameTime += dt;

  handleInput(dt);
  updateEntities(dt);

  //check collisions
  checkCollisions();

  //update the viewport
  if (player.pos[0] > vX + 80) {
    vX = player.pos[0] - 80;
  }
}

function handleInput(dt) {
  if (player.piping || player.dying || player.noInput) return; //don't accept input

  if (input.isDown('RUN')){
    player.run();
  } else {
    player.noRun();
  }
  if (input.isDown('JUMP')) {
    player.jump();
  } else {
    //we need this to detect the beginning of a jump
    player.noJump();
  }

  if (input.isDown('DOWN')) {
    player.crouch();
  } else {
    player.noCrouch();
  }

  if (input.isDown('LEFT')) {
    player.moveLeft();
  }
  else if (input.isDown('RIGHT')) {
    player.moveRight();
  } else {
    player.noWalk();
  }
}

function updateEntities(dt) {
  player.update(dt, vX);
  updateables.forEach (function(ent) {
    ent.update(dt, vX);
  });

  //We use a special array for fireballs because they can be deleted mid-update
  for (var i = fireballs.length - 1; i >= 0; i--) {
    fireballs[i].update(dt, vX);
  }
}

function checkCollisions() {
  if (player.piping || player.dying) return;
  player.checkCollisions();

  //Still use fireballs for this because they can be deleted mid-check
  for (var i = fireballs.length - 1; i >= 0; i--) {
    fireballs[i].checkCollisions();
  }

  //same for updateables
  for (var i = updateables.length - 1; i >= 0; i--) {
    updateables[i].checkCollisions();
  }
}

function render() {
  updateables = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5C94FC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  //draw the scenery first
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.scenery[i][j]) {
        renderEntity(level.scenery[i][j]);
      }
    }
  }

  //then items
  level.items.forEach (function (item) {
    renderEntity(item);
  });

  level.enemies.forEach (function(enemy) {
    renderEntity(enemy);
  });

  fireballs.forEach(function(fireball) {
    renderEntity(fireball);
  })

  //then we draw every static object.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.statics[i][j]) {
        renderEntity(level.statics[i][j]);
      }
      if (level.blocks[i][j]) {
        renderEntity(level.blocks[i][j]);
        updateables.push(level.blocks[i][j]);
      }
    }
  }

  //then the player
  if (player.invincibility % 2 === 0) {
    renderEntity(player);
  }

  //Mario goes INTO pipes, so naturally they go after.
  level.pipes.forEach (function(pipe) {
    renderEntity(pipe);
  });
}

function renderEntity(entity) {
  entity.render(ctx, vX, vY);
}
