// Question Shuffle Service
// Handles question shuffling for student attempts while preserving original order for results

import { TestQuestion } from '@/models/testSchema';
import { QuestionOrderMapping } from '@/models/attemptSchema';

export class QuestionShuffleService {
  /**
   * Generate a shuffled question order for a student attempt
   * Uses a seeded random function to ensure consistent shuffling per attempt
   */
  static generateShuffledOrder(
    questions: TestQuestion[],
    attemptId: string
  ): {
    shuffledQuestions: TestQuestion[];
    questionOrderMapping: QuestionOrderMapping[];
    shuffledQuestionIds: string[];
  } {
    // Create a deterministic seed from attemptId to ensure consistent results
    const seed = this.hashStringToNumber(attemptId);
    const rng = this.createSeededRandom(seed);
    
    // Create array of indices to shuffle
    const indices = Array.from({ length: questions.length }, (_, i) => i);
    
    // Fisher-Yates shuffle with seeded random
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Create shuffled questions array
    const shuffledQuestions: TestQuestion[] = indices.map((originalIndex, shuffledIndex) => ({
      ...questions[originalIndex],
      // Update the order to reflect shuffled position (1-based for display)
      order: shuffledIndex + 1
    }));
    
    // Create order mapping
    const questionOrderMapping: QuestionOrderMapping[] = indices.map((originalIndex, shuffledIndex) => ({
      originalOrder: originalIndex,
      shuffledOrder: shuffledIndex,
      questionId: questions[originalIndex].id
    }));
    
    // Create shuffled question IDs array
    const shuffledQuestionIds = shuffledQuestions.map(q => q.id);
    
    console.log('🔀 Generated shuffled question order:', {
      attemptId,
      totalQuestions: questions.length,
      mapping: questionOrderMapping.slice(0, 3), // Log first 3 for verification
      shuffledIds: shuffledQuestionIds.slice(0, 3)
    });
    
    return {
      shuffledQuestions,
      questionOrderMapping,
      shuffledQuestionIds
    };
  }
  
  /**
   * Get questions in shuffled order for display during test
   */
  static getShuffledQuestions(
    originalQuestions: TestQuestion[],
    questionOrderMapping: QuestionOrderMapping[]
  ): TestQuestion[] {
    // Sort mapping by shuffled order
    const sortedMapping = [...questionOrderMapping].sort((a, b) => a.shuffledOrder - b.shuffledOrder);
    
    // Return questions in shuffled order
    return sortedMapping.map((mapping, index) => ({
      ...originalQuestions[mapping.originalOrder],
      order: index + 1 // Update display order
    }));
  }
  
  /**
   * Get questions in original order for results display
   */
  static getOriginalOrderQuestions(
    shuffledQuestions: TestQuestion[],
    questionOrderMapping: QuestionOrderMapping[]
  ): TestQuestion[] {
    // Sort mapping by original order
    const sortedMapping = [...questionOrderMapping].sort((a, b) => a.originalOrder - b.originalOrder);
    
    // Return questions in original order
    return sortedMapping.map((mapping, index) => {
      // Find the question by ID since shuffled array order doesn't match original
      const question = shuffledQuestions.find(q => q.id === mapping.questionId);
      if (!question) {
        console.error('Question not found for mapping:', mapping);
        return shuffledQuestions[0]; // Fallback
      }
      
      return {
        ...question,
        order: index + 1 // Restore original display order
      };
    });
  }
  
  /**
   * Map shuffled index to original index
   */
  static getOriginalIndex(shuffledIndex: number, questionOrderMapping: QuestionOrderMapping[]): number {
    const mapping = questionOrderMapping.find(m => m.shuffledOrder === shuffledIndex);
    return mapping ? mapping.originalOrder : shuffledIndex;
  }
  
  /**
   * Map original index to shuffled index
   */
  static getShuffledIndex(originalIndex: number, questionOrderMapping: QuestionOrderMapping[]): number {
    const mapping = questionOrderMapping.find(m => m.originalOrder === originalIndex);
    return mapping ? mapping.shuffledOrder : originalIndex;
  }
  
  /**
   * Get question ID by shuffled index
   */
  static getQuestionIdByShuffledIndex(shuffledIndex: number, questionOrderMapping: QuestionOrderMapping[]): string {
    const mapping = questionOrderMapping.find(m => m.shuffledOrder === shuffledIndex);
    return mapping ? mapping.questionId : '';
  }
  
  /**
   * Check if questions should be shuffled for this test
   */
  static shouldShuffleQuestions(test: any): boolean {
    return test?.config?.shuffleQuestions === true;
  }
  
  /**
   * Hash string to number for seeded random
   */
  private static hashStringToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Create seeded random number generator
   */
  private static createSeededRandom(seed: number): () => number {
    let state = seed;
    return function() {
      // Linear congruential generator
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
      return state / Math.pow(2, 32);
    };
  }
}
