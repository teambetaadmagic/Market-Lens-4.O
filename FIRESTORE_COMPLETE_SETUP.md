# Market Lens 4.0 - Firebase Firestore Complete Setup

## ✅ What's Already Configured in the App

The app **already stores all data in Firestore**:

### Data Stored in Firestore:
1. **shopifyConfigs** - Shopify store connections
   - Access token, domain, shop name
   - Syncs across all devices in real-time

2. **suppliers** - Supplier information
   - Name, phone, last used date
   - Created when you add inventory

3. **products** - Product/item master data
   - Image, hash, description, price
   - Created when you scan items

4. **dailyLogs** - Daily inventory tracking
   - Quantities, dates, supplier info
   - Pickup and receiving records

### Real-Time Sync:
- All collections have **real-time listeners** enabled
- Changes appear on all devices in **1-2 seconds**
- Works across desktop + mobile + PWA

---

## ⚙️ What You Need to Do

### Step 1: Go to Firebase Console
```
https://console.firebase.google.com/
```

### Step 2: Select Your Project
- Project ID: **market-lense-4-o**

### Step 3: Enable Firestore Database
1. Click **Firestore Database** in sidebar
2. If you see "Create Database" button:
   - Click it
   - Choose **Start in production mode**
   - Select region closest to you
   - Click **Create**

### Step 4: Enable Anonymous Authentication
1. Go to **Authentication** section
2. Click **Sign-in method** tab
3. Find **Anonymous** provider
4. If not enabled:
   - Click **Anonymous**
   - Toggle **Enable**
   - Click **Save**

### Step 5: Update Security Rules
1. Click **Firestore Database**
2. Click **Rules** tab
3. **REPLACE ALL** existing text with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **Publish** button (blue button on right)

### Step 6: Wait for Deployment
- Rules usually deploy in **30-60 seconds**
- You'll see "✓ Deployed" message

---

## 🧪 Test Everything

### In Browser Console:

1. **Open any page** of the app
2. **Press F12** to open Developer Tools
3. Go to **Console** tab
4. **Paste and run:**

```javascript
debugFirestore()
```

### What You Should See:

```
============================================================
📊 FIREBASE DEBUG INFO
============================================================

🔐 Authentication Status:
✓ Authenticated as: [user-id]
✓ Anonymous: true

📦 Collections in Firestore:
✓ shopifyConfigs: X documents
✓ suppliers: X documents  
✓ products: X documents
✓ dailyLogs: X documents

✍️ Testing Write Permission:
✓ Write successful!
✓ Test doc cleaned up

✓ Debug complete!
```

### If You See Errors:

**Error: "permission-denied"**
- Rules haven't been published
- Go back to Step 5 and click **Publish** again
- Wait 1 minute and refresh browser

**Error: "authentication/invalid-api-key"**
- Firebase config is wrong
- Check `firebaseConfig.ts` has correct API key

**Error: "request.auth is null"**
- Anonymous auth not enabled
- Go to Step 4 and enable Anonymous

---

## 📱 Cross-Device Sync Testing

### Test 1: Add Store on Desktop, View on Mobile

1. **Open app on desktop** (laptop/browser)
2. Go to **Settings → Shopify Connections**
3. Add a store with valid credentials
4. Should see: "✓ Store added!" message
5. Open **browser console** → should see: `✓ Saved to Firestore:`
6. **Open same app on mobile**
7. Go to **Settings → Shopify Connections**
8. **New store should appear automatically!** ✓

### Test 2: Verify Data in Firebase Console

1. Go to **Firebase Console**
2. Click **Firestore Database**
3. Click **Collections** tab
4. Click **shopifyConfigs**
5. You should see your store with:
   - accessToken
   - shopifyDomain
   - shopName
   - createdAt timestamp

### Test 3: Real-Time Sync Speed

1. **Add item on mobile**
2. **Watch desktop app**
3. New item should appear in **1-2 seconds**
4. No page refresh needed!

---

## 🔍 Verify Each Collection

### shopifyConfigs Collection
- Contains: Store connections
- Should have fields: accessToken, shopifyDomain, shopName, createdAt, updatedAt

### suppliers Collection  
- Contains: Supplier information
- Should have fields: id, name, phone, lastUsedAt

### products Collection
- Contains: Item/product master data
- Should have fields: id, imageHash, imageUrl, description, lastPrice, lastSupplierId

### dailyLogs Collection
- Contains: Daily inventory tracking
- Should have fields: id, date, quantities, supplierId, status (pending/completed)

---

## ⚠️ Common Issues & Solutions

### Problem: Stores not appearing on mobile

**Solution:**
1. Both devices must use **same WiFi** (or be internet connected)
2. Check browser console on mobile for errors
3. Make sure **Anonymous auth is enabled**
4. Clear mobile browser cache and reload
5. Run `debugFirestore()` on mobile to verify auth

### Problem: Data not saving

**Solution:**
1. Check browser console for specific error
2. Verify **Firestore Rules are published** (should show "✓ Deployed")
3. Check **collections exist** in Firebase Console
4. Try adding a test item and watch console logs

### Problem: "Firestore permission denied"

**Solution:**
1. Go to **Firestore Database → Rules** tab
2. Make sure the rules are exactly as shown above
3. Click **Publish** button
4. Wait 1 minute
5. Refresh browser and try again

### Problem: Authentication errors

**Solution:**
1. Go to **Authentication → Sign-in method**
2. Ensure **Anonymous** is **enabled** (toggle should be blue)
3. If not, click on Anonymous and enable it
4. Click **Save**

---

## 📊 Monitor Data Usage

### Free Tier Includes:
- **1 GB** data storage
- **Unlimited** read/write operations (within free tier limits)
- **Real-time sync** across all devices
- **Automatic backups**

### Check Your Usage:
1. Go to Firebase Console
2. Click **Project Settings** (gear icon)
3. Click **Billing** tab
4. See current data storage and operations

---

## ✨ Summary

**Your Market Lens 4.0 app now:**

✅ Stores all data in Firebase Firestore  
✅ Syncs across desktop + mobile in real-time  
✅ Uses anonymous authentication  
✅ Works with offline mode (data syncs when online)  
✅ Has automatic backups  
✅ Scales to any data size  

**Once you complete the 6 steps above, everything works automatically!**

---

## Need More Help?

Check console logs with: `debugFirestore()`

Open browser Developer Tools: **F12 → Console tab**

Contact support if errors persist.
