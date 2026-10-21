(async()=>{
  try {
    const a = await (await fetch("./part0.js")).text();
    const b = await (await fetch("./part1.js")).text();
    const code = a + b;
    await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
  } catch(e) {
    console.error(e);
    const s = document.getElementById("status");
    if (s) s.innerHTML = "<strong>Load error:</strong> " + e;
  }
})();
