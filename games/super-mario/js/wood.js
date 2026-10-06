(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  // Simple pushable wooden crate / beam
  var Wood = Mario.Wood = function(pos, w, h, horizontal) {
    this.pos = pos;
    this.w = w || 16;
    this.h = h || 16;
    this.horizontal = !!horizontal;
    this.vel = [0, 0];
    this.acc = [0, 0.25]; // gravity
    this.standing = false;
    this.hitbox = [0, 0, this.w, this.h];
    this.idx = level.enemies ? level.enemies.length : 0;
    this.sprite = null;
  };

  Wood.prototype.update = function(dt, vX) {
    if (this.pos[0] - vX < -64 || this.pos[0] - vX > 400) return;

    this.acc[1] = 0.25;
    this.vel[1] += this.acc[1];
    this.pos[1] += this.vel[1];
    this.pos[0] += this.vel[0];

    // friction
    this.vel[0] *= 0.9;
    if (Math.abs(this.vel[0]) < 0.05) this.vel[0] = 0;

    // simple ground clamp
    if (this.pos[1] + this.h > 208) {
      this.pos[1] = 208 - this.h;
      this.vel[1] = 0;
      this.standing = true;
    }
  };

  Wood.prototype.render = function(ctx, vX, vY) {
    var x = Math.floor(this.pos[0] - vX);
    var y = Math.floor(this.pos[1] - vY);
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(x, y, this.w, this.h);
    ctx.strokeStyle = '#5C3317';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, this.w - 1, this.h - 1);
    // wood grain lines
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    if (this.horizontal) {
      for (var i = 4; i < this.h; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x + 1, y + i);
        ctx.lineTo(x + this.w - 1, y + i);
        ctx.stroke();
      }
    } else {
      for (var i = 4; i < this.w; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + 1);
        ctx.lineTo(x + i, y + this.h - 1);
        ctx.stroke();
      }
    }
  };

  Wood.prototype.collideWall = function() {
    this.vel[0] = 0;
  };

  Wood.prototype.push = function(dir) {
    this.vel[0] = dir * 2.5;
  };

  Wood.prototype.checkCollisions = function() {
    var hpos1 = [this.pos[0], this.pos[1]];
    var hpos2 = [player.pos[0] + player.hitbox[0], player.pos[1] + player.hitbox[1]];

    if (!(hpos1[0] > hpos2[0] + player.hitbox[2] || hpos1[0] + this.w < hpos2[0])) {
      if (!(hpos1[1] > hpos2[1] + player.hitbox[3] || hpos1[1] + this.h < hpos2[1])) {
        if (player.pos[0] < this.pos[0]) {
          this.push(1);
          player.pos[0] = this.pos[0] - player.hitbox[2] - player.hitbox[0];
        } else {
          this.push(-1);
          player.pos[0] = this.pos[0] + this.w - player.hitbox[0];
        }
      }
    }
  };
})();
