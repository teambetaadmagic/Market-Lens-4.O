# Firebase Setup Guide for Market Lens 4.0

## Overview
All app data is stored in **Firebase Firestore** (not Realtime Database):
- Shopify Configurations
- Suppliers
- Products  
- Daily Logs
- Warehouse Data

## Step 1: Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **market-lense-4-o**
3. Click **Firestore Database** in left sidebar
4. If not created, click **Create Database**
5. Choose **Start in production mode**
6. Select region: **asia-south1** (or closest to your location)
7. Click **Create**

## Step 2: Enable Anonymous Authentication

1. Go to **Authentication** section
2. Click **Sign-in method** tab
3. Click **Anonymous**
4. Toggle **Enable** → **Save**

This allows users to sign in anonymously so Firestore rules can work.

## Step 3: Set Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. **DELETE** all existing rules
3. **PASTE** these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write all collections
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **Publish** button

## Step 4: Verify Collections Will Auto-Create

Firestore collections are created automatically when you:
- Add the first Shopify store
- Add suppliers
- Add products
- Create daily logs

These collections should appear:
- `shopifyConfigs`
- `suppliers`
- `products`
- `dailyLogs`

## Step 5: Test in App

1. **Open app** in browser (desktop)
2. **Open Console** (F12 or Cmd+Option+I)
3. Should see message: `✓ Anonymous authentication enabled`
4. **Add a Shopify store**
5. Check Console for: `✓ Saved to Firestore: [store-id]`
6. **Open mobile app**
7. New store should appear automatically!

## Troubleshooting

### Store not saving?
Check browser console for errors:
- `permission-denied` → Rules not published correctly
- `unavailable` → Firestore not initialized
- Network error → Check internet connection

### Store appears on desktop but not mobile?
1. Make sure both devices use same WiFi
2. Open browser console on mobile (Chrome: `chrome://inspect`)
3. Check for same `✓ Saved to Firestore` message
4. Wait 2-3 seconds for real-time sync

### Can't authenticate?
1. Verify Anonymous Sign-in is **enabled** in Authentication
2. Check rules are **published**
3. Clear browser cache and reload

## Manual Data Verification

To verify data is in Firestore:

1. Go to Firebase Console → Firestore Database
2. Click **Collections** tab
3. Should see collections:
   - `shopifyConfigs` → contains your stores
   - `suppliers` → contains supplier data
   - `products` → contains product data
   - `dailyLogs` → contains daily logs

## Important Notes

- **Firestore is the only storage** - no localStorage for critical data
- **Real-time sync enabled** - changes appear on all devices in 1-2 seconds
- **Anonymous auth required** - everyone signs in anonymously
- **Free tier included** - up to 1 GB data per day is free

## Need Help?

If data isn't syncing:
1. Check browser console (F12)
2. Run in console: `debugFirestore()`
3. Check if authenticated: `auth.currentUser` should show a user ID
4. Check Collections in Firebase Console for your data

---

**Once set up, all your data will automatically sync across desktop and mobile devices!**
