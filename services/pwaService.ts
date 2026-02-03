/**
 * PWA Service Worker Registration
 * Handles service worker registration and update notifications
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('Service Worker registered successfully:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, notify user
              console.log('New app version available');
              
              // Dispatch custom event for app to handle
              window.dispatchEvent(new CustomEvent('serviceWorkerUpdate', {
                detail: { registration }
              }));
            }
          });
        });
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

/**
 * Install PWA prompt handler
 */
export let deferredPrompt = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Dispatch event to show install button in UI
    window.dispatchEvent(new CustomEvent('pwaInstallReady', {
      detail: { deferredPrompt }
    }));
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
    
    // Track installation
    window.dispatchEvent(new CustomEvent('pwaInstalled'));
  });
}

/**
 * Trigger PWA install prompt
 */
export async function triggerInstallPrompt() {
  if (!deferredPrompt) {
    return false;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  console.log(`User response to the install prompt: ${outcome}`);
  
  deferredPrompt = null;
  return outcome === 'accepted';
}

/**
 * Check if app is running as PWA (standalone mode)
 */
export function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

/**
 * Get PWA display mode
 */
export function getPWADisplayMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) {
    return 'standalone';
  }
  
  if (window.navigator.standalone === true) {
    return 'standalone-ios';
  }
  
  return 'browser';
}
