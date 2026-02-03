# 🚀 QUICK START - Firebase Setup in 5 Minutes

## Your Task
Set up Firebase Firestore to enable **cross-device data sync**

## 5-Minute Setup

### Step 1: Open Firebase Console (1 min)
```
https://console.firebase.google.com/
→ Select project: market-lense-4-o
```

### Step 2: Create Firestore Database (1 min)
```
Left sidebar → Firestore Database
→ Click "Create Database" 
→ Production mode
→ Region: asia-south1 (or closest)
→ Create
```

### Step 3: Enable Anonymous Auth (1 min)
```
Left sidebar → Authentication
→ Sign-in method tab
→ Click Anonymous
→ Toggle Enable (blue)
→ Save
```

### Step 4: Update Security Rules (1 min)
```
Firestore Database → Rules tab
→ Delete all existing text
→ Paste this:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

→ Publish (blue button)
```

### Step 5: Wait 1 Minute
Rules deploy in 30-60 seconds.

## ✅ Done!

Your app now:
- ✅ Stores everything in Firestore (not localStorage)
- ✅ Syncs data across desktop + mobile instantly
- ✅ Works offline, syncs when online
- ✅ Secure & backed up automatically

## Test It

### In Browser Console (F12):
```javascript
debugFirestore()
```

Should show:
```
✓ Authenticated as: [user-id]
✓ shopifyConfigs: X documents
✓ suppliers: X documents
✓ products: X documents
✓ dailyLogs: X documents
✓ Write successful!
```

## Troubleshoot

| Problem | Solution |
|---------|----------|
| Data not showing | Click **Publish** in Rules tab |
| Permission denied | Rules not deployed yet - wait 1 min |
| Auth error | Enable Anonymous in Authentication |
| Still stuck? | See FIRESTORE_COMPLETE_SETUP.md |

---

**That's it! Your app is now ready for multi-device sync.**
