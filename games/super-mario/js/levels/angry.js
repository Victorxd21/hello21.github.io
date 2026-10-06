(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  Mario.angryLevel = function() {
    if (typeof Mario.oneone === 'function') {
      Mario.oneone();
    } else {
      console.error('Mario.oneone not found');
      return;
    }

    setTimeout(function() {
      if (Mario.AngryPhysics) {
        try {
          Mario.AngryPhysics.start(1180);
        } catch (e) {
          console.error('AngryPhysics start failed:', e);
        }
      }
    }, 100);
  };
})();
