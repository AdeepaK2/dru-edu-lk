// Firestore service for managing questions and question banks
import { firestore as db } from '@/utils/firebase-client';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch
} from 'firebase/firestore';

import {
  Question,
  MCQQuestion,
  EssayQuestion,
  QuestionBank,
  QuestionBankAssignment
} from '@/models/questionBankSchema';

// Collection paths
const QUESTIONS_COLLECTION = 'questions';
const QUESTION_BANKS_COLLECTION = 'questionBanks';
const ASSIGNMENTS_COLLECTION = 'questionBankAssignments';

// Question Services
export const questionService = {
  // Create a new question
  async createQuestion(question: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const questionRef = await addDoc(collection(db, QUESTIONS_COLLECTION), {
      ...question,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return questionRef.id;
  },

  // Get a question by ID
  async getQuestion(id: string): Promise<Question | null> {
    const questionSnapshot = await getDoc(doc(db, QUESTIONS_COLLECTION, id));
    if (!questionSnapshot.exists()) return null;
    
    const data = questionSnapshot.data() as Question;
    return {
      ...data,
      id: questionSnapshot.id,
    };
  },

  // Update a question
  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    await updateDoc(doc(db, QUESTIONS_COLLECTION, id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  // Delete a question
  async deleteQuestion(id: string): Promise<void> {
    // First, we need to check if the question is used in any question banks
    const bankQuery = query(
      collection(db, QUESTION_BANKS_COLLECTION),
      where('questionIds', 'array-contains', id)
    );
    
    const bankSnapshot = await getDocs(bankQuery);
    
    if (!bankSnapshot.empty) {
      // Remove the question ID from all banks that contain it
      const batch = writeBatch(db);
      bankSnapshot.forEach(bankDoc => {
        const bankData = bankDoc.data() as QuestionBank;
        const updatedQuestionIds = bankData.questionIds.filter(qId => qId !== id);
        
        batch.update(doc(db, QUESTION_BANKS_COLLECTION, bankDoc.id), { 
          questionIds: updatedQuestionIds,
          totalQuestions: updatedQuestionIds.length,
          ...(updates => {
            if (bankData.mcqCount > 0) return { mcqCount: bankData.mcqCount - 1 };
            if (bankData.essayCount > 0) return { essayCount: bankData.essayCount - 1 };
            return {};
          })()
        });
      });
      
      // Execute the batch
      await batch.commit();
    }
    
    // Now delete the question
    await deleteDoc(doc(db, QUESTIONS_COLLECTION, id));
  },
  // List questions with filters
  async listQuestions(filters?: {
    type?: 'mcq' | 'essay';
    subjectId?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    topic?: string;
  }): Promise<Question[]> {
    const collectionRef = collection(db, QUESTIONS_COLLECTION);
    
    // Apply filters if provided
    if (filters) {
      let constraints = [] as any[];
      
      if (filters.type) {
        constraints.push(where('type', '==', filters.type));
      }
      
      if (filters.subjectId) {
        constraints.push(where('subjectId', '==', filters.subjectId));
      }
      
      if (filters.difficulty) {
        constraints.push(where('difficultyLevel', '==', filters.difficulty));
      }
      
      if (filters.topic) {
        constraints.push(where('topic', '==', filters.topic));
      }
      
      const q = query(collectionRef, ...constraints, orderBy('createdAt', 'desc'));
      const questionSnapshots = await getDocs(q);
      return questionSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Question));
    } else {
      const q = query(collectionRef, orderBy('createdAt', 'desc'));
      const questionSnapshots = await getDocs(q);
      return questionSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Question));
    }
  }
};

// Question Bank Services
export const questionBankService = {
  // Create a new question bank
  async createQuestionBank(bank: Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const bankRef = await addDoc(collection(db, QUESTION_BANKS_COLLECTION), {
      ...bank,
      nextMcqSequence: bank.nextMcqSequence ?? bank.mcqCount ?? 0,
      nextEssaySequence: bank.nextEssaySequence ?? bank.essayCount ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return bankRef.id;
  },

  // Create a question and add it to a bank atomically.
  // This prevents duplicate question numbers under concurrent writes.
  async createQuestionInBank(
    bankId: string,
    question: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const bankRef = doc(db, QUESTION_BANKS_COLLECTION, bankId);
    const questionRef = doc(collection(db, QUESTIONS_COLLECTION));

    await runTransaction(db, async transaction => {
      const bankDoc = await transaction.get(bankRef);
      if (!bankDoc.exists()) {
        throw new Error('Question bank not found');
      }

      const bankData = bankDoc.data() as QuestionBank;
      const currentMcqCount = bankData.mcqCount || 0;
      const currentEssayCount = bankData.essayCount || 0;
      const currentTotal = bankData.totalQuestions || 0;

      const isMcq = question.type === 'mcq';
      const currentSequence = isMcq
        ? (bankData.nextMcqSequence ?? currentMcqCount)
        : (bankData.nextEssaySequence ?? currentEssayCount);
      const nextSequence = currentSequence + 1;
      const generatedTitle = `${isMcq ? 'M' : 'E'}${nextSequence}`;

      transaction.set(questionRef, {
        ...question,
        title: generatedTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.update(bankRef, {
        questionIds: [...(bankData.questionIds || []), questionRef.id],
        totalQuestions: currentTotal + 1,
        mcqCount: isMcq ? currentMcqCount + 1 : currentMcqCount,
        essayCount: isMcq ? currentEssayCount : currentEssayCount + 1,
        nextMcqSequence: isMcq ? nextSequence : (bankData.nextMcqSequence ?? currentMcqCount),
        nextEssaySequence: isMcq ? (bankData.nextEssaySequence ?? currentEssayCount) : nextSequence,
        updatedAt: serverTimestamp()
      });
    });

    return questionRef.id;
  },

  // Get a question bank by ID
  async getQuestionBank(id: string): Promise<QuestionBank | null> {
    const bankSnapshot = await getDoc(doc(db, QUESTION_BANKS_COLLECTION, id));
    if (!bankSnapshot.exists()) return null;
    
    const data = bankSnapshot.data() as QuestionBank;
    return {
      ...data,
      id: bankSnapshot.id
    };
  },

  // Update a question bank
  async updateQuestionBank(id: string, updates: Partial<QuestionBank>): Promise<void> {
    await updateDoc(doc(db, QUESTION_BANKS_COLLECTION, id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  // Delete a question bank
  async deleteQuestionBank(id: string): Promise<void> {
    // Check if the bank is assigned to any classes
    const assignmentQuery = query(
      collection(db, ASSIGNMENTS_COLLECTION),
      where('bankId', '==', id)
    );
    
    const assignmentSnapshot = await getDocs(assignmentQuery);
    
    if (!assignmentSnapshot.empty) {
      throw new Error('Cannot delete question bank - it is assigned to one or more classes.');
    }
    
    await deleteDoc(doc(db, QUESTION_BANKS_COLLECTION, id));
  },

  // Add questions to a bank
  async addQuestionsToBank(bankId: string, questionIds: string[]): Promise<void> {
    const bankRef = doc(db, QUESTION_BANKS_COLLECTION, bankId);
    
    await runTransaction(db, async transaction => {
      const bankDoc = await transaction.get(bankRef);
      if (!bankDoc.exists()) {
        throw new Error('Question bank not found');
      }
      
      const bankData = bankDoc.data() as QuestionBank;
      const existingIds = new Set(bankData.questionIds);
      const newIds = questionIds.filter(id => !existingIds.has(id));
      
      if (newIds.length === 0) return; // No new questions to add
      
      // Get the question types for counting
      const questionPromises = newIds.map(id => 
        getDoc(doc(db, QUESTIONS_COLLECTION, id))
      );
      
      const questionDocs = await Promise.all(questionPromises);
      let mcqCount = bankData.mcqCount || 0;
      let essayCount = bankData.essayCount || 0;
      
      questionDocs.forEach(qDoc => {
        if (qDoc.exists()) {
          const qData = qDoc.data();
          if (qData.type === 'mcq') mcqCount++;
          else if (qData.type === 'essay') essayCount++;
        }
      });
      
      // Update the bank with new questions and counts
      transaction.update(bankRef, {
        questionIds: [...bankData.questionIds, ...newIds],
        totalQuestions: bankData.totalQuestions + newIds.length,
        mcqCount,
        essayCount,
        updatedAt: serverTimestamp()
      });
    });
  },

  // Remove questions from a bank
  async removeQuestionsFromBank(bankId: string, questionIds: string[]): Promise<void> {
    const bankRef = doc(db, QUESTION_BANKS_COLLECTION, bankId);
    
    await runTransaction(db, async transaction => {
      const bankDoc = await transaction.get(bankRef);
      if (!bankDoc.exists()) {
        throw new Error('Question bank not found');
      }
      
      const bankData = bankDoc.data() as QuestionBank;
      const remainingIds = bankData.questionIds.filter(id => !questionIds.includes(id));
      
      if (remainingIds.length === bankData.questionIds.length) return; // No questions removed
      
      // Get the question types for counting
      const questionPromises = questionIds.map(id => 
        getDoc(doc(db, QUESTIONS_COLLECTION, id))
      );
      
      const questionDocs = await Promise.all(questionPromises);
      let mcqCount = bankData.mcqCount || 0;
      let essayCount = bankData.essayCount || 0;
      
      questionDocs.forEach(qDoc => {
        if (qDoc.exists()) {
          const qData = qDoc.data();
          if (qData.type === 'mcq') mcqCount = Math.max(0, mcqCount - 1);
          else if (qData.type === 'essay') essayCount = Math.max(0, essayCount - 1);
        }
      });
      
      // Update the bank with removed questions and updated counts
      transaction.update(bankRef, {
        questionIds: remainingIds,
        totalQuestions: remainingIds.length,
        mcqCount,
        essayCount,
        updatedAt: serverTimestamp()
      });
    });
  },

  // List question banks with filters
  async listQuestionBanks(filters?: {
    subjectId?: string;
    grade?: string;
  }): Promise<QuestionBank[]> {
    const collectionRef = collection(db, QUESTION_BANKS_COLLECTION);
    
    // Apply filters if provided
    if (filters) {
      let constraints = [] as any[];
      
      if (filters.subjectId) {
        constraints.push(where('subjectId', '==', filters.subjectId));
      }
      
      if (filters.grade) {
        constraints.push(where('grade', '==', filters.grade));
      }
      
      const q = query(collectionRef, ...constraints, orderBy('createdAt', 'desc'));
      const bankSnapshots = await getDocs(q);
      return bankSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as QuestionBank));
    } else {
      const q = query(collectionRef, orderBy('createdAt', 'desc'));
      const bankSnapshots = await getDocs(q);
      return bankSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as QuestionBank));
    }
  }
};

// Question Bank Assignment Services
export const questionBankAssignmentService = {
  // Assign a question bank to a class
  async assignBankToClass(assignment: Omit<QuestionBankAssignment, 'id' | 'assignedAt'>): Promise<string> {
    const assignmentRef = await addDoc(collection(db, ASSIGNMENTS_COLLECTION), {
      ...assignment,
      assignedAt: serverTimestamp()
    });
    return assignmentRef.id;
  },

  // Get assignment by ID
  async getAssignment(id: string): Promise<QuestionBankAssignment | null> {
    const assignmentSnapshot = await getDoc(doc(db, ASSIGNMENTS_COLLECTION, id));
    if (!assignmentSnapshot.exists()) return null;
    
    const data = assignmentSnapshot.data() as QuestionBankAssignment;
    return {
      ...data,
      id: assignmentSnapshot.id
    };
  },

  // Update assignment
  async updateAssignment(id: string, updates: Partial<QuestionBankAssignment>): Promise<void> {
    await updateDoc(doc(db, ASSIGNMENTS_COLLECTION, id), updates);
  },

  // Delete assignment
  async deleteAssignment(id: string): Promise<void> {
    await deleteDoc(doc(db, ASSIGNMENTS_COLLECTION, id));
  },

  // List assignments with filters
  async listAssignments(filters?: {
    classId?: string;    bankId?: string;
    status?: 'active' | 'draft' | 'archived';
  }): Promise<QuestionBankAssignment[]> {
    const collectionRef = collection(db, ASSIGNMENTS_COLLECTION);
    
    // Apply filters
    if (filters) {
      let constraints = [] as any[];
      
      if (filters.classId) {
        constraints.push(where('classId', '==', filters.classId));
      }
      
      if (filters.bankId) {
        constraints.push(where('bankId', '==', filters.bankId));
      }
      
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      const q = query(collectionRef, ...constraints, orderBy('assignedAt', 'desc'));
      const assignmentSnapshots = await getDocs(q);
      return assignmentSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as QuestionBankAssignment));
    } else {
      const q = query(collectionRef, orderBy('assignedAt', 'desc'));
      const assignmentSnapshots = await getDocs(q);
      return assignmentSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as QuestionBankAssignment));
    }
  }
};
