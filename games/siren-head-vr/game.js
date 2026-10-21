/**
 * Siren Head VR — loads the original game and retargets sound paths.
 * Full source lives in ../Siren Head/; this folder is the VR workspace copy.
 */
(async function () {
  const res = await fetch("../Siren%20Head/game.js");
  if (!res.ok) throw new Error("Failed to load Siren Head game.js: " + res.status);
  let code = await res.text();
  // Force sound folder to the original location
  code = code.replace(
    /const FOLDER\s*=\s*['"][^'"]*['"]/,
    "const FOLDER = '../Siren Head/SirenSounds/'"
  );
  code = code.replace(/(['"])SirenSounds\//g, "$1../Siren Head/SirenSounds/");
  const blob = new Blob([code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  await import(url);
})().catch((e) => {
  console.error(e);
  const el = document.getElementById("loading");
  if (el) el.innerHTML = "<div class='loading-inner'><div class='loading-title'>LOAD ERROR</div><div class='loading-sub'>" + e + "</div></div>";
});
