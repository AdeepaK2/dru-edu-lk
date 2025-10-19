// Service for generating and managing student numbers
import { firestore } from '@/utils/firebase-client';
import { doc, getDoc, setDoc, runTransaction, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export class StudentNumberService {
  private static readonly COUNTER_COLLECTION = 'counters';
  private static readonly COUNTER_DOC = 'studentNumber';
  private static readonly PREFIX = 'ST';
  private static readonly PADDING = 4; // Number of digits (e.g., ST0001)

  /**
   * Generate a new unique student number
   * Format: ST0001, ST0002, etc.
   */
  static async generateStudentNumber(): Promise<string> {
    try {
      const counterRef = doc(firestore, this.COUNTER_COLLECTION, this.COUNTER_DOC);
      
      // Use transaction to ensure atomicity
      const studentNumber = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let nextNumber = 1;
        
        if (counterDoc.exists()) {
          const currentCount = counterDoc.data().count || 0;
          nextNumber = currentCount + 1;
        }
        
        // Update the counter
        transaction.set(counterRef, { 
          count: nextNumber,
          lastUpdated: new Date()
        });
        
        // Format the student number with padding
        const formattedNumber = this.formatStudentNumber(nextNumber);
        return formattedNumber;
      });
      
      console.log('✅ Generated student number:', studentNumber);
      return studentNumber;
      
    } catch (error) {
      console.error('❌ Error generating student number:', error);
      throw new Error('Failed to generate student number');
    }
  }

  /**
   * Format a number to student number format (e.g., 1 -> ST0001)
   */
  private static formatStudentNumber(num: number): string {
    const paddedNum = num.toString().padStart(this.PADDING, '0');
    return `${this.PREFIX}${paddedNum}`;
  }

  /**
   * Check if a student number already exists
   */
  static async isStudentNumberExists(studentNumber: string): Promise<boolean> {
    try {
      const studentsRef = collection(firestore, 'students');
      const q = query(studentsRef, where('studentNumber', '==', studentNumber), limit(1));
      const snapshot = await getDocs(q);
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking student number existence:', error);
      return false;
    }
  }

  /**
   * Get the current counter value (for admin purposes)
   */
  static async getCurrentCounter(): Promise<number> {
    try {
      const counterRef = doc(firestore, this.COUNTER_COLLECTION, this.COUNTER_DOC);
      const counterDoc = await getDoc(counterRef);
      
      if (counterDoc.exists()) {
        return counterDoc.data().count || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting current counter:', error);
      return 0;
    }
  }

  /**
   * Initialize counter based on existing students (run once during migration)
   */
  static async initializeCounter(): Promise<void> {
    try {
      const studentsRef = collection(firestore, 'students');
      const q = query(
        studentsRef, 
        where('studentNumber', '!=', null),
        orderBy('studentNumber', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      let maxNumber = 0;
      
      if (!snapshot.empty) {
        const lastStudentNumber = snapshot.docs[0].data().studentNumber;
        // Extract number from format ST0001
        const numberPart = lastStudentNumber.replace(this.PREFIX, '');
        maxNumber = parseInt(numberPart, 10) || 0;
      }
      
      const counterRef = doc(firestore, this.COUNTER_COLLECTION, this.COUNTER_DOC);
      await setDoc(counterRef, {
        count: maxNumber,
        lastUpdated: new Date(),
        initialized: true
      });
      
      console.log('✅ Counter initialized with value:', maxNumber);
    } catch (error) {
      console.error('❌ Error initializing counter:', error);
      throw error;
    }
  }

  /**
   * Parse student number to get the numeric value
   */
  static parseStudentNumber(studentNumber: string): number | null {
    if (!studentNumber || !studentNumber.startsWith(this.PREFIX)) {
      return null;
    }
    
    const numberPart = studentNumber.replace(this.PREFIX, '');
    const num = parseInt(numberPart, 10);
    
    return isNaN(num) ? null : num;
  }

  /**
   * Validate student number format
   */
  static isValidStudentNumber(studentNumber: string): boolean {
    const pattern = new RegExp(`^${this.PREFIX}\\d{${this.PADDING}}$`);
    return pattern.test(studentNumber);
  }
}
