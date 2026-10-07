import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const [a,b,c] = await Promise.all([
  fetch(new URL('./part0.js', import.meta.url)).then(r=>r.text()),
  fetch(new URL('./part1.js', import.meta.url)).then(r=>r.text()),
  fetch(new URL('./part2.js', import.meta.url)).then(r=>r.text()),
]);
let src = (a+b+c).replace(/^import \* as THREE from 'three';\s*import \{ OrbitControls \} from 'three\/addons\/controls\/OrbitControls\.js';\s*/m, '');
const fn = new Function('THREE', 'OrbitControls', src + '\n//# sourceURL=game-full.js');
fn(THREE, OrbitControls);
