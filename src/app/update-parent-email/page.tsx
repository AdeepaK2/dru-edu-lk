'use client';

import React, { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

export default function UpdateParentEmail() {
  const [studentEmail, setStudentEmail] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Use env var or default for the WhatsApp number
  const adminWhatsApp = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '+61400000000'; // Replace with actual default if known
  const expectedCode = process.env.NEXT_PUBLIC_PARENT_UPDATE_CODE || 'DRU2026';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!studentEmail || !newParentEmail || !securityCode) {
      setError('Please fill in all fields.');
      return;
    }

    if (securityCode !== expectedCode) {
      setError('Invalid security code. Please contact the administrator via WhatsApp to receive the correct code.');
      return;
    }

    if (studentEmail.toLowerCase() === newParentEmail.toLowerCase()) {
      setError('The new parent email cannot be the same as the student email. Please provide a distinct email address for the parent.');
      return;
    }

    setLoading(true);
    
    try {
      // Find the student by email
      const studentsRef = collection(firestore, 'students');
      const q = query(studentsRef, where('email', '==', studentEmail.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('No student found with that email address. Please check the spelling and try again.');
        setLoading(false);
        return;
      }

      // Update parent.email for all matching student records (usually just 1)
      for (const studentDoc of querySnapshot.docs) {
        const data = studentDoc.data();
        const oldParentEmail = data.parent?.email || '';
        const studentRef = doc(firestore, 'students', studentDoc.id);
        await updateDoc(studentRef, {
          'parent.email': newParentEmail.toLowerCase()
        });

        // Log the change to Firestore for admin audit trail
        await addDoc(collection(firestore, 'parentEmailChangeLogs'), {
          studentId: studentDoc.id,
          studentName: data.name || '',
          studentEmail: data.email || '',
          oldParentEmail: oldParentEmail,
          newParentEmail: newParentEmail.toLowerCase(),
          changedAt: new Date().toISOString(),
        });
      }

      setSuccess(true);
      // Clear form
      setStudentEmail('');
      setNewParentEmail('');
      setSecurityCode('');

    } catch (err: any) {
      console.error('Error updating parent email:', err);
      setError('An error occurred while updating the email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Update Parent Email
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w">
          Securely link a distinct parent email address to a student record.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <p className="text-sm text-green-700">Parent email updated successfully! You may now use this new email to access the Parent Portal.</p>
              </div>
            )}

            <div>
              <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700">
                Student Email Address
              </label>
              <div className="mt-1">
                <input
                  id="studentEmail"
                  name="studentEmail"
                  type="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="newParentEmail" className="block text-sm font-medium text-gray-700">
                New Parent Email Address
              </label>
              <div className="mt-1">
                <input
                  id="newParentEmail"
                  name="newParentEmail"
                  type="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={newParentEmail}
                  onChange={(e) => setNewParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="securityCode" className="block text-sm font-medium text-gray-700">
                Security Code
              </label>
              <div className="mt-1">
                <input
                  id="securityCode"
                  name="securityCode"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  placeholder="Enter the code from the administrator"
                />
              </div>
              
              <div className="mt-2 text-right">
                <a
                  href={`https://wa.me/${adminWhatsApp.replace(/[^0-9]/g, '')}?text=Hi%2C%20I%20am%20trying%20to%20update%20my%20parent%20email%20on%20Dr%20U%20Education.%20Could%20I%20please%20get%20the%20Security%20Code%3F`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-green-600 hover:text-green-500 flex items-center justify-end"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Don't have the code? Ask via WhatsApp
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {loading ? 'Updating...' : 'Update Parent Email'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
