#!/bin/bash
# MySpeed-CN Build Script
# Builds Windows executable and Docker image locally
#
# Usage:
#   ./scripts/build.sh windows    # Build Windows x64 executable
#   ./scripts/build.sh linux      # Build Linux x64 executable
#   ./scripts/build.sh docker     # Build Docker image
#   ./scripts/build.sh all        # Build everything

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

build_client() {
    print_step "Installing client dependencies..."
    cd client && bun install && cd ..

    print_step "Building client..."
    cd client && bun run build && cd ..

    print_step "Moving build folder..."
    mv client/build . 2>/dev/null || true
    print_ok "Client built"
}

build_server() {
    print_step "Installing server dependencies..."
    bun install

    print_step "Generating migrations..."
    bun run generate-migrations

    print_step "Generating integrations..."
    bun run generate-integrations

    print_step "Generating client embed..."
    bun run generate-client-embed
    print_ok "Server prepared"
}

build_windows() {
    print_step "Building Windows x64 executable..."
    build_client
    build_server

    bun build --compile \
        --compile-autoload-package-json \
        --external pg-hstore \
        --external pg \
        --target=bun-windows-x64 \
        server/index.js \
        --outfile MySpeed-CN.exe

    print_ok "Windows binary: MySpeed-CN.exe ($(du -h MySpeed-CN.exe | cut -f1))"
}

build_linux() {
    print_step "Building Linux x64 executable..."
    build_client
    build_server

    bun build --compile \
        --compile-autoload-package-json \
        --external pg-hstore \
        --external pg \
        --target=bun-linux-x64 \
        server/index.js \
        --outfile MySpeed-CN

    print_ok "Linux binary: MySpeed-CN ($(du -h MySpeed-CN | cut -f1))"
}

build_docker() {
    print_step "Building Docker image..."

    docker build -t myspeed-cn:latest -t myspeed-cn:dev .

    print_ok "Docker image: myspeed-cn:latest"
    echo ""
    echo "Run with:"
    echo "  docker run -d --name myspeed-cn -p 5216:5216 -v myspeed-data:/myspeed/data myspeed-cn:latest"
}

case "${1:-all}" in
    windows|win)
        build_windows
        ;;
    linux)
        build_linux
        ;;
    docker|dock)
        build_docker
        ;;
    all)
        build_windows
        echo ""
        build_docker
        ;;
    *)
        echo "Usage: $0 {windows|linux|docker|all}"
        exit 1
        ;;
esac

echo ""
print_ok "Build complete!"
