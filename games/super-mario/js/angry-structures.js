/**
 * Angry Birds–style wooden structures.
 * Mario can push them and stand on them.
 * Drawn with canvas (no external images needed).
 */
(function () {
  'use strict';

  if (typeof Matter === 'undefined') {
    console.warn('[AngryStructures] Matter.js not found – structures disabled');
    return;
  }

  var Engine = Matter.Engine,
      World  = Matter.World,
      Bodies = Matter.Bodies,
      Body   = Matter.Body;

  var engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
  var world  = engine.world;

  var woods = [];
  var marioBody = null;
  var started = false;
  var BASE_X = 850;

  function addWood(x, y, w, h) {
    var b = Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
      density: 0.0028,
      friction: 0.9,
      frictionStatic: 1.0,
      restitution: 0.02,
      label: 'wood'
    });
    woods.push(b);
    World.add(world, b);
    return b;
  }

  function build() {
    var ground = Bodies.rectangle(BASE_X + 280, 210, 800, 24, {
      isStatic: true,
      friction: 1,
      label: 'ground'
    });
    World.add(world, ground);

    // Structure 1 – small tower
    addWood(BASE_X,       176, 14, 32);
    addWood(BASE_X + 50,  176, 14, 32);
    addWood(BASE_X - 6,   162, 76, 14);

    addWood(BASE_X + 10,  130, 14, 32);
    addWood(BASE_X + 40,  130, 14, 32);
    addWood(BASE_X + 6,   116, 52, 14);

    // Structure 2
    addWood(BASE_X + 170, 176, 14, 32);
    addWood(BASE_X + 220, 176, 14, 32);
    addWood(BASE_X + 166, 162, 72, 14);

    // Tall tip-able post
    addWood(BASE_X + 310, 144, 16, 64);

    // Loose crates
    addWood(BASE_X + 90,  192, 22, 16);
    addWood(BASE_X + 120, 192, 22, 16);
    addWood(BASE_X + 270, 192, 26, 16);
    addWood(BASE_X + 360, 192, 20, 16);

    console.log('[AngryStructures] built', woods.length, 'wood pieces');
  }

  function ensureMario() {
    if (!window.player || !player.pos) return;
    if (!marioBody) {
      marioBody = Bodies.rectangle(player.pos[0] + 8, player.pos[1] + 12, 14, 24, {
        density: 0.025,
        friction: 0.05,
        restitution: 0,
        label: 'mario',
        inertia: Infinity
      });
      World.add(world, marioBody);
    }
  }

  function syncMario() {
    if (!player || !marioBody) return;
    Body.setPosition(marioBody, {
      x: player.pos[0] + 8,
      y: player.pos[1] + 12
    });
    var vx = (player.vel && player.vel[0]) ? player.vel[0] * 2.0 : 0;
    var vy = (player.vel && player.vel[1]) ? player.vel[1] * 0.5 : 0;
    Body.setVelocity(marioBody, { x: vx, y: vy });
  }

  function supportMario() {
    if (!player || !player.pos) return;
    var feetX = player.pos[0] + 8;
    var feetY = player.pos[1] + 16;

    for (var i = 0; i < woods.length; i++) {
      var b = woods[i];
      var top = b.bounds.min.y;
      var left = b.bounds.min.x;
      var right = b.bounds.max.x;

      if (feetX > left - 2 && feetX < right + 2) {
        if (feetY >= top - 5 && feetY <= top + 8 && player.vel[1] >= -0.5) {
          player.pos[1] = top - 16;
          player.vel[1] = 0;
          if (typeof player.standing !== 'undefined') player.standing = true;
          break;
        }
      }
    }
  }

  function draw(ctx, camX, camY) {
    for (var i = 0; i < woods.length; i++) {
      var b = woods[i];
      var pos = b.position;
      var angle = b.angle;
      var w = b.bounds.max.x - b.bounds.min.x;
      var h = b.bounds.max.y - b.bounds.min.y;

      ctx.save();
      ctx.translate(pos.x - camX, pos.y - camY);
      ctx.rotate(angle);

      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(-w / 2, -h / 2, w, h);

      ctx.strokeStyle = '#4A3728';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);

      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      if (w >= h) {
        for (var g = -h / 2 + 3; g < h / 2; g += 4) {
          ctx.beginPath();
          ctx.moveTo(-w / 2 + 2, g);
          ctx.lineTo(w / 2 - 2, g);
          ctx.stroke();
        }
      } else {
        for (var g = -w / 2 + 3; g < w / 2; g += 4) {
          ctx.beginPath();
          ctx.moveTo(g, -h / 2 + 2);
          ctx.lineTo(g, h / 2 - 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function loop() {
    if (started) {
      ensureMario();
      syncMario();
      Engine.update(engine, 1000 / 60);
      supportMario();

      if (window.ctx && typeof window.vX === 'number') {
        draw(window.ctx, window.vX, window.vY || 0);
      }
    }
    requestAnimationFrame(loop);
  }

  function start() {
    if (started) return;
    if (!window.level || !window.player) {
      setTimeout(start, 250);
      return;
    }
    started = true;
    build();
    console.log('[AngryStructures] active – walk right to find the wooden towers');
  }

  requestAnimationFrame(loop);
  setTimeout(start, 800);

  window.AngryStructures = { start: start };
})();
