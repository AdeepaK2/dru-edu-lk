import { useState } from 'react';
import { PublicationImageService } from '@/apiservices/publicationImageService';
import { auth } from '@/utils/firebase-client';

// Types for the publication image upload hook
interface PublicationUploadOptions {
  type: 'cover' | 'gallery';
  publicationId: string;
}

interface PublicationUploadResult {
  imageUrl: string;
  error: string | null;
}

/**
 * Custom hook for handling image uploads for publications
 */
export const usePublicationImageUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload an image with progress tracking using Firebase Storage directly
   * 
   * @param file File to upload
   * @param options Upload options (type and publicationId)
   * @returns Promise with the upload result
   */
  const uploadImage = async (file: File, options: PublicationUploadOptions): Promise<PublicationUploadResult> => {
    console.log('🔍 Starting publication image upload:', { file: file.name, size: file.size, type: options.type });
    
    // Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('❌ User not authenticated');
      return { imageUrl: '', error: 'User not authenticated. Please log in again.' };
    }
    
    console.log('✅ User authenticated:', currentUser.uid);
    
    // Ensure we have the latest token with admin claims
    try {
      const idTokenResult = await currentUser.getIdTokenResult(true); // Force refresh
      if (!idTokenResult.claims.admin) {
        console.error('❌ User does not have admin privileges');
        return { imageUrl: '', error: 'Admin privileges required to upload publication images.' };
      }
      console.log('✅ Admin privileges verified');
    } catch (tokenError) {
      console.error('❌ Error verifying admin token:', tokenError);
      return { imageUrl: '', error: 'Failed to verify admin privileges. Please log in again.' };
    }
    
    // Validate file
    const validation = PublicationImageService.validateImageFile(file);
    if (!validation.isValid) {
      return { imageUrl: '', error: validation.error || 'Invalid file' };
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      let downloadURL: string;

      console.log('🔍 Uploading to PublicationImageService with options:', options);

      // Use PublicationImageService to upload directly to Firebase Storage
      if (options.type === 'cover') {
        downloadURL = await PublicationImageService.uploadCoverImage(file, options.publicationId, setProgress);
      } else if (options.type === 'gallery') {
        downloadURL = await PublicationImageService.uploadGalleryImage(file, options.publicationId, setProgress);
      } else {
        throw new Error('Invalid upload type');
      }

      console.log('✅ Publication image uploaded successfully:', downloadURL);
      setIsUploading(false);
      setProgress(100);
      
      return { imageUrl: downloadURL, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown upload error';
      console.error('❌ Publication image upload error:', err);
      console.error('Error details:', { message: errorMessage, error: err });
      
      setError(errorMessage);
      setIsUploading(false);
      
      return { imageUrl: '', error: errorMessage };
    }
  };

  /**
   * Upload multiple images for gallery
   * 
   * @param files Array of files to upload
   * @param publicationId The publication ID
   * @returns Promise with array of upload results
   */
  const uploadMultipleImages = async (files: File[], publicationId: string): Promise<PublicationUploadResult[]> => {
    const results: PublicationUploadResult[] = [];
    
    for (const file of files) {
      const result = await uploadImage(file, { type: 'gallery', publicationId });
      results.push(result);
    }
    
    return results;
  };

  /**
   * Delete an image from storage
   * 
   * @param imageUrl The URL of the image to delete
   * @returns Promise that resolves when deletion is complete
   */
  const deleteImage = async (imageUrl: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await PublicationImageService.deleteImage(imageUrl);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown delete error';
      console.error('❌ Image delete error:', err);
      return { success: false, error: errorMessage };
    }
  };

  return {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    isUploading,
    progress,
    error,
    resetState: () => {
      setIsUploading(false);
      setProgress(0);
      setError(null);
    },
    validateFile: PublicationImageService.validateImageFile,
    createPreviewUrl: PublicationImageService.createPreviewUrl,
    revokePreviewUrl: PublicationImageService.revokePreviewUrl
  };
};
