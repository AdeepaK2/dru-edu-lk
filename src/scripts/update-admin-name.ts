/**
 * One-time script to update Firebase Auth display name
 * Run this in the browser console or as a temporary component
 */

import { updateProfile } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';

export const updateAdminDisplayName = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      console.error('No user is currently signed in');
      return false;
    }

    console.log('Current display name:', user.displayName);
    
    await updateProfile(user, {
      displayName: 'Dr U Admin'
    });
    
    console.log('Display name updated successfully to: Dr U Admin');
    
    // Force refresh the user to get updated profile
    await user.reload();
    
    console.log('New display name:', auth.currentUser?.displayName);
    return true;
    
  } catch (error) {
    console.error('Error updating display name:', error);
    return false;
  }
};

// For browser console usage
if (typeof window !== 'undefined') {
  (window as any).updateAdminDisplayName = updateAdminDisplayName;
}