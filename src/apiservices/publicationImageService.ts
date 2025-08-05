import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from '@/utils/firebase-client';

// Constants for storage paths
const PUBLICATION_IMAGES_PATH = 'publications/covers';
const PUBLICATION_GALLERY_PATH = 'publications/gallery';

export class PublicationImageService {
  /**
   * Upload a publication cover image to Firebase Storage
   * @param file The image file to upload
   * @param publicationId The ID of the publication
   * @param onProgress Optional callback for upload progress
   * @returns Promise resolving to the download URL
   */
  static async uploadCoverImage(file: File, publicationId: string, onProgress?: (progress: number) => void): Promise<string> {
    return this.uploadImage(file, `${PUBLICATION_IMAGES_PATH}/${publicationId}`, onProgress);
  }

  /**
   * Upload a publication gallery image to Firebase Storage
   * @param file The image file to upload
   * @param publicationId The ID of the publication
   * @param onProgress Optional callback for upload progress
   * @returns Promise resolving to the download URL
   */
  static async uploadGalleryImage(file: File, publicationId: string, onProgress?: (progress: number) => void): Promise<string> {
    const timestamp = Date.now();
    return this.uploadImage(file, `${PUBLICATION_GALLERY_PATH}/${publicationId}`, onProgress, `image_${timestamp}`);
  }

  /**
   * Delete an image from Firebase Storage
   * @param imageUrl The URL of the image to delete
   * @returns Promise that resolves when deletion is complete
   */
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract the path from the download URL
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      
      if (!pathMatch) {
        throw new Error('Invalid image URL format');
      }
      
      const fullPath = decodeURIComponent(pathMatch[1]);
      const imageRef = ref(storage, fullPath);
      
      await deleteObject(imageRef);
      console.log('Image deleted successfully:', fullPath);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private method to handle the actual upload process
   * @param file The file to upload
   * @param basePath The base storage path
   * @param onProgress Optional progress callback
   * @param customFileName Optional custom file name
   * @returns Promise resolving to the download URL
   */
  private static async uploadImage(
    file: File, 
    basePath: string, 
    onProgress?: (progress: number) => void,
    customFileName?: string
  ): Promise<string> {
    try {
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }

      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('File size must be less than 10MB');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = customFileName || `${timestamp}_${randomId}.${fileExtension}`;
      
      // Create storage reference
      const storageRef = ref(storage, `${basePath}/${fileName}`);
      
      // Start upload
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Progress monitoring
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(Math.round(progress));
            }
            console.log(`Upload progress: ${progress}%`);
          },
          (error) => {
            // Handle upload errors
            console.error('Upload error:', error);
            reject(new Error(`Upload failed: ${error.message}`));
          },
          async () => {
            // Upload completed successfully
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Image uploaded successfully:', downloadURL);
              resolve(downloadURL);
            } catch (error) {
              console.error('Error getting download URL:', error);
              reject(new Error(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate image file
   * @param file The file to validate
   * @returns Object with isValid boolean and error message if invalid
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (!file.type.startsWith('image/')) {
      return { isValid: false, error: 'File must be an image' };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 10MB' };
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'File type must be JPEG, PNG, GIF, or WebP' };
    }

    return { isValid: true };
  }

  /**
   * Generate a temporary preview URL for a file
   * @param file The file to create a preview for
   * @returns Object URL for preview
   */
  static createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Revoke a preview URL to free up memory
   * @param url The object URL to revoke
   */
  static revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
