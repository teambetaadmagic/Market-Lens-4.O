import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('[Bootstrap] Starting app initialization...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[Bootstrap] FATAL: Could not find root element');
  document.body.innerHTML = `
    <div style="width:100%; height:100vh; display:flex; align-items:center; justify-content:center; background:#fee; color:#c33; font-family:sans-serif; padding:20px; text-align:center;">
      <div style="max-width:400px;">
        <h1>⚠️ Bootstrap Failed</h1>
        <p>Could not find the root element (#root) to mount the application.</p>
        <p><small>This is a critical setup issue. Check your HTML file.</small></p>
      </div>
    </div>
  `;
  throw new Error("Could not find root element to mount to");
}

console.log('[Bootstrap] Root element found, creating React app...');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('[Bootstrap] React root created, rendering App...');
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('[Bootstrap] App rendered successfully');
} catch (error) {
  console.error('[Bootstrap] FATAL Error rendering app:', error);
  document.body.innerHTML = `
    <div style="width:100%; height:100vh; display:flex; align-items:center; justify-content:center; background:#fee; color:#c33; font-family:monospace; padding:20px; overflow:auto;">
      <div style="max-width:500px;">
        <h1>🔴 Rendering Error</h1>
        <p><strong>Error:</strong> ${String(error).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p><small>Check browser console for details (F12)</small></p>
      </div>
    </div>
  `;
  throw error;
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

console.log('[Bootstrap] Bootstrap complete');
