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

const templateSrc = path.resolve(__dirname, '..', 'electron', 'template.xlsx');
const templateDest = path.join(out, 'template.xlsx');
if (fs.existsSync(templateSrc)) {
  try {
    fs.copyFileSync(templateSrc, templateDest);
    console.log(`Copied template: ${templateSrc} -> ${templateDest}`);
  } catch (e) {
    console.error(`Failed to copy template.xlsx:`, e);
    process.exitCode = 1;
  }
} else {
  console.warn(`Template missing, expected at ${templateSrc}`);
}

console.log('postbuild-electron done');
