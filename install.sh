#!/bin/bash
# ASCIImp4 — Install CEP extension (Mac)
# Creates a symlink in the AE extensions folder and disables CEP signature check.

PLUGIN_DIR="$( cd "$( dirname "$0" )" && pwd )"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.asciimp4.panel"

echo "ASCIImp4 Installer"
echo "━━━━━━━━━━━━━━━━━━"

# Remove old install
if [ -L "$DEST" ] || [ -d "$DEST" ]; then
  rm -rf "$DEST"
  echo "Removed existing install."
fi

# Create symlink
ln -s "$PLUGIN_DIR" "$DEST"
echo "Symlinked: $PLUGIN_DIR → $DEST"

# Disable CEP signature verification (required for unsigned extensions)
echo "Disabling CEP signature check..."
defaults write /Library/Preferences/com.adobe.CSXS.11 PlayerDebugMode 1 2>/dev/null
defaults write /Library/Preferences/com.adobe.CSXS.10 PlayerDebugMode 1 2>/dev/null
defaults write /Library/Preferences/com.adobe.CSXS.9  PlayerDebugMode 1 2>/dev/null
defaults write ~/Library/Preferences/com.adobe.CSXS.11 PlayerDebugMode 1 2>/dev/null
defaults write ~/Library/Preferences/com.adobe.CSXS.10 PlayerDebugMode 1 2>/dev/null
defaults write ~/Library/Preferences/com.adobe.CSXS.9  PlayerDebugMode 1 2>/dev/null

echo ""
echo "Done! Restart After Effects, then go to:"
echo "  Window → Extensions → ASCIImp4"
