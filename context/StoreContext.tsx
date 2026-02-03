import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, DailyLog, ProductMaster, Supplier, PreviewMetadata, User, UserRole, ShopifyOrder, PurchaseOrder, ProductSupplierHistory } from '../types';
import { db } from '../firebaseConfig';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { saveShopifyOrder, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, recordProductSupplierAssignment } from '../services/firestore';
import { DEBUG } from '../utils/debug';

interface ShopifyConfig {
  id: string;
  accessToken: string;
  shopifyDomain: string;
  shopName?: string;
}

interface StoreContextType extends AppState {
  // User Management
  user: User | null;
  isLoading: boolean;
  loginError: string | null;
  isInitialized: boolean;
  login: (username: string, password: string) => void;
  logout: () => void;

  // Shopify Configuration
  shopifyConfigs: ShopifyConfig[];
  addShopifyConfig: (config: Omit<ShopifyConfig, 'id'>) => Promise<void>;
  updateShopifyConfig: (id: string, config: Partial<ShopifyConfig>) => Promise<void>;
  deleteShopifyConfig: (id: string) => Promise<void>;

  // Shopify Orders (from barcode scan)
  shopifyOrders: ShopifyOrder[];

  // Purchase Orders
  purchaseOrders: PurchaseOrder[];
  savePurchaseOrder: (poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePO: (poId: string, updates: Partial<PurchaseOrder>) => Promise<void>;
  deletePO: (poId: string) => Promise<void>;

  // Data Management
  initError: any;
  previewImage: string | null;
  previewMeta: PreviewMetadata | null;
  setPreviewImage: (url: string | null, meta?: PreviewMetadata) => void;
  addOrUpdateDailyLog: (
    imageBase64: string,
    imageHash: string,
    quantities: Record<string, number>,
    hasSizes: boolean,
    supplierName?: string,
    description?: string,
    price?: number,
    supplierPhone?: string
  ) => Promise<void>;

  updateLogSupplier: (logId: string, supplierName: string) => void;
  updateLogDetails: (logId: string, orderedQty: Record<string, number>, price?: number) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  processPickup: (logId: string, picked: Record<string, number>, notes?: string, proofImage?: string, price?: number, supplierName?: string, supplierPhone?: string) => Promise<void>;
  processReceiving: (logId: string, received: Record<string, number>, price?: number, supplierName?: string, supplierPhone?: string) => Promise<void>;
  addSupplier: (supplier: { name: string; phone: string }) => Promise<void>;
  updateSupplier: (id: string, data: { name: string; phone?: string; tag?: string }) => Promise<void>;
  getTodayDate: () => string;
  findProductByHash: (hash: string) => ProductMaster | null;
  mergeLogsManual: (sourceLogId: string, targetLogId: string) => Promise<void>;
  fetchShopifyOrder: (orderName: string) => Promise<any>;
  getMostRecentSupplierForProduct: (productId: string) => ProductSupplierHistory | null;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // fallback
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  try {
    DEBUG.log('STORE', 'StoreProvider initializing');
    DEBUG.log('STORE', 'Firebase db instance:', db ? 'AVAILABLE' : 'MISSING');
  } catch (e) {
    DEBUG.error('STORE', 'Failed to initialize logging', e);
  }

  const [data, setData] = useState<AppState>({
    suppliers: [],
    products: [],
    dailyLogs: [],
    shopifyOrders: [],
    purchaseOrders: []
  });
  const [user, setUser] = useState<User | null>(() => {
    // Load user from localStorage
    try {
      const saved = localStorage.getItem('market-lens-user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      DEBUG.error('STORE', 'Failed to load user from localStorage', e);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<any>(null);
  const [previewImage, setPreviewImageState] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<PreviewMetadata | null>(null);
  const [shopifyConfigs, setShopifyConfigs] = useState<ShopifyConfig[]>(() => {
    // Load Shopify configs from localStorage (will be synced from Firestore)
    const saved = localStorage.getItem('market-lens-shopify-configs');
    return saved ? JSON.parse(saved) : [];
  });
  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [productSupplierHistory, setProductSupplierHistory] = useState<ProductSupplierHistory[]>([]);

  // Mock user database
  const USERS: Record<string, { password: string; role: UserRole }> = {
    'Neha': { password: 'Neha@01', role: 'warehouse' },
    'Sunil': { password: 'Sunil@001', role: 'market_person' },
    'Admagic': { password: 'Admagic@2025', role: 'admin' },
  };

  const login = (username: string, password: string) => {
    setIsLoading(true);
    setLoginError(null);

    // Simulate async operation
    setTimeout(() => {
      const userCredentials = USERS[username];

      if (!userCredentials) {
        setLoginError('Invalid username or password');
        setIsLoading(false);
        return;
      }

      if (userCredentials.password !== password) {
        setLoginError('Invalid username or password');
        setIsLoading(false);
        return;
      }

      // Successful login
      const newUser: User = {
        id: username,
        username: username,
        role: userCredentials.role
      };

      setUser(newUser);
      localStorage.setItem('market-lens-user', JSON.stringify(newUser));
      setIsLoading(false);
    }, 500);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('market-lens-user');
    setLoginError(null);
  };

  const setPreviewImage = (url: string | null, meta?: PreviewMetadata) => {
    setPreviewImageState(url);
    setPreviewMeta(meta || null);
  };

  const addShopifyConfig = async (config: Omit<ShopifyConfig, 'id'>) => {
    try {
      const newConfig: ShopifyConfig = { ...config, id: generateId() };
      const newConfigs = [...shopifyConfigs, newConfig];

      // Update local state
      setShopifyConfigs(newConfigs);
      localStorage.setItem('market-lens-shopify-configs', JSON.stringify(newConfigs));

      // Save to Firestore database for global access
      const shopifyConfigRef = doc(db, 'shopifyConfigs', newConfig.id);
      await setDoc(shopifyConfigRef, {
        accessToken: newConfig.accessToken,
        shopifyDomain: newConfig.shopifyDomain,
        shopName: newConfig.shopName || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('[Shopify Config] Added to Firestore:', newConfig.id);
    } catch (error) {
      console.error('Failed to add Shopify config:', error);
      throw error;
    }
  };

  const updateShopifyConfig = async (id: string, updatedFields: Partial<ShopifyConfig>) => {
    try {
      const newConfigs = shopifyConfigs.map(c =>
        c.id === id ? { ...c, ...updatedFields } : c
      );

      // Update local state
      setShopifyConfigs(newConfigs);
      localStorage.setItem('market-lens-shopify-configs', JSON.stringify(newConfigs));

      // Update in Firestore
      const shopifyConfigRef = doc(db, 'shopifyConfigs', id);
      await updateDoc(shopifyConfigRef, {
        ...updatedFields,
        updatedAt: new Date()
      });

      console.log('[Shopify Config] Updated in Firestore:', id);
    } catch (error) {
      console.error('Failed to update Shopify config:', error);
      throw error;
    }
  };

  const deleteShopifyConfig = async (id: string) => {
    try {
      const newConfigs = shopifyConfigs.filter(c => c.id !== id);

      // Update local state
      setShopifyConfigs(newConfigs);
      localStorage.setItem('market-lens-shopify-configs', JSON.stringify(newConfigs));

      // Delete from Firestore
      const shopifyConfigRef = doc(db, 'shopifyConfigs', id);
      await deleteDoc(shopifyConfigRef);

      console.log('[Shopify Config] Deleted from Firestore:', id);
    } catch (error) {
      console.error('Failed to delete Shopify config:', error);
      throw error;
    }
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  /**
   * Get the most frequently assigned supplier for a product
   * Returns the supplier with highest assignmentCount
   */
  const getMostRecentSupplierForProduct = (productId: string): ProductSupplierHistory | null => {
    const histories = productSupplierHistory.filter(h => h.productId === productId);
    if (histories.length === 0) return null;

    // Sort by assignmentCount descending
    return histories.sort((a, b) => b.assignmentCount - a.assignmentCount)[0];
  };

  // 1. Subscribe to Firestore Collections
  useEffect(() => {
    try {
      DEBUG.log('STORE', 'Initializing Firestore listeners...');

      const handleError = (error: any) => {
        DEBUG.error('STORE', 'Firestore Listener Error', { code: error?.code, message: error?.message });
        if (error?.code === 'permission-denied' || error?.code === 'unavailable') {
          setInitError(error);
          setIsInitialized(true); // Still mark as initialized so we can show the error screen
        }
      };

      const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
        const suppliers = snapshot.docs.map(doc => doc.data() as Supplier);
        DEBUG.log('STORE', `Suppliers synced: ${suppliers.length} records`);
        setData(prev => ({ ...prev, suppliers }));
        setInitError(null);
        setIsInitialized(true);
      }, handleError);

      const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
        const products = snapshot.docs.map(doc => doc.data() as ProductMaster);
        console.log('[Products] Synced from Firestore:', products.length);
        setData(prev => ({ ...prev, products }));
      }, handleError);

      const unsubLogs = onSnapshot(collection(db, 'dailyLogs'), (snapshot) => {
        const dailyLogs = snapshot.docs.map(doc => doc.data() as DailyLog);
        console.log('[DailyLogs] Synced from Firestore:', dailyLogs.length);
        setData(prev => ({ ...prev, dailyLogs }));
      }, handleError);

      // Subscribe to Shopify configs from Firestore
      const unsubShopifyConfigs = onSnapshot(collection(db, 'shopifyConfigs'), (snapshot) => {
        const configs = snapshot.docs.map(doc => ({
          id: doc.id,
          accessToken: doc.data().accessToken,
          shopifyDomain: doc.data().shopifyDomain,
          shopName: doc.data().shopName
        } as ShopifyConfig));
        setShopifyConfigs(configs);
        console.log('[Shopify Config] Loaded from Firestore:', configs.length, 'stores');
      }, handleError);

      // Subscribe to Shopify Orders from Firestore
      const unsubShopifyOrders = onSnapshot(collection(db, 'shopifyOrders'), (snapshot) => {
        const orders = snapshot.docs.map(doc => doc.data() as ShopifyOrder);
        setShopifyOrders(orders);
        setData(prev => ({ ...prev, shopifyOrders: orders }));
        console.log('[Shopify Orders] Loaded from Firestore:', orders.length, 'orders');
      }, handleError);

      // Subscribe to Purchase Orders from Firestore
      const unsubPurchaseOrders = onSnapshot(collection(db, 'purchaseOrders'), (snapshot) => {
        const pos = snapshot.docs.map(doc => doc.data() as PurchaseOrder);
        setPurchaseOrders(pos);
        setData(prev => ({ ...prev, purchaseOrders: pos }));
        console.log('[Purchase Orders] Loaded from Firestore:', pos.length, 'orders');
      }, handleError);

      // Subscribe to Product-Supplier History from Firestore
      const unsubProductHistory = onSnapshot(collection(db, 'productSupplierHistory'), (snapshot) => {
        const history = snapshot.docs.map(doc => doc.data() as ProductSupplierHistory);
        setProductSupplierHistory(history);
        console.log('[Product-Supplier History] Loaded from Firestore:', history.length, 'records');
      }, handleError);

      // Set a timeout for initialization - if not initialized after 10 seconds, mark as initialized anyway
      const initTimeout = setTimeout(() => {
        console.warn('[StoreContext] Initialization timeout - marking as initialized after 10s');
        setIsInitialized(true);
      }, 10000);

      return () => {
        try {
          clearTimeout(initTimeout);
          unsubSuppliers();
          unsubProducts();
          unsubLogs();
          unsubShopifyConfigs();
          unsubShopifyOrders();
          unsubPurchaseOrders();
          unsubProductHistory();
        } catch (e) {
          console.error('[StoreContext] Failed to cleanup listeners:', e);
        }
      };
    } catch (e) {
      console.error('[StoreContext] Fatal error in Firestore initialization:', e);
      setIsInitialized(true);
      setInitError({ code: 'fatal-error', message: (e as any)?.message || 'Unknown error' });
      return () => { };
    }
  }, []);

  const findProductByHash = useCallback((hash: string) => {
    return data.products.find(p => p.imageHash === hash) || null;
  }, [data.products]);


  const addOrUpdateDailyLog = async (
    imageBase64: string,
    imageHash: string,
    quantities: Record<string, number>,
    hasSizes: boolean,
    supplierName?: string,
    description?: string,
    price?: number,
    supplierPhone?: string
  ): Promise<void> => {
    try {
      console.log('[addOrUpdateDailyLog] Starting to save log...', { description, quantities });
      const batch = writeBatch(db);
      const today = getTodayDate();
      let supplierId: string | null = null;

      // 1. Handle Supplier
      if (supplierName && supplierName.trim()) {
        const normalized = supplierName.trim();
        const existingSupplier = data.suppliers.find(s => s.name.toLowerCase() === normalized.toLowerCase());

        const supplierData: any = { lastUsedAt: Date.now() };
        if (supplierPhone) supplierData.phone = supplierPhone;

        if (existingSupplier) {
          supplierId = existingSupplier.id;
          const supRef = doc(db, 'suppliers', existingSupplier.id);
          batch.update(supRef, supplierData);
        } else {
          const newId = generateId();
          supplierId = newId;
          const supRef = doc(db, 'suppliers', newId);
          batch.set(supRef, {
            id: newId,
            name: normalized,
            ...supplierData
          });
        }
      }

      // 2. Handle Product
      let productId: string;

      const existingProduct = findProductByHash(imageHash);

      if (existingProduct) {
        productId = existingProduct.id;
        const prodRef = doc(db, 'products', productId);

        const prodUpdates: any = {};
        if (supplierId && existingProduct.lastSupplierId !== supplierId) {
          prodUpdates.lastSupplierId = supplierId;
        }
        if (price !== undefined) {
          prodUpdates.lastPrice = price;
        }

        if (Object.keys(prodUpdates).length > 0) {
          batch.update(prodRef, prodUpdates);
        }
      } else {
        productId = generateId();

        const newProduct: any = {
          id: productId,
          imageUrl: imageBase64,
          imageHash,
          description: description || 'Item',
          createdAt: Date.now()
        };
        if (supplierId) newProduct.lastSupplierId = supplierId;
        if (price !== undefined) newProduct.lastPrice = price;

        const prodRef = doc(db, 'products', productId);
        batch.set(prodRef, newProduct);
      }

      // 3. Handle Daily Log
      // Find ANY active log for this product today to merge into.
      // Exclude 'dispatched' status to prevent merging into already-dispatched items.
      const existingLog = data.dailyLogs.find(l =>
        l.productId === productId &&
        l.date === today &&
        ['ordered', 'picked_partial', 'picked_full'].includes(l.status)
      );

      if (existingLog) {
        const logRef = doc(db, 'dailyLogs', existingLog.id);
        const mergedQty = { ...existingLog.orderedQty };
        Object.entries(quantities).forEach(([k, v]) => {
          mergedQty[k] = (mergedQty[k] || 0) + v;
        });

        const updateData: any = {
          hasSizes,
          orderedQty: mergedQty,
          // CRITICAL: Reset status to 'ordered' to unlock the item in PickupView
          // allowing the user to confirm the NEW total quantity.
          status: 'ordered',
          history: [...existingLog.history, { action: 'updated_order', timestamp: Date.now() }]
        };
        if (supplierId) updateData.supplierId = supplierId;
        if (price !== undefined) updateData.price = price;

        batch.update(logRef, updateData);
      } else {
        const newLogId = generateId();
        const logRef = doc(db, 'dailyLogs', newLogId);

        const newLog: any = {
          id: newLogId,
          productId,
          date: today,
          hasSizes,
          orderedQty: quantities,
          pickedQty: {},
          dispatchedQty: {},
          receivedQty: {},
          status: 'ordered',
          history: [{ action: 'created', timestamp: Date.now() }]
        };
        if (supplierId) newLog.supplierId = supplierId;
        if (price !== undefined) newLog.price = price;

        batch.set(logRef, newLog);
      }

      console.log('[addOrUpdateDailyLog] Committing batch to Firestore...');
      await batch.commit();
      console.log('[addOrUpdateDailyLog] ✅ Successfully saved to Firestore!');

    } catch (e: any) {
      console.error('❌ [addOrUpdateDailyLog] FAILED:', {
        errorCode: e?.code,
        errorMessage: e?.message,
        fullError: e
      });
      throw e;
    }
  };

  const updateLogSupplier = async (logId: string, supplierName: string) => {
    const normalized = supplierName.trim();
    if (!normalized) return;

    const batch = writeBatch(db);

    let supplierId = '';
    const existingSupplier = data.suppliers.find(s => s.name.toLowerCase() === normalized.toLowerCase());

    if (existingSupplier) {
      supplierId = existingSupplier.id;
      const supRef = doc(db, 'suppliers', existingSupplier.id);
      batch.update(supRef, { lastUsedAt: Date.now() });
    } else {
      const newId = generateId();
      supplierId = newId;
      const supRef = doc(db, 'suppliers', newId);
      batch.set(supRef, { id: newId, name: normalized, lastUsedAt: Date.now() });
    }

    const logRef = doc(db, 'dailyLogs', logId);
    const currentLog = data.dailyLogs.find(l => l.id === logId);
    if (!currentLog) return;

    batch.update(logRef, {
      supplierId: supplierId,
      history: [...currentLog.history, { action: 'supplier_change', timestamp: Date.now() }]
    });

    if (currentLog.productId) {
      const prodRef = doc(db, 'products', currentLog.productId);
      batch.update(prodRef, { lastSupplierId: supplierId });
    }

    await batch.commit();
  };

  const updateLogDetails = async (logId: string, orderedQty: Record<string, number>, price?: number) => {
    try {
      const logRef = doc(db, 'dailyLogs', logId);
      const currentLog = data.dailyLogs.find(l => l.id === logId);
      if (!currentLog) return;

      const updates: any = {
        orderedQty,
        history: [...currentLog.history, { action: 'edited_details', timestamp: Date.now() }]
      };
      if (price !== undefined) updates.price = price;

      await updateDoc(logRef, updates);
    } catch (e) {
      console.error("Failed to update log details", e);
      throw e;
    }
  };

  const deleteLog = async (logId: string) => {
    try {
      await deleteDoc(doc(db, 'dailyLogs', logId));
    } catch (e) {
      console.error("Failed to delete log", e);
      throw e;
    }
  };

  const processPickup = async (
    logId: string,
    picked: Record<string, number>,
    notes?: string,
    proofImage?: string,
    price?: number,
    supplierName?: string,
    supplierPhone?: string
  ) => {
    try {
      console.log('processPickup called with:', { logId, picked, proofImage: !!proofImage });
      const batch = writeBatch(db);
      const currentLog = data.dailyLogs.find(l => l.id === logId);
      if (!currentLog) {
        console.error('Log not found:', logId);
        throw new Error(`Log not found: ${logId}`);
      }
      console.log('Current log found:', { orderedQty: currentLog.orderedQty, pickedQty: currentLog.pickedQty });

      // 1. Handle Mandatory Supplier/Phone Update
      let targetSupplierId = currentLog.supplierId;

      if (supplierName) {
        const normalized = supplierName.trim();
        const existingSupplier = data.suppliers.find(s => s.name.toLowerCase() === normalized.toLowerCase());

        if (existingSupplier) {
          targetSupplierId = existingSupplier.id;
          if (supplierPhone) {
            const supRef = doc(db, 'suppliers', existingSupplier.id);
            batch.update(supRef, { phone: supplierPhone, lastUsedAt: Date.now() });
          }
        } else {
          const newId = generateId();
          targetSupplierId = newId;
          const supRef = doc(db, 'suppliers', newId);
          batch.set(supRef, {
            id: newId,
            name: normalized,
            phone: supplierPhone, // can be undefined
            lastUsedAt: Date.now()
          });
        }
      } else if (targetSupplierId && supplierPhone) {
        // Just updating phone for existing supplier
        const supRef = doc(db, 'suppliers', targetSupplierId);
        batch.update(supRef, { phone: supplierPhone, lastUsedAt: Date.now() });
      }

      // Update Product Master with new price/supplier if provided
      if (currentLog.productId) {
        const prodRef = doc(db, 'products', currentLog.productId);
        const prodUpdates: any = {};
        if (price !== undefined) prodUpdates.lastPrice = price;
        if (targetSupplierId && targetSupplierId !== currentLog.supplierId) prodUpdates.lastSupplierId = targetSupplierId;

        if (Object.keys(prodUpdates).length > 0) {
          batch.update(prodRef, prodUpdates);
        }
      }

      const logRef = doc(db, 'dailyLogs', logId);
      const dispatchedTotal = Object.values(picked).reduce((a: number, b: number) => a + (b || 0), 0);

      const baseUpdate: any = {};
      if (targetSupplierId && targetSupplierId !== currentLog.supplierId) baseUpdate.supplierId = targetSupplierId;
      if (price !== undefined) baseUpdate.price = price;

      if (dispatchedTotal > 0) {
        // Check if there's remaining qty after this dispatch
        const remainingQty: Record<string, number> = {};
        let hasRemaining = false;

        Object.keys(currentLog.orderedQty).forEach(size => {
          const ord = currentLog.orderedQty[size] || 0;
          const dispatch = picked[size] || 0;
          const remaining = ord - dispatch;

          if (remaining > 0) {
            remainingQty[size] = remaining;
            hasRemaining = true;
          }
        });

        if (hasRemaining) {
          // PARTIAL DISPATCH: Split into dispatched and remaining logs

          // 1. Update current log: Mark as dispatched with picked qty
          const dispatchedUpdatePayload: any = {
            ...baseUpdate,
            orderedQty: picked,  // Change orderedQty to the dispatched amount
            pickedQty: picked,
            dispatchedQty: picked,  // Mark all as dispatched
            receivedQty: {},  // Will be filled during receiving
            status: 'dispatched',  // Goes to Inward tab
            history: [...currentLog.history, {
              action: 'pickup_dispatch',
              timestamp: Date.now(),
              details: `Dispatched: ${dispatchedTotal}`
            }]
          };
          if (notes !== undefined) dispatchedUpdatePayload.notes = notes;
          if (proofImage) dispatchedUpdatePayload.pickupProofUrl = proofImage;

          batch.update(logRef, dispatchedUpdatePayload);

          // 2. Create remainder log for remaining qty (stays in Pickup tab)
          const newId = generateId();
          const newLogRef = doc(db, 'dailyLogs', newId);

          const remainingLog: any = {
            id: newId,
            productId: currentLog.productId,
            supplierId: targetSupplierId || currentLog.supplierId,
            date: currentLog.date,
            hasSizes: currentLog.hasSizes,
            orderedQty: remainingQty,
            pickedQty: {},
            dispatchedQty: {},
            receivedQty: {},
            status: 'ordered',  // Back to ordered - stays in Pickup tab
            pickupProofUrl: null,
            history: [...currentLog.history, {
              action: 'split_remaining',
              timestamp: Date.now(),
              details: `Remaining: ${Object.entries(remainingQty).map(([k, v]) => `${k}:${v}`).join(',')}`
            }]
          };
          // Only add price if it's defined
          if (currentLog.price !== undefined) {
            remainingLog.price = currentLog.price;
          }

          batch.set(newLogRef, remainingLog);
        } else {
          // FULL DISPATCH: No remaining qty
          const updatePayload: any = {
            ...baseUpdate,
            pickedQty: picked,
            dispatchedQty: picked,
            status: 'dispatched',  // Goes to Inward tab
            history: [...currentLog.history, {
              action: 'pickup_full_dispatch',
              timestamp: Date.now(),
              details: `Fully Dispatched: ${dispatchedTotal}`
            }]
          };
          if (notes !== undefined) updatePayload.notes = notes;
          if (proofImage) updatePayload.pickupProofUrl = proofImage;

          batch.update(logRef, updatePayload);
        }
      } else {
        // No items picked - update notes/status but keep in list
        const updatePayload: any = {
          ...baseUpdate,
          pickedQty: picked,
          status: 'ordered',
          history: [...currentLog.history, { action: 'visited_zero', timestamp: Date.now() }]
        };
        if (notes !== undefined) updatePayload.notes = notes;
        batch.update(logRef, updatePayload);
      }

      console.log('About to commit batch...');
      await batch.commit();
      console.log('Batch committed successfully!');
    } catch (error: any) {
      console.error('Error processing pickup:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      throw new Error(`Pickup dispatch failed: ${error?.message || error}`);
    }
  };

  const processReceiving = async (
    logId: string,
    received: Record<string, number>,
    price?: number,
    supplierName?: string,
    supplierPhone?: string
  ) => {
    const batch = writeBatch(db);
    const logRef = doc(db, 'dailyLogs', logId);
    const currentLog = data.dailyLogs.find(l => l.id === logId);
    if (!currentLog) return;

    // 1. Handle Supplier Updates if provided
    let targetSupplierId = currentLog.supplierId;

    if (supplierName) {
      const normalized = supplierName.trim();
      const existingSupplier = data.suppliers.find(s => s.name.toLowerCase() === normalized.toLowerCase());

      if (existingSupplier) {
        targetSupplierId = existingSupplier.id;
        if (supplierPhone) {
          const supRef = doc(db, 'suppliers', existingSupplier.id);
          batch.update(supRef, { phone: supplierPhone, lastUsedAt: Date.now() });
        }
      } else {
        const newId = generateId();
        targetSupplierId = newId;
        const supRef = doc(db, 'suppliers', newId);
        batch.set(supRef, {
          id: newId,
          name: normalized,
          phone: supplierPhone,
          lastUsedAt: Date.now()
        });
      }
    } else if (targetSupplierId && supplierPhone) {
      const supRef = doc(db, 'suppliers', targetSupplierId);
      batch.update(supRef, { phone: supplierPhone, lastUsedAt: Date.now() });
    }

    // 2. Update Product Master (Last Price / Supplier)
    if (currentLog.productId) {
      const prodRef = doc(db, 'products', currentLog.productId);
      const prodUpdates: any = {};
      if (price !== undefined) prodUpdates.lastPrice = price;
      if (targetSupplierId && targetSupplierId !== currentLog.supplierId) prodUpdates.lastSupplierId = targetSupplierId;

      if (Object.keys(prodUpdates).length > 0) {
        batch.update(prodRef, prodUpdates);
      }
    }

    // 3. Update Log
    const logUpdates: any = {
      receivedQty: received,
      status: 'received_partial',
      history: [...currentLog.history, { action: 'received', timestamp: Date.now() }]
    };

    if (price !== undefined) logUpdates.price = price;
    if (targetSupplierId && targetSupplierId !== currentLog.supplierId) logUpdates.supplierId = targetSupplierId;

    batch.update(logRef, logUpdates);

    await batch.commit();
  };

  const addSupplier = async (supplierData: { name: string; phone: string }) => {
    const normalized = supplierData.name.trim();
    const existing = data.suppliers.find(s => s.name.toLowerCase() === normalized.toLowerCase());

    if (existing) {
      const supRef = doc(db, 'suppliers', existing.id);
      await updateDoc(supRef, { phone: supplierData.phone, lastUsedAt: Date.now() });
    } else {
      const newId = generateId();
      await setDoc(doc(db, 'suppliers', newId), {
        id: newId,
        name: normalized,
        phone: supplierData.phone,
        lastUsedAt: Date.now()
      });
    }
  };

  const updateSupplier = async (id: string, updateData: { name: string; phone?: string; tag?: string }) => {
    const supRef = doc(db, 'suppliers', id);
    const updatePayload: any = {
      name: updateData.name,
      lastUsedAt: Date.now()
    };
    if (updateData.phone !== undefined) {
      updatePayload.phone = updateData.phone;
    }
    if (updateData.tag !== undefined) {
      updatePayload.tag = updateData.tag;
    }
    await updateDoc(supRef, updatePayload);
  };

  const mergeLogsManual = async (sourceLogId: string, targetLogId: string) => {
    try {
      const batch = writeBatch(db);
      const sourceLog = data.dailyLogs.find(l => l.id === sourceLogId);
      const targetLog = data.dailyLogs.find(l => l.id === targetLogId);

      if (!sourceLog || !targetLog) {
        throw new Error('One or both logs not found');
      }

      // Validate: don't merge if source has 0 quantity
      const sourceQty = Object.values(sourceLog.orderedQty).reduce((sum, qty) => sum + qty, 0);
      if (sourceQty === 0) {
        throw new Error('Cannot merge entry with 0 quantity');
      }

      // Determine merged hasSizes flag - if either has sizes, result should have sizes
      const mergedHasSizes = sourceLog.hasSizes || targetLog.hasSizes;

      // Merge quantities from source into target
      const mergedQty: Record<string, number> = { ...targetLog.orderedQty };

      Object.entries(sourceLog.orderedQty).forEach(([size, qty]) => {
        const numQty = Number(qty) || 0;
        // If merging size-based entries, keep size keys; otherwise merge into 'Total'
        if (mergedHasSizes && size !== 'Total') {
          mergedQty[size] = (mergedQty[size] || 0) + numQty;
        } else if (!mergedHasSizes || size === 'Total') {
          // For non-size entries or 'Total' key, add to Total
          const totalKey = 'Total';
          const currentTotal = mergedQty[totalKey] || 0;
          mergedQty[totalKey] = currentTotal + numQty;
        }
      });

      // Clean up merged quantities - remove entries with 0 qty
      Object.keys(mergedQty).forEach(key => {
        if ((mergedQty[key] || 0) === 0) {
          delete mergedQty[key];
        }
      });

      // Format dates for history
      const sourceDateObj = new Date(sourceLog.date);
      const targetDateObj = new Date(targetLog.date);
      const sourceDateStr = sourceDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      const targetDateStr = targetDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

      // Calculate total quantity merged
      const totalMergedQty = Object.values(sourceLog.orderedQty).reduce((sum, qty) => sum + qty, 0);

      // Update target log with merged quantities
      const targetRef = doc(db, 'dailyLogs', targetLogId);
      const mergeDetails = sourceLog.date === targetLog.date
        ? `Merged duplicate from same date (${sourceDateStr})`
        : `Merged entry from ${sourceDateStr} into ${targetDateStr}`;

      batch.update(targetRef, {
        orderedQty: mergedQty,
        hasSizes: mergedHasSizes,
        status: 'ordered',
        notes: (targetLog.notes || '') + (targetLog.notes ? ' | ' : '') + `[MERGED: ${mergeDetails}]`,
        history: [
          ...targetLog.history,
          {
            action: 'merged_entries',
            timestamp: Date.now(),
            quantity: totalMergedQty,
            details: `${mergeDetails} (Source Date: ${sourceDateStr}, Target Date: ${targetDateStr})`
          }
        ]
      });

      // Delete source log
      const sourceRef = doc(db, 'dailyLogs', sourceLogId);
      batch.delete(sourceRef);

      await batch.commit();
    } catch (e) {
      console.error('Failed to merge logs:', e);
      throw e;
    }
  };

  const fetchShopifyOrder = useCallback(async (orderName: string) => {
    if (shopifyConfigs.length === 0) {
      throw new Error('No Shopify stores connected. Please add a store in Settings.');
    }

    console.log('[fetchShopifyOrder] Searching for order:', orderName, 'across', shopifyConfigs.length, 'stores');

    const searchStore = async (config: ShopifyConfig) => {
      try {
        console.log(`[fetchShopifyOrder] Trying store: ${config.shopName || config.shopifyDomain}`);
        const response = await fetch('/api/shopify/order', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: config.accessToken,
            shopifyDomain: config.shopifyDomain,
            orderName: orderName
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`[fetchShopifyOrder] ✅ Order found in ${config.shopName}!`);
            return { ...data, shopName: config.shopName || config.shopifyDomain };
          }
        }
      } catch (err) {
        console.warn(`[fetchShopifyOrder] Failed to search in store ${config.shopifyDomain}:`, err);
      }
      return null;
    };

    // Search all stores concurrently
    console.log(`[fetchShopifyOrder] executing ${shopifyConfigs.length} parallel requests...`);
    const results = await Promise.all(shopifyConfigs.map(config => searchStore(config)));
    const foundOrder = results.find(result => result !== null);

    if (foundOrder) {
      return foundOrder;
    }

    throw new Error(`Order "${orderName}" not found in any of the ${shopifyConfigs.length} connected stores.`);
  }, [shopifyConfigs]);

  // Purchase Order Management Functions
  const savePurchaseOrder = useCallback(async (poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const poId = await createPurchaseOrder(poData);
      console.log('[StoreContext] Purchase order saved:', poId);
      return poId;
    } catch (error) {
      console.error('[StoreContext] Failed to save purchase order:', error);
      throw error;
    }
  }, []);

  const updatePO = useCallback(async (poId: string, updates: Partial<PurchaseOrder>): Promise<void> => {
    try {
      await updatePurchaseOrder(poId, updates);
      console.log('[StoreContext] Purchase order updated:', poId);
    } catch (error) {
      console.error('[StoreContext] Failed to update purchase order:', error);
      throw error;
    }
  }, []);

  const deletePO = useCallback(async (poId: string): Promise<void> => {
    try {
      await deletePurchaseOrder(poId);
      console.log('[StoreContext] Purchase order deleted:', poId);
    } catch (error) {
      console.error('[StoreContext] Failed to delete purchase order:', error);
      throw error;
    }
  }, []);

  return (
    <StoreContext.Provider value={{
      ...data,
      // User Management
      user,
      isLoading,
      loginError,
      isInitialized,
      login,
      logout,

      // Shopify Configuration
      shopifyConfigs,
      addShopifyConfig,
      updateShopifyConfig,
      deleteShopifyConfig,

      // Shopify Orders
      shopifyOrders,

      // Purchase Orders
      purchaseOrders,
      savePurchaseOrder,
      updatePO,
      deletePO,

      // Data Management
      initError,
      previewImage,
      previewMeta,
      setPreviewImage,
      addOrUpdateDailyLog,
      updateLogSupplier,
      updateLogDetails,
      deleteLog,
      processPickup,
      processReceiving,
      addSupplier,
      updateSupplier,
      getTodayDate,
      findProductByHash,
      mergeLogsManual,
      fetchShopifyOrder,
      getMostRecentSupplierForProduct
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
