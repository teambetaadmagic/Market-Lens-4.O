import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navigation } from './components/Navigation';
import { LoginPage } from './components/LoginPage';
import { OrdersView } from './views/OrdersView';
import { PickupView } from './views/PickupView';
import { WarehouseView } from './views/WarehouseView';
import { SuppliersView } from './views/SuppliersView';
import { AdminSettingsView } from './views/AdminSettingsView';
import { isConfigured } from './firebaseConfig'; 
import { Settings, AlertCircle, ShieldAlert, Database, CheckCircle2, WifiOff, X } from 'lucide-react';
import { DEBUG } from './utils/debug';

const SetupGuide: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <Settings className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Setup Required</h1>
            <p className="text-blue-100 text-sm">Connect your Firebase database</p>
        </div>
        
        <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-amber-800">
                   The app is missing configuration keys. Please update <b>firebaseConfig.ts</b> to continue.
                </p>
            </div>

            <ol className="space-y-4 text-sm text-gray-600">
                <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-xs">1</span>
                    <span>Go to your <b>Firebase Console</b> project settings.</span>
                </li>
                <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-xs">2</span>
                    <span>Scroll to "Your apps" and select the Web app <b>(&lt;/&gt;)</b>.</span>
                </li>
                <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-xs">3</span>
                    <span>Copy the <code>firebaseConfig</code> object.</span>
                </li>
                <li className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-xs">4</span>
                    <span>Paste it into <code>firebaseConfig.ts</code>.</span>
                </li>
            </ol>
        </div>
      </div>
    </div>
  );
};

const OfflineGuide: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <WifiOff size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Failed</h2>
                <p className="text-gray-600 mb-6 text-sm">
                    Could not reach the database. This might be due to a poor internet connection or a firewall blocking the connection.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black transition"
                >
                    Retry Connection
                </button>
            </div>
        </div>
    );
};

const RulesGuide: React.FC = () => {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
          <div className="bg-red-600 p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <ShieldAlert className="text-white" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Database Locked</h1>
              <p className="text-red-100 text-sm">Permission Denied</p>
          </div>
          
          <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                  <Database size={16} />
                  <div className="text-xs">
                      <strong>Project ID:</strong> market-lens-34752
                  </div>
              </div>
  
              <div className="bg-gray-900 rounded-lg p-3 overflow-hidden">
                  <p className="text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">Required Rule Change</p>
                  <code className="text-green-400 text-xs block font-mono">allow read, write: if true;</code>
              </div>
  
              <ol className="space-y-3 text-sm text-gray-600 pt-2 border-b border-gray-100 pb-5">
                  <li className="flex gap-3 items-start">
                      <span className="flex-none w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-xs mt-0.5">1</span>
                      <span>Go to <b>Firebase Console</b> &gt; <b>Firestore Database</b> &gt; <b>Rules</b> tab.</span>
                  </li>
                  <li className="flex gap-3 items-start">
                      <span className="flex-none w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-xs mt-0.5">2</span>
                      <span>Change rule to <code>if true;</code> and click <b>Publish</b>.</span>
                  </li>
              </ol>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                  <CheckCircle2 className="text-amber-600 shrink-0" size={18} />
                  <div className="text-xs text-amber-900">
                      <strong>Don't worry about the warning:</strong>
                      <p className="mt-1">Firebase will show a red banner saying "rules are defined as public". This confirms your database is open for development.</p>
                  </div>
              </div>

              <button 
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold text-sm hover:bg-black transition"
              >
                  I've Updated The Rules, Retry
              </button>
          </div>
        </div>
      </div>
    );
};

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('orders');
  const { user, login, isLoading, loginError, initError, isInitialized, previewImage, previewMeta, setPreviewImage } = useStore();

  DEBUG.log('APP', 'AppContent render state', { isInitialized, user: user?.username, hasInitError: !!initError });

  // Show loading screen while Firebase is initializing
  if (!isInitialized) {
    DEBUG.log('APP', 'Showing loading screen', { initError: initError?.code });
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading</h2>
          <p className="text-gray-600 text-sm">Initializing application...</p>
          {initError && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-600 font-mono">Error: {initError.code || 'unknown'}</p>
              <p className="text-xs text-red-500 mt-1">{initError.message}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    DEBUG.log('APP', 'Showing login screen');
    return <LoginPage onLogin={login} isLoading={isLoading} error={loginError} />;
  }

  DEBUG.log('APP', 'Showing main app for user:', user.username);

  // Handle initialization errors
  if (initError) {
      if (initError.code === 'permission-denied') return <RulesGuide />;
      if (initError.code === 'unavailable') return <OfflineGuide />;
      // For any other errors, still show the app but log the error
      DEBUG.warn('APP', 'Init error but continuing:', initError);
  }

  const renderView = () => {
    switch (currentView) {
      case 'orders': return <OrdersView />;
      case 'pickup': return <PickupView setView={setCurrentView} />;
      case 'warehouse': return <WarehouseView />;
      case 'suppliers': return <SuppliersView />;
      case 'admin-settings': return <AdminSettingsView />;
      default: return <OrdersView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex justify-center items-start">
      <main className="w-full max-w-md h-[100dvh] bg-white shadow-2xl relative overflow-hidden flex flex-col">
         {/* Top Bar Decoration */}
         <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 w-full z-50 flex-shrink-0"></div>
         
         {/* User Info Bar */}
         <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
           <div>
             <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Logged in as</p>
             <p className="text-sm font-bold text-gray-900">{user.username}</p>
             <p className="text-xs text-blue-600 capitalize font-semibold">{user.role.replace('_', ' ')}</p>
           </div>
         </div>
         
         <div className="flex-1 overflow-y-auto no-scrollbar relative w-full">
            {renderView()}
         </div>
         
         {/* This empty div ensures content isn't hidden behind the fixed nav */}
         <div className="h-0" />

         {/* Image Zoom Modal with Watermark Overlay */}
         {previewImage && (
             <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center animate-in fade-in duration-200 p-4 backdrop-blur-sm mx-auto max-w-md" onClick={() => setPreviewImage(null)}>
                 <button className="absolute top-4 right-4 text-white hover:text-gray-200 p-2 bg-black/40 rounded-full z-50 backdrop-blur-md border border-white/10" onClick={() => setPreviewImage(null)}>
                     <X size={20} />
                 </button>
                 
                 <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                     <img 
                         src={previewImage} 
                         className="w-auto h-auto max-w-full max-h-[85vh] object-contain block" 
                         alt="Preview" 
                     />
                     
                     {/* Watermark Overlay - Positioned absolutely over the image */}
                     {previewMeta && (
                         <div className="absolute bottom-0 left-0 right-0 p-5 pt-12 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white pointer-events-none w-full">
                             {previewMeta.tag && (
                                 <span className="inline-block bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-1.5 uppercase tracking-wider">
                                     {previewMeta.tag}
                                 </span>
                             )}
                             
                             {previewMeta.title && (
                                 <h3 className="font-bold text-lg mb-1 text-white/95 drop-shadow-md leading-tight line-clamp-2">
                                     {previewMeta.title}
                                 </h3>
                             )}
                             
                             <div className="flex items-end justify-between gap-4 mt-1">
                                 <div>
                                     {previewMeta.qty && (
                                         <div className="text-2xl font-bold tracking-tight drop-shadow-md text-white">
                                             {previewMeta.qty}
                                         </div>
                                     )}
                                     {previewMeta.sizeDetails && (
                                         <div className="text-yellow-400 font-mono font-bold mt-0.5 text-xl drop-shadow-md">
                                             {previewMeta.sizeDetails}
                                         </div>
                                     )}
                                 </div>
                                 {previewMeta.price && (
                                     <div className="text-xl font-bold text-green-400 drop-shadow-md">
                                         {previewMeta.price}
                                     </div>
                                 )}
                             </div>
                         </div>
                     )}
                 </div>
             </div>
         )}
      </main>
      <Navigation currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

const App: React.FC = () => {
  // Setup guard
  if (!isConfigured) {
    return <ErrorBoundary><SetupGuide /></ErrorBoundary>;
  }

  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
};

export default App;