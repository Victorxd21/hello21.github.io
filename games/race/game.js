import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

async function loadGame() {
  const n = 13;
  const urls = Array.from({length: n}, (_, i) => new URL('./c' + i + '.txt', import.meta.url));
  const parts = await Promise.all(urls.map(u => fetch(u).then(r => r.text())));
  const b64 = parts.join('').replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const src = await new Response(stream).text();
  const cleaned = src.replace(/^import \* as THREE from 'three';\s*import \{ OrbitControls \} from 'three\/addons\/controls\/OrbitControls\.js';\s*/, '');
  const fn = new Function('THREE', 'OrbitControls', cleaned + '\n//# sourceURL=game-full.js');
  fn(THREE, OrbitControls);
}
loadGame().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:red;position:fixed;top:0;left:0;background:#000;z-index:9999">'+e+'</pre>'); });
