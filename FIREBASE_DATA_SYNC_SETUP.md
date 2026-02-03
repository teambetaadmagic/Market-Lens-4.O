# Firebase Data Sync - Setup Checklist

## Before You Deploy

### ✅ Step 1: Verify Firebase Config
- [ ] Check `firebaseConfig.ts` has valid API credentials
- [ ] Firebase project is created and active
- [ ] Firestore database is enabled
- [ ] Web app is registered in Firebase Console

### ✅ Step 2: Create Firestore Collections
These are auto-created by the app, but you can pre-create them in Firebase Console:

Create these collections (empty is fine):
- [ ] `suppliers`
- [ ] `products`
- [ ] `dailyLogs`
- [ ] `shopifyConfigs`
- [ ] `shopifyOrders` (NEW - for Shopify integration)
- [ ] `purchaseOrders` (NEW - for purchase order tracking)

### ✅ Step 3: Set Firestore Rules
Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all authenticated users to read/write
    // For production, implement proper role-based access
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Steps:
1. Open Firebase Console → Your Project → Firestore Database
2. Go to "Rules" tab
3. Paste the rules above
4. Click "Publish"

### ✅ Step 4: Enable Offline Persistence (Optional)
This allows the app to work offline. Already enabled in the app code.

## After Deploy

### ✅ Step 5: Test Basic Flow

**Device A (Warehouse):**
1. Login as "Neha"
2. Go to Orders → Click "Scan Barcode"
3. Scan order number (e.g., #1001)
4. Wait for order to load

**Device B (Computer):**
1. Login as "Admagic" 
2. Open Firebase Console → Firestore
3. Check `shopifyOrders` collection
4. You should see the order data there
5. Also check `purchaseOrders` - a new PO should be created

### ✅ Step 6: Verify Multi-Device Sync

**Device A (Warehouse):**
1. Create a new supplier: "Test Supplier" with phone "9999999999"
2. Keep the page open

**Device B (Computer):**
1. Refresh or wait a few seconds
2. Create a new daily log
3. In supplier dropdown, search for "Test"
4. **Verify**: "Test Supplier" appears (synced from Device A)

### ✅ Step 7: Check Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Firestore Database
4. Check these collections have data:
   - [ ] `suppliers` - List of suppliers
   - [ ] `products` - Product images & details
   - [ ] `dailyLogs` - Orders created
   - [ ] `shopifyConfigs` - Shopify stores you added
   - [ ] `shopifyOrders` - Orders you scanned
   - [ ] `purchaseOrders` - Auto-generated POs

### ✅ Step 8: Monitor Usage

In Firebase Console → Usage tab:
- [ ] Note current usage (for billing reference)
- [ ] Set up billing alerts (recommended)
- [ ] Monitor monthly growth

## Common Issues & Fixes

### Issue: "Cannot sync data"
**Cause**: Firestore rules blocking access

**Fix**:
1. Check Firestore Rules (should allow `read` and `write`)
2. Verify user is authenticated (logged in)
3. Check browser console for permission errors

### Issue: "Shopify order not found"
**Cause**: Store not configured or order doesn't exist

**Fix**:
1. Verify Shopify store is added in Admin Settings
2. Check order number (format: #1001, not just 1001)
3. Verify access token is valid

### Issue: "Data not appearing on other device"
**Cause**: Listener not initialized or network issue

**Fix**:
1. Refresh the page on the other device
2. Check both devices are online
3. Check Firebase Console → Status (should show green)
4. Open browser console and look for errors

### Issue: "localStorage still being used"
**Current behavior**: App still uses localStorage for user session but **Firestore for all data**

This is intentional - user login is local, but orders/suppliers/products sync via Firebase

## Monitoring Dashboard

Check this regularly:

**Firebase Console → Firestore Database → Stats:**
- Documents count
- Storage used
- Real-time listeners active

**Expected during normal use:**
- Documents grow as you add orders/suppliers
- Real-time listeners: 1-2 per device
- Reads/Writes: 10-50 per operation

## Troubleshooting Checklist

When something doesn't work:

1. **Check Firebase Status**
   - [ ] Console shows green status
   - [ ] No quota exceeded messages
   - [ ] No billing issues

2. **Check App Logs**
   - [ ] Open browser console (F12)
   - [ ] Look for errors with "[Firestore]" prefix
   - [ ] Look for network errors

3. **Check Firestore Data**
   - [ ] Open Firebase Console
   - [ ] Check the collection has data
   - [ ] Click a document to see details
   - [ ] Check createdAt timestamp is recent

4. **Check Network**
   - [ ] Device has internet connection
   - [ ] WiFi/Mobile signal is strong
   - [ ] Firewall not blocking firebase.com

5. **Restart Test**
   - [ ] Close app completely
   - [ ] Clear browser cache (Ctrl+Shift+Del)
   - [ ] Reopen app
   - [ ] Try operation again

## Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│          Admin Device (Admin Settings)           │
│  • Add Shopify stores                           │
│  • Configure access tokens                      │
└──────────────────┬──────────────────────────────┘
                   │ Firestore: shopifyConfigs
                   ↓
        ┌──────────────────────┐
        │  Firebase Firestore  │
        │                      │
        │ ┌──────────────────┐ │
        │ │ shopifyConfigs   │ │
        │ │ suppliers        │ │
        │ │ products         │ │
        │ │ dailyLogs        │ │
        │ │ shopifyOrders    │ │
        │ │ purchaseOrders   │ │
        │ └──────────────────┘ │
        └──────┬───────────────┘
               │ Real-time sync
    ┌──────────┴──────────┐
    ↓                     ↓
┌─────────────┐    ┌─────────────┐
│ Warehouse   │    │  Office PC  │
│ Device (A)  │    │  Device (B) │
│             │    │             │
│ • Scan codes│    │ • View data │
│ • Create POs│    │ • Monitor   │
│ • Manage    │    │   orders    │
│   pickup    │    │ • Reports   │
└─────────────┘    └─────────────┘
```

## Performance Tips

1. **Images**: Currently stored as base64 in Firestore
   - Limit to small items (< 1MB each)
   - For larger items, migrate to Cloud Storage

2. **Collection Cleanup**: Archive old logs periodically
   - Keep last 90 days active
   - Move older data to backup collection

3. **Indexes**: Firebase auto-creates optimal indexes
   - Monitor "Indexes" tab in Firestore
   - Nothing to do manually

## Security Notes

1. **Access Tokens**: Currently stored in Firestore
   - Consider moving to secure backend service
   - Implement token rotation

2. **User Authentication**: Currently mock-based
   - Consider Firebase Auth for production
   - Would allow per-user permissions

3. **Audit Logs**: All changes tracked
   - Export periodically for compliance
   - Review "history" field in documents

## Success Indicators

Your setup is working if:

✅ Create supplier on Device A
✅ Appears on Device B in < 2 seconds
✅ Scan order in Device A
✅ Firebase Console shows new document in shopifyOrders
✅ Purchase Order auto-created in purchaseOrders
✅ All devices show same data without refresh

---

## Need Help?

1. Check Firebase Console for errors
2. Check browser console (F12) for app errors
3. Verify internet connection
4. Check Firestore Rules are published
5. Clear cache and try again

**All data is now synced via Firebase! 🎉**
