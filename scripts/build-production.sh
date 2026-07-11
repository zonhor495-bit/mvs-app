#!/bin/bash
set -e

echo "=== Production Build for Electron ==="
echo ""

# Step 1: Full build with all dependencies
echo "1️⃣ Installing all dependencies (dev + prod)..."
npm ci > /dev/null 2>&1
echo "   ✓ Done"

# Step 2: Build web and electron
echo "2️⃣ Building web and electron..."
npm run build > /dev/null 2>&1
echo "   ✓ Done"

# Step 3: Build Windows installer
echo "3️⃣ Building Windows installer..."
npm run build:win > /dev/null 2>&1
echo "   ✓ Done"

# Step 4: Prune dev dependencies
echo "4️⃣ Removing dev-only packages from node_modules..."
npm prune --production > /dev/null 2>&1
echo "   ✓ Done"

# Step 5: Rebuild just the packager (app.asar only, no dev in node_modules)
echo "5️⃣ Rebuilding installer with production-only packages..."
npx electron-builder build --win nsis --x64 > /dev/null 2>&1
node ./scripts/finalize-installer.cjs > /dev/null 2>&1
echo "   ✓ Done"

echo ""
echo "✅ Production build complete: build/win/MVSSetup.exe"
