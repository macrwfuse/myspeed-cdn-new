#!/bin/bash
# MySpeed-CN Windows x64 Build Script
# Cross-compiles the project to a standalone Windows executable
#
# Usage: ./scripts/build-windows.sh
# Output: dist/MySpeed-CN.exe

set -e

GREEN='\033[0;32m'
BLUE='\033[1;34m'
RED='\033[0;31m'
NC='\033[0m'

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_ok()    { echo -e "${GREEN}✅ $1${NC}"; }
print_err()   { echo -e "${RED}❌ $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Check bun
if ! command -v bun &> /dev/null; then
    print_err "Bun is not installed. Install from https://bun.sh"
    exit 1
fi

print_step "Installing client dependencies..."
cd client && bun install && cd ..

print_step "Building client..."
cd client && bun run build && cd ..

print_step "Moving build folder..."
mkdir -p build
cp -r client/build/* build/ 2>/dev/null || mv client/build . 2>/dev/null || true

print_step "Installing server dependencies..."
bun install

print_step "Generating migrations..."
bun run generate-migrations

print_step "Generating integrations..."
bun run generate-integrations

print_step "Generating client embed..."
bun run generate-client-embed

print_step "Compiling Windows x64 executable..."
mkdir -p dist
bun build --compile \
    --compile-autoload-package-json \
    --external pg-hstore \
    --external pg \
    --target=bun-windows-x64 \
    server/index.js \
    --outfile dist/MySpeed-CN.exe

print_ok "Build complete: dist/MySpeed-CN.exe ($(du -h dist/MySpeed-CN.exe | cut -f1))"
