import 'server-only';

import { adminFirestore } from '@/utils/firebase-admin';
import { DocumentType } from '@/models/studentSchema';
import { getMissingDocumentsInfo } from '@/utils/documentUrls';

export interface StudentWithMissingDocs {
  id: string;
  name: string;
  email: string;
  parent: { name: string; phone: string } | null;
  missingDocuments: Array<{ type: string; name: string; url: string }>;
}

export async function getStudentsWithMissingDocuments(): Promise<StudentWithMissingDocs[]> {
  const studentsSnapshot = await adminFirestore.collection('students').get();

  const requiredDocuments = getMissingDocumentsInfo([
    DocumentType.CLASS_POLICY,
    DocumentType.PARENT_NOTICE,
    DocumentType.PHOTO_CONSENT,
  ]);

  const studentsWithMissingDocs: StudentWithMissingDocs[] = [];

  studentsSnapshot.docs.forEach(doc => {
    const studentData = doc.data();

    if (studentData.status !== 'Active') return;

    const submittedTypes = (studentData.documents || [])
      .filter((d: any) => d.status === 'Verified' || d.status === 'Pending')
      .map((d: any) => d.type);

    const missingDocuments = requiredDocuments.filter(
      reqDoc => !submittedTypes.includes(reqDoc.type),
    );

    if (missingDocuments.length > 0) {
      studentsWithMissingDocs.push({
        id: doc.id,
        name: studentData.name || 'Unknown Student',
        email: studentData.email || '',
        parent: studentData.parent
          ? {
              name: studentData.parent.name || 'Parent/Guardian',
              phone: studentData.parent.phone || studentData.parent.phoneNumber || '',
            }
          : null,
        missingDocuments: missingDocuments.map(d => ({
          type: d.type,
          name: d.name,
          url: d.url,
        })),
      });
    }
  });

  return studentsWithMissingDocs;
}
