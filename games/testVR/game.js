(async () => {
  try {
    const raw = await (await fetch("./payload.txt")).text();
    const b64 = raw.replace(/\s+/g, "");
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ds = new DecompressionStream("gzip");
    const stream = new Response(bin).body.pipeThrough(ds);
    const code = await new Response(stream).text();
    const blob = new Blob([code], { type: "text/javascript" });
    await import(URL.createObjectURL(blob));
  } catch (e) {
    console.error(e);
    const s = document.getElementById("status");
    if (s) s.innerHTML = "<strong>Load error:</strong> " + e;
  }
})();
