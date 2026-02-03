# Firebase Data Migration - Complete Guide

## Overview

This guide explains how the app has been updated to **store ALL data in Firebase Firestore** instead of localStorage. This ensures that:

- **Multi-device sync**: Data created on one device is instantly visible on all other devices
- **Persistent storage**: Data survives app restarts and device resets
- **Real-time updates**: Changes propagate automatically across all connected devices
- **Complete audit trail**: All actions and changes are tracked in Firestore

## What's Changed

### 1. **Data Collections in Firestore**

The app now uses these Firebase collections:

| Collection | Purpose | Contains |
|---|---|---|
| `suppliers` | All suppliers in your network | Name, phone, tags, usage history |
| `products` | Product master data | Images (base64), descriptions, categories, pricing history |
| `dailyLogs` | Daily orders, pickups, receiving records | Quantities, dates, status, action history |
| `shopifyConfigs` | Connected Shopify stores | Access tokens, domain, store names |
| **`shopifyOrders`** *(NEW)* | Scanned orders from Shopify | Order details, line items, sync timestamps |
| **`purchaseOrders`** *(NEW)* | Purchase orders created from Shopify | Items, supplier, amounts, linked order ID, history |

### 2. **New Data Types**

Added support for tracking Shopify orders and Purchase Orders:

#### `ShopifyOrder`
```typescript
{
  id: string;                    // Unique ID
  orderName: string;             // E.g., "#1001"
  shopName?: string;             // Name of the Shopify store
  shopifyDomain: string;         // Store domain
  lineItems: ShopifyLineItem[];  // Products in the order
  totalPrice?: number;           // Order total
  customerEmail?: string;
  customerName?: string;
  status: 'confirmed' | 'dispatched' | 'delivered' | 'cancelled' | 'archived';
  createdAt: number;             // When scanned
  syncedAt: number;              // When synced to app
  notes?: string;
}
```

#### `PurchaseOrder`
```typescript
{
  id: string;
  poNumber: string;              // Auto-generated: PO-2024-0001
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'partial_received' | 'completed' | 'cancelled';
  linkedShopifyOrderId?: string;  // Reference to source Shopify order
  createdAt: number;
  updatedAt: number;
  history: ActionHistory[];      // Complete audit trail
  notes?: string;
}
```

## How It Works - Step by Step

### **Admin Adds Shopify Store**

1. Admin logs in → Goes to Admin Settings
2. Enters access token and domain
3. App validates connection → Saves to `shopifyConfigs` collection
4. **All devices instantly see the new store** (via real-time listener)

### **Warehouse Staff Scans Barcode**

1. Warehouse staff logs in → Opens Orders View
2. Clicks barcode scanner button
3. Scans Shopify order number (e.g., #1001)
4. App fetches order from Shopify API
5. **Saves order to `shopifyOrders` collection** (NEW)
6. Creates daily logs for each item
7. **Automatically creates a Purchase Order** in `purchaseOrders` collection
8. **All staff on other devices instantly see the new order and PO**

### **Real-time Sync Across Devices**

The app uses Firebase's `onSnapshot` listeners to sync data in real-time:

```typescript
// Listens to shopifyOrders collection
onSnapshot(collection(db, 'shopifyOrders'), (snapshot) => {
  const orders = snapshot.docs.map(doc => doc.data() as ShopifyOrder);
  setShopifyOrders(orders);
  // UI updates automatically
});

// Listens to purchaseOrders collection
onSnapshot(collection(db, 'purchaseOrders'), (snapshot) => {
  const pos = snapshot.docs.map(doc => doc.data() as PurchaseOrder);
  setPurchaseOrders(pos);
  // UI updates automatically
});
```

## Key Features

### ✅ **Instant Multi-Device Sync**
- When one device creates a daily log, all devices see it immediately
- When one device marks an order as "picked", all devices update
- When one device adds a supplier, it appears on all devices

### ✅ **Complete Audit Trail**
All collections include `history` field tracking:
- Who made the change (userId)
- When it was made (timestamp)
- What was changed (action, details)

Example:
```typescript
{
  action: 'created_from_shopify',
  timestamp: 1704067200000,
  details: 'Created from Shopify order #1001',
  userId: 'Neha'
}
```

### ✅ **No More Local-Only Data**
Previously, all data was stored in `localStorage` which:
- Only visible on that device
- Lost when cache cleared
- Not accessible offline (except cached data)

Now with Firebase:
- Visible on all devices immediately
- Persists in the cloud
- Works offline (syncs when reconnected)

### ✅ **Linked Shopify Orders & POs**
Purchase Orders created from Shopify scans include:
```typescript
linkedShopifyOrderId: "order_#1001_1704067200000"
```

This allows you to:
- Track which PO came from which Shopify order
- See the complete order flow (Shopify → Daily Logs → PO)
- Maintain referential integrity

## API Changes

### New Functions in StoreContext

```typescript
// Save a fetched Shopify order
savePurchaseOrder(poData: Omit<PurchaseOrder, ...>): Promise<string>

// Update an existing PO
updatePO(poId: string, updates: Partial<PurchaseOrder>): Promise<void>

// Delete a PO
deletePO(poId: string): Promise<void>
```

### New Functions in firestore.ts

```typescript
// Save Shopify order from barcode scan
saveShopifyOrder(orderData: any, shopName?: string): Promise<string>

// Update Shopify order status
updateShopifyOrderStatus(orderId: string, status: string): Promise<void>

// Create a purchase order
createPurchaseOrder(poData: ...): Promise<string>

// Update a purchase order
updatePurchaseOrder(poId: string, updates: ...): Promise<void>

// Delete a purchase order
deletePurchaseOrder(poId: string): Promise<void>
```

## Firebase Rules

To ensure proper access control, update your Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their organization's data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Testing the Integration

### Test 1: Multi-Device Sync
1. Open app on Device A (Phone/Tablet)
2. Open app on Device B (Computer/Another Phone)
3. Scan a barcode on Device A
4. **Verify**: Device B shows the new order immediately (without refresh)

### Test 2: Shopify Order to PO Flow
1. Scan a Shopify order
2. Check `shopifyOrders` collection in Firebase Console
3. Check `purchaseOrders` collection
4. Verify `linkedShopifyOrderId` matches

### Test 3: Real-time Updates
1. Create a daily log on Device A
2. Mark it as "picked" on Device B
3. **Verify**: Device A shows the updated status instantly

### Test 4: Supplier Sync
1. Add a new supplier on Device A
2. On Device B, try to create a log
3. **Verify**: The new supplier appears in the dropdown automatically

## Firebase Console Structure

Your Firestore should look like this:

```
market-lense-4-o
├── suppliers
│   ├── doc_id_1 {name: "Admagic", phone: "..."}
│   └── doc_id_2 {name: "Vishal", phone: "..."}
├── products
│   ├── product_id_1 {imageUrl: "...", description: "..."}
│   └── product_id_2 {imageUrl: "...", description: "..."}
├── dailyLogs
│   ├── log_id_1 {productId: "...", status: "ordered"}
│   └── log_id_2 {productId: "...", status: "picked_full"}
├── shopifyConfigs
│   └── config_id_1 {shopName: "Store 1", accessToken: "..."}
├── shopifyOrders (NEW)
│   ├── order_#1001_timestamp {orderName: "#1001", lineItems: [...]}
│   └── order_#1002_timestamp {orderName: "#1002", lineItems: [...]}
└── purchaseOrders (NEW)
    ├── po_id_1 {poNumber: "PO-2024-0001", supplierName: "..."}
    └── po_id_2 {poNumber: "PO-2024-0002", supplierName: "..."}
```

## Offline Support

The app now works offline with Firebase's offline persistence:

1. **Write operations**: Queued locally and synced when online
2. **Read operations**: Served from local cache
3. **Real-time listeners**: Resume syncing when connection restored

No changes needed - Firebase handles this automatically!

## Performance Considerations

1. **Image Storage**: Images are stored as base64 in Firestore. For large deployments, consider using Cloud Storage
2. **Collection Size**: Firestore handles collections with millions of documents efficiently
3. **Query Optimization**: Use indexes for filtering by date, supplier, status

## Troubleshooting

### Data not syncing across devices?
- Check Firebase connection (Console shows green in top-right)
- Verify both devices are logged in with same credentials
- Check network connection on both devices

### Shopify order not found?
- Verify Shopify store is added in Admin Settings
- Check order number format (should be like #1001)
- Confirm access token has correct permissions

### Purchase Order not created automatically?
- Check browser console for errors
- Verify `savePurchaseOrder` is being called in OrdersView
- Check Firebase permissions allow writes to purchaseOrders collection

## Migration Path

If you had existing data in localStorage:

1. The app **still supports localStorage as fallback**
2. Data automatically syncs to Firebase
3. Firebase becomes the source of truth
4. localStorage is used for user session only

To completely clear old data:
```javascript
// In browser console
localStorage.clear()
```

## Next Steps

1. ✅ Deploy updated code
2. ✅ Test multi-device sync
3. ✅ Monitor Firebase usage in Console
4. ✅ Train staff on new features
5. ✅ Set up Firebase backups

## Summary

Your app is now **fully cloud-enabled** with:
- ✅ Real-time sync across all devices
- ✅ Persistent cloud storage
- ✅ Complete audit trails
- ✅ Shopify order integration
- ✅ Automatic purchase order generation
- ✅ Offline-first architecture

All data entered on any device is **instantly available on all other devices!**
