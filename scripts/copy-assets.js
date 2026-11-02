import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const itemsToCopy = [
  'games',
  'game-art',
  'pics',
  'music',
  'sounds',
  'images',
  'game-hub-icon.svg',
  'manifest.webmanifest',
  '.nojekyll'
];

for (const item of itemsToCopy) {
  const src = path.resolve(process.cwd(), item);
  const dest = path.resolve(distDir, item);

  if (fs.existsSync(src)) {
    try {
      fs.cpSync(src, dest, { recursive: true, force: true });
      console.log(`[copy-assets] Copied ${item} -> dist/${item}`);
    } catch (err) {
      console.error(`[copy-assets] Error copying ${item}:`, err);
    }
  } else {
    console.warn(`[copy-assets] Skipped missing item: ${item}`);
  }
}

console.log('[copy-assets] Completed copying static game assets to dist.');
