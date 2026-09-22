```javascript
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const playButton = document.getElementById("playButton");
const hud = document.getElementById("hud");
const heightText = document.getElementById("height");

let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

window.addEventListener("resize", function () {
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;
});


/* =========================================================
   CONFIG
========================================================= */

const CONFIG = {
    catSize: 28,

    gravity: 0.6,
    moveSpeed: 4.5,
    jumpForce: 12,

    groundFriction: 0.78,
    airFriction: 0.96,

    chainLength: 100,
    chainForce: 0.18,

    cameraSpeed: 0.08,

    platformMinWidth: 120,
    platformMaxWidth: 240,

    platformHeight: 18,

    platformGapMin: 100,
    platformGapMax: 170
};


/* =========================================================
   INPUT
========================================================= */

const keys = {};

window.addEventListener("keydown", function (event) {
    keys[event.key.toLowerCase()] = true;

    if (event.code === "Space") {
        event.preventDefault();
    }
});

window.addEventListener("keyup", function (event) {
    keys[event.key.toLowerCase()] = false;
});


/* =========================================================
   GAME STATE
========================================================= */

let gameStarted = false;

let cameraY = 0;

let platforms = [];

let cats = [];

let chainPoints = [];


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
        this.jumpLock = false;

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


        /* Horizontal movement */

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


        /* Friction */

        if (this.grounded) {
            this.vx *= CONFIG.groundFriction;
        } else {
            this.vx *= CONFIG.airFriction;
        }


        /* Jump */

        if (jump && this.grounded && !this.jumpLock) {

            this.vy = -CONFIG.jumpForce;

            this.grounded = false;

            this.jumpLock = true;
        }

        if (!jump) {
            this.jumpLock = false;
        }


        /* Gravity */

        this.vy += CONFIG.gravity;


        /* Move */

        this.x += this.vx;
        this.y += this.vy;


        /* Platform collision */

        this.grounded = false;

        for (let i = 0; i < platforms.length; i++) {
            this.collideWithPlatform(platforms[i]);
        }


        /* Screen boundaries */

        if (this.x < 0) {

            this.x = 0;
            this.vx *= -0.4;
        }


        if (this.x + this.width > width) {

            this.x = width - this.width;
            this.vx *= -0.4;
        }


        /* Respawn */

        if (this.y > cameraY + height + 500) {
            this.respawn();
        }
    }


    collideWithPlatform(platform) {

        const bottom = this.y + this.height;
        const top = this.y;

        const right = this.x + this.width;
        const left = this.x;

        const platformTop = platform.y;
        const platformBottom =
            platform.y + platform.height;

        const platformLeft = platform.x;
        const platformRight =
            platform.x + platform.width;


        const horizontal =
            right > platformLeft &&
            left < platformRight;


        /* Landing */

        if (
            horizontal &&
            this.vy >= 0 &&
            bottom >= platformTop &&
            top < platformTop
        ) {

            this.y =
                platformTop - this.height;

            this.vy = 0;

            this.grounded = true;

            return;
        }


        /* Hitting the bottom */

        if (
            horizontal &&
            this.vy < 0 &&
            top <= platformBottom &&
            bottom > platformBottom
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


        /* Body */

        ctx.fillStyle = this.color;

        ctx.fillRect(
            this.x,
            screenY,
            this.width,
            this.height
        );


        /* Ears */

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


        /* Eyes */

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

    constructor(x, y, platformWidth) {

        this.x = x;
        this.y = y;

        this.width = platformWidth;
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
   LEVEL GENERATION
========================================================= */

function generateLevel() {

    platforms = [];


    /* Starting platform */

    platforms.push(
        new Platform(
            width / 2 - 160,
            400,
            320
        )
    );


    let y = 300;


    /* Generate platforms upward */

    for (let i = 0; i < 100; i++) {

        const platformWidth =
            random(
                CONFIG.platformMinWidth,
                CONFIG.platformMaxWidth
            );


        const x =
            random(
                20,
                width - platformWidth - 20
            );


        platforms.push(
            new Platform(
                x,
                y,
                platformWidth
            )
        );


        y -= random(
            CONFIG.platformGapMin,
            CONFIG.platformGapMax
        );
    }
}


/* =========================================================
   MORE PLATFORMS
========================================================= */

function generateMorePlatforms() {

    let highestY = 0;


    for (let i = 0; i < platforms.length; i++) {

        if (platforms[i].y < highestY) {
            highestY = platforms[i].y;
        }
    }


    for (let i = 0; i < 40; i++) {

        const platformWidth =
            random(
                CONFIG.platformMinWidth,
                CONFIG.platformMaxWidth
            );


        const x =
            random(
                20,
                width - platformWidth - 20
            );


        highestY -= random(
            CONFIG.platformGapMin,
            CONFIG.platformGapMax
        );


        platforms.push(
            new Platform(
                x,
                highestY,
                platformWidth
            )
        );
    }
}


/* =========================================================
   CHAIN
========================================================= */

function createChain() {

    chainPoints = [];


    if (cats.length < 2) {
        return;
    }


    const first = cats[0];
    const second = cats[1];


    const dx = second.x - first.x;
    const dy = second.y - first.y;


    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    const count =
        Math.max(
            4,
            Math.floor(distance / 10)
        );


    for (let i = 0; i <= count; i++) {

        const t = i / count;


        chainPoints.push({
            x: first.x + dx * t,
            y: first.y + dy * t,
            vx: 0,
            vy: 0
        });
    }
}


function updateChain() {

    if (cats.length < 2) {
        return;
    }


    const first = cats[0];
    const second = cats[1];


    let dx =
        second.x - first.x;

    let dy =
        second.y - first.y;


    let distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    if (distance < 0.001) {
        distance = 0.001;
    }


    /* Pull cats together when chain is stretched */

    if (distance > CONFIG.chainLength) {

        const amount =
            distance - CONFIG.chainLength;


        const nx =
            dx / distance;

        const ny =
            dy / distance;


        const force =
            amount * CONFIG.chainForce;


        first.vx += nx * force;
        first.vy += ny * force;

        second.vx -= nx * force;
        second.vy -= ny * force;
    }


    /* Move chain points */

    const count =
        chainPoints.length - 1;


    for (let i = 0; i <= count; i++) {

        const point =
            chainPoints[i];


        const t =
            count === 0
                ? 0
                : i / count;


        const targetX =
            first.x +
            (second.x - first.x) * t;


        const targetY =
            first.y +
            (second.y - first.y) * t;


        point.vx +=
            (targetX - point.x) * 0.25;


        point.vy +=
            (targetY - point.y) * 0.25;


        point.vx *= 0.82;
        point.vy *= 0.82;


        point.x += point.vx;
        point.y += point.vy;
    }
}


function drawChain() {

    if (chainPoints.length < 2) {
        return;
    }


    ctx.beginPath();


    const first =
        chainPoints[0];


    ctx.moveTo(
        first.x,
        first.y - cameraY
    );


    for (let i = 1; i < chainPoints.length; i++) {

        const point =
            chainPoints[i];


        ctx.lineTo(
            point.x,
            point.y - cameraY
        );
    }


    ctx.strokeStyle = "#aaa";

    ctx.lineWidth = 5;

    ctx.lineCap = "round";

    ctx.lineJoin = "round";

    ctx.stroke();
}


/* =========================================================
   CAMERA
========================================================= */

function updateCamera() {

    if (cats.length === 0) {
        return;
    }


    let highestCat =
        cats[0];


    for (let i = 1; i < cats.length; i++) {

        if (cats[i].y < highestCat.y) {
            highestCat = cats[i];
        }
    }


    const target =
        highestCat.y -
        height * 0.55;


    /* Camera only travels upward */

    if (target < cameraY) {

        cameraY +=
            (target - cameraY) *
            CONFIG.cameraSpeed;
    }


    /* Generate more level */

    let highestPlatform = 0;


    for (let i = 0; i < platforms.length; i++) {

        if (platforms[i].y < highestPlatform) {
            highestPlatform =
                platforms[i].y;
        }
    }


    if (
        highestPlatform >
        cameraY - height * 2
    ) {

        generateMorePlatforms();
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
        width,
        height
    );


    const gridSize = 50;

    const offset =
        ((-cameraY % gridSize) + gridSize) %
        gridSize;


    ctx.strokeStyle = "#1d1d1d";

    ctx.lineWidth = 1;


    for (
        let y = offset;
        y < height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();
    }


    for (
        let x = 0;
        x < width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            height
        );

        ctx.stroke();
    }
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    if (cats.length === 0) {
        return;
    }


    let highestY =
        cats[0].y;


    for (let i = 1; i < cats.length; i++) {

        if (cats[i].y < highestY) {
            highestY = cats[i].y;
        }
    }


    const meters =
        Math.max(
            0,
            Math.floor(
                (400 - highestY) / 10
            )
        );


    heightText.textContent =
        "Height: " + meters + "m";
}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

    if (gameStarted) {
        return;
    }


    gameStarted = true;


    menu.style.display = "none";

    hud.style.display = "block";


    cameraY = 0;


    generateLevel();


    /*
     * Temporary local test cats.
     *
     * These will become real multiplayer
     * players later.
     */

    cats = [

        new Cat(
            width / 2 - 50,
            350,
            "#ff4d5a"
        ),

        new Cat(
            width / 2 + 22,
            350,
            "#4d8dff"
        )

    ];


    createChain();


    requestAnimationFrame(gameLoop);
}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop() {

    if (!gameStarted) {
        return;
    }


    /* Physics */

    for (let i = 0; i < cats.length; i++) {
        cats[i].update();
    }


    updateChain();

    updateCamera();

    updateHUD();


    /* Render */

    drawBackground();


    for (let i = 0; i < platforms.length; i++) {

        const platform =
            platforms[i];


        const screenY =
            platform.y - cameraY;


        if (
            screenY > -100 &&
            screenY < height + 100
        ) {

            platform.draw();
        }
    }


    drawChain();


    for (let i = 0; i < cats.length; i++) {
        cats[i].draw();
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
