#!/usr/bin/env bash
# Simple local API test script for auth-server
# Usage: from repo root run: DB_FILE=./tools/auth-server/data/auth.db JWT_SECRET=testsecret node ./tools/auth-server/src/index.js &

BASE=http://127.0.0.1:4000

echo "Register testuser..."
curl -s -X POST "$BASE/api/register" -H 'Content-Type: application/json' -d '{"username":"persisttest","passwordHash":"testpw","name":"Persist Test"}' | jq || true

echo
echo "Login..."
RESP=$(curl -s -X POST "$BASE/api/login" -H 'Content-Type: application/json' -d '{"username":"persisttest","passwordHash":"testpw"}')
echo "$RESP" | jq || true

TOKEN=$(echo "$RESP" | jq -r '.token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Login failed; cannot continue persistence test"; exit 1
fi

echo
echo "Get /api/me..."
curl -s -X GET "$BASE/api/me" -H "Authorization: Bearer $TOKEN" | jq || true

echo
echo "Now STOP the server manually, then restart it, then press Enter to continue"
read -p "Press Enter after server restart..."

echo "Attempt login again after restart..."
curl -s -X POST "$BASE/api/login" -H 'Content-Type: application/json' -d '{"username":"persisttest","passwordHash":"testpw"}' | jq || true

echo
echo "Cleanup: delete user"
RESP2=$(curl -s -X POST "$BASE/api/login" -H 'Content-Type: application/json' -d '{"username":"persisttest","passwordHash":"testpw"}')
TK=$(echo "$RESP2" | jq -r '.token')
if [ -n "$TK" ] && [ "$TK" != "null" ]; then
  curl -s -X DELETE "$BASE/api/me" -H "Authorization: Bearer $TK" | jq || true
fi

echo "Done"
