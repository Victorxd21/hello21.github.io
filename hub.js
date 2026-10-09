/* hub.js v3.1.2 — load full feature set + rigid-body cubes */
(async function bootstrap() {
  const CDN = "https://cdn.jsdelivr.net/gh/Victorxd21/hello21.github.io@515b90c2a1e97a73cece93063b1411728f82c32a/index.html";
  try {
    const r = await fetch(CDN, { cache: "no-store" });
    if (!r.ok) throw new Error("CDN " + r.status);
    const html = await r.text();
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!m) throw new Error("no script in CDN hub");
    let code = m[1];

    // Version
    code = code.replace(/3\.1\.0/g, "3.1.2");

    // Safe DOM: never crash if an optional node is missing
    code = code.replace(
      /document\.getElementById\("([^"]+)"\)\.textContent/g,
      '(document.getElementById("$1")||{textContent:""}).textContent'
    );
    code = code.replace(
      /document\.getElementById\("([^"]+)"\)\.innerHTML/g,
      '(document.getElementById("$1")||{innerHTML:""}).innerHTML'
    );
    code = code.replace(
      /document\.getElementById\("([^"]+)"\)\.style/g,
      '(document.getElementById("$1")||{style:{}}).style'
    );
    code = code.replace(
      /document\.getElementById\("([^"]+)"\)\.classList/g,
      '(document.getElementById("$1")||{classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false}}}).classList'
    );
    code = code.replace(
      /document\.getElementById\("([^"]+)"\)\.addEventListener/g,
      '(document.getElementById("$1")&&document.getElementById("$1").addEventListener.bind(document.getElementById("$1")))'
    );

    // Rigid-body cube collisions
    code = code.replace(
      /const push = \(minD - dist\) \* 0\.08, nx = dx \/ dist, ny = dy \/ dist;\s*a\.vx -= nx \* push; a\.vy -= ny \* push;\s*b\.vx \+= nx \* push; b\.vy \+= ny \* push;/,
      `const nx = dx / dist, ny = dy / dist;
              const pen = minD - dist;
              const ma = a.size * a.size, mb = b.size * b.size;
              const inv = 1 / (ma + mb);
              a.x -= nx * pen * mb * inv; a.y -= ny * pen * mb * inv;
              b.x += nx * pen * ma * inv; b.y += ny * pen * ma * inv;
              const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv > 0) continue;
              const jn = -(1 + 0.55) * rv / (1/ma + 1/mb);
              a.vx -= (jn * nx) / ma; a.vy -= (jn * ny) / ma;
              b.vx += (jn * nx) / mb; b.vy += (jn * ny) / mb;
              a.vr -= jn * 0.04; b.vr += jn * 0.04;`
    );
    code = code.replace(/const GRAVITY = 0\.18, BOUNCE = 0\.62, FRICTION = 0\.988;/,
      "const GRAVITY = 0.22, BOUNCE = 0.55, FRICTION = 0.985;");
    code = code.replace(/this\.vr \*= 0\.98;/, "this.vr *= 0.992;");

    (0, eval)(code);
  } catch (e) {
    console.error("hub bootstrap failed", e);
    var root = document.getElementById("gamesRoot");
    if (root) {
      root.innerHTML = "<p style=\"color:#f87171;padding:20px;text-align:center\">Failed to load hub logic: " +
        (e && e.message ? e.message : e) + ". Try hard refresh.</p>";
    }
  }
})();
