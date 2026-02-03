# PWA Quick Start Guide

## What's Been Added

Your MarketLens app now has full Progressive Web App (PWA) support for iOS and Android!

### Files Created:
- ✅ `public/manifest.json` - Web App Manifest
- ✅ `public/sw.js` - Service Worker
- ✅ `components/PWAInstallPrompt.tsx` - Install UI Component
- ✅ `services/pwaService.ts` - PWA utilities
- ✅ `PWA_SETUP_GUIDE.md` - Complete documentation
- ✅ `scripts/generate-icons.js` - Icon generator

### Files Modified:
- ✅ `index.html` - Added PWA meta tags and service worker registration

---

## Getting Started (5 Steps)

### 1. Generate Placeholder Icons
```bash
npm run generate-icons
```
This creates placeholder icons. Replace them with your actual logo later.

### 2. Integrate PWA Install Prompt into Your App
Edit `App.tsx` and add the PWA prompt component:

```tsx
import PWAInstallPrompt from './components/PWAInstallPrompt';

export const App: React.FC = () => {
  return (
    <>
      {/* Your existing components */}
      <Navigation />
      <MainContent />
      
      {/* Add this at the bottom */}
      <PWAInstallPrompt />
    </>
  );
};
```

### 3. Test Locally
```bash
npm run dev
```
Visit `http://localhost:5173` in your browser. You should see:
- Service Worker registered (check DevTools → Application)
- Install prompt after a few visits

### 4. Build for Production
```bash
npm run build
```

### 5. Deploy on HTTPS
PWA requires HTTPS in production. Deploy to:
- Netlify, Vercel, GitHub Pages, or your own HTTPS server
- Service Worker will only work over HTTPS

---

## Testing the PWA

### Test on Chrome/Edge:
1. Open DevTools (F12)
2. Go to **Application** tab
3. Check:
   - ✅ Manifest loads properly
   - ✅ Service Worker is registered
   - ✅ Offline support works
   - ✅ All icons are present

### Test Install Prompt:
1. Visit your deployed site in Chrome/Edge
2. Visit at least 2-3 times over a few days
3. You should see an "Install" button
4. Click to install on home screen

### Test Offline:
1. DevTools → Network tab
2. Check "Offline" checkbox
3. Refresh page - app should still work!

### Test on Android:
1. Open in Chrome on Android
2. Tap menu (⋮) → "Install app"
3. Tap "Install"
4. App appears on home screen

### Test on iOS:
1. Open in Safari on iOS
2. Tap Share (↗️)
3. Select "Add to Home Screen"
4. App appears on home screen

---

## Icon Customization

### Replace Icons with Your Logo

1. **Create your logo** (PNG or SVG, 512x512px minimum)
2. **Place in project root** as `logo.png` or `logo.svg`
3. **Regenerate icons:**
   ```bash
   npm run generate-icons
   ```

### Icon Sizes Generated:
- Favicon: 16x16, 32x32
- Home screen: 72x72 → 512x512
- Apple touch icon: 180x180
- Maskable icons: 192x192, 512x512 (Android adaptive)

### Using PWA Asset Generator (Professional):
```bash
npm install -g pwa-asset-generator

pwa-asset-generator logo.png ./public/icons \
  --splash-only \
  --type png \
  --background "white" \
  --padding "25%"
```

---

## What Users See

### On Android:
1. Browse app in Chrome
2. See "Install app" option
3. App installs like native app
4. Opens fullscreen without browser chrome
5. Shows up in app launcher

### On iOS:
1. Browse app in Safari
2. Tap Share → Add to Home Screen
3. App installs as web clip
4. Opens in fullscreen Safari mode
5. Looks like native app

### Install Prompt:
- Shows after 2-3 visits
- Users can choose "Install" or "Not Now"
- Won't show again if dismissed

### Update Notification:
- Shows when new version available
- User can update immediately
- Or update later

---

## PWA Features Enabled

| Feature | Status |
|---------|--------|
| Offline Support | ✅ Works |
| Install Prompt | ✅ Ready |
| Home Screen Icon | ✅ Ready |
| Fullscreen Standalone | ✅ Ready |
| App Updates | ✅ Auto-checks |
| Service Worker | ✅ Registered |
| Manifest | ✅ Configured |
| iOS Support | ✅ Ready |
| Android Support | ✅ Ready |

---

## Deployment Checklist

- [ ] Generate or create app icons
- [ ] Update `manifest.json` with your app details
- [ ] Integrate `PWAInstallPrompt` into App.tsx
- [ ] Test locally with `npm run dev`
- [ ] Build with `npm run build`
- [ ] Deploy on HTTPS server
- [ ] Verify Service Worker registers
- [ ] Test install on Chrome
- [ ] Test on actual iPhone (Safari)
- [ ] Test on actual Android (Chrome)

---

## Troubleshooting

### "Install button not showing"
- App needs to be visited 2-3 times first
- Clear browser cache
- Try incognito mode
- Check manifest is valid (DevTools → Application)

### "Service Worker not registering"
- Check if HTTPS is enabled (or localhost)
- Look for errors in DevTools Console
- Verify `/sw.js` file exists
- Check manifest.json is valid

### "Icons not showing"
- Run `npm run generate-icons` again
- Verify files in `public/icons/` exist
- Check `manifest.json` icon paths
- Clear browser cache

### "Offline not working"
- Check Service Worker is active (DevTools)
- Test with Network → Offline in DevTools
- Look for fetch errors in console
- Service Worker should have "activated" status

---

## Next Steps

1. **Customize your branding**: Update icons and app name
2. **Test thoroughly**: Use DevTools and real devices
3. **Monitor performance**: Check Lighthouse score
4. **Gather feedback**: See how users respond
5. **Add features**: Notifications, background sync, etc.

---

## Documentation

For complete details, see:
- [`PWA_SETUP_GUIDE.md`](./PWA_SETUP_GUIDE.md) - Comprehensive guide
- [Google PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN PWA Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

---

## Support

Need help? Check:
- DevTools Console for errors
- PWA_SETUP_GUIDE.md for detailed info
- Lighthouse report for PWA score
- Service Worker logs in DevTools

Happy deploying! 🚀
