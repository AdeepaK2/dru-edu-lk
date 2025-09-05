// Centralized document URLs configuration
// This ensures consistency across the application for document links

import { DocumentType } from '@/models/studentSchema';

export const DOCUMENT_URLS = {
  [DocumentType.CLASS_POLICY]: "https://drive.google.com/file/d/1YHJxvAfTVMqRJ5YQeD5fFZdXkt81vSr1/view",
  [DocumentType.PARENT_NOTICE]: "https://drive.google.com/file/d/1j_LO0jWJ2-4WRYBZwMwp0eRnFMqOVM-F/view",
  [DocumentType.PHOTO_CONSENT]: "https://drive.google.com/file/d/1qD9nYtOnbHs_AImrAaEU5NTPalXwea6F/view",
} as const;

export const DOCUMENT_NAMES = {
  [DocumentType.CLASS_POLICY]: "Class Policy Agreement",
  [DocumentType.PARENT_NOTICE]: "Parent/Guardian Notice",
  [DocumentType.PHOTO_CONSENT]: "Photo Consent Form",
} as const;

// Helper function to get document info
export function getDocumentInfo(type: DocumentType) {
  return {
    type,
    name: DOCUMENT_NAMES[type],
    url: DOCUMENT_URLS[type]
  };
}

// Helper function to get missing documents with proper URLs
export function getMissingDocumentsInfo(missingTypes: DocumentType[]) {
  return missingTypes.map(type => getDocumentInfo(type));
}
