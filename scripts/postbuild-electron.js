const fs = require('fs');
const path = require('path');
const out = path.resolve(__dirname, '..', 'build', 'electron');
const renames = [
  ['main.js', 'main.cjs'],
  ['preload.js', 'preload.cjs']
];
for (const [src, dest] of renames) {
  const srcPath = path.join(out, src);
  const destPath = path.join(out, dest);
  if (fs.existsSync(srcPath)) {
    try {
      fs.renameSync(srcPath, destPath);
      console.log(`Renamed ${srcPath} -> ${destPath}`);
    } catch (e) {
      console.error(`Failed to rename ${srcPath}:`, e);
      process.exitCode = 1;
    }
  }
}
console.log('postbuild-electron done');
