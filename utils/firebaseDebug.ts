import { db, auth } from '../firebaseConfig';
import { collection, getDocs, writeBatch, doc, setDoc, deleteDoc } from 'firebase/firestore';

export const debugFirestore = async () => {
  console.log('='.repeat(60));
  console.log('📊 FIREBASE DEBUG INFO');
  console.log('='.repeat(60));
  
  // Check if authenticated
  console.log('\n🔐 Authentication Status:');
  if (auth.currentUser) {
    console.log(`✓ Authenticated as: ${auth.currentUser.uid}`);
    console.log(`✓ Anonymous: ${auth.currentUser.isAnonymous}`);
    console.log(`✓ Provider: ${auth.currentUser.providerData[0]?.providerId || 'anonymous'}`);
  } else {
    console.log('✗ NOT authenticated');
    return;
  }
  
  try {
    // Check collections
    console.log('\n📦 Collections in Firestore:');
    const collections = ['shopifyConfigs', 'suppliers', 'products', 'dailyLogs'];
    
    for (const collName of collections) {
      try {
        const snapshot = await getDocs(collection(db, collName));
        console.log(`✓ ${collName}: ${snapshot.size} documents`);
        if (snapshot.size > 0) {
          snapshot.docs.forEach((doc, idx) => {
            if (idx < 3) { // Show first 3 docs
              console.log(`  - ${doc.id}: ${JSON.stringify(doc.data()).substring(0, 80)}...`);
            }
          });
          if (snapshot.size > 3) {
            console.log(`  ... and ${snapshot.size - 3} more`);
          }
        }
      } catch (error: any) {
        console.log(`✗ ${collName}: ${error.code} - ${error.message}`);
      }
    }
    
    // Test write permission
    console.log('\n✍️  Testing Write Permission:');
    const testId = 'test-' + Date.now();
    const testRef = doc(db, 'shopifyConfigs', testId);
    
    try {
      await setDoc(testRef, {
        test: true,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 50)
      });
      console.log('✓ Write successful! Test doc ID:', testId);
      
      // Clean up test doc
      await deleteDoc(testRef);
      console.log('✓ Test doc cleaned up');
    } catch (error: any) {
      console.error('✗ Write failed:', {
        code: error.code,
        message: error.message
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ Debug complete!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).debugFirestore = debugFirestore;
  console.log('💡 Tip: Run debugFirestore() in console to check Firestore setup');
}
