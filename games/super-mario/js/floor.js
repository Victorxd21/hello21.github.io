(function() {
  if (typeof Mario === 'undefined')
    window.Mario = {};

  //TODO: make these something that can be put on a map like pipes and such.
  // also, make the sprite configurable. right now they are hard coded.
  var Floor = Mario.Floor = function(options) {
    this.pos = options.pos;
    this.sprite = options.sprite;
    this.hitbox = [0,0,16,16];
  }

  Floor.prototype.render = function(ctx, vX, vY) {
    this.sprite.render(ctx, this.pos[0], this.pos[1], vX, vY);
  }
})();
