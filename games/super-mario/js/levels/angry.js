(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  Mario.angryLevel = function() {
    if (typeof Mario.oneone === 'function') {
      Mario.oneone();
    }

    if (Mario.AngryPhysics) {
      Mario.AngryPhysics.start(1180);
    }
  };
})();
