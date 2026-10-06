(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  var Pig = Mario.Pig = function(pos) {
    this.pos = pos;
    this.vel = [0, 0];
    this.acc = [0, 0.2];
    this.hitbox = [2, 2, 12, 14];
    this.dying = false;
    this.dieTimer = 0;
    this.idx = level.enemies.length;
    this.standing = true;
  };

  Pig.prototype.update = function(dt, vX) {
    if (this.pos[0] - vX < -48 || this.pos[0] - vX > 400) return;

    if (this.dying) {
      this.dieTimer++;
      if (this.dieTimer > 30) {
        delete level.enemies[this.idx];
      }
      return;
    }

    this.vel[1] += this.acc[1];
    this.pos[1] += this.vel[1];
    this.pos[0] += this.vel[0];
    this.vel[0] *= 0.85;

    if (this.pos[1] + 16 > 208) {
      this.pos[1] = 192;
      this.vel[1] = 0;
    }
  };

  Pig.prototype.render = function(ctx, vX, vY) {
    var x = Math.floor(this.pos[0] - vX);
    var y = Math.floor(this.pos[1] - vY);

    if (this.dying) {
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(x + 8, y + 8, 10 + this.dieTimer / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText('POP', x + 1, y + 12);
      return;
    }

    // Simple green pig drawn with canvas
    ctx.fillStyle = '#7CFC00';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 9, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // snout
    ctx.fillStyle = '#FF69B4';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 11, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // nostrils
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 6, y + 10, 1.5, 2);
    ctx.fillRect(x + 9, y + 10, 1.5, 2);
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 5, y + 6, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 11, y + 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + 5.5, y + 6.5, 1, 0, Math.PI * 2);
    ctx.arc(x + 11.5, y + 6.5, 1, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#5CB85C';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 3, 3, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y + 3, 3, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
  };

  Pig.prototype.checkCollisions = function() {
    if (this.dying) return;

    var hpos1 = [this.pos[0] + this.hitbox[0], this.pos[1] + this.hitbox[1]];
    var hpos2 = [player.pos[0] + player.hitbox[0], player.pos[1] + player.hitbox[1]];

    if (!(hpos1[0] > hpos2[0] + player.hitbox[2] || hpos1[0] + this.hitbox[2] < hpos2[0])) {
      if (!(hpos1[1] > hpos2[1] + player.hitbox[3] || hpos1[1] + this.hitbox[3] < hpos2[1])) {
        if (player.vel[1] > 0 && player.pos[1] + player.hitbox[3] < this.pos[1] + 10) {
          this.die();
          player.bounce = true;
          if (typeof sounds !== 'undefined' && sounds.stomp) sounds.stomp.play();
        } else if (!player.starTime) {
          player.damage();
        } else {
          this.die();
        }
      }
    }

    // Crush by falling wood
    if (level.enemies) {
      for (var i = 0; i < level.enemies.length; i++) {
        var e = level.enemies[i];
        if (!e || e === this || !(e instanceof Mario.Wood)) continue;
        if (e.vel[1] < 1.5) continue;

        var wx = e.pos[0], wy = e.pos[1];
        if (!(wx > this.pos[0] + 16 || wx + e.w < this.pos[0])) {
          if (!(wy > this.pos[1] + 16 || wy + e.h < this.pos[1])) {
            this.die();
            if (typeof sounds !== 'undefined' && sounds.kick) sounds.kick.play();
          }
        }
      }
    }
  };

  Pig.prototype.die = function() {
    this.dying = true;
    this.dieTimer = 0;
    this.hitbox = [0, 0, 0, 0];
  };

  Pig.prototype.collideWall = function() {};
})();
