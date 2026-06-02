#!/bin/bash
set -u

# SoundCloud Random Music — macOS launcher
# Double-click this file in Finder, or run: ./start.command

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
MAIN_DIR="$APP_DIR/main"
DATA_DIR="$MAIN_DIR/data"

export SRM_DATA_DIR="$DATA_DIR"
export SRM_PORTABLE_DATA_DIR="$DATA_DIR"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

mkdir -p "$DATA_DIR"
cd "$MAIN_DIR" || exit 1

clear
printf 'SoundCloud Random Music\n'
printf '=======================\n'
printf 'macOS Terminal mode\n'
printf 'Portable data: %s\n\n' "$DATA_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install it with Homebrew: brew install node"
  echo "Or download it from: https://nodejs.org/"
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed. Reinstall Node.js."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

if ! command -v mpv >/dev/null 2>&1; then
  echo "Warning: mpv is not installed. Music playback will not work until you install it."
  echo "Install: brew install mpv"
  echo
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "Warning: yt-dlp is not installed. Some fallback methods will not work."
  echo "Install: brew install yt-dlp"
  echo
fi

if [ ! -d "node_modules" ]; then
  echo "First launch: installing npm dependencies..."
  npm install --registry=https://registry.npmjs.org/ --no-audit --fund=false
  if [ $? -ne 0 ]; then
    echo
    echo "npm install failed."
    echo "Check your internet connection or npm registry settings."
    echo
    read -r -p "Press Enter to close..."
    exit 1
  fi
fi

echo "Version:"
node ./src/index.mjs --version

echo
echo "Starting..."
echo

node ./src/index.mjs
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo
  echo "SRM exited with an error."
  echo "Exit code: $STATUS"
  echo
  read -r -p "Press Enter to close..."
fi
exit $STATUS
