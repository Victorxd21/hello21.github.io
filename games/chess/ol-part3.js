typeof startOnlineGame === 'function') {
    startOnlineGame = startOnlineWithMode;
    window.startOnlineGame = startOnlineWithMode;
  }

  console.log('online lobby v5 ready');
})();
