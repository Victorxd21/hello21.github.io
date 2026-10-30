(async()=>{
const a=await(await fetch('game-a.js?v=5')).text();
const b=await(await fetch('game-b.js?v=5')).text();
const s=document.createElement('script');
s.textContent=a+b;
document.body.appendChild(s);
})();
