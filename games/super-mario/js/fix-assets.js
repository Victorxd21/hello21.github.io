/**
 * Fix for loading Mario sprites/sounds from CDN when the engine code
 * still uses relative paths like 'sprites/player.png'.
 */
(function() {
  var ASSET_BASE = 'https://cdn.jsdelivr.net/gh/reruns/mario@gh-pages/';

  function fixUrl(url) {
    if (!url) return url;
    if (url.indexOf('http') === 0 || url.indexOf('data:') === 0) return url;
    url = url.replace(/^\.\//, '').replace(/^\//, '');
    return ASSET_BASE + url;
  }

  function patchResources() {
    if (typeof resources === 'undefined') {
      setTimeout(patchResources, 10);
      return;
    }
    var origLoad = resources.load;
    var origGet = resources.get;

    resources.load = function(urlOrArr) {
      if (urlOrArr instanceof Array) {
        return origLoad.call(resources, urlOrArr.map(fixUrl));
      }
      return origLoad.call(resources, fixUrl(urlOrArr));
    };

    resources.get = function(url) {
      return origGet.call(resources, fixUrl(url));
    };

    console.log('[fix-assets] resources patched to use CDN');
  }

  function patchSprite() {
    if (typeof Mario === 'undefined' || !Mario.Sprite) {
      setTimeout(patchSprite, 10);
      return;
    }
    var OrigSprite = Mario.Sprite;
    Mario.Sprite = function(img, pos, size, speed, frames, once) {
      return new OrigSprite(fixUrl(img), pos, size, speed, frames, once);
    };
    for (var k in OrigSprite) {
      if (OrigSprite.hasOwnProperty(k)) Mario.Sprite[k] = OrigSprite[k];
    }
    Mario.Sprite.prototype = OrigSprite.prototype;
    console.log('[fix-assets] Mario.Sprite patched');
  }

  patchResources();
  patchSprite();
})();
