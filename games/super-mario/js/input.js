(function() {
    var pressedKeys = {};

    function setKey(event, status) {
        var code = event.keyCode;
        var key;

        switch(code) {
        case 32:
            key = 'SPACE'; break;
        case 37:
            key = 'LEFT'; break;
        case 38:
            key = 'UP'; break;
        case 39:
            key = 'RIGHT'; break;
        case 40:
            key = 'DOWN'; break;
        case 88: // X
            key = 'JUMP'; break;
        case 90: // Z
            key = 'RUN'; break;
        default:
            key = String.fromCharCode(code);
        }

        pressedKeys[key] = status;
    }

    document.addEventListener('keydown', function(e) {
        setKey(e, true);
    });

    document.addEventListener('keyup', function(e) {
        setKey(e, false);
    });

    window.addEventListener('blur', function() {
        pressedKeys = {};
    });

    // ===== Gamepad / PS4 DualShock & DualSense support =====
    // Standard mapping works for PS4 DualShock 4 and most modern controllers.
    // Buttons (standard mapping):
    //   0 = Cross (X)      -> JUMP
    //   1 = Circle (O)
    //   2 = Square        -> RUN
    //   3 = Triangle
    //   12 = D-Pad Up
    //   13 = D-Pad Down
    //   14 = D-Pad Left
    //   15 = D-Pad Right
    // Axes: 0 = Left stick X, 1 = Left stick Y

    var gamepadState = {
        LEFT: false,
        RIGHT: false,
        UP: false,
        DOWN: false,
        JUMP: false,
        RUN: false
    };

    function pollGamepads() {
        var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        // Reset
        gamepadState.LEFT = false;
        gamepadState.RIGHT = false;
        gamepadState.UP = false;
        gamepadState.DOWN = false;
        gamepadState.JUMP = false;
        gamepadState.RUN = false;

        for (var i = 0; i < gamepads.length; i++) {
            var gp = gamepads[i];
            if (!gp) continue;

            // Prefer standard mapping when available
            var buttons = gp.buttons;
            var axes = gp.axes;

            // D-Pad
            if (buttons[14] && buttons[14].pressed) gamepadState.LEFT = true;
            if (buttons[15] && buttons[15].pressed) gamepadState.RIGHT = true;
            if (buttons[12] && buttons[12].pressed) gamepadState.UP = true;
            if (buttons[13] && buttons[13].pressed) gamepadState.DOWN = true;

            // Face buttons
            // Cross (0) = Jump, Square (2) = Run  (common PS4 layout)
            if (buttons[0] && buttons[0].pressed) gamepadState.JUMP = true;
            if (buttons[2] && buttons[2].pressed) gamepadState.RUN = true;

            // Left stick (with deadzone)
            var deadzone = 0.25;
            if (axes[0] < -deadzone) gamepadState.LEFT = true;
            if (axes[0] >  deadzone) gamepadState.RIGHT = true;
            if (axes[1] < -deadzone) gamepadState.UP = true;
            if (axes[1] >  deadzone) gamepadState.DOWN = true;
        }
    }

    // Poll every frame via requestAnimationFrame for low latency
    function gamepadLoop() {
        pollGamepads();
        requestAnimationFrame(gamepadLoop);
    }
    requestAnimationFrame(gamepadLoop);

    // Also listen for connection events
    window.addEventListener("gamepadconnected", function(e) {
        console.log("Gamepad connected:", e.gamepad.id);
    });
    window.addEventListener("gamepaddisconnected", function(e) {
        console.log("Gamepad disconnected:", e.gamepad.id);
    });

    window.input = {
        isDown: function(key) {
            key = key.toUpperCase();
            return !!(pressedKeys[key] || gamepadState[key]);
        },
        reset: function() {
            pressedKeys['RUN'] = false;
            pressedKeys['LEFT'] = false;
            pressedKeys['RIGHT'] = false;
            pressedKeys['DOWN'] = false;
            pressedKeys['JUMP'] = false;
            // gamepad state is polled continuously, no need to clear
        }
    };
})();
