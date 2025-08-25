// Teacher Access Bank Firestore Service - manages teacher access to question banks

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore as db } from '@/utils/firebase-client';
import { 
  TeacherAccessBank, 
  TeacherAccessBankRequest, 
  BulkTeacherAccessAssignment 
} from '@/models/teacherAccessBankSchema';

export const teacherAccessBankService = {
  // Get all question banks accessible by a teacher
  async getAccessibleQuestionBanks(teacherId: string): Promise<TeacherAccessBank[]> {
    try {
      console.log('🔍 Getting accessible question banks for teacher:', teacherId);
      
      const q = query(
        collection(db, 'teacherAccessBanks'),
        where('teacherId', '==', teacherId),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const accessBanks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeacherAccessBank[];
      
      // Filter out expired access
      const now = Timestamp.now();
      const validAccessBanks = accessBanks.filter(access => 
        !access.expiresAt || access.expiresAt.seconds > now.seconds
      );
      
      // Sort in memory instead of in query to avoid index requirements
      validAccessBanks.sort((a, b) => {
        // First sort by subject name
        const subjectCompare = a.subjectName.localeCompare(b.subjectName);
        if (subjectCompare !== 0) return subjectCompare;
        
        // Then by question bank name
        return a.questionBankName.localeCompare(b.questionBankName);
      });
      
      console.log('✅ Found accessible question banks:', validAccessBanks.length);
      return validAccessBanks;
    } catch (error) {
      console.error('Error getting accessible question banks:', error);
      throw error;
    }
  },

  // Get all teachers with access to a specific question bank
  async getTeachersWithAccess(questionBankId: string): Promise<TeacherAccessBank[]> {
    try {
      const q = query(
        collection(db, 'teacherAccessBanks'),
        where('questionBankId', '==', questionBankId),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const accessList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeacherAccessBank[];
      
      // Sort in memory instead of in query
      accessList.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
      
      return accessList;
    } catch (error) {
      console.error('Error getting teachers with access:', error);
      throw error;
    }
  },

  // Grant access to a teacher for a question bank
  async grantAccess(
    teacherId: string,
    teacherName: string,
    teacherEmail: string,
    questionBankId: string,
    questionBankName: string,
    subjectId: string,
    subjectName: string,
    accessType: 'read' | 'read_add' | 'write' | 'admin',
    grantedBy: string,
    grantedByName: string,
    expiresAt?: Timestamp,
    notes?: string
  ): Promise<string> {
    try {
      console.log('🔍 Granting access:', { teacherId, questionBankId, accessType });
      
      // Check if access already exists
      const existingAccess = await this.getTeacherAccessToBank(teacherId, questionBankId);
      
      if (existingAccess) {
        // Update existing access
        const accessRef = doc(db, 'teacherAccessBanks', existingAccess.id);
        const updateData: any = {
          accessType,
          grantedBy,
          grantedByName,
          notes,
          isActive: true,
          updatedAt: Timestamp.now()
        };
        
        // Only include expiresAt if it's provided
        if (expiresAt) {
          updateData.expiresAt = expiresAt;
        }
        
        await updateDoc(accessRef, updateData);
        console.log('✅ Updated existing access:', existingAccess.id);
        return existingAccess.id;
      } else {
        // Create new access
        const newAccess: any = {
          teacherId,
          teacherName,
          teacherEmail,
          questionBankId,
          questionBankName,
          subjectId,
          subjectName,
          accessType,
          grantedBy,
          grantedByName,
          grantedAt: Timestamp.now(),
          isActive: true,
          notes,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        // Only include expiresAt if it's provided
        if (expiresAt) {
          newAccess.expiresAt = expiresAt;
        }
        
        const docRef = await addDoc(collection(db, 'teacherAccessBanks'), newAccess);
        console.log('✅ Created new access:', docRef.id);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error granting access:', error);
      throw error;
    }
  },

  // Check if teacher has access to a specific question bank (simple boolean check)
  async hasAccess(teacherId: string, questionBankId: string): Promise<boolean> {
    try {
      const access = await this.getTeacherAccessToBank(teacherId, questionBankId);
      return access !== null;
    } catch (error) {
      console.error('Error checking if teacher has access:', error);
      return false;
    }
  },

  // Check if teacher has access to a specific question bank
  async getTeacherAccessToBank(teacherId: string, questionBankId: string): Promise<TeacherAccessBank | null> {
    try {
      const q = query(
        collection(db, 'teacherAccessBanks'),
        where('teacherId', '==', teacherId),
        where('questionBankId', '==', questionBankId),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      const accessData = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as TeacherAccessBank;
      
      // Check if access is expired
      if (accessData.expiresAt) {
        const now = Timestamp.now();
        if (accessData.expiresAt.seconds <= now.seconds) {
          return null; // Expired access
        }
      }
      
      return accessData;
    } catch (error) {
      console.error('Error checking teacher access:', error);
      throw error;
    }
  },

  // Revoke access
  async revokeAccess(teacherId: string, questionBankId: string): Promise<void> {
    try {
      const existingAccess = await this.getTeacherAccessToBank(teacherId, questionBankId);
      
      if (existingAccess) {
        const accessRef = doc(db, 'teacherAccessBanks', existingAccess.id);
        await updateDoc(accessRef, {
          isActive: false,
          updatedAt: Timestamp.now()
        });
        console.log('✅ Revoked access:', existingAccess.id);
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  },

  // Bulk grant access to multiple teachers for a question bank
  async bulkGrantAccess(
    questionBankId: string,
    questionBankName: string,
    subjectId: string,
    subjectName: string,
    teacherAccessList: Array<{
      teacherId: string;
      teacherName: string;
      teacherEmail: string;
      accessType: 'read' | 'write';
    }>,
    grantedBy: string,
    grantedByName: string,
    notes?: string
  ): Promise<BulkTeacherAccessAssignment> {
    try {
      console.log('🔍 Bulk granting access to:', teacherAccessList.length, 'teachers');
      
      const batch = writeBatch(db);
      const now = Timestamp.now();
      let successfulAssignments = 0;
      let failedAssignments = 0;
      const errors: string[] = [];
      
      // Create bulk assignment record
      const bulkAssignment: Omit<BulkTeacherAccessAssignment, 'id'> = {
        questionBankId,
        questionBankName,
        subjectId,
        subjectName,
        teacherIds: teacherAccessList.map(t => t.teacherId),
        accessType: 'read', // Default, individual records will have specific types
        assignedBy: grantedBy,
        assignedByName: grantedByName,
        assignedAt: now,
        notes,
        status: 'in-progress',
        successfulAssignments: 0,
        failedAssignments: 0
      };
      
      const bulkRef = doc(collection(db, 'bulkTeacherAccessAssignments'));
      batch.set(bulkRef, bulkAssignment);
      
      // Process each teacher
      for (const teacher of teacherAccessList) {
        try {
          const newAccess: Omit<TeacherAccessBank, 'id'> = {
            teacherId: teacher.teacherId,
            teacherName: teacher.teacherName,
            teacherEmail: teacher.teacherEmail,
            questionBankId,
            questionBankName,
            subjectId,
            subjectName,
            accessType: teacher.accessType,
            grantedBy,
            grantedByName,
            grantedAt: now,
            isActive: true,
            notes,
            createdAt: now,
            updatedAt: now
          };
          
          const accessRef = doc(collection(db, 'teacherAccessBanks'));
          batch.set(accessRef, newAccess);
          successfulAssignments++;
        } catch (error) {
          failedAssignments++;
          errors.push(`Failed to grant access to ${teacher.teacherName}: ${error}`);
        }
      }
      
      // Update bulk assignment with results
      batch.update(bulkRef, {
        status: 'completed',
        successfulAssignments,
        failedAssignments,
        errors: errors.length > 0 ? errors : undefined
      });
      
      await batch.commit();
      
      console.log('✅ Bulk access granted:', { successfulAssignments, failedAssignments });
      
      return {
        id: bulkRef.id,
        ...bulkAssignment,
        status: 'completed',
        successfulAssignments,
        failedAssignments,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in bulk grant access:', error);
      throw error;
    }
  },

  // Get accessible question banks grouped by subject
  async getAccessibleQuestionBanksBySubject(teacherId: string): Promise<{ [subjectId: string]: TeacherAccessBank[] }> {
    try {
      const accessBanks = await this.getAccessibleQuestionBanks(teacherId);
      
      const groupedBySubject: { [subjectId: string]: TeacherAccessBank[] } = {};
      
      accessBanks.forEach(access => {
        if (!groupedBySubject[access.subjectId]) {
          groupedBySubject[access.subjectId] = [];
        }
        groupedBySubject[access.subjectId].push(access);
      });
      
      return groupedBySubject;
    } catch (error) {
      console.error('Error getting question banks by subject:', error);
      throw error;
    }
  }
};
