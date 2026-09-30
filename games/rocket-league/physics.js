// Simple car + ball physics for Rocket League prototype

const Physics = {
  GRAVITY: -28,
  CAR_SPEED: 42,
  CAR_TURN: 2.8,
  BOOST_MULT: 1.85,
  JUMP_FORCE: 14,
  BALL_BOUNCE: 0.72,
  BALL_FRICTION: 0.985,
  CAR_RADIUS: 1.6,
  BALL_RADIUS: 1.15,

  updateCar(car, input, dt, boostAmount) {
    if (!car || !car.userData) return boostAmount;

    const ud = car.userData;
    if (!ud.velocity) ud.velocity = new THREE.Vector3();
    if (!ud.onGround) ud.onGround = true;

    let throttle = 0;
    let steer = 0;
    let boosting = false;
    let jump = false;

    if (input.forward) throttle = 1;
    if (input.back) throttle = -0.55;
    if (input.left) steer = 1;
    if (input.right) steer = -1;
    if (input.boost) boosting = true;
    if (input.jump) jump = true;

    // Boost
    if (boosting && boostAmount > 0) {
      boostAmount = Math.max(0, boostAmount - 55 * dt);
      throttle *= this.BOOST_MULT;
    } else {
      boostAmount = Math.min(100, boostAmount + 18 * dt);
    }

    // Steering
    if (Math.abs(throttle) > 0.05 || Math.abs(ud.velocity.length()) > 1) {
      car.rotation.y += steer * this.CAR_TURN * dt * (throttle >= 0 ? 1 : -0.7);
    }

    // Acceleration
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(car.quaternion);
    const accel = forward.multiplyScalar(throttle * this.CAR_SPEED * dt);
    ud.velocity.add(accel);

    // Drag
    ud.velocity.x *= 0.96;
    ud.velocity.z *= 0.96;

    // Jump
    if (jump && ud.onGround) {
      ud.velocity.y = this.JUMP_FORCE;
      ud.onGround = false;
    }

    // Gravity
    if (!ud.onGround) {
      ud.velocity.y += this.GRAVITY * dt;
    }

    // Apply velocity
    car.position.add(ud.velocity.clone().multiplyScalar(dt));

    // Ground collision
    if (car.position.y <= 0.55) {
      car.position.y = 0.55;
      ud.velocity.y = 0;
      ud.onGround = true;
    }

    // Soft arena bounds
    car.position.x = Math.max(-56, Math.min(56, car.position.x));
    car.position.z = Math.max(-36, Math.min(36, car.position.z));

    return boostAmount;
  },

  updateBall(ball, cars, dt) {
    if (!ball || !ball.userData) return;
    const v = ball.userData.velocity;
    if (!v) {
      ball.userData.velocity = new THREE.Vector3();
      return;
    }

    // Gravity
    v.y += this.GRAVITY * dt;

    // Integrate
    ball.position.add(v.clone().multiplyScalar(dt));

    // Floor bounce
    if (ball.position.y < this.BALL_RADIUS) {
      ball.position.y = this.BALL_RADIUS;
      v.y = -v.y * this.BALL_BOUNCE;
      v.x *= this.BALL_FRICTION;
      v.z *= this.BALL_FRICTION;
    }

    // Walls
    if (Math.abs(ball.position.x) > 58) {
      ball.position.x = Math.sign(ball.position.x) * 58;
      v.x *= -0.75;
    }
    if (Math.abs(ball.position.z) > 38) {
      ball.position.z = Math.sign(ball.position.z) * 38;
      v.z *= -0.75;
    }

    // Ceiling
    if (ball.position.y > 22) {
      ball.position.y = 22;
      v.y *= -0.5;
    }

    // Car collisions
    cars.forEach(car => {
      if (!car) return;
      const dist = ball.position.distanceTo(car.position);
      const minDist = this.CAR_RADIUS + this.BALL_RADIUS;
      if (dist < minDist && dist > 0.01) {
        const dir = ball.position.clone().sub(car.position).normalize();
        const push = (minDist - dist) * 1.2;
        ball.position.add(dir.clone().multiplyScalar(push));

        // Transfer velocity
        const carVel = car.userData.velocity || new THREE.Vector3();
        const relative = carVel.clone().sub(v);
        const impact = relative.dot(dir);
        if (impact > 0) {
          v.add(dir.multiplyScalar(impact * 1.4 + 4));
          v.y += 3 + Math.random() * 2;
        }
      }
    });
  },

  checkGoal(ball) {
    // Blue goal (negative X) -> Orange scores
    if (ball.position.x < -54.5 && Math.abs(ball.position.z) < 11.5 && ball.position.y < 7.5) {
      return "orange";
    }
    // Orange goal (positive X) -> Blue scores
    if (ball.position.x > 54.5 && Math.abs(ball.position.z) < 11.5 && ball.position.y < 7.5) {
      return "blue";
    }
    return null;
  },

  resetBall(ball) {
    ball.position.set(0, this.BALL_RADIUS + 0.1, 0);
    ball.userData.velocity.set(0, 0, 0);
  }
};
