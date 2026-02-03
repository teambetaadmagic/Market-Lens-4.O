# PWA Architecture Diagram

## High-Level PWA Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Device                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Browser (Chrome/Safari/Edge/Firefox)                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  index.html                                    │  │   │
│  │  │  - PWA meta tags                               │  │   │
│  │  │  - manifest.json link                          │  │   │
│  │  │  - Service Worker registration                 │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      ↓                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  React App (App.tsx + Components)              │  │   │
│  │  │  - Main content                                │  │   │
│  │  │ + PWAInstallPrompt (NEW!)                       │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      ↓                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Service Worker (sw.js)                        │  │   │
│  │  │  - Offline support                             │  │   │
│  │  │  - Caching strategy                            │  │   │
│  │  │  - Update detection                            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      ↓                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Cache Storage                                 │  │   │
│  │  │  - HTML/CSS/JS                                 │  │   │
│  │  │  - Static assets                               │  │   │
│  │  │  - App data                                    │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Home Screen (Install Target)                        │   │
│  │  - App Icon                                          │   │
│  │  - App Name                                          │   │
│  │  - Opens in standalone mode                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│                   Your Web Server                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  public/                                             │   │
│  │  ├── index.html (PWA meta tags)                      │   │
│  │  ├── manifest.json (App config)                      │   │
│  │  ├── sw.js (Service Worker)                          │   │
│  │  └── icons/                                          │   │
│  │      ├── favicon-*.png                               │   │
│  │      ├── icon-*.png                                  │   │
│  │      ├── apple-touch-icon.png                        │   │
│  │      └── *-maskable.png                              │   │
│  ├── dist/ (Built app)                                 │   │
│  │  └── [bundled React app]                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                      HTTPS REQUIRED                          │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure Overview

```
market-lens/
│
├── index.html ◄──────────────────┐
│   ├─ PWA meta tags              │ Entry Point
│   ├─ manifest.json link         │
│   └─ sw.js registration         │
│                                 │
├── public/                        │
│   ├── manifest.json ◄───────────┼──────┐
│   │   ├─ App metadata           │      │ PWA Config
│   │   ├─ Display mode           │      │
│   │   ├─ Icons list             │      │
│   │   └─ Shortcuts              │      │
│   │                             │      │
│   ├── sw.js ◄──────────────────┼──────┤ Service Worker
│   │   ├─ Caching logic          │      │
│   │   ├─ Offline support        │      │
│   │   └─ Update detection       │      │
│   │                             │      │
│   └── icons/ ◄──────────────────┼──────┘
│       ├── favicon.ico
│       ├── favicon-16x16.png
│       ├── icon-192x192.png
│       ├── icon-512x512.png
│       ├── icon-192x192-maskable.png
│       └── apple-touch-icon-180x180.png
│
├── components/
│   └── PWAInstallPrompt.tsx ◄────┐ UI
│       ├─ Install prompt         │ Components
│       └─ Update notification    │
│
├── services/
│   └── pwaService.ts ◄───────────┐
│       ├─ SW registration        │ Utilities
│       ├─ Install handling       │
│       └─ Mode detection         │
│
├── App.tsx
│   └─ + <PWAInstallPrompt /> (TODO: Add this)
│
├── scripts/
│   └── generate-icons.js ◄──────┐ Build
│       └─ Icon generation       │ Scripts
│
└── Documentation/
    ├── START_HERE_PWA.md
    ├── PWA_QUICK_START.md
    ├── PWA_SETUP_GUIDE.md
    └── PWA_IMPLEMENTATION_SUMMARY.md
```

---

## Installation Flow

### Web Browser

```
User visits app
        ↓
Manifest & SW loaded
        ↓
App caches static files
        ↓
User visits 2-3 times
        ↓
Browser shows install prompt
        ↓
User clicks "Install"
        ↓
App installed on home screen
        ↓
Fullscreen standalone mode
```

### iOS (Safari)

```
User opens in Safari
        ↓
User taps Share (↗️)
        ↓
User selects "Add to Home Screen"
        ↓
Prompted for app name
        ↓
App added using apple-touch-icon
        ↓
Fullscreen Safari mode
        ↓
Custom status bar styling applied
```

### Android (Chrome)

```
User opens in Chrome
        ↓
Chrome detects PWA (manifest + SW)
        ↓
User taps menu (⋮)
        ↓
User selects "Install app"
        ↓
App installs
        ↓
Fullscreen standalone mode
        ↓
Adaptive icon applied (maskable)
```

---

## Service Worker Lifecycle

```
┌─────────────────────────────────────────────────┐
│           Browser Loads App                      │
└────────────────────┬────────────────────────────┘
                     ↓
        ┌─────────────────────────┐
        │ SW Registration Script  │
        │ navigator.serviceWorker │
        │ .register('/sw.js')     │
        └────────────┬────────────┘
                     ↓
     ┌───────────────────────────────┐
     │  Install Event                │
     │  - Cache essential files      │
     │  - skipWaiting() called       │
     └───────────────┬───────────────┘
                     ↓
     ┌───────────────────────────────┐
     │  Activate Event               │
     │  - Clean old caches           │
     │  - clients.claim()            │
     │  - NOW CONTROLLING PAGE       │
     └───────────────┬───────────────┘
                     ↓
     ┌───────────────────────────────┐
     │  Fetch Events                 │
     │  - Intercept all requests     │
     │  - Network first strategy     │
     │  - Cache fallback             │
     └───────────────┬───────────────┘
                     ↓
     ┌───────────────────────────────┐
     │  Message Events               │
     │  - Handle app messages        │
     │  - Skip waiting on update      │
     └───────────────────────────────┘

   Every 60 seconds:
   Check for new service worker
```

---

## Request Handling Flow

```
Browser makes request
        ↓
Service Worker intercepts (fetch event)
        ↓
┌──────────────────────┐
│ Is it a GET request? │
└───────┬──────────────┘
        │ YES          │ NO
        ↓              ↓
    Continue        Skip SW
        ↓            caching
        ↓
┌──────────────────────────────┐
│ Is it firebase/API request?  │
└───────┬──────────────────────┘
        │ YES          │ NO
        ↓              ↓
  Skip cache        ↓
                    ↓
        ┌──────────────────┐
        │ Try NETWORK      │
        │ fetch()          │
        └────┬──────┬──────┘
             │      │
          ✅OK   ❌Error
             │      │
             ↓      ↓
          Cache   Try CACHE
             ↓      ↓
          Return   ✅Found
             ↓      ↓
           Done   Return
                    ↓
                 ❌No Cache
                    ↓
                Return 503
                Offline
```

---

## PWA Features Timeline

```
Visit 1 → App loads, SW installs, caches files
          ↓
Visit 2 → App loads faster (from cache)
          ↓
Visit 3 → Install button shown (browser policy)
          ↓
USER INSTALLS
          ↓
App on home screen
Launches fullscreen
Works offline
          ↓
Update check (every 60 sec)
New version available
          ↓
Update notification shown
User clicks "Update Now"
          ↓
New version installed
App refreshes
User enjoys new features!
```

---

## Browser Support by Feature

```
Feature                  Chrome  Firefox  Safari  Edge
─────────────────────────────────────────────────────
Web App Manifest         ✅      ✅       ⚠️      ✅
Service Worker           ✅      ✅       ✅      ✅
Install Prompt           ✅      ❌       ⚠️      ✅
Standalone Mode          ✅      ✅       ✅      ✅
Offline Support          ✅      ✅       ✅      ✅
Apple Touch Icon         ✅      ✅       ✅      ✅
Theme Color              ✅      ✅       ❌      ✅
Maskable Icons           ✅      ❌       ❌      ✅
─────────────────────────────────────────────────────

Legend: ✅ Full Support | ⚠️ Partial | ❌ No Support
```

---

## Component Relationships

```
┌──────────────────────────────┐
│         App.tsx              │
│  Main React Component        │
└──────────────┬───────────────┘
               │ imports
               ↓
┌──────────────────────────────────────────┐
│    PWAInstallPrompt.tsx                  │
│  - Shows install UI                      │
│  - Shows update UI                       │
│  - Listens to beforeinstallprompt        │
│  - Handles install logic                 │
└──────────────┬───────────────────────────┘
               │ uses
               ↓
┌──────────────────────────────────────────┐
│    pwaService.ts (optional)              │
│  - registerServiceWorker()               │
│  - setupInstallPrompt()                  │
│  - triggerInstallPrompt()                │
│  - isRunningAsPWA()                      │
│  - getPWADisplayMode()                   │
└──────────────────────────────────────────┘
               │ loads
               ↓
┌──────────────────────────────────────────┐
│    index.html                            │
│  - PWA meta tags                         │
│  - Inline SW registration                │
│  - Links manifest.json                   │
│  - Loads SW.js                           │
└──────────────┬───────────────────────────┘
               │ controls
               ↓
┌──────────────────────────────────────────┐
│    public/sw.js                          │
│  - Intercepts fetch requests             │
│  - Manages cache                         │
│  - Handles offline                       │
│  - Checks for updates                    │
└──────────────┬───────────────────────────┘
               │ references
               ↓
┌──────────────────────────────────────────┐
│    public/manifest.json                  │
│  - App metadata                          │
│  - Icon paths                            │
│  - Shortcuts                             │
│  - Display mode                          │
└──────────────┬───────────────────────────┘
               │ uses
               ↓
┌──────────────────────────────────────────┐
│    public/icons/                         │
│  - favicon.ico                           │
│  - icon-*.png                            │
│  - apple-touch-icon.png                  │
│  - *-maskable.png                        │
└──────────────────────────────────────────┘
```

---

## Integration Steps Flowchart

```
┌─────────────────────────────┐
│ 1. Generate Icons           │
│ npm run generate-icons      │
└──────────────┬──────────────┘
               ↓
        ✅ Icons created
               ↓
┌─────────────────────────────┐
│ 2. Update App.tsx           │
│ Add <PWAInstallPrompt />    │
└──────────────┬──────────────┘
               ↓
        ✅ Component integrated
               ↓
┌─────────────────────────────┐
│ 3. Test Locally             │
│ npm run dev                 │
└──────────────┬──────────────┘
               ↓
        ✅ App running
               ↓
┌─────────────────────────────┐
│ 4. Build                    │
│ npm run build               │
└──────────────┬──────────────┘
               ↓
        ✅ Production ready
               ↓
┌─────────────────────────────┐
│ 5. Deploy on HTTPS          │
│ Deploy to server            │
└──────────────┬──────────────┘
               ↓
        ✅ Live on web
               ↓
┌─────────────────────────────┐
│ 6. Test on Devices          │
│ Android + iOS               │
└──────────────┬──────────────┘
               ↓
        ✅ Ready for users!
```

---

## Cache Storage Details

```
IndexedDB / Cache Storage
│
├── CacheName: "marketlens-v1"
│   ├── index.html
│   ├── index.css
│   ├── manifest.json
│   ├── Firebase scripts
│   ├── React bundle
│   ├── Tailwind CSS
│   └── [Dynamically cached responses]
│
└── Expires: Never (manually versioned)
    Note: Bump version in sw.js to clear
```

---

## Performance Metrics

```
First Load (Offline)
├─ From cache: ~100-200ms
└─ Network unavailable: ~200-300ms

Subsequent Loads (Online)
├─ From cache (instant): ~50-100ms
├─ Check network: ~50-100ms
└─ Update cache: Happens in background

App Install Time
├─ Android: ~5 seconds
├─ iOS: ~10 seconds
└─ Web: Instant (no download needed)

Update Detection
├─ Check interval: 60 seconds
├─ Detection time: ~1-2 seconds
└─ User notification: <100ms
```

---

This PWA architecture provides:
✅ Offline functionality
✅ App-like experience
✅ Quick installation
✅ Automatic updates
✅ Cross-platform support
