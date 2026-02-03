import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Check, AlertCircle, Eye, EyeOff, X, Trash2, Plus, Store, ExternalLink } from 'lucide-react';

interface ValidationResult {
  isValid: boolean;
  message: string;
  shopName?: string;
}

export const AdminSettingsView: React.FC = () => {
  const storeData = useStore();
  const { shopifyConfigs = [], addShopifyConfig, deleteShopifyConfig } = storeData;
  const [newStore, setNewStore] = useState({
    accessToken: '',
    shopifyDomain: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(shopifyConfigs.length === 0);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewStore(prev => ({
      ...prev,
      accessToken: e.target.value
    }));
    setConnectionStatus('idle');
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const domain = e.target.value;
    const normalizedDomain = domain.replace(/\.myshopify\.com$/, '');
    setNewStore(prev => ({
      ...prev,
      shopifyDomain: normalizedDomain
    }));
    setConnectionStatus('idle');
  };

  const testShopifyConnection = async (token: string, domain: string): Promise<ValidationResult> => {
    try {
      console.log('[Shopify Verify] testShopifyConnection called with:', { tokenLength: token.length, domainLength: domain.length });

      if (!token.trim() || !domain.trim()) {
        return { isValid: false, message: 'Token and domain are required' };
      }

      const tokenPattern = /^(shpat_|shpca_|shpss_|shpua_|shppa_)/;
      if (!tokenPattern.test(token.trim())) {
        return { isValid: false, message: 'Invalid access token format. Token should start with shpat_, shpca_, or shpss_' };
      }

      if (token.length < 20) {
        return { isValid: false, message: 'Access token is too short' };
      }

      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
      const cleanDomain = domain.replace('.myshopify.com', '').trim();

      if (!domainPattern.test(cleanDomain)) {
        return { isValid: false, message: 'Invalid store domain format' };
      }

      const fullDomain = cleanDomain.includes('.myshopify.com') ? cleanDomain : `${cleanDomain}.myshopify.com`;
      const serverlessUrl = '/api/shopify/verify';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(serverlessUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token.trim(), shopifyDomain: cleanDomain }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json().catch(e => {
            console.error('[Shopify Verify] Failed to parse successful response:', e);
            return { success: false, message: 'Failed to parse server response' };
          });
          if (data.success) {
            return { isValid: true, message: `Successfully connected to ${data.shopName}!`, shopName: data.shopName };
          } else {
            return { isValid: false, message: data.message || 'Verification failed.' };
          }
        } else if (response.status === 404) {
          console.warn('[Shopify Verify] Serverless endpoint not found (404). Falling back...');
        } else if (response.status >= 400 && response.status < 500) {
          const data = await response.json().catch(() => ({ message: 'Verification failed' }));
          return { isValid: false, message: data.message || `Error: ${response.statusText}` };
        }
      } catch (serverlessError: any) {
        console.warn('[Shopify Verify] Serverless verification caught exception:', serverlessError.message);
      }

      // Fallback: CORS Proxy
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const shopifyUrl = `https://${fullDomain}/admin/api/2024-01/shop.json`;
        const CORS_PROXY = 'https://corsproxy.io/?';
        const proxyUrl = CORS_PROXY + encodeURIComponent(shopifyUrl);

        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'X-Shopify-Access-Token': token.trim(), 'Content-Type': 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.shop && data.shop.name) {
            return { isValid: true, message: `Successfully connected to ${data.shop.name}!`, shopName: data.shop.name };
          } else {
            return { isValid: false, message: 'Invalid response from Shopify. Please check your credentials.' };
          }
        } else {
          return { isValid: false, message: `Connection error: ${response.statusText || response.status}` };
        }
      } catch (directError: any) {
        return { isValid: false, message: `Verification failed: ${directError.message}` };
      }
    } catch (error: any) {
      return { isValid: false, message: 'Failed to validate credentials.' };
    }
  };

  const handleSave = async () => {
    if (!newStore.accessToken.trim()) {
      setErrorMessage('Custom app access token is required');
      setSaveStatus('error');
      return;
    }
    if (!newStore.shopifyDomain.trim()) {
      setErrorMessage('.myshopify domain is required');
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');
    setConnectionStatus('testing');

    const validation = await testShopifyConnection(newStore.accessToken, newStore.shopifyDomain);

    if (!validation.isValid) {
      setErrorMessage(validation.message);
      setSaveStatus('error');
      setConnectionStatus('failed');
      return;
    }

    try {
      await addShopifyConfig({
        accessToken: newStore.accessToken,
        shopifyDomain: newStore.shopifyDomain,
        shopName: validation.shopName
      });
      setSaveStatus('saved');
      setConnectionStatus('connected');
      setNewStore({ accessToken: '', shopifyDomain: '' });
      setIsAddingNew(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setErrorMessage('Failed to save settings. Please try again.');
      setSaveStatus('error');
      setConnectionStatus('failed');
    }
  };

  const handleClear = () => {
    setNewStore({ accessToken: '', shopifyDomain: '' });
    setShowToken(false);
    setErrorMessage('');
    setConnectionStatus('idle');
    setSaveStatus('idle');
  };

  const handleDeleteStore = async (id: string) => {
    try {
      await deleteShopifyConfig(id);
      setStoreToDelete(null);
    } catch (error) {
      setErrorMessage('Failed to delete store.');
    }
  };

  return (
    <div className="flex flex-col h-full pb-20">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-4 flex-shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Shopify Connections</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your connected Shopify stores</p>
        </div>
        {!isAddingNew && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            <Plus size={16} />
            Add Store
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {isAddingNew ? (
          <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-md font-bold text-gray-800">Add New Store</h2>
              {shopifyConfigs.length > 0 && (
                <button
                  onClick={() => { setIsAddingNew(false); handleClear(); }}
                  className="text-gray-500 hover:text-gray-700 text-sm font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1 text-xs uppercase tracking-wider">Setup Instructions</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Go to Shopify Admin → Settings → Apps</li>
                  <li>Create a Custom App and generate Access Token</li>
                  <li>Enable necessary Admin API scopes</li>
                  <li>Copy Token and .myshopify.com domain</li>
                </ol>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Access Token <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={newStore.accessToken}
                    onChange={handleTokenChange}
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Store Domain <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={newStore.shopifyDomain}
                    onChange={handleDomainChange}
                    placeholder="my-store-name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">.myshopify.com</span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex gap-2">
                <X size={16} className="mt-0.5" /> {errorMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleClear} className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700">Clear</button>
              <button
                onClick={handleSave}
                className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition ${saveStatus === 'saving' ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {saveStatus === 'saving' ? 'Verifying...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-md font-bold text-gray-800 flex items-center gap-2">
              <Store size={18} className="text-blue-600" />
              Connected Stores ({shopifyConfigs.length})
            </h2>

            <div className="grid gap-4">
              {shopifyConfigs.map(store => (
                <div key={store.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Store size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{store.shopName || 'Shopify Store'}</h3>
                        <p className="text-xs text-gray-500 font-mono">{store.shopifyDomain}.myshopify.com</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`https://${store.shopifyDomain}.myshopify.com`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        onClick={() => setStoreToDelete(store.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Connected</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {storeToDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Remove Store?</h3>
                <p className="text-sm text-gray-500 mt-1">This store's inventory connection will be removed. You can add it back later.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStoreToDelete(null)} className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl">Cancel</button>
                <button
                  onClick={() => handleDeleteStore(storeToDelete)}
                  className="flex-1 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
