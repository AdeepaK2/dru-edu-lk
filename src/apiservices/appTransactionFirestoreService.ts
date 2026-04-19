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
    const [parentsSnapshot, entitlementSnapshot, invoicesSnapshot] = await Promise.all([
      getDocs(query(collection(firestore, 'parents'), orderBy('createdAt', 'desc'))),
      getDocs(collection(firestore, 'parentPortalEntitlements')),
      getDocs(collection(firestore, 'billingInvoices')),
    ]);

    const entitlementByEmail = new Map<string, any>();
    entitlementSnapshot.docs.forEach((docSnap) => {
      entitlementByEmail.set(docSnap.id, docSnap.data());
    });

    const invoicesByEmail = new Map<string, any[]>();
    invoicesSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const parentEmail = String(data.parentEmail || '').toLowerCase();
      const existing = invoicesByEmail.get(parentEmail) || [];
      existing.push({ id: docSnap.id, ...data });
      invoicesByEmail.set(parentEmail, existing);
    });

    const results: ParentAppTransaction[] = [];

    for (const docSnap of parentsSnapshot.docs) {
      const data = docSnap.data();
      const parentEmail = String(data.email || '').toLowerCase();
      const entitlement = entitlementByEmail.get(parentEmail);
      const invoices = (invoicesByEmail.get(parentEmail) || []).sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      const latestInvoice = invoices[0];

      if (!entitlement && invoices.length === 0) continue;

      const linkedStudents: { id: string; name: string }[] = (data.linkedStudents || []).map(
        (s: any) => ({ id: s.id || s.studentId || '', name: s.name || s.displayName || 'Unknown' })
      );

      results.push({
        parentId: docSnap.id,
        parentName: data.displayName || data.name || data.email || 'Unknown Parent',
        parentEmail: data.email || '',
        linkedStudents,
        subscription: {
          status: entitlement?.status || (latestInvoice ? 'pending' : 'none'),
          platform: 'web',
          productId: 'parent_portal_fee',
          purchaseToken: undefined,
          studentCount: linkedStudents.length,
          totalAmount: latestInvoice?.amountTotal || 0,
          startDate: entitlement?.startAt?.toDate?.()?.toISOString?.() || '',
          expiryDate: entitlement?.endAt?.toDate?.()?.toISOString?.() || '',
          transactions: invoices.map((invoice: any) => ({
            transactionId: invoice.invoiceNumber || invoice.id,
            productId: 'parent_portal_fee',
            purchaseDate: invoice.paidAt?.toDate?.()?.toISOString?.()
              || invoice.createdAt?.toDate?.()?.toISOString?.()
              || '',
            amount: Number(invoice.amountTotal || 0),
            currency: invoice.currency || 'AUD',
          })),
        },
      });
    }

    return results;
  }
}
