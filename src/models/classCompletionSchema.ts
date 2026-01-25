
import { Timestamp } from 'firebase/firestore';

export interface ClassCompletion {
  id: string; // Composite key: classId_date (YYYY-MM-DD)
  classId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  finishedAt: Timestamp; // Actual time clicked
  classStartTime: string; // Scheduled start time (HH:mm)
  classEndTime: string; // Scheduled end time (HH:mm)
  status: 'finished';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ClassCompletionDocument = ClassCompletion;
