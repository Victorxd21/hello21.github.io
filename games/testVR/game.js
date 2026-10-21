(async () => {
  try {
    const a = await (await fetch("./p0.txt")).text();
    const b = await (await fetch("./p1.txt")).text();
    const code = a + b;
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    await import(url);
  } catch (e) {
    console.error(e);
    const s = document.getElementById("status");
    if (s) s.innerHTML = "<strong>Load error:</strong> " + e;
  }
})();
