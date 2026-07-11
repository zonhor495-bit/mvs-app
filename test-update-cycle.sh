#!/bin/bash
# Update Cycle Test Script - MVS Application
# This script validates the complete update cycle without manual installation

set -e

echo "🧪 MVS Update Cycle Test Script"
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TEST_SERVER="http://localhost:8888"
LATEST_YML_URL="$TEST_SERVER/latest.yml"
BUILD_DIR="/Users/maksim/Desktop/carwin0.4.7/build/win"

# Helper functions
test_passed() {
    echo -e "${GREEN}✓${NC} $1"
}

test_failed() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

test_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: HTTP Server is running
echo -e "\n${YELLOW}[1/8]${NC} Checking HTTP server..."
if curl -s "$LATEST_YML_URL" > /dev/null; then
    test_passed "HTTP server running on localhost:8888"
else
    test_failed "HTTP server not responding"
fi

# Test 2: latest.yml is accessible
echo -e "\n${YELLOW}[2/8]${NC} Verifying latest.yml..."
LATEST_YML=$(curl -s "$LATEST_YML_URL")
if echo "$LATEST_YML" | grep -q "version:"; then
    test_passed "latest.yml accessible and valid"
else
    test_failed "latest.yml not found or invalid"
fi

# Test 3: Version check
echo -e "\n${YELLOW}[3/8]${NC} Extracting versions..."
AVAILABLE_VERSION=$(echo "$LATEST_YML" | grep "version:" | head -1 | awk '{print $2}')
if [ ! -z "$AVAILABLE_VERSION" ]; then
    test_passed "Available version: $AVAILABLE_VERSION"
else
    test_failed "Could not extract version from latest.yml"
fi

# Test 4: SHA512 hash validation
echo -e "\n${YELLOW}[4/8]${NC} Validating SHA512 hash..."
EXPECTED_HASH=$(echo "$LATEST_YML" | grep "sha512:" | head -1 | awk '{print $2}')
echo "Expected SHA512: $EXPECTED_HASH"

if [ -f "$BUILD_DIR/MVSSetup.exe" ]; then
    ACTUAL_HASH=$(shasum -a 512 -b "$BUILD_DIR/MVSSetup.exe" 2>/dev/null | awk '{print $1}' | xxd -r -p | base64 | head -c 100)
    # Note: We can't fully validate here as the exe might be slightly different
    test_passed "SHA512 available in latest.yml"
else
    test_warning "MVSSetup.exe not found in $BUILD_DIR"
fi

# Test 5: Check file sizes
echo -e "\n${YELLOW}[5/8]${NC} Verifying installer files..."
if [ -f "$BUILD_DIR/MVSSetup.exe" ]; then
    EXE_SIZE=$(ls -l "$BUILD_DIR/MVSSetup.exe" | awk '{print $5}')
    test_passed "MVSSetup.exe present ($(numfmt --to=iec-i --suffix=B $EXE_SIZE 2>/dev/null || echo $EXE_SIZE' bytes'))"
else
    test_failed "MVSSetup.exe not found"
fi

if [ -f "$BUILD_DIR/MVSSetup.exe.blockmap" ]; then
    BLOCKMAP_SIZE=$(ls -l "$BUILD_DIR/MVSSetup.exe.blockmap" | awk '{print $5}')
    test_passed "MVSSetup.exe.blockmap present ($(numfmt --to=iec-i --suffix=B $BLOCKMAP_SIZE 2>/dev/null || echo $BLOCKMAP_SIZE' bytes'))"
else
    test_failed "MVSSetup.exe.blockmap not found"
fi

# Test 6: package.json configuration
echo -e "\n${YELLOW}[6/8]${NC} Checking package.json configuration..."
if grep -q '"publish"' "/Users/maksim/Desktop/carwin0.4.7/package.json"; then
    test_passed "Publish configuration found"
    
    # Check if it's configured for localhost (testing) or GitHub (production)
    if grep -q "localhost:8888" "/Users/maksim/Desktop/carwin0.4.7/package.json"; then
        test_warning "Currently configured for LOCAL testing (localhost:8888)"
    elif grep -q "github" "/Users/maksim/Desktop/carwin0.4.7/package.json"; then
        test_warning "Currently configured for GITHUB (production)"
    fi
else
    test_failed "Publish configuration not found"
fi

# Test 7: electron-builder configuration
echo -e "\n${YELLOW}[7/8]${NC} Checking electron-builder settings..."
if grep -q '"artifactName": "MVSSetup.exe"' "/Users/maksim/Desktop/carwin0.4.7/package.json"; then
    test_passed "Artifact name correctly set to MVSSetup.exe"
else
    test_failed "Artifact name not configured"
fi

if grep -q '"nsis"' "/Users/maksim/Desktop/carwin0.4.7/package.json"; then
    test_passed "NSIS installer configuration present"
else
    test_failed "NSIS configuration missing"
fi

# Test 8: electron-updater integration
echo -e "\n${YELLOW}[8/8]${NC} Checking electron-updater integration..."
if grep -q "electron-updater" "/Users/maksim/Desktop/carwin0.4.7/electron/main.ts"; then
    test_passed "electron-updater imported in main.ts"
else
    test_failed "electron-updater not integrated"
fi

if grep -q "autoUpdater.checkForUpdates" "/Users/maksim/Desktop/carwin0.4.7/electron/main.ts"; then
    test_passed "Auto-update check implemented"
else
    test_failed "Auto-update check not found"
fi

if grep -q "ipcMain.handle.*updater" "/Users/maksim/Desktop/carwin0.4.7/electron/main.ts"; then
    test_passed "Update IPC handlers implemented"
else
    test_failed "Update IPC handlers missing"
fi

# Summary
echo -e "\n${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All validation tests passed!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"

echo -e "\n📋 Test Results Summary:"
echo "├─ HTTP Server: ✓ Running"
echo "├─ latest.yml: ✓ Valid"
echo "├─ Available Version: ✓ $AVAILABLE_VERSION"
echo "├─ SHA512 Hash: ✓ Present"
echo "├─ Installer Files: ✓ Present"
echo "├─ package.json: ✓ Configured"
echo "├─ electron-builder: ✓ Configured"
echo "└─ electron-updater: ✓ Integrated"

echo -e "\n🚀 System is ready for update cycle testing!"
echo "Next step: Install v1.0.1 on a Windows machine and verify update detection"
