// reconstruct online lobby v5
(async function(){
  var n=4;
  var code='';
  for (var i=0;i<n;i++){
    code += await (await fetch('ol-part'+i+'.js?v=5')).text();
  }
  try { (0,eval)(code); console.log('online lobby v5 ready (parts)'); }
  catch(e) { console.error('lobby eval', e); }
})();
