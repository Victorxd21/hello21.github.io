/**
 * Angry Birds physics layer for the Mario hybrid.
 * Uses Matter.js – wooden towers Mario can push and stand on.
 * Drawn from the main game render loop (Mario.AngryPhysics.render).
 */
(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  var Engine, World, Bodies, Body, Events, Composite;
  var engine = null;
  var world = null;
  var physicsEnabled = false;
  var woodBodies = [];
  var pigBodies = [];
  var marioBody = null;
  var ground = null;

  // Mario ground top is at y ≈ 208 (tile row 13)
  var FLOOR_Y = 208;

  function initMatter() {
    if (typeof Matter === 'undefined') {
      console.error('[AngryPhysics] Matter.js not loaded');
      return false;
    }
    Engine = Matter.Engine;
    World = Matter.World;
    Bodies = Matter.Bodies;
    Body = Matter.Body;
    Events = Matter.Events;
    Composite = Matter.Composite;

    engine = Engine.create({ gravity: { x: 0, y: 1.15 } });
    world = engine.world;
    return true;
  }

  function createWood(x, y, w, h) {
    // Matter uses center position
    var body = Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
      density: 0.0035,
      friction: 0.95,
      frictionStatic: 1.0,
      restitution: 0.04,
      label: 'wood'
    });
    woodBodies.push(body);
    return body;
  }

  function createPig(x, y) {
    var r = 12;
    var body = Bodies.circle(x + r, y + r, r, {
      density: 0.003,
      friction: 0.4,
      restitution: 0.1,
      label: 'pig',
      plugin: { hp: 100, dying: false, dieTimer: 0 }
    });
    pigBodies.push(body);
    return body;
  }

  function buildStructures(baseX) {
    // Structure 1 – small tower (posts + beam + upper level)
    createWood(baseX,       FLOOR_Y - 48, 14, 48);
    createWood(baseX + 48,  FLOOR_Y - 48, 14, 48);
    createWood(baseX - 4,   FLOOR_Y - 62, 70, 14);

    createWood(baseX + 8,   FLOOR_Y - 94, 14, 32);
    createWood(baseX + 36,  FLOOR_Y - 94, 14, 32);
    createWood(baseX + 4,   FLOOR_Y - 108, 54, 14);

    createPig(baseX + 16, FLOOR_Y - 24);
    createPig(baseX + 34, FLOOR_Y - 24);

    // Structure 2 – wider tower
    createWood(baseX + 160, FLOOR_Y - 48, 14, 48);
    createWood(baseX + 210, FLOOR_Y - 48, 14, 48);
    createWood(baseX + 156, FLOOR_Y - 62, 72, 14);
    createPig(baseX + 180, FLOOR_Y - 24);

    // Tall tip-able post
    createWood(baseX + 280, FLOOR_Y - 72, 16, 72);

    // Loose crates on the ground
    createWood(baseX + 90,  FLOOR_Y - 16, 22, 16);
    createWood(baseX + 120, FLOOR_Y - 16, 22, 16);
    createWood(baseX + 250, FLOOR_Y - 16, 26, 16);
    createWood(baseX + 320, FLOOR_Y - 16, 20, 16);

    // Static ground under the structures (Matter only)
    ground = Bodies.rectangle(baseX + 180, FLOOR_Y + 8, 700, 16, {
      isStatic: true,
      label: 'ground',
      friction: 1
    });

    World.add(world, woodBodies.concat(pigBodies).concat([ground]));
    console.log('[AngryPhysics] built', woodBodies.length, 'wood pieces at x≈' + baseX);
  }

  function syncMarioBody() {
    if (!window.player) return;
    if (!marioBody) {
      marioBody = Bodies.rectangle(player.pos[0] + 8, player.pos[1] + 12, 12, 22, {
        density: 0.012,
        friction: 0.6,
        restitution: 0,
        label: 'mario',
        inertia: Infinity
      });
      World.add(world, marioBody);
    }
    Body.setPosition(marioBody, {
      x: player.pos[0] + 8,
      y: player.pos[1] + 12
    });
    Body.setVelocity(marioBody, {
      x: (player.vel ? player.vel[0] : 0) * 1.8,
      y: (player.vel ? player.vel[1] : 0) * 0.4
    });
  }

  // Let Mario stand on top of wood pieces
  function supportMario() {
    if (!window.player || !player.pos) return;
    var feetX = player.pos[0] + 8;
    var feetY = player.pos[1] + 16;

    for (var i = 0; i < woodBodies.length; i++) {
      var b = woodBodies[i];
      var top = b.bounds.min.y;
      var left = b.bounds.min.x;
      var right = b.bounds.max.x;

      if (feetX > left - 3 && feetX < right + 3) {
        if (feetY >= top - 6 && feetY <= top + 10 && player.vel[1] >= -0.3) {
          player.pos[1] = top - 16;
          player.vel[1] = 0;
          if (typeof player.standing !== 'undefined') player.standing = true;
          break;
        }
      }
    }
  }

  function setupCollisions() {
    Events.on(engine, 'collisionStart', function(event) {
      var pairs = event.pairs;
      for (var i = 0; i < pairs.length; i++) {
        var bodyA = pairs[i].bodyA;
        var bodyB = pairs[i].bodyB;
        var pig = null;
        var other = null;

        if (bodyA.label === 'pig') { pig = bodyA; other = bodyB; }
        else if (bodyB.label === 'pig') { pig = bodyB; other = bodyA; }

        if (!pig || !pig.plugin || pig.plugin.dying) continue;

        var vx = (bodyA.velocity.x - bodyB.velocity.x);
        var vy = (bodyA.velocity.y - bodyB.velocity.y);
        var speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 2.5) {
          pig.plugin.hp -= (speed - 2.5) * 18;
          if (pig.plugin.hp <= 0) {
            pig.plugin.dying = true;
            pig.plugin.dieTimer = 0;
            if (typeof sounds !== 'undefined' && sounds.kick) {
              try { sounds.kick.play(); } catch (e) {}
            }
          }
        }

        if (other && other.label === 'mario' && player && player.vel && player.vel[1] > 0) {
          pig.plugin.dying = true;
          pig.plugin.dieTimer = 0;
          player.bounce = true;
          if (typeof sounds !== 'undefined' && sounds.stomp) {
            try { sounds.stomp.play(); } catch (e) {}
          }
        }
      }
    });
  }

  Mario.AngryPhysics = {
    start: function(baseX) {
      if (physicsEnabled) return;
      if (!initMatter()) return;
      physicsEnabled = true;
      woodBodies = [];
      pigBodies = [];
      marioBody = null;
      buildStructures(baseX || 420);
      setupCollisions();
      console.log('[AngryPhysics] active – walk right to find the wooden towers');
    },

    update: function(dt) {
      if (!physicsEnabled || !engine) return;
      Engine.update(engine, 1000 / 60);
      syncMarioBody();
      supportMario();

      for (var i = pigBodies.length - 1; i >= 0; i--) {
        var p = pigBodies[i];
        if (p.plugin.dying) {
          p.plugin.dieTimer++;
          if (p.plugin.dieTimer > 25) {
            World.remove(world, p);
            pigBodies.splice(i, 1);
          }
        }
      }
    },

    render: function(ctx, vX, vY) {
      if (!physicsEnabled) return;
      vX = vX || 0;
      vY = vY || 0;

      for (var i = 0; i < woodBodies.length; i++) {
        var b = woodBodies[i];
        var pos = b.position;
        var angle = b.angle;
        var w = b.bounds.max.x - b.bounds.min.x;
        var h = b.bounds.max.y - b.bounds.min.y;

        ctx.save();
        ctx.translate(pos.x - vX, pos.y - vY);
        ctx.rotate(angle);
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#5C3317';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        if (w >= h) {
          for (var g = -h / 2 + 4; g < h / 2; g += 4) {
            ctx.beginPath();
            ctx.moveTo(-w / 2 + 2, g);
            ctx.lineTo(w / 2 - 2, g);
            ctx.stroke();
          }
        } else {
          for (var g = -w / 2 + 4; g < w / 2; g += 4) {
            ctx.beginPath();
            ctx.moveTo(g, -h / 2 + 2);
            ctx.lineTo(g, h / 2 - 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      for (var i = 0; i < pigBodies.length; i++) {
        var p = pigBodies[i];
        var pos = p.position;
        var r = 12;
        var x = pos.x - vX;
        var y = pos.y - vY;

        if (p.plugin.dying) {
          ctx.fillStyle = '#4CAF50';
          ctx.beginPath();
          ctx.arc(x, y, r + p.plugin.dieTimer / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.fillText('POP', x - 10, y + 4);
          continue;
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#7CFC00';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.ellipse(0, 4, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(-3, 3, 2, 2);
        ctx.fillRect(1, 3, 2, 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-5, -4, 3, 0, Math.PI * 2);
        ctx.arc(5, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-4.5, -3.5, 1.2, 0, Math.PI * 2);
        ctx.arc(5.5, -3.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    isEnabled: function() { return physicsEnabled; }
  };
})();
