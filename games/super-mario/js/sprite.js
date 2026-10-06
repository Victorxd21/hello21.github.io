(function() {
  if (typeof Mario === 'undefined')
    window.Mario = {};

  var Sprite = Mario.Sprite = function(img, pos, size, speed, frames, once) {
    this.pos = pos;
    this.size = size;
    this.speed = typeof speed === 'number' ? speed : 0;
    this.frames = frames;
    this._index = 0;
    this.img = img;
    this.once = once;
    this.done = false;
  }

  Sprite.prototype.update = function(dt, gameTime) {
    if (gameTime && gameTime == this.lastUpdated) return;
    this.lastUpdated = gameTime;

    if (this.speed > 0) {
      this._index += this.speed * dt;
    }
  }

  Sprite.prototype.render = function(ctx, posx, posy, vX, vY) {
    var frame;

    if (this.speed > 0) {
      var max = this.frames.length;
      var idx = Math.floor(this._index);
      frame = this.frames[idx % max];

      if (this.once && idx >= max) {
        this.done = true;
        return;
      }
    }
    else {
      frame = 0;
    }

    var x = this.pos[0];
    var y = this.pos[1];

    x += frame * this.size[0];

    ctx.drawImage(resources.get(this.img),
                  x, y,
                  this.size[0], this.size[1],
                  Math.floor(posx - vX), Math.floor(posy - vY),
                  this.size[0], this.size[1]);
  }

  Sprite.prototype.setFrame = function(frame) {
    this._index = frame;
  }
})();
