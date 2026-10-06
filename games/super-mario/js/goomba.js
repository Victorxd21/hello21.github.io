(function() {
  if (typeof Mario === 'undefined')
    window.Mario = {};

  //TODO: Goombas need to be able to fall.
  var Goomba = Mario.Goomba = function(pos, sprite) {
    this.dying = false;
    Mario.Entity.call(this, {
      pos: pos,
      sprite: sprite,
      hitbox: [0,0,16,16]
    });
    this.vel[0] = -0.5;
    this.idx = level.enemies.length;
  }

  Mario.Util.inherits(Goomba, Mario.Entity);

  Goomba.prototype.render = function(ctx, vX, vY) {
    this.sprite.render(ctx, this.pos[0], this.pos[1], vX, vY);
  }

  Goomba.prototype.update = function(dt, vX) {
    if (this.pos[0] - vX > 336) { // if we're too far away, don't update
      return;
    } else if (this.pos[0] - vX < -32) {
      delete level.enemies[this.idx];
    }

    if (this.dying) {
      this.sprite.pos[1] = 16;
      this.sprite.speed = 0;
      this.hitbox = [0,0,0,0];
      this.dying -= 1;
      if (!this.dying) {
        delete level.enemies[this.idx];
      }
      return;
    }

    this.acc[1] = 0.2;
    this.vel[1] += this.acc[1];
    this.pos[1] += this.vel[1];
    this.pos[0] += this.vel[0];

    this.sprite.update(dt);
  }

  Goomba.prototype.collideWall = function() {
    this.vel[0] = -this.vel[0];
  }

  Goomba.prototype.checkCollisions = function() {
    if (this.dying) return;
    var hpos1 = [this.pos[0] + this.hitbox[0], this.pos[1] + this.hitbox[1]];
    var hpos2 = [player.pos[0] + player.hitbox[0], player.pos[1] + player.hitbox[1]];

    // the first two conditions check if there is no overlap
    if (!(hpos1[0] > hpos2[0]+player.hitbox[2] || (hpos1[0]+this.hitbox[2] < hpos2[0]))) {
      if (!(hpos1[1] > hpos2[1]+player.hitbox[3] || (hpos1[1]+this.hitbox[3] < hpos2[1]))) {
        this.bump();
      }
    }
  }

  Goomba.prototype.bump = function() {
    if (player.starTime) {
      this.stomp();
      return;
    }
    if (player.pos[1] + player.hitbox[3] < this.pos[1] + 8) {
      this.stomp();
    } else {
      player.damage();
    }
  }

  Goomba.prototype.stomp = function() {
    sounds.stomp.play();
    player.bounce = true;
    this.dying = 10;
  }
})();
