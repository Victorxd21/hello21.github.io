(async()=>{
const n=31;
const parts=[];
for(let i=0;i<n;i++) parts.push(await(await fetch('p'+i+'.txt?v=7')).text());
const s=document.createElement('script');
s.textContent=atob(parts.join(''));
document.body.appendChild(s);
})();
