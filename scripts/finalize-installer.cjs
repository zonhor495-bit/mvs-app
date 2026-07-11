const fs = require('fs');
const path = require('path');
const buildOutput = path.resolve(__dirname, '..', 'build', 'win');
const finalDir = path.resolve(__dirname, '..', 'WD125');
const sourceName = 'MVSSetup.exe';
const targetName = 'Setup.exe';

if (!fs.existsSync(buildOutput)) {
  console.error(`Build output directory not found: ${buildOutput}`);
  process.exit(1);
}

const sourcePath = path.join(buildOutput, sourceName);
if (!fs.existsSync(sourcePath)) {
  console.error(`Installer artifact not found: ${sourcePath}`);
  process.exit(1);
}

if (fs.existsSync(finalDir)) {
  fs.rmSync(finalDir, { recursive: true, force: true });
}
fs.mkdirSync(finalDir, { recursive: true });
fs.copyFileSync(sourcePath, path.join(finalDir, targetName));
console.log(`Created ${path.join(finalDir, targetName)}`);
