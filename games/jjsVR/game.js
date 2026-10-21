(async()=>{
  try {
    const p0 = await (await fetch("./part0.js")).text();
    let b64 = "";
    for (let i = 0; i < 4; i++) b64 += await (await fetch("./bc" + i + ".txt")).text();
    const rest = atob(b64.replace(/\s+/g,""));
    await import(URL.createObjectURL(new Blob([p0 + rest], { type: "text/javascript" })));
  } catch(e) {
    console.error(e);
    const s = document.getElementById("status");
    if (s) s.innerHTML = "<strong>Load error:</strong> " + e;
  }
})();
