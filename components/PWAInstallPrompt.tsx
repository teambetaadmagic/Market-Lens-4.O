import React, { useState, useEffect } from 'react';
import { Download, X, AlertCircle, Check } from 'lucide-react';

interface PWAPromptProps {
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAPromptProps> = ({ onDismiss }) => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Listen for install ready event
    const handleInstallReady = () => {
      setShowInstallPrompt(true);
    };

    // Listen for service worker updates
    const handleServiceWorkerUpdate = () => {
      setShowUpdatePrompt(true);
    };

    window.addEventListener('pwaInstallReady', handleInstallReady);
    window.addEventListener('serviceWorkerUpdate', handleServiceWorkerUpdate);

    // Also capture the deferred prompt directly
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('pwaInstallReady', handleInstallReady);
      window.removeEventListener('serviceWorkerUpdate', handleServiceWorkerUpdate);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installed successfully');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      onDismiss?.();
    }
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    onDismiss?.();
  };

  const handleDismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  const handleRefreshForUpdate = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-lg shadow-lg overflow-hidden animate-slide-up">
          <div className="bg-blue-600 text-white p-4 flex items-start gap-3">
            <Download size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm">Install MarketLens</h3>
              <p className="text-xs mt-1 opacity-90">Add to your home screen for quick access</p>
            </div>
            <button
              onClick={handleDismissInstall}
              className="flex-shrink-0 hover:bg-blue-700 p-1 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4 flex gap-2">
            <button
              onClick={handleDismissInstall}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Not Now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-lg shadow-lg overflow-hidden animate-slide-up">
          <div className="bg-amber-600 text-white p-4 flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm">Update Available</h3>
              <p className="text-xs mt-1 opacity-90">A new version of MarketLens is available</p>
            </div>
            <button
              onClick={handleDismissUpdate}
              className="flex-shrink-0 hover:bg-amber-700 p-1 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4 flex gap-2">
            <button
              onClick={handleDismissUpdate}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleRefreshForUpdate}
              className="flex-1 px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Update Now
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default PWAInstallPrompt;
