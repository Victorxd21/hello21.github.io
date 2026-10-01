const UI = (() => {
  const $=id=>document.getElementById(id); const screens=['lobbyScreen','waitingScreen','gameScreen','gameOverScreen'];
  function screen(id){screens.forEach(x=>$(x).classList.toggle('active',x===id));}
  function player(){const n=$('playerName').value.trim();if(!n){alert('Enter your name first.');return null}return n;}
  function renderPlayers(list){$('playerCount').textContent=list.length; $('playersList').innerHTML=list.map(p=>`<div class="player ${p.id===multiplayer.playerId?'you':''}">${escapeHtml(p.name)} ${p.host?'👑 Host':''}</div>`).join('');$('readyStatus').textContent=list.length>=2?'Ready! The host can start the game.':'Need at least 2 players to start'; $('startGameBtn').disabled=!(multiplayer.isHost&&list.length>=2); if(list[0])$('player1Name').textContent=list[0].name;if(list[1])$('player2Name').textContent=list[1].name;}
  function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function waiting(){screen('waitingScreen');$('lobbyCodeDisplay').textContent=multiplayer.lobbyCode;}
  function startGame(){screen('gameScreen');$('gameStatus').textContent='SPACE / HOLD SCREEN TO FLY';Game.start();}
  function showGameOver(won,score){screen('gameOverScreen');$('gameOverTitle').textContent=won?'You Win!':'You were eliminated';$('gameOverMessage').textContent=won?'Your rival crashed first!':'Keep flying and try again.';$('gameOverPlayer1Score').textContent=score;}
  $('createLobbyBtn').onclick=async()=>{const n=player();if(n){await multiplayer.create(n);waiting();}}; $('joinLobbyBtn').onclick=()=>{$('joinLobbySection').classList.remove('hidden');}; $('backBtn').onclick=()=>$('joinLobbySection').classList.add('hidden'); $('confirmJoinBtn').onclick=async()=>{const n=player(),c=$('lobbyCode').value.trim();if(n&&c){await multiplayer.join(n,c);waiting();}}; $('startGameBtn').onclick=()=>multiplayer.start(); $('leaveLobbyBtn').onclick=async()=>{await multiplayer.leave();screen('lobbyScreen');}; $('exitGameBtn').onclick=async()=>{await multiplayer.leave();screen('lobbyScreen');}; $('playAgainBtn').onclick=()=>startGame();
  return {renderPlayers,startGame,showGameOver};
})();
