# Barcode & Label Generator - Desktop App

## 🚀 Build Instructions (Windows .exe හදන්නේ මෙහෙමයි)

### Prerequisites (install කරන්න ඕන)
1. **Node.js** - https://nodejs.org (LTS version download කරන්න)
2. **Git** (optional)

---

### Step 1: Dependencies Install කරන්න
```bash
npm install
```

### Step 2: Windows .exe Build කරන්න
```bash
npm run electron:build:win
```

Build වෙලා ඉවර වෙනකොට `release/` folder එකේ මෙව්ව හොයාගන්නන්:
- `release/Barcode & Label Generator Setup 1.0.0.exe` — Installer (install කරලා use කරන්නට)
- `release/Barcode & Label Generator 1.0.0.exe` — Portable exe (directly run කරන්නට)

---

### Other platforms build කරන්නට:
```bash
npm run electron:build:mac    # macOS .dmg
npm run electron:build:linux  # Linux .AppImage
npm run electron:build        # current OS
```

### Development mode (live reload):
```bash
npm run electron:dev
```

---

## 📁 Project Structure
```
├── electron/
│   └── main.js          # Electron main process
├── src/                 # React source files
├── dist/                # Vite build output (auto-generated)
├── release/             # Final exe output (after build)
└── package.json
```
