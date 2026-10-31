// ===== ONLINE LOBBY entry: v4 base + join fix =====
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/Victorxd21/hello21.github.io@c2df1c5cf87b91f5f34d49ab71c5fa83a7ecdaa9/games/chess/online-lobby.js?t=' + Date.now();
  s.onload = function () {
    console.log('online lobby v4 base loaded');
    try {
      var _create = window.createRoom;
      var _join = window.joinRoom;

      window.createRoom = async function () {
        var code = await _create.apply(this, arguments);
        try {
          if (channel) {
            channel.on('broadcast', { event: 'player_joined' }, function (msg) {
              if (typeof window.__onOnlineOpponentJoined === 'function') {
                window.__onOnlineOpponentJoined();
              }
            });
            channel.on('presence', { event: 'join' }, function () {
              if (typeof window.__onOnlineOpponentJoined === 'function') {
                window.__onOnlineOpponentJoined();
              }
            });
            if (window.__lobbyPoll) clearInterval(window.__lobbyPoll);
            window.__lobbyPoll = setInterval(function () {
              if (!isHost || !channel) return;
              try {
                var state = channel.presenceState() || {};
                var others = Object.keys(state).filter(function (k) { return k !== 'host'; });
                if (others.length && typeof window.__onOnlineOpponentJoined === 'function') {
                  window.__onOnlineOpponentJoined();
                }
              } catch (e) {}
            }, 700);
          }
        } catch (e) { console.warn(e); }
        return code;
      };

      window.joinRoom = async function (code) {
        var ok = await _join.apply(this, arguments);
        if (!ok) return false;
        try {
          if (channel) {
            var ping = function () {
              try {
                channel.send({
                  type: 'broadcast',
                  event: 'player_joined',
                  payload: {
                    cosmetic: (typeof myCosmetic !== 'undefined' && myCosmetic && myCosmetic.id) || 'classic',
                    role: 'guest'
                  }
                });
              } catch (e) {}
            };
            setTimeout(ping, 300);
            setTimeout(ping, 800);
            setTimeout(ping, 1500);
            setTimeout(ping, 2500);
            setTimeout(ping, 4000);
            var n = 0;
            var iv = setInterval(function () {
              n++;
              if (n > 15) { clearInterval(iv); return; }
              ping();
            }, 1200);
          }
        } catch (e) { console.warn(e); }
        return true;
      };

      console.log('join fix applied');
    } catch (e) {
      console.error('join fix failed', e);
    }
  };
  s.onerror = function () { console.error('failed to load online lobby base'); };
  document.body.appendChild(s);
})();
