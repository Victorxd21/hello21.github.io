const parts = [];
async function load() {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('./c' + i + '.txt');
    parts.push(await r.text());
  }
  const code = atob(parts.join(''));
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  await import(url);
}
load().catch(e => {
  console.error(e);
  const s = document.getElementById('status');
  if (s) s.textContent = 'Load error: ' + e;
});
