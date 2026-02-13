# DEEPAXIS Desktop App - Icons

Place the following icon files in this folder:

## Required Icons

1. **icon.png** (512x512) - Main app icon for Linux
2. **icon.ico** - Windows icon (256x256 minimum)
3. **icon.icns** - macOS icon
4. **tray-icon.png** (16x16 or 32x32) - System tray icon

## How to Create Icons

### Option 1: Online Converter
1. Create a 512x512 PNG icon
2. Use https://iconverticons.com to convert:
   - PNG → ICO (for Windows)
   - PNG → ICNS (for macOS)

### Option 2: Using electron-icon-builder
```bash
npm install -g electron-icon-builder
electron-icon-builder --input=icon.png --output=./
```

## Temporary Testing
For testing without custom icons, the app will use Electron's default icon.
