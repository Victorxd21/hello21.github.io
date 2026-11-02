import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const docsDir = path.resolve(rootDir, 'docs');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Ensure .nojekyll exists in root and dist
fs.writeFileSync(path.resolve(rootDir, '.nojekyll'), '');
fs.writeFileSync(path.resolve(distDir, '.nojekyll'), '');

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
  const src = path.resolve(rootDir, item);
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

// 1. Copy built assets from dist/assets to root /assets (for GitHub Pages root branch deployment)
const distAssets = path.resolve(distDir, 'assets');
const rootAssets = path.resolve(rootDir, 'assets');
if (fs.existsSync(distAssets)) {
  if (!fs.existsSync(rootAssets)) {
    fs.mkdirSync(rootAssets, { recursive: true });
  }
  fs.cpSync(distAssets, rootAssets, { recursive: true, force: true });
  console.log('[copy-assets] Copied dist/assets -> /assets (root)');
}

// 2. Post-process dist/index.html to remove any fallback timer script so it is pristine production code
const distIndexPath = path.resolve(distDir, 'index.html');
if (fs.existsSync(distIndexPath)) {
  let distHtml = fs.readFileSync(distIndexPath, 'utf8');

  // Ensure trailing slash normalization is in head if not already present
  if (!distHtml.includes('window.location.replace(p + \'/\'')) {
    const trailingSlashFix = `
    <!-- GitHub Pages subpath trailing slash normalization -->
    <script>
      (function() {
        var p = window.location.pathname;
        if (p && !p.endsWith('/') && !p.split('/').pop().includes('.')) {
          window.location.replace(p + '/' + window.location.search + window.location.hash);
        }
      })();
    </script>
  </head>`;
    distHtml = distHtml.replace('</head>', trailingSlashFix);
  }

  // Remove any fallback scripts from dist/index.html to keep production build pure
  distHtml = distHtml.replace(/<!-- Static Production Fallback[\s\S]*?<\/script>/gi, '');
  distHtml = distHtml.replace(/<!-- Production fallback[\s\S]*?<\/script>/gi, '');

  fs.writeFileSync(distIndexPath, distHtml, 'utf8');
  console.log('[copy-assets] Cleaned dist/index.html for production.');

  // Create 404.html for GitHub Pages SPA routing fallback
  fs.writeFileSync(path.resolve(distDir, '404.html'), distHtml, 'utf8');
  fs.writeFileSync(path.resolve(rootDir, '404.html'), distHtml, 'utf8');
  console.log('[copy-assets] Generated 404.html for SPA fallback.');
}

// 3. Mirror to /docs for repositories using GitHub Pages "Deploy from branch -> /docs"
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
if (fs.existsSync(distIndexPath)) {
  fs.cpSync(distIndexPath, path.resolve(docsDir, 'index.html'), { force: true });
  fs.cpSync(distIndexPath, path.resolve(docsDir, '404.html'), { force: true });
}
if (fs.existsSync(distAssets)) {
  fs.cpSync(distAssets, path.resolve(docsDir, 'assets'), { recursive: true, force: true });
}
fs.writeFileSync(path.resolve(docsDir, '.nojekyll'), '');
console.log('[copy-assets] Prepared /docs folder for docs-based GitHub Pages deployment.');

console.log('[copy-assets] Asset sync complete.');
