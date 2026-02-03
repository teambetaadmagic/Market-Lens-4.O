import { getFirestore } from "firebase/firestore";
import { db as firebaseDb } from "../firebaseConfig";
import { ShopifyOrder, PurchaseOrder, ActionHistory } from "../types";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";

// Use the db instance from firebaseConfig
export const db = firebaseDb;

// ===== SHOPIFY ORDERS =====
/**
 * Save a fetched Shopify order to Firestore
 * This creates a permanent record of orders scanned via barcode
 */
export const saveShopifyOrder = async (orderData: any, shopName?: string, shopifyDomain?: string): Promise<string> => {
  try {
    const orderId = `order_${orderData.orderName}_${Date.now()}`;
    const shopifyOrder: ShopifyOrder = {
      id: orderId,
      orderName: orderData.orderName,
      shopName: shopName || orderData.shopName,
      shopifyDomain: shopifyDomain || orderData.shopifyDomain || '',
      lineItems: (orderData.lineItems || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        variant_title: item.variant_title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        sku: item.sku,
        image_url: item.image_url,
        product_id: item.product_id,
        variant_id: item.variant_id
      })),
      totalPrice: orderData.totalPrice,
      customerEmail: orderData.customerEmail,
      customerName: orderData.customerName,
      status: 'confirmed',
      createdAt: Timestamp.now().toMillis(),
      syncedAt: Timestamp.now().toMillis(),
      notes: `Scanned from barcode on ${new Date().toISOString()}`
    };

    const docRef = doc(db, 'shopifyOrders', orderId);
    await setDoc(docRef, shopifyOrder);
    console.log('[Firestore] Saved Shopify order:', orderId);
    return orderId;
  } catch (error) {
    console.error('[Firestore] Error saving Shopify order:', error);
    throw error;
  }
};

/**
 * Update the status of a saved Shopify order
 */
export const updateShopifyOrderStatus = async (orderId: string, status: string, notes?: string): Promise<void> => {
  try {
    const docRef = doc(db, 'shopifyOrders', orderId);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now().toMillis(),
      ...(notes && { notes })
    });
    console.log('[Firestore] Updated Shopify order status:', orderId, status);
  } catch (error) {
    console.error('[Firestore] Error updating Shopify order:', error);
    throw error;
  }
};

// ===== PURCHASE ORDERS =====
/**
 * Create a new purchase order
 */
export const createPurchaseOrder = async (poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const poId = `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    const purchaseOrder: PurchaseOrder = {
      id: poId,
      poNumber,
      supplierId: poData.supplierId,
      supplierName: poData.supplierName,
      supplierPhone: poData.supplierPhone,
      items: poData.items,
      totalAmount: poData.totalAmount,
      status: poData.status || 'pending',
      linkedShopifyOrderId: poData.linkedShopifyOrderId,
      notes: poData.notes,
      history: poData.history || [
        {
          action: 'created',
          timestamp: Timestamp.now().toMillis(),
          details: `Purchase order created for ${poData.supplierName}`
        }
      ],
      createdAt: Timestamp.now().toMillis(),
      updatedAt: Timestamp.now().toMillis()
    };

    const docRef = doc(db, 'purchaseOrders', poId);
    await setDoc(docRef, purchaseOrder);
    console.log('[Firestore] Created purchase order:', poNumber);
    return poId;
  } catch (error) {
    console.error('[Firestore] Error creating purchase order:', error);
    throw error;
  }
};

/**
 * Update an existing purchase order
 */
export const updatePurchaseOrder = async (poId: string, updates: Partial<PurchaseOrder>): Promise<void> => {
  try {
    const docRef = doc(db, 'purchaseOrders', poId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now().toMillis()
    });
    console.log('[Firestore] Updated purchase order:', poId);
  } catch (error) {
    console.error('[Firestore] Error updating purchase order:', error);
    throw error;
  }
};

/**
 * Add history entry to purchase order
 */
export const addPurchaseOrderHistory = async (poId: string, action: string, details?: string, userId?: string): Promise<void> => {
  try {
    const entry: ActionHistory = {
      action,
      timestamp: Timestamp.now().toMillis(),
      details,
      userId
    };

    const docRef = doc(db, 'purchaseOrders', poId);
    await updateDoc(docRef, {
      history: Timestamp.increment(1),
      updatedAt: Timestamp.now().toMillis()
    });
    
    // We'll append to history array in the StoreContext when fetching
    console.log('[Firestore] Added history entry to PO:', poId);
  } catch (error) {
    console.error('[Firestore] Error adding PO history:', error);
    throw error;
  }
};

/**
 * Delete a purchase order
 */
export const deletePurchaseOrder = async (poId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'purchaseOrders', poId);
    await deleteDoc(docRef);
    console.log('[Firestore] Deleted purchase order:', poId);
  } catch (error) {
    console.error('[Firestore] Error deleting purchase order:', error);
    throw error;
  }
};
