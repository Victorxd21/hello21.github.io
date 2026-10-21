(async()=>{
  try {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      parts.push(await (await fetch("./part" + i + ".js")).text());
    }
    const code = parts.join("");
    await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
  } catch(e) {
    console.error(e);
    const s = document.getElementById("status");
    if (s) s.innerHTML = "<strong>Load error:</strong> " + e;
  }
})();
