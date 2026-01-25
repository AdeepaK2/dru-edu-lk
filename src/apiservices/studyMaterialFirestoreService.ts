import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore as db } from '@/utils/firebase-client';
import { 
  StudyMaterialDocument, 
  StudyMaterialData, 
  StudyMaterialUpdateData,
  StudyMaterialDisplayData,
  formatFileSize,
  formatDuration,
  getRelativeTime
} from '@/models/studyMaterialSchema';

// Collection name
export const COLLECTION_NAME = 'studyMaterials';

// Get collection reference
const getStudyMaterialsCollection = () => collection(db, COLLECTION_NAME);

// Convert Firestore document to StudyMaterialDocument
const convertDocumentToStudyMaterial = (doc: any): StudyMaterialDocument => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    uploadedAt: data.uploadedAt?.toDate() || new Date(),
    dueDate: data.dueDate?.toDate() || null,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
};

// Convert StudyMaterialData to Firestore document
const convertStudyMaterialToDocument = (material: StudyMaterialData) => {
  // Filter out undefined values to avoid Firestore errors
  const filteredData: any = {};
  
  Object.entries(material).forEach(([key, value]) => {
    if (value !== undefined) {
      filteredData[key] = value;
    }
  });

  return {
    ...filteredData,
    uploadedAt: filteredData.uploadedAt ? Timestamp.fromDate(filteredData.uploadedAt) : Timestamp.now(),
    dueDate: filteredData.dueDate ? Timestamp.fromDate(filteredData.dueDate) : null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
};

// Create a new study material
export const createStudyMaterial = async (materialData: StudyMaterialData): Promise<StudyMaterialDocument> => {
  try {
    const docData = convertStudyMaterialToDocument(materialData);
    const docRef = await addDoc(getStudyMaterialsCollection(), docData);
    
    const createdDoc = await getDoc(docRef);
    if (!createdDoc.exists()) {
      throw new Error('Failed to create study material');
    }

    return convertDocumentToStudyMaterial(createdDoc);
  } catch (error) {
    console.error('Error creating study material:', error);
    throw error;
  }
};

// Get study material by ID
export const getStudyMaterialById = async (id: string): Promise<StudyMaterialDocument | null> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    return convertDocumentToStudyMaterial(docSnap);
  } catch (error) {
    console.error('Error getting study material:', error);
    throw error;
  }
};

// Get all study materials for a class
export const getStudyMaterialsByClass = async (classId: string): Promise<StudyMaterialDocument[]> => {
  try {
    const q = query(
      getStudyMaterialsCollection(),
      where('classId', '==', classId),
      where('isVisible', '==', true),
      orderBy('week', 'asc'),
      orderBy('order', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertDocumentToStudyMaterial);
  } catch (error) {
    console.error('Error getting study materials by class:', error);
    throw error;
  }
};

// Get study materials by class and week
export const getStudyMaterialsByWeek = async (classId: string, week: number, year: number): Promise<StudyMaterialDocument[]> => {
  try {
    const q = query(
      getStudyMaterialsCollection(),
      where('classId', '==', classId),
      where('week', '==', week),
      where('year', '==', year),
      where('isVisible', '==', true),
      orderBy('order', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertDocumentToStudyMaterial);
  } catch (error) {
    console.error('Error getting study materials by week:', error);
    throw error;
  }
};

// Get study materials by lesson
export const getStudyMaterialsByLesson = async (lessonId: string): Promise<StudyMaterialDocument[]> => {
  try {
    const q = query(
      getStudyMaterialsCollection(),
      where('lessonId', '==', lessonId),
      where('isVisible', '==', true),
      orderBy('order', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertDocumentToStudyMaterial);
  } catch (error) {
    console.error('Error getting study materials by lesson:', error);
    throw error;
  }
};

// Update study material
export const updateStudyMaterial = async (
  id: string, 
  updateData: StudyMaterialUpdateData
): Promise<StudyMaterialDocument> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), id);
    
    const updateFields = {
      ...updateData,
      updatedAt: Timestamp.now(),
      ...(updateData.dueDate && { dueDate: Timestamp.fromDate(updateData.dueDate) }),
    };

    await updateDoc(docRef, updateFields);
    
    const updatedDocSnapshot = await getDoc(docRef);
    if (!updatedDocSnapshot.exists()) {
      throw new Error('Study material not found');
    }

    return convertDocumentToStudyMaterial(updatedDocSnapshot);
  } catch (error) {
    console.error('Error updating study material:', error);
    throw error;
  }
};

// Delete study material
export const deleteStudyMaterial = async (id: string): Promise<void> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting study material:', error);
    throw error;
  }
};

// Mark material as completed by student
export const markMaterialCompleted = async (materialId: string, studentId: string): Promise<void> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), materialId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Study material not found');
    }

    const currentData = docSnap.data();
    const completedBy = currentData.completedBy || [];
    
    if (!completedBy.includes(studentId)) {
      completedBy.push(studentId);
      await updateDoc(docRef, { 
        completedBy,
        updatedAt: Timestamp.now()
      });
    }
  } catch (error) {
    console.error('Error marking material as completed:', error);
    throw error;
  }
};

// Unmark material as completed by student
export const unmarkMaterialCompleted = async (materialId: string, studentId: string): Promise<void> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), materialId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Study material not found');
    }

    const currentData = docSnap.data();
    const completedBy = currentData.completedBy || [];
    
    const updatedCompletedBy = completedBy.filter((id: string) => id !== studentId);
    await updateDoc(docRef, { 
      completedBy: updatedCompletedBy,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error unmarking material as completed:', error);
    throw error;
  }
};

// Increment download count
export const incrementDownloadCount = async (materialId: string): Promise<void> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), materialId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Study material not found');
    }

    const currentData = docSnap.data();
    const newCount = (currentData.downloadCount || 0) + 1;
    
    await updateDoc(docRef, { 
      downloadCount: newCount,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error incrementing download count:', error);
    throw error;
  }
};

// Increment view count
export const incrementViewCount = async (materialId: string): Promise<void> => {
  try {
    const docRef = doc(getStudyMaterialsCollection(), materialId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Study material not found');
    }

    const currentData = docSnap.data();
    const newCount = (currentData.viewCount || 0) + 1;
    
    await updateDoc(docRef, { 
      viewCount: newCount,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    throw error;
  }
};

// Get study materials grouped by weeks for a class
export const getStudyMaterialsByClassGroupedByWeek = async (classId: string, year: number) => {
  try {
    const q = query(
      getStudyMaterialsCollection(),
      where('classId', '==', classId),
      where('year', '==', year),
      where('isVisible', '==', true),
      orderBy('week', 'asc'),
      orderBy('order', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const materials = querySnapshot.docs.map(convertDocumentToStudyMaterial);

    // Group materials by week
    const weekGroups: { [key: number]: StudyMaterialDocument[] } = {};
    
    materials.forEach(material => {
      if (!weekGroups[material.week]) {
        weekGroups[material.week] = [];
      }
      weekGroups[material.week].push(material);
    });

    // Convert to array with week information
    return Object.entries(weekGroups).map(([week, weekMaterials]) => ({
      week: parseInt(week),
      weekTitle: weekMaterials[0]?.weekTitle || `Week ${week}`,
      materials: weekMaterials,
      stats: {
        totalMaterials: weekMaterials.length,
        requiredMaterials: weekMaterials.filter(m => m.isRequired).length,
        averageCompletion: weekMaterials.length > 0 
          ? Math.round((weekMaterials.reduce((sum, m) => sum + (m.completedBy?.length || 0), 0) / weekMaterials.length))
          : 0
      }
    }));
  } catch (error) {
    console.error('Error getting study materials grouped by week:', error);
    throw error;
  }
};

// Convert to display data with additional formatting
export const convertToDisplayData = (
  material: StudyMaterialDocument,
  lessonName?: string,
  uploaderName?: string,
  studentId?: string
): StudyMaterialDisplayData => {
  return {
    ...material,
    lessonName,
    uploaderName,
    isCompleted: studentId ? (material.completedBy?.includes(studentId) || false) : undefined,
    completionPercentage: material.completedBy?.length || 0,
    formattedFileSize: formatFileSize(material.fileSize),
    formattedDuration: formatDuration(material.duration),
    relativeUploadTime: getRelativeTime(material.uploadedAt instanceof Date ? material.uploadedAt : material.uploadedAt.toDate()),
  };
};

// Get study materials grouped by lesson for a class
export const getStudyMaterialsByClassGroupedByLesson = async (
  classId: string, 
  year: number = new Date().getFullYear()
): Promise<any[]> => {
  try {
    console.log('📚 Getting study materials by lesson for class:', classId, 'year:', year);
    
    const studyMaterialsRef = getStudyMaterialsCollection();
    
    // First try with composite index
    try {
      const q = query(
        studyMaterialsRef,
        where('classId', '==', classId),
        where('year', '==', year),
        where('isVisible', '==', true),
        orderBy('lessonId'),
        orderBy('order', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const materials = querySnapshot.docs.map(doc => convertDocumentToStudyMaterial(doc));
      
      console.log('📊 Found', materials.length, 'materials for class');
      
      // Group materials by lesson
      const groupedByLesson = materials.reduce((acc: any, material: any) => {
        const lessonId = material.lessonId || 'unassigned';
        
        if (!acc[lessonId]) {
          acc[lessonId] = {
            lessonId,
            lessonName: material.lessonName || 'General Materials',
            materials: [],
            stats: {
              totalMaterials: 0,
              requiredMaterials: 0,
              averageCompletion: 0
            }
          };
        }
        
        acc[lessonId].materials.push({
          ...material,
          formattedFileSize: formatFileSize(material.fileSize),
          formattedDuration: material.duration ? formatDuration(material.duration) : null,
          relativeUploadTime: getRelativeTime(material.uploadedAt)
        });
        
        acc[lessonId].stats.totalMaterials++;
        if (material.isRequired) {
          acc[lessonId].stats.requiredMaterials++;
        }
        
        // Calculate completion percentage (mock data for now)
        acc[lessonId].stats.averageCompletion = 0; // TODO: Calculate real completion percentage
        
        return acc;
      }, {});
      
      // Convert to array and sort
      const result = Object.values(groupedByLesson).sort((a: any, b: any) => {
        if (a.lessonId === 'unassigned') return -1; // Put unassigned at the top
        if (b.lessonId === 'unassigned') return 1;
        return 0; // Maintain order based on lesson order when we have lesson data
      });
      
      console.log('✅ Grouped materials by lesson:', result.length, 'lessons');
      return result;
      
    } catch (error: any) {
      console.warn('⚠️ Composite index query failed, trying fallback:', error.message);
      
      // Fallback query without composite index
      const fallbackQuery = query(
        studyMaterialsRef,
        where('classId', '==', classId),
        where('year', '==', year)
      );
      
      const querySnapshot = await getDocs(fallbackQuery);
      const materials = querySnapshot.docs
        .map(doc => convertDocumentToStudyMaterial(doc))
        .filter(material => material.isVisible)
        .sort((a, b) => {
          const lessonCompare = (a.lessonId || '').localeCompare(b.lessonId || '');
          if (lessonCompare !== 0) return lessonCompare;
          return a.order - b.order;
        });
      
      console.log('📊 Fallback found', materials.length, 'materials');
      
      // Group by lesson (same logic as above)
      const groupedByLesson = materials.reduce((acc: any, material: any) => {
        const lessonId = material.lessonId || 'unassigned';
        
        if (!acc[lessonId]) {
          acc[lessonId] = {
            lessonId,
            lessonName: material.lessonName || 'General Materials',
            materials: [],
            stats: {
              totalMaterials: 0,
              requiredMaterials: 0,
              averageCompletion: 0
            }
          };
        }
        
        acc[lessonId].materials.push({
          ...material,
          formattedFileSize: formatFileSize(material.fileSize),
          formattedDuration: material.duration ? formatDuration(material.duration) : null,
          relativeUploadTime: getRelativeTime(material.uploadedAt)
        });
        
        acc[lessonId].stats.totalMaterials++;
        if (material.isRequired) {
          acc[lessonId].stats.requiredMaterials++;
        }
        
        acc[lessonId].stats.averageCompletion = 0; // TODO: Calculate real completion percentage
        
        return acc;
      }, {});
      
      const result = Object.values(groupedByLesson).sort((a: any, b: any) => {
        if (a.lessonId === 'unassigned') return 1;
        if (b.lessonId === 'unassigned') return -1;
        return 0;
      });
      
      console.log('✅ Fallback grouped materials by lesson:', result.length, 'lessons');
      return result;
    }
    
  } catch (error) {
    console.error('❌ Error getting study materials by lesson:', error);
    throw error;
  }
};

// Get study materials grouped by upload batch (for Google Classroom-like display)
export const getStudyMaterialsByClassGrouped = async (classId: string): Promise<any[]> => {
  try {
    const q = query(
      getStudyMaterialsCollection(),
      where('classId', '==', classId),
      where('isVisible', '==', true),
      orderBy('uploadedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const materials = querySnapshot.docs.map(convertDocumentToStudyMaterial);

    // Group materials by groupId or treat singles as their own groups
    const groupedMaterials: { [key: string]: any } = {};

    materials.forEach(material => {
      const groupKey = material.groupId || `single_${material.id}`;
      
      if (!groupedMaterials[groupKey]) {
        groupedMaterials[groupKey] = {
          id: groupKey,
          groupId: material.groupId,
          groupTitle: material.groupTitle || material.title,
          isGroup: !!material.groupId,
          uploadedAt: material.uploadedAt,
          lessonId: material.lessonId,
          lessonName: material.lessonName,
          isRequired: material.isRequired,
          materials: [],
          totalFiles: 0,
          fileTypes: new Set(),
          completedBy: new Set(),
          totalDownloads: 0,
          totalViews: 0
        };
      }

      groupedMaterials[groupKey].materials.push(material);
      groupedMaterials[groupKey].totalFiles++;
      groupedMaterials[groupKey].fileTypes.add(material.fileType);
      groupedMaterials[groupKey].totalDownloads += material.downloadCount || 0;
      groupedMaterials[groupKey].totalViews += material.viewCount || 0;

      // Merge completion data
      if (material.completedBy) {
        material.completedBy.forEach(studentId => {
          groupedMaterials[groupKey].completedBy.add(studentId);
        });
      }

      // Keep the most restrictive requirement setting
      if (material.isRequired) {
        groupedMaterials[groupKey].isRequired = true;
      }
    });

    // Convert sets to arrays and sort by upload date
    return Object.values(groupedMaterials).map((group: any) => ({
      ...group,
      fileTypes: Array.from(group.fileTypes),
      completedBy: Array.from(group.completedBy),
      materials: group.materials.sort((a: any, b: any) => a.order - b.order)
    })).sort((a: any, b: any) => {
      const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : a.uploadedAt.toDate();
      const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : b.uploadedAt.toDate();
      return dateB.getTime() - dateA.getTime();
    });

  } catch (error) {
    console.error('Error getting grouped study materials by class:', error);
    throw error;
  }
};
