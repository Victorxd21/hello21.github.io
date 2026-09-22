```javascript
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const playButton = document.getElementById("playButton");
const hud = document.getElementById("hud");
const heightText = document.getElementById("height");

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;

canvas.width = WIDTH;
canvas.height = HEIGHT;

window.addEventListener("resize", () => {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;
});

/* =========================================================
   SETTINGS
========================================================= */

const CONFIG = {
    catSize: 28,

    gravity: 0.65,
    moveSpeed: 4.5,
    jumpForce: 12,

    friction: 0.82,
    airFriction: 0.96,

    chainLength: 95,
    chainStiffness: 0.16,

    cameraSmoothness: 0.08,

    platformWidthMin: 110,
    platformWidthMax: 230,

    platformHeight: 18,

    levelGapMin: 100,
    levelGapMax: 170
};

/* =========================================================
   INPUT
========================================================= */

const keys = {};

window.addEventListener("keydown", (event) => {
    keys[event.key.toLowerCase()] = true;

    if (
        event.code === "Space" ||
        event.key === "ArrowUp"
    ) {
        event.preventDefault();
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
});

/* =========================================================
   GAME STATE
========================================================= */

let gameStarted = false;

let cameraY = 0;

let highestPoint = 0;

let platforms = [];

let cats = [];

let chainSegments = [];

/* =========================================================
   UTILITY
========================================================= */

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/* =========================================================
   CAT
========================================================= */

class Cat {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;

        this.vx = 0;
        this.vy = 0;

        this.width = CONFIG.catSize;
        this.height = CONFIG.catSize;

        this.color = color;

        this.grounded = false;

        this.jumpCooldown = 0;

        this.spawnX = x;
        this.spawnY = y;
    }

    update() {
        const left =
            keys["a"] ||
            keys["arrowleft"];

        const right =
            keys["d"] ||
            keys["arrowright"];

        const jump =
            keys["w"] ||
            keys["arrowup"] ||
            keys[" "];

        /*
         * Horizontal movement
         */

        if (left) {
            this.vx -= 0.7;
        }

        if (right) {
            this.vx += 0.7;
        }

        this.vx = clamp(
            this.vx,
            -CONFIG.moveSpeed,
            CONFIG.moveSpeed
        );

        /*
         * Friction
         */

        if (this.grounded) {
            this.vx *= CONFIG.friction;
        } else {
            this.vx *= CONFIG.airFriction;
        }

        /*
         * Jump
         */

        if (
            jump &&
            this.grounded &&
            this.jumpCooldown <= 0
        ) {
            this.vy = -CONFIG.jumpForce;
            this.grounded = false;
            this.jumpCooldown = 12;
        }

        if (this.jumpCooldown > 0) {
            this.jumpCooldown--;
        }

        /*
         * Gravity
         */

        this.vy += CONFIG.gravity;

        /*
         * Move
         */

        this.x += this.vx;
        this.y += this.vy;

        /*
         * Platform collision
         */

        this.grounded = false;

        for (const platform of platforms) {
            this.collideWithPlatform(platform);
        }

        /*
         * World boundaries
         */

        if (this.x < 0) {
            this.x = 0;
            this.vx *= -0.4;
        }

        if (this.x + this.width > WIDTH) {
            this.x = WIDTH - this.width;
            this.vx *= -0.4;
        }

        /*
         * Respawn if player falls too far
         */

        if (this.y > cameraY + HEIGHT + 500) {
            this.respawn();
        }

        highestPoint = Math.min(
            highestPoint,
            this.y
        );
    }

    collideWithPlatform(platform) {
        const catBottom =
            this.y + this.height;

        const catTop =
            this.y;

        const catRight =
            this.x + this.width;

        const catLeft =
            this.x;

        const platformTop =
            platform.y;

        const platformBottom =
            platform.y + platform.height;

        const platformRight =
            platform.x + platform.width;

        const platformLeft =
            platform.x;

        const horizontalCollision =
            catRight > platformLeft &&
            catLeft < platformRight;

        /*
         * Landing on top
         */

        if (
            horizontalCollision &&
            this.vy >= 0 &&
            catBottom >= platformTop &&
            catTop < platformTop
        ) {
            this.y =
                platformTop - this.height;

            this.vy = 0;

            this.grounded = true;

            return;
        }

        /*
         * Hit underside
         */

        if (
            horizontalCollision &&
            this.vy < 0 &&
            catTop <= platformBottom &&
            catBottom > platformBottom
        ) {
            this.y = platformBottom;
            this.vy = 0;
        }
    }

    respawn() {
        this.x = this.spawnX;
        this.y = this.spawnY;

        this.vx = 0;
        this.vy = 0;
    }

    draw() {
        const screenY =
            this.y - cameraY;

        /*
         * Cat body
         */

        ctx.fillStyle = this.color;

        ctx.fillRect(
            this.x,
            screenY,
            this.width,
            this.height
        );

        /*
         * Tiny ears
         */

        ctx.beginPath();

        ctx.moveTo(
            this.x + 3,
            screenY
        );

        ctx.lineTo(
            this.x + 9,
            screenY - 7
        );

        ctx.lineTo(
            this.x + 15,
            screenY
        );

        ctx.fill();

        ctx.beginPath();

        ctx.moveTo(
            this.x + this.width - 15,
            screenY
        );

        ctx.lineTo(
            this.x + this.width - 9,
            screenY - 7
        );

        ctx.lineTo(
            this.x + this.width - 3,
            screenY
        );

        ctx.fill();

        /*
         * Eyes
         */

        ctx.fillStyle = "#111";

        ctx.fillRect(
            this.x + 7,
            screenY + 9,
            4,
            4
        );

        ctx.fillRect(
            this.x + 17,
            screenY + 9,
            4,
            4
        );
    }
}

/* =========================================================
   PLATFORM
========================================================= */

class Platform {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;

        this.width = width;
        this.height = CONFIG.platformHeight;
    }

    draw() {
        const screenY =
            this.y - cameraY;

        ctx.fillStyle = "#333";

        ctx.fillRect(
            this.x,
            screenY,
            this.width,
            this.height
        );

        ctx.fillStyle = "#555";

        ctx.fillRect(
            this.x,
            screenY,
            this.width,
            3
        );
    }
}

/* =========================================================
   CHAIN
========================================================= */

class ChainSegment {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.vx = 0;
        this.vy = 0;
    }
}

function createChain() {
    chainSegments = [];

    const catA = cats[0];
    const catB = cats[1];

    const dx =
        catB.x - catA.x;

    const dy =
        catB.y - catA.y;

    const distance =
        Math.sqrt(dx * dx + dy * dy);

    const count =
        Math.max(
            2,
            Math.floor(
                distance / 12
            )
        );

    for (let i = 0; i <= count; i++) {
        const t = i / count;

        chainSegments.push(
            new ChainSegment(
                catA.x + dx * t,
                catA.y + dy * t
            )
        );
    }
}

function updateChain() {
    if (cats.length < 2) {
        return;
    }

    const a = cats[0];
    const b = cats[1];

    /*
     * Pull the cats toward each other
     * when they exceed the allowed chain length.
     */

    let dx =
        b.x - a.x;

    let dy =
        b.y - a.y;

    let distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    if (distance === 0) {
        distance = 0.001;
    }

    const maxLength =
        CONFIG.chainLength;

    if (distance > maxLength) {
        const difference =
            distance - maxLength;

        const nx =
            dx / distance;

        const ny =
            dy / distance;

        const force =
            difference *
            CONFIG.chainStiffness;

        a.vx += nx * force;
        a.vy += ny * force;

        b.vx -= nx * force;
        b.vy -= ny * force;
    }

    /*
     * Update visible chain segments.
     */

    const count =
        chainSegments.length - 1;

    for (let i = 0; i <= count; i++) {
        const t =
            count === 0
                ? 0
                : i / count;

        const targetX =
            a.x +
            (b.x - a.x) * t +
            a.vx * t * 2;

        const targetY =
            a.y +
            (b.y - a.y) * t;

        const segment =
            chainSegments[i];

        segment.vx +=
            (targetX - segment.x) *
            0.25;

        segment.vy +=
            (targetY - segment.y) *
            0.25;

        segment.vx *= 0.82;
        segment.vy *= 0.82;

        segment.x += segment.vx;
        segment.y += segment.vy;
    }
}

function drawChain() {
    if (cats.length < 2) {
        return;
    }

    /*
     * Draw rope using a smooth line
     * through the physics segments.
     */

    ctx.beginPath();

    if (chainSegments.length > 0) {
        const first =
            chainSegments[0];

        ctx.moveTo(
            first.x,
            first.y - cameraY
        );

        for (
            let i = 1;
            i < chainSegments.length;
            i++
        ) {
            const segment =
                chainSegments[i];

            ctx.lineTo(
                segment.x,
                segment.y - cameraY
            );
        }
    }

    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();
}

/* =========================================================
   LEVEL GENERATION
========================================================= */

function generateInitialLevel() {
    platforms = [];

    /*
     * Starting platform
     */

    platforms.push(
        new Platform(
            WIDTH / 2 - 150,
            400,
            300
        )
    );

    let currentY = 300;

    /*
     * Generate lots of platforms upward.
     */

    for (let i = 0; i < 80; i++) {
        const width =
            random(
                CONFIG.platformWidthMin,
                CONFIG.platformWidthMax
            );

        const x =
            random(
                20,
                WIDTH - width - 20
            );

        platforms.push(
            new Platform(
                x,
                currentY,
                width
            )
        );

        currentY -= random(
            CONFIG.levelGapMin,
            CONFIG.levelGapMax
        );
    }
}

/* =========================================================
   ADD MORE LEVEL
========================================================= */

function generateMoreLevel() {
    if (platforms.length === 0) {
        return;
    }

    let highestPlatform =
        Math.min(
            ...platforms.map(
                p => p.y
            )
        );

    for (let i = 0; i < 30; i++) {
        const width =
            random(
                CONFIG.platformWidthMin,
                CONFIG.platformWidthMax
            );

        const x =
            random(
                20,
                WIDTH - width - 20
            );

        highestPlatform -= random(
            CONFIG.levelGapMin,
            CONFIG.levelGapMax
        );

        platforms.push(
            new Platform(
                x,
                highestPlatform,
                width
            )
        );
    }
}

/* =========================================================
   CAMERA
========================================================= */

function updateCamera() {
    if (cats.length === 0) {
        return;
    }

    /*
     * Follow the highest cat.
     */

    const highestCat =
        cats.reduce(
            (highest, cat) =>
                cat.y < highest.y
                    ? cat
                    : highest,
            cats[0]
        );

    const targetCamera =
        highestCat.y -
        HEIGHT * 0.55;

    /*
     * Camera only moves upward.
     */

    if (
        targetCamera <
        cameraY
    ) {
        cameraY +=
            (
                targetCamera -
                cameraY
            ) *
            CONFIG.cameraSmoothness;
    }

    /*
     * Generate more platforms
     * when we're getting close to the top.
     */

    const highestPlatform =
        Math.min(
            ...platforms.map(
                p => p.y
            )
        );

    if (
        highestPlatform >
        cameraY - HEIGHT * 2
    ) {
        generateMoreLevel();
    }
}

/* =========================================================
   BACKGROUND
========================================================= */

function drawBackground() {
    ctx.fillStyle = "#151515";

    ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
    );

    /*
     * Simple vertical grid.
     */

    const gridSize = 50;

    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 1;

    const offsetY =
        -cameraY % gridSize;

    for (
        let y = offsetY;
        y < HEIGHT;
        y += gridSize
    ) {
        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            WIDTH,
            y
        );

        ctx.stroke();
    }

    for (
        let x = 0;
        x < WIDTH;
        x += gridSize
    ) {
        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            HEIGHT
        );

        ctx.stroke();
    }
}

/* =========================================================
   HEIGHT HUD
========================================================= */

function updateHUD() {
    if (cats.length === 0) {
        return;
    }

    const highestCat =
        Math.min(
            ...cats.map(
                cat => cat.y
            )
        );

    const meters =
        Math.max(
            0,
            Math.floor(
                (400 - highestCat) / 10
            )
        );

    heightText.textContent =
        `Height: ${meters}m`;
}

/* =========================================================
   START GAME
========================================================= */

function startGame() {
    gameStarted = true;

    menu.style.display = "none";
    hud.style.display = "block";

    generateInitialLevel();

    /*
     * Two test cats.
     *
     * Later these will become
     * actual multiplayer players.
     */

    cats = [
        new Cat(
            WIDTH / 2 - 55,
            330,
            "#ff4d5a"
        ),

        new Cat(
            WIDTH / 2 + 25,
            330,
            "#4d8dff"
        )
    ];

    createChain();

    requestAnimationFrame(gameLoop);
}

/* =========================================================
   GAME LOOP
========================================================= */

let lastTime = performance.now();

function gameLoop(currentTime) {
    if (!gameStarted) {
        return;
    }

    /*
     * Prevent huge physics jumps
     * when the browser lags.
     */

    const delta =
        Math.min(
            (currentTime - lastTime) / 16.67,
            2
        );

    lastTime = currentTime;

    /*
     * Physics update
     */

    for (const cat of cats) {
        cat.update();
    }

    updateChain();

    updateCamera();

    updateHUD();

    /*
     * Rendering
     */

    drawBackground();

    for (const platform of platforms) {
        /*
         * Don't draw platforms far away.
         */

        const screenY =
            platform.y - cameraY;

        if (
            screenY > -100 &&
            screenY < HEIGHT + 100
        ) {
            platform.draw();
        }
    }

    drawChain();

    for (const cat of cats) {
        cat.draw();
    }

    requestAnimationFrame(gameLoop);
}

/* =========================================================
   PLAY BUTTON
========================================================= */

playButton.addEventListener(
    "click",
    startGame
);
```
