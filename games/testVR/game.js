(async () => {
  try {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const r = await fetch("./c" + i + ".txt");
      parts.push(await r.text());
    }
    const b64 = parts.join("").replace(/\s+/g, "");
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ds = new DecompressionStream("gzip");
    const stream = new Response(bin).body.pipeThrough(ds);
    const code = await new Response(stream).text();
    await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
  } catch (e) {
    console.error(e);
    const s = document.getElementById("status");
    if (s) s.innerHTML = "<strong>Load error:</strong> " + e;
  }
})();
