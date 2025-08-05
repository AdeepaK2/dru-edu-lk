import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  Timestamp,
  DocumentData,
  QuerySnapshot,
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { firestore, storage } from '@/utils/firebase-client';
import { VideoData, VideoDocument, VideoUpdateData, videoSchema } from '@/models/videoSchema';

const COLLECTION_NAME = 'videos';

export class VideoFirestoreService {
  private static collectionRef = collection(firestore, COLLECTION_NAME);

  /**
   * Generate a unique video ID
   */
  private static async generateVideoId(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      
      // Get the latest video ID to determine the next sequence number
      const q = query(
        this.collectionRef, 
        where('videoId', '>=', `VID-${year}`),
        where('videoId', '<', `VID-${year+1}`),
        orderBy('videoId', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // First video of the year
        return `VID-${year}-001`;
      } else {
        // Extract the sequence number from the last video ID
        const lastId = querySnapshot.docs[0].data().videoId;
        const matches = lastId.match(/VID-\d{4}-(\d{3})/);
        
        if (matches && matches[1]) {
          const sequence = parseInt(matches[1], 10) + 1;
          return `VID-${year}-${sequence.toString().padStart(3, '0')}`;
        } else {
          return `VID-${year}-001`;
        }
      }
    } catch (error) {
      console.error('Error generating video ID:', error);
      const year = new Date().getFullYear();
      // Fallback with timestamp to ensure uniqueness
      const timestamp = Date.now();
      return `VID-${year}-${timestamp}`;
    }
  }

  /**
   * Upload video file to Firebase Storage
   */
  static async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `videos/${fileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(`Upload failed: ${error.message}`);
          },
          async () => {
            try {
              // Upload completed successfully, get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload thumbnail to Firebase Storage
   */
  static async uploadThumbnail(file: File): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `thumbnail_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `thumbnails/${fileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => {
            console.error('Thumbnail upload error:', error);
            reject(`Thumbnail upload failed: ${error.message}`);
          },
          async () => {
            try {
              // Upload completed successfully, get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(`Failed to get thumbnail download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      throw new Error(`Failed to upload thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new video
   */
  static async createVideo(videoData: VideoData, userId: string): Promise<string> {
    try {
      // Validate the data
      const validatedData = videoSchema.parse(videoData);
      
      // Generate auto video ID
      const videoId = await this.generateVideoId();
      
      // Prepare the document data, filtering out undefined values
      const documentData: any = {
        title: validatedData.title,
        description: validatedData.description,
        videoUrl: validatedData.videoUrl,
        subjectId: validatedData.subjectId,
        visibility: validatedData.visibility,
        videoId,
        status: 'active' as const,
        views: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId,
      };

      // Only add optional fields if they have values
      if (validatedData.thumbnailUrl && validatedData.thumbnailUrl.trim()) {
        documentData.thumbnailUrl = validatedData.thumbnailUrl;
      }
      
      if (validatedData.subjectName && validatedData.subjectName.trim()) {
        documentData.subjectName = validatedData.subjectName;
      }
      
      if (validatedData.lessonId && validatedData.lessonId.trim()) {
        documentData.lessonId = validatedData.lessonId;
      }
      
      if (validatedData.lessonName && validatedData.lessonName.trim()) {
        documentData.lessonName = validatedData.lessonName;
      }
      
      if (validatedData.assignedClassIds && validatedData.assignedClassIds.length > 0) {
        documentData.assignedClassIds = validatedData.assignedClassIds;
      }
      
      if (validatedData.assignedStudentIds && validatedData.assignedStudentIds.length > 0) {
        documentData.assignedStudentIds = validatedData.assignedStudentIds;
      }
      
      if (validatedData.tags && validatedData.tags.length > 0) {
        documentData.tags = validatedData.tags;
      }
      
      if (validatedData.teacherId && validatedData.teacherId.trim()) {
        documentData.teacherId = validatedData.teacherId;
      }
      
      if (validatedData.price !== undefined && validatedData.price >= 0) {
        documentData.price = validatedData.price;
      }
      
      const docRef = await addDoc(this.collectionRef, documentData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating video:', error);
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Get all videos
   */  static async getAllVideos(): Promise<VideoDocument[]> {
    try {
      const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
        const videos = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as VideoDocument;
      });
      
      return videos;
    } catch (error) {
      console.error('Error fetching videos:', error);
      throw new Error(`Failed to fetch videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get videos by class IDs
   */  static async getVideosByClass(classId: string): Promise<VideoDocument[]> {
    try {
      console.log('Fetching videos for class ID:', classId);
      
      // Get all videos and filter client-side (same as main page)
      const allVideos = await this.getAllVideos();
      console.log('Total videos found:', allVideos.length);
      
      const classVideos = allVideos.filter(video => {
        const hasClass = video.assignedClassIds?.includes(classId);
        if (hasClass) {
          console.log('Video assigned to class:', video.title, video.assignedClassIds);
        }
        return hasClass;
      });
      
      console.log('Videos filtered for class:', classVideos.length);
      return classVideos;
    } catch (error) {
      console.error(`Error fetching videos for class ${classId}:`, error);
      throw new Error(`Failed to fetch videos for class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get videos assigned to a specific student
   */
  static async getVideosByStudent(studentId: string): Promise<VideoDocument[]> {
    try {
      console.log('Fetching videos for student ID:', studentId);
      
      // Get all videos and filter client-side
      const allVideos = await this.getAllVideos();
      console.log('Total videos found:', allVideos.length);
      
      const studentVideos = allVideos.filter(video => {
        const hasStudent = video.assignedStudentIds?.includes(studentId);
        if (hasStudent) {
          console.log('Video assigned to student:', video.title, video.assignedStudentIds);
        }
        return hasStudent;
      });
      
      console.log('Videos filtered for student:', studentVideos.length);
      return studentVideos;
    } catch (error) {
      console.error(`Error fetching videos for student ${studentId}:`, error);
      throw new Error(`Failed to fetch videos for student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a video by ID
   */
  static async getVideoById(videoId: string): Promise<VideoDocument | null> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, videoId);
      const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as VideoDocument;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching video:', error);
      throw new Error(`Failed to fetch video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update video
   */
  static async updateVideo(videoId: string, updateData: Partial<VideoData>): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, videoId);
      
      const updatePayload = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, updatePayload);
      console.log('Video updated successfully');
    } catch (error) {
      console.error('Error updating video:', error);
      throw new Error(`Failed to update video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assign video to classes
   */
  static async assignToClasses(videoId: string, classIds: string[]): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, videoId);
      
      await updateDoc(docRef, {
        assignedClassIds: classIds,
        updatedAt: Timestamp.now(),
      });
      console.log('Video assigned to classes successfully');
    } catch (error) {
      console.error('Error assigning video to classes:', error);
      throw new Error(`Failed to assign video to classes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Increment view count
   */
  static async incrementViewCount(videoId: string): Promise<void> {
    try {
      const docRef = doc(firestore, COLLECTION_NAME, videoId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentViews = docSnap.data().views || 0;
        
        await updateDoc(docRef, {
          views: currentViews + 1,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Error incrementing view count:', error);
      // Don't throw here to prevent breaking the user experience
    }
  }

  /**
   * Delete video
   */
  static async deleteVideo(videoId: string): Promise<void> {
    try {
      // First get the video to delete its storage files
      const video = await this.getVideoById(videoId);
      
      if (video) {
        // Delete from Firestore
        const docRef = doc(firestore, COLLECTION_NAME, videoId);
        await deleteDoc(docRef);
        
        // Delete video file from Storage if URL exists
        if (video.videoUrl) {
          try {
            const videoRef = ref(storage, video.videoUrl);
            await deleteObject(videoRef);
          } catch (storageError) {
            console.warn('Could not delete video file:', storageError);
          }
        }
        
        // Delete thumbnail from Storage if URL exists
        if (video.thumbnailUrl) {
          try {
            const thumbnailRef = ref(storage, video.thumbnailUrl);
            await deleteObject(thumbnailRef);
          } catch (storageError) {
            console.warn('Could not delete thumbnail file:', storageError);
          }
        }
        
        console.log('Video deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      throw new Error(`Failed to delete video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to videos for real-time updates
   */
  static subscribeToVideos(
    onSuccess: (videos: VideoDocument[]) => void,
    onError: (error: Error) => void
  ): () => void {
    try {
      const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {          const videos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as VideoDocument));
          
          onSuccess(videos);
        },
        (error) => {
          console.error('Real-time subscription error:', error);
          onError(new Error(`Real-time subscription failed: ${error.message}`));
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      onError(new Error(`Failed to setup subscription: ${error instanceof Error ? error.message : 'Unknown error'}`));
      // Return a no-op function as fallback
      return () => {};
    }
  }

  /**
   * Search videos by title, description or tags
   */
  static async searchVideos(searchTerm: string): Promise<VideoDocument[]> {
    try {
      // Firebase doesn't support full text search, so we'll fetch all and filter
      // In a real production app, you would use Algolia, Elasticsearch, or Firebase Extensions
      const allVideos = await this.getAllVideos();
      
      const searchTermLower = searchTerm.toLowerCase();
      
      return allVideos.filter(video => {
        const titleMatch = video.title.toLowerCase().includes(searchTermLower);
        const descriptionMatch = video.description.toLowerCase().includes(searchTermLower);
        const tagMatch = video.tags?.some(tag => tag.toLowerCase().includes(searchTermLower));
        
        return titleMatch || descriptionMatch || tagMatch;
      });
    } catch (error) {
      console.error('Error searching videos:', error);
      throw new Error(`Failed to search videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get videos by teacher ID (no index required)
   */
  static async getVideosByTeacher(teacherId: string): Promise<VideoDocument[]> {
    try {
      // Simple query with only where clause to avoid composite index
      const querySnapshot = await getDocs(
        query(this.collectionRef, where('teacherId', '==', teacherId))
      );
      
      const videos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VideoDocument));
      
      // Sort by creation date in JavaScript (newest first)
      return videos.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('Error fetching videos by teacher:', error);
      throw new Error(`Failed to fetch videos by teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get videos by subject ID
   */
  static async getVideosBySubject(subjectId: string): Promise<VideoDocument[]> {
    try {
      const querySnapshot = await getDocs(
        query(this.collectionRef, where('subjectId', '==', subjectId))
      );
      
      const videos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VideoDocument));
      
      // Sort by creation date in JavaScript (newest first)
      return videos.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('Error fetching videos by subject:', error);
      throw new Error(`Failed to fetch videos by subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get videos by teacher and subject
   */
  static async getVideosByTeacherAndSubject(teacherId: string, subjectId: string): Promise<VideoDocument[]> {
    try {
      const querySnapshot = await getDocs(
        query(
          this.collectionRef, 
          where('teacherId', '==', teacherId),
          where('subjectId', '==', subjectId)
        )
      );
      
      const videos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VideoDocument));
      
      // Sort by creation date in JavaScript (newest first)
      return videos.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('Error fetching videos by teacher and subject:', error);
      throw new Error(`Failed to fetch videos by teacher and subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}
