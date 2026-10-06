(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  // Hybrid level: classic Mario 1-1 + Angry Birds structures & pigs
  Mario.angryLevel = function() {
    if (typeof Mario.oneone === 'function') {
      Mario.oneone();
    }

    // Wooden tower structures around x = 1200–1500
    level.enemies.push(new Mario.Wood([1200, 176], 12, 32, false));
    level.enemies.push(new Mario.Wood([1240, 176], 12, 32, false));
    level.enemies.push(new Mario.Wood([1280, 176], 12, 32, false));

    level.enemies.push(new Mario.Wood([1196, 160], 56, 12, true));
    level.enemies.push(new Mario.Wood([1236, 160], 56, 12, true));

    level.enemies.push(new Mario.Wood([1210, 128], 12, 32, false));
    level.enemies.push(new Mario.Wood([1260, 128], 12, 32, false));
    level.enemies.push(new Mario.Wood([1206, 116], 70, 12, true));

    // Pigs
    level.enemies.push(new Mario.Pig([1210, 192]));
    level.enemies.push(new Mario.Pig([1250, 192]));
    level.enemies.push(new Mario.Pig([1225, 100]));

    // Second structure further along
    level.enemies.push(new Mario.Wood([1450, 176], 14, 32, false));
    level.enemies.push(new Mario.Wood([1490, 176], 14, 32, false));
    level.enemies.push(new Mario.Wood([1446, 160], 62, 12, true));
    level.enemies.push(new Mario.Pig([1465, 192]));
    level.enemies.push(new Mario.Pig([1475, 144]));

    console.log('Angry Birds structures & pigs added to the level');
  };
})();
