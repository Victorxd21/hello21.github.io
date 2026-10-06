(function() {
  if (typeof Mario === 'undefined')
    window.Mario = {};

  var Coin = Mario.Coin = function(pos) {
    Mario.Entity.call(this, {
      pos: pos,
      sprite: new Mario.Sprite('sprites/items.png', [0,96], [16,16], 6, [0,1,2,1]),
      hitbox: [0,0,16,16]
    });
    this.idx = level.items.length;
  }

  Mario.Util.inherits(Coin, Mario.Entity);

  Coin.prototype.isPlayerCollided = function() {
    var hpos1 = [this.pos[0] + this.hitbox[0], this.pos[1] + this.hitbox[1]];
    var hpos2 = [player.pos[0] + player.hitbox[0], player.pos[1] + player.hitbox[1]];

    if (!(hpos1[0] > hpos2[0]+player.hitbox[2] || (hpos1[0]+this.hitbox[2] < hpos2[0]))) {
      if (!(hpos1[1] > hpos2[1]+player.hitbox[3] || (hpos1[1]+this.hitbox[3] < hpos2[1]))) {
        this.collect();
      }
    }
  }

  Coin.prototype.render = function(ctx, vX, vY) {
    this.sprite.render(ctx, this.pos[0], this.pos[1], vX, vY);
  }

  Coin.prototype.update = function(dt) {
    this.sprite.update(dt);
  }

  Coin.prototype.collect = function() {
    sounds.coin.currentTime = 0.05;
    sounds.coin.play();
    player.coins += 1;
    delete level.items[this.idx];
  }
})();
