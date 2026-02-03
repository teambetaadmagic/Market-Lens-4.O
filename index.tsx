import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('%c[BOOTSTRAP] Starting app initialization...', 'color: #2563eb; font-weight: bold;');

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

console.log('%c[BOOTSTRAP] Root element found, creating React app...', 'color: #16a34a; font-weight: bold;');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('%c[BOOTSTRAP] React root created, rendering App...', 'color: #16a34a; font-weight: bold;');
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('%c[BOOTSTRAP] App rendered successfully', 'color: #16a34a; font-weight: bold; font-size: 14px;');
} catch (error) {
  console.error('%c[BOOTSTRAP] FATAL Error rendering app:', 'color: #dc2626; font-weight: bold;', error);
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
  console.error('%c[Global Error Handler]', 'color: #dc2626; font-weight: bold;', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('%c[Unhandled Promise Rejection]', 'color: #dc2626; font-weight: bold;', event.reason);
});

console.log('%c[BOOTSTRAP] Bootstrap complete and ready for use', 'color: #2563eb; font-weight: bold; font-size: 14px;');
