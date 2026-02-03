# PWA Configuration Guide for MarketLens

## Overview
This document outlines the Progressive Web App (PWA) configuration for MarketLens AI, enabling installation on both iOS and Android devices.

## Implemented Features

### 1. Service Worker (`public/sw.js`)
- **Offline Support**: Caches essential files and provides offline fallback
- **Network First Strategy**: Tries network first, then falls back to cache
- **Auto-update**: Checks for updates every 60 seconds
- **Cache Management**: Clears old caches on activation

### 2. Web App Manifest (`public/manifest.json`)
- App name and short name
- Display mode: `standalone` (full-screen, no browser UI)
- Theme and background colors
- Multiple icon sizes (72x72 to 512x512)
- Maskable icons for adaptive icons (Android)
- App shortcuts for quick actions
- Screenshots for app stores

### 3. HTML Meta Tags (`index.html`)
- **PWA Detection**: `mobile-web-app-capable`, `apple-mobile-web-app-capable`
- **iOS Configuration**:
  - `apple-mobile-web-app-title`: App name on home screen
  - `apple-mobile-web-app-status-bar-style`: Status bar appearance
  - `apple-touch-icon`: Home screen icon
- **Android Configuration**:
  - `theme-color`: Address bar color
  - `android-chrome-icon`: App icon
- **Preconnect**: Optimized resource loading

### 4. Service Worker Registration (`index.html`)
Inline script that:
- Registers service worker on page load
- Checks for updates every minute
- Notifies app of new versions via custom events
- Handles install prompt

### 5. React Component (`components/PWAInstallPrompt.tsx`)
- Shows install prompt when available
- Shows update notification when new version available
- Handles user interactions (Install/Later/Update Now)
- Animated slide-up UI

## Required Setup Steps

### Step 1: Add Icons
Create the following icon files in the `public/icons/` directory:

```
public/icons/
├── favicon.ico (32x32)
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon-180x180.png
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-192x192-maskable.png
├── icon-384x384.png
├── icon-512x512.png
├── icon-512x512-maskable.png
├── shortcut-new-order-192x192.png
└── shortcut-suppliers-192x192.png
```

**Recommended Tool**: Use [PWA Asset Generator](https://github.com/GoogleChromeLabs/pwa-asset-generator)

```bash
npm install -g pwa-asset-generator
pwa-asset-generator logo.svg ./public/icons --splash-only --type png
```

### Step 2: Add Screenshots
Create the following screenshot files in `public/screenshots/`:

```
public/screenshots/
├── screenshot-192x144.png (for narrow form factor)
└── screenshot-540x720.png (for wide form factor)
```

These should be actual app screenshots for:
- Android: 540x720px or 1080x1440px
- iOS: 192x144px or 512x384px

### Step 3: Update App Component
Import and use the PWA install prompt in your main App component:

```tsx
import PWAInstallPrompt from './components/PWAInstallPrompt';

export const App: React.FC = () => {
  return (
    <>
      {/* Your existing app components */}
      <PWAInstallPrompt />
    </>
  );
};
```

### Step 4: Ensure HTTPS
For PWA to work in production:
- Deploy on HTTPS (required)
- Service worker only works on HTTPS (localhost is exempted)
- Configure SSL certificate on your domain

### Step 5: Static File Serving
Ensure your web server serves files from the `public/` directory:

**Vite Configuration** (`vite.config.ts`):
```typescript
export default {
  // ... existing config
  server: {
    headers: {
      'Service-Worker-Allowed': '/'
    }
  },
  // Ensure public files are served
  publicDir: 'public'
};
```

## Installation Instructions for Users

### Android
1. Open app in Chrome browser
2. Tap menu (⋮) → "Install app" or "Add to Home Screen"
3. Tap "Install" to confirm
4. App appears on home screen

### iOS (Safari)
1. Open app in Safari browser
2. Tap Share button (↗️)
3. Scroll down → "Add to Home Screen"
4. Tap "Add" to confirm
5. App appears on home screen

**Note**: iOS Safari doesn't fully support Web App Manifest yet, but uses:
- `apple-touch-icon` for home screen icon
- `apple-mobile-web-app-title` for app name
- `apple-mobile-web-app-status-bar-style` for status bar styling

## Testing the PWA

### Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to Application tab
3. Check Service Worker registration
4. Check Manifest validity
5. Test offline functionality

### PWA Audit
```bash
# Using Lighthouse
npm install -g lighthouse
lighthouse https://your-domain.com --view
```

### Manual Testing
1. **Offline**: Disconnect from internet, app should still work
2. **Install Prompt**: Should show after 2-3 visits
3. **Home Screen**: Icon and title should display correctly
4. **Fullscreen**: App should launch in standalone mode

## Customization

### Change App Name
Edit `manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "Short Name"
}
```

### Change Theme Colors
Edit `manifest.json` and `index.html`:
```json
{
  "theme_color": "#0066CC",
  "background_color": "#FFFFFF"
}
```

### Add More Shortcuts
Edit `manifest.json` shortcuts array:
```json
{
  "shortcuts": [
    {
      "name": "View Orders",
      "url": "/?shortcut=orders",
      "icons": [...]
    }
  ]
}
```

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Worker | ✅ | ✅ | ✅ (iOS 15.4+) | ✅ |
| Web App Manifest | ✅ | ✅ | ⚠️ (Limited) | ✅ |
| Standalone Mode | ✅ | ✅ | ✅ | ✅ |
| Install Prompt | ✅ | ❌ | ⚠️ (iOS only) | ✅ |

## Troubleshooting

### Service Worker not registering
- Check browser console for errors
- Ensure HTTPS is enabled (or localhost)
- Verify `/sw.js` is accessible
- Clear browser cache and try again

### Install prompt not showing
- App must meet PWA criteria (manifest, icons, service worker)
- Must be visited at least twice (browser policy)
- Requires HTTPS (or localhost)
- Check DevTools Application → Manifest for errors

### Icons not displaying
- Verify icon files exist in `public/icons/`
- Check icon paths in `manifest.json`
- Ensure correct image formats and sizes
- Clear browser cache

### Offline not working
- Check Service Worker in DevTools
- Verify cache names in `sw.js`
- Test in offline mode (DevTools → Network → Offline)
- Check browser console for fetch errors

## Performance Optimization

### Cache Strategy
Current: Network first with fallback to cache
- Fast offline experience
- Always gets latest content when online
- Good for API-heavy apps

### Alternative Strategies
**Cache first** (for static assets):
```javascript
// In sw.js fetch handler
const cache = await caches.match(event.request);
if (cache) return cache;
return fetch(event.request);
```

**Stale while revalidate** (balance):
```javascript
// Return cache immediately, update in background
const cache = await caches.match(event.request);
fetch(event.request).then(r => {
  caches.open(CACHE_NAME).then(c => c.put(event.request, r));
});
return cache || fetch(event.request);
```

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Service Worker Scope**: Limited to `/` by manifest
3. **Content Security Policy**: Configure appropriate CSP headers
4. **Cache Expiration**: Implement cache versioning and cleanup
5. **API Security**: Firebase auth tokens should be handled securely

## Additional Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google: PWA Checklist](https://web.dev/pwa-checklist/)
- [Apple: Web App Configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Web Manifest Specification](https://www.w3.org/TR/appmanifest/)
