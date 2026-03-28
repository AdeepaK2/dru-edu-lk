import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

export interface AppSubscriptionTransaction {
  transactionId: string;
  productId: string;
  purchaseDate: string;
  amount: number;
  currency: string;
}

export interface AppSubscription {
  status: 'active' | 'expired' | 'cancelled' | string;
  platform: 'ios' | 'android' | string;
  productId: string;
  purchaseToken?: string;
  studentCount: number;
  totalAmount: number;
  startDate: string;
  expiryDate: string;
  transactions?: AppSubscriptionTransaction[];
}

export interface ParentAppTransaction {
  parentId: string;
  parentName: string;
  parentEmail: string;
  linkedStudents: { id: string; name: string }[];
  subscription: AppSubscription;
}

export class AppTransactionFirestoreService {
  static async getAllParentSubscriptions(): Promise<ParentAppTransaction[]> {
    const parentsRef = collection(firestore, 'parents');
    const q = query(parentsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const results: ParentAppTransaction[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.subscription || !data.subscription.status) continue;

      const linkedStudents: { id: string; name: string }[] = (data.linkedStudents || []).map(
        (s: any) => ({ id: s.id || s.studentId || '', name: s.name || s.displayName || 'Unknown' })
      );

      results.push({
        parentId: docSnap.id,
        parentName: data.displayName || data.name || data.email || 'Unknown Parent',
        parentEmail: data.email || '',
        linkedStudents,
        subscription: {
          status: data.subscription.status,
          platform: data.subscription.platform || 'unknown',
          productId: data.subscription.productId || '',
          purchaseToken: data.subscription.purchaseToken,
          studentCount: data.subscription.studentCount || linkedStudents.length,
          totalAmount: data.subscription.totalAmount || 0,
          startDate: data.subscription.startDate || '',
          expiryDate: data.subscription.expiryDate || '',
          transactions: data.subscription.transactions || [],
        },
      });
    }

    return results;
  }
}
