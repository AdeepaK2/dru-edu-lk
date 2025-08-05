import { storage, auth } from '@/utils/firebase-client';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export class TeacherImageService {
  /**
   * Upload teacher profile image to Firebase Storage
   */
  static async uploadProfileImage(
    file: File, 
    teacherId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image file size must be less than 10MB');
      }

      // Check if user is authenticated
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('You must be logged in to upload a profile image');
      }

      console.log('Current user:', currentUser.uid);
      console.log('Teacher ID:', teacherId);

      // Force token refresh to ensure we have the latest claims and a fresh token
      try {
        console.log('🔄 Refreshing authentication token for profile image upload...');
        await currentUser.getIdToken(true); // Force refresh
        console.log('✅ Authentication token refreshed successfully');
        
        // Verify user has teacher role claims
        const tokenResult = await currentUser.getIdTokenResult();
        console.log('🔑 User claims for profile upload:', tokenResult.claims);
        
        if (!tokenResult.claims.teacher && tokenResult.claims.role !== 'teacher') {
          throw new Error('Access denied. Teacher permissions required for profile image upload.');
        }
        
        console.log('✅ Teacher role verified for profile upload');
      } catch (error) {
        console.error('❌ Error refreshing token or checking claims for profile upload:', error);
        throw new Error('Authentication error. Please log in again.');
      }

      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `profile_${teacherId}_${timestamp}.${fileExtension}`;
      
      console.log('Uploading to path:', `teacher-profiles/images/${fileName}`);
      
      // Create storage reference
      const storageRef = ref(storage, `teacher-profiles/images/${fileName}`);
      
      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Track upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(Math.round(progress));
            }
          },
          (error) => {
            console.error('Error uploading profile image:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let errorMessage = 'Upload failed';
            if (error.code === 'storage/unauthorized') {
              errorMessage = 'You do not have permission to upload images. Please make sure you are logged in as a teacher.';
            } else if (error.code === 'storage/quota-exceeded') {
              errorMessage = 'Storage quota exceeded. Please contact support.';
            } else if (error.code === 'storage/invalid-format') {
              errorMessage = 'Invalid file format. Please use JPG, PNG, or GIF images.';
            } else if (error.code === 'storage/unknown') {
              // Check if it's a 412 error (common with auth issues)
              if (error.message.includes('412')) {
                errorMessage = 'Upload failed: Authentication issue. Please refresh the page and try again.';
              } else {
                errorMessage = 'Upload failed: Unknown storage error. Please try again or contact support.';
              }
            } else {
              errorMessage = `Upload failed: ${error.message}`;
            }
            
            reject(new Error(errorMessage));
          },
          async () => {
            try {
              // Get download URL when upload is complete
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Profile image uploaded successfully:', downloadURL);
              resolve(downloadURL);
            } catch (error) {
              console.error('Error getting download URL:', error);
              reject(new Error('Failed to get image URL'));
            }
          }
        );
      });
    } catch (error: any) {
      console.error('Error in uploadProfileImage:', error);
      throw error;
    }
  }

  /**
   * Delete teacher profile image from Firebase Storage
   */
  static async deleteProfileImage(imageUrl: string): Promise<void> {
    try {
      if (!imageUrl || !imageUrl.includes('firebase')) {
        // Not a Firebase Storage URL, skip deletion
        return;
      }

      // Extract the file path from the URL
      const urlParts = imageUrl.split('/');
      const tokenIndex = urlParts.findIndex(part => part.includes('token='));
      
      if (tokenIndex === -1) {
        throw new Error('Invalid Firebase Storage URL');
      }

      // Extract the file path
      const pathPart = urlParts[tokenIndex - 1];
      const decodedPath = decodeURIComponent(pathPart);
      
      // Create storage reference and delete
      const storageRef = ref(storage, decodedPath);
      await deleteObject(storageRef);
      
      console.log('Profile image deleted successfully');
    } catch (error: any) {
      console.error('Error deleting profile image:', error);
      // Don't throw error for deletion failures to avoid blocking profile updates
      console.warn('Profile image deletion failed, continuing with profile update');
    }
  }

  /**
   * Validate image file before upload
   */
  static validateImageFile(file: File): string | null {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file (JPG, PNG, GIF, etc.)';
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return 'Image file size must be less than 10MB';
    }

    // Check for common image formats
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return 'Only JPG, PNG, GIF, and WebP images are supported';
    }

    return null; // No validation errors
  }

  /**
   * Generate optimized image dimensions for profile photos
   */
  static getOptimalImageDimensions(): { width: number; height: number } {
    return {
      width: 400,  // Max width for profile photos
      height: 400  // Max height for profile photos (square aspect ratio)
    };
  }

  /**
   * Create a preview URL for the selected image file
   */
  static createImagePreview(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Revoke the preview URL to free up memory
   */
  static revokeImagePreview(previewUrl: string): void {
    URL.revokeObjectURL(previewUrl);
  }
}

export default TeacherImageService;
