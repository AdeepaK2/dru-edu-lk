// Debug script to compare two conversation documents
// Run with: npx tsx src/scripts/debug-conversations.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA6AaV4VXUr1xMfMmTNAunXjXKLaI1J_5M",
  authDomain: "dru-edu.firebaseapp.com",
  projectId: "dru-edu",
  storageBucket: "dru-edu.firebasestorage.app",
  messagingSenderId: "1022299615005",
  appId: "1:1022299615005:web:fb0a67d02b1b58e6edd7dd",
  measurementId: "G-TR1P7QBLH6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugConversations() {
  const convId1 = '7z8sSd8LbCBMTwnqFxV9'; // Web conversation
  const convId2 = '5sZSm3UUU7FohDq5PoUd'; // Mobile conversation
  
  console.log('Fetching conversations...\n');
  
  const conv1Doc = await getDoc(doc(db, 'chatConversations', convId1));
  const conv2Doc = await getDoc(doc(db, 'chatConversations', convId2));
  
  console.log('=== Web Conversation (7z8sSd8LbCBMTwnqFxV9) ===');
  if (conv1Doc.exists()) {
    const data = conv1Doc.data();
    console.log('participants:', JSON.stringify(data?.participants));
    console.log('participantDetails:', JSON.stringify(data?.participantDetails, null, 2));
    console.log('createdAt:', data?.createdAt?.toDate?.());
  } else {
    console.log('NOT FOUND');
  }
  
  console.log('\n=== Mobile Conversation (5sZSm3UUU7FohDq5PoUd) ===');
  if (conv2Doc.exists()) {
    const data = conv2Doc.data();
    console.log('participants:', JSON.stringify(data?.participants));
    console.log('participantDetails:', JSON.stringify(data?.participantDetails, null, 2));
    console.log('createdAt:', data?.createdAt?.toDate?.());
  } else {
    console.log('NOT FOUND');
  }
  
  // Also get messages count for each
  console.log('\n=== Message Counts ===');
  const messagesRef = collection(db, 'chatMessages');
  const messages1Query = query(messagesRef, where('conversationId', '==', convId1));
  const messages2Query = query(messagesRef, where('conversationId', '==', convId2));
  
  const messages1 = await getDocs(messages1Query);
  const messages2 = await getDocs(messages2Query);
  
  console.log(`Web conversation messages: ${messages1.size}`);
  console.log(`Mobile conversation messages: ${messages2.size}`);
}

debugConversations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
