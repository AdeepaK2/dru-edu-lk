/**
 * Test script to check if parent data is being correctly retrieved from Firestore
 * This file can be used to debug and validate student parent information
 */

import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { firestore } from '../utils/firebase-client';

export async function testStudentParentData() {
  console.log('🔍 Starting student parent data test...');
  
  try {
    // Get first 5 students from Firestore
    const studentsQuery = query(collection(firestore, 'students'), limit(5));
    const snapshot = await getDocs(studentsQuery);
    
    if (snapshot.empty) {
      console.log('❌ No students found in Firestore');
      return;
    }
    
    console.log(`📋 Found ${snapshot.size} students to test`);
    
    for (const docSnap of snapshot.docs) {
      const studentId = docSnap.id;
      const studentData = docSnap.data();
      
      console.log(`\n👤 Student: ${studentData.name || 'Unknown'} (${studentId})`);
      console.log('   Email:', studentData.email || 'NO EMAIL');
      console.log('   Status:', studentData.status || 'NO STATUS');
      
      if (studentData.parent) {
        console.log('   ✅ Parent object exists');
        console.log('   Parent Name:', studentData.parent.name || '❌ NO NAME');
        console.log('   Parent Email:', studentData.parent.email || '❌ NO EMAIL');
        console.log('   Parent Phone:', studentData.parent.phone || '❌ NO PHONE');
        
        // Check if ready for WhatsApp
        const readyForWhatsApp = 
          studentData.parent.name && 
          studentData.parent.name.trim() !== '' &&
          studentData.parent.phone && 
          studentData.parent.phone.trim() !== '';
          
        console.log('   WhatsApp Ready:', readyForWhatsApp ? '✅ YES' : '❌ NO');
      } else {
        console.log('   ❌ No parent object found');
      }
      
      // Check documents
      if (studentData.documents && studentData.documents.length > 0) {
        console.log('   📄 Documents:', studentData.documents.length);
        studentData.documents.forEach((doc: any, index: number) => {
          console.log(`     ${index + 1}. ${doc.type} - ${doc.status}`);
        });
      } else {
        console.log('   📄 No documents found');
      }
    }
    
    console.log('\n✅ Student parent data test completed');
    
  } catch (error) {
    console.error('❌ Error testing student parent data:', error);
  }
}

// Function to test a specific student by ID
export async function testSpecificStudent(studentId: string) {
  console.log(`🔍 Testing specific student: ${studentId}`);
  
  try {
    const studentRef = doc(firestore, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      console.log('❌ Student not found');
      return null;
    }
    
    const data = studentSnap.data();
    const result = {
      id: studentId,
      name: data.name,
      email: data.email,
      status: data.status,
      hasParent: !!data.parent,
      parentData: data.parent ? {
        name: data.parent.name || null,
        email: data.parent.email || null,
        phone: data.parent.phone || null,
      } : null,
      documentsCount: data.documents?.length || 0,
      readyForWhatsApp: !!(data.parent?.name && data.parent?.phone)
    };
    
    console.log('Student Data:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error testing specific student:', error);
    return null;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testStudentParentData = testStudentParentData;
  (window as any).testSpecificStudent = testSpecificStudent;
}
