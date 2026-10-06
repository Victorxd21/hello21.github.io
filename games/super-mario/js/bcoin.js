(function() {
  if (typeof Mario === 'undefined')
    window.Mario = {};

  var Bcoin = Mario.Bcoin = function(pos) {
    this.pos = pos;
    this.sprite = new Mario.Sprite('sprites/items.png', [0,0], [16,16], 10, [0,1,2,1]);
    this.active = false;
  }

  Bcoin.prototype.spawn = function() {
    this.active = true;
    this.vel = [0,-2.5];
    this.acc = [0,0.2];
  }

  Bcoin.prototype.update = function(dt) {
    if (!this.active) return;
    this.vel[1] += this.acc[1];
    this.pos[1] += this.vel[1];
    this.sprite.update(dt);
    if (this.pos[1] > this.originalY - 32) {
      // done popping
    }
  }

  Bcoin.prototype.render = function(ctx, vX, vY) {
    if (this.active) this.sprite.render(ctx, this.pos[0], this.pos[1], vX, vY);
  }

  Bcoin.prototype.collect = function() {
    sounds.coin.currentTime = 0.05;
    sounds.coin.play();
    this.active = false;
  }
})();
