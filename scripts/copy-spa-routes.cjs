#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
const routes = ['download', 'changelog', 'release-notes'];

function copyTo(route) {
  const dir = path.join(dist, route);
  try {
    if (!fs.existsSync(index)) {
      console.error('dist/index.html not found, skipping copy for', route);
      return;
    }
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'index.html');
    fs.copyFileSync(index, target);
    console.log('Copied index.html ->', path.relative(process.cwd(), target));
  } catch (e) {
    console.error('Error copying for', route, e && e.message);
  }
}

routes.forEach(copyTo);
