# Firestore Security Rules Setup

## Issue
Stores are not syncing from desktop to mobile because Firestore security rules are likely blocking unauthenticated access.

## Solution: Update Firebase Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **market-lense-4-o**
3. Navigate to **Firestore Database** → **Rules** tab
4. Replace the rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all users to read/write shopifyConfigs (cross-device sync)
    match /shopifyConfigs/{document=**} {
      allow read, write: if true;
    }
    
    // Allow all users to read/write suppliers, products, dailyLogs
    match /suppliers/{document=**} {
      allow read, write: if true;
    }
    
    match /products/{document=**} {
      allow read, write: if true;
    }
    
    match /dailyLogs/{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Click **Publish** to save the rules

## Testing
After updating the rules:

1. Open the app in browser
2. Open **Developer Tools** (F12 or Cmd+Option+I)
3. In the Console tab, run: `debugFirestore()`
4. Look for these messages:
   - ✓ "Anonymous authentication enabled" - means auth is working
   - ✓ "shopifyConfigs collection exists" - means Firestore read works
   - ✓ "Test write successful!" - means Firestore write works

## If you see "permission-denied" errors:
- Make sure the rules above are published correctly
- Clear browser cache and reload
- Check that your Firestore is not in read-only mode

## To enable Authentication
The app now uses anonymous authentication, which requires that Anonymous Sign-in is enabled:

1. Go to Firebase Console → **Authentication**
2. Click **Sign-in method** tab
3. Enable **Anonymous** provider
4. Click **Save**

Done! Stores should now sync across devices.
