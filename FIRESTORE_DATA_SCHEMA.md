# 📊 Firestore Data Schema - What's Stored Where

## Complete Data Structure

### 1. shopifyConfigs Collection

**What it stores:** Shopify store API credentials

**When it's created:** When user adds a store in Settings

**Document structure:**
```json
{
  "id": "uuid-generated-id",
  "accessToken": "shpat_xxxxxxxx...",
  "shopifyDomain": "my-store-name",
  "shopName": "My Store Inc",
  "createdAt": "2024-02-02T10:30:00.000Z",
  "updatedAt": "2024-02-02T10:30:00.000Z"
}
```

**Used for:**
- Fetching Shopify orders
- Getting product availability
- Cross-device access (mobile sees desktop store configs)

**Example:** Store added on desktop → instantly available on mobile

---

### 2. suppliers Collection

**What it stores:** Supplier contact information

**When it's created:** When user adds/mentions a supplier

**Document structure:**
```json
{
  "id": "uuid-generated-id",
  "name": "ABC Textiles",
  "phone": "+91-9876543210",
  "tag": "preferred",
  "lastUsedAt": 1707110400000
}
```

**Used for:**
- Dropdown list when entering supplier
- Contact information
- Usage tracking (last used date)

**Example:** Add supplier on mobile → dropdown shows on desktop

---

### 3. products Collection

**What it stores:** Master product/item data

**When it's created:** When user first scans an item's barcode/label

**Document structure:**
```json
{
  "id": "uuid-generated-id",
  "imageHash": "sha256-hash-of-item-image",
  "imageUrl": "base64-encoded-image-data",
  "description": "Cotton T-Shirt Blue M",
  "hasSizes": true,
  "lastPrice": 250,
  "lastSupplierId": "supplier-id-reference",
  "createdAt": 1707110400000,
  "updatedAt": 1707110400000
}
```

**Used for:**
- Identifying items by image
- Tracking item history
- Quick lookup of recent items

**Example:** Scan item on mobile → desktop sees it in product list

---

### 4. dailyLogs Collection

**What it stores:** Daily inventory transactions

**When it's created:** When user logs an item (order, receive, dispatch)

**Document structure:**
```json
{
  "id": "uuid-generated-id",
  "date": "2024-02-02",
  "productId": "product-id-reference",
  "supplierId": "supplier-id-reference",
  "hasSizes": true,
  "orderedQty": {
    "S": 10,
    "M": 15,
    "L": 5
  },
  "pickedQty": {
    "S": 0,
    "M": 0,
    "L": 0
  },
  "dispatchedQty": {
    "S": 0,
    "M": 0,
    "L": 0
  },
  "receivedQty": {
    "S": 0,
    "M": 0,
    "L": 0
  },
  "status": "ordered",
  "price": 250,
  "history": [
    {
      "action": "created",
      "timestamp": 1707110400000
    },
    {
      "action": "picked_partial",
      "timestamp": 1707114000000
    }
  ]
}
```

**Status values:**
- `ordered` - Item ordered
- `picked_partial` - Some items picked
- `picked_full` - All items picked
- `dispatched` - Ready to send
- `received` - Customer received
- `completed` - Transaction done

**Used for:**
- Daily inventory tracking
- Pick/dispatch/receive workflow
- Historical records
- Cross-device sync of warehouse activities

**Example:** Pick item on mobile → desktop shows updated status instantly

---

## Real-Time Listeners

Each collection has a **real-time listener** that:

1. **Watches for changes** in Firestore
2. **Updates app state** immediately
3. **Syncs across all devices** in 1-2 seconds

```typescript
// Example (already in your app code)
onSnapshot(collection(db, 'shopifyConfigs'), (snapshot) => {
  // Fires whenever ANY store is added/updated/deleted
  setShopifyConfigs(stores)
})
```

---

## Data Flow Diagram

```
Desktop App
    ↓ (adds store)
    ↓ Firestore Collection: shopifyConfigs
    ↓ (real-time listener)
    ↓ Mobile App instantly sees new store
    
Mobile App
    ↓ (scans item)
    ↓ Firestore Collection: products + dailyLogs
    ↓ (real-time listeners)
    ↓ Desktop App instantly sees new item + log

Firestore
    ↓ (automatic daily backup)
    ↓ Google Cloud Storage
    ↓ (30-day backup history)
    ↓ Can restore if needed
```

---

## Data Relationships

```
shopifyConfigs
    └─ (user adds stores)

suppliers
    └─ (reused across products)

products
    └─ (can be used multiple times)
    
dailyLogs
    ├─ references productId
    ├─ references supplierId
    └─ tracks quantities for this product today
```

---

## What Gets Stored Where

| Data Type | Collection | Stored | Updated | Synced |
|-----------|-----------|--------|---------|--------|
| Store credentials | shopifyConfigs | ✅ | ✅ | Real-time |
| Supplier info | suppliers | ✅ | ✅ | Real-time |
| Item images | products | ✅ | ✅ | Real-time |
| Quantities | dailyLogs | ✅ | ✅ | Real-time |
| Status updates | dailyLogs.history | ✅ | ✅ | Real-time |

---

## Example: Complete Flow

### User Journey:

1. **Add store on Desktop:**
   ```
   User clicks "Add Store"
   → Saves to shopifyConfigs collection
   → Listener fires on Mobile
   → Mobile loads new store automatically
   ```

2. **Scan item on Mobile:**
   ```
   User scans barcode
   → Creates product (if new)
   → Creates dailyLog entry
   → Batch commit to Firestore
   → Desktop listener fires
   → Desktop shows item in list
   ```

3. **Pick item on Mobile:**
   ```
   User updates pickedQty
   → Updates dailyLog in Firestore
   → Listener fires on Desktop
   → Desktop shows updated status
   ```

4. **View history on Desktop:**
   ```
   User clicks on item
   → Reads history from dailyLogs
   → Shows all status changes with timestamps
   ```

---

## Database Size Estimates

### For Small Business (1 year data):

| Collection | Approx. Documents | Approx. Size |
|-----------|------------------|------------|
| shopifyConfigs | 5-20 | ~50 KB |
| suppliers | 50-200 | ~200 KB |
| products | 500-2000 | ~50 MB (images) |
| dailyLogs | 10,000-50,000 | ~20 MB |
| **Total** | | **~70 MB** |

*Well under 1 GB free tier limit*

---

## Backup & Recovery

Firestore automatically:
- ✅ Backs up every 24 hours
- ✅ Keeps 30-day history
- ✅ Can restore by date
- ✅ Zero cost (included)

To restore old data:
1. Contact Firebase support
2. Provide date to restore to
3. They restore the entire database
4. Takes 1-2 business days

---

## Security Rules Explained

Your security rule:
```javascript
allow read, write: if request.auth != null;
```

Means:
- ✅ Authenticated users can READ all data
- ✅ Authenticated users can WRITE all data
- ❌ Anonymous users (not signed in) cannot access
- ❌ Public access blocked

Every user gets signed in anonymously automatically in your app.

---

## Monitoring

To check Firestore usage:

1. Firebase Console → **Usage** tab
2. See:
   - Read operations (your daily limit)
   - Write operations (your daily limit)
   - Data storage (your free tier limit)
   - Network bandwidth

Real-time charts show current usage.

---

## Summary

✅ **All data in Firestore, not localStorage**
✅ **Real-time sync across all devices**
✅ **Automatic backups**
✅ **Free tier sufficient**
✅ **Secure with authentication**

**Your app is fully configured for multi-device data sync!**
