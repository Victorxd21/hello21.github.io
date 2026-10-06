Mario.Entity = function(pos, sprite, hitbox) {
  this.pos = pos;
  this.sprite = sprite;
  this.hitbox = hitbox || [0,0,16,16];
  this.vel = [0,0];
  this.acc = [0,0];
};

Mario.Entity.prototype.update = function(dt) {
  this.vel[0] += this.acc[0] * dt;
  this.vel[1] += this.acc[1] * dt;
  this.pos[0] += this.vel[0] * dt;
  this.pos[1] += this.vel[1] * dt;
};

Mario.Entity.prototype.render = function(ctx, vX, vY) {
  this.sprite.render(ctx, this.pos[0] - vX, this.pos[1] - vY);
};
