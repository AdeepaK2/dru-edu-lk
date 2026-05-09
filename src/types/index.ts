/**
 * Shared type re-exports.
 *
 * Import shared domain types from here instead of reaching into individual
 * schema files. The schema files remain the source of truth — this barrel
 * just makes imports shorter and more discoverable.
 *
 * For types that don't come from schemas (API response shapes, shared
 * utility types), see src/types/api.ts.
 */

// Student
export type {
  ParentInfo,
  PaymentInfo,
  DocumentInfo,
  Student,
  StudentDocument,
  StudentData,
  StudentUpdateData,
} from '@/models/studentSchema';
export { DocumentType } from '@/models/studentSchema';

// Teacher
export type {
  SubjectGrade,
  Teacher,
  TeacherDocument,
  TeacherData,
  TeacherUpdateData,
  SubjectGradeData,
} from '@/models/teacherSchema';

// Admin
export type { AdminDocument, AdminData, AdminUpdateData } from '@/models/adminSchema';

// Enrollment
export type {
  EnrollmentRequest,
  EnrollmentRequestDocument,
  EnrollmentRequestData,
  EnrollmentRequestUpdateData,
} from '@/models/enrollmentRequestSchema';

export type {
  StudentEnrollment,
  StudentEnrollmentDocument,
  StudentEnrollmentData,
  StudentEnrollmentUpdateData,
} from '@/models/studentEnrollmentSchema';

// Class & Subject
export type {
  ClassDocument,
  ClassDisplayData,
  ClassData,
  ClassUpdateData,
} from '@/models/classSchema';

export type {
  SubjectDocument,
  SubjectDisplayData,
  SubjectData,
  SubjectUpdateData,
} from '@/models/subjectSchema';

// Tests & Questions
export type {
  Test,
  LiveTest,
  FlexibleTest,
  InClassTest,
  TestAttempt,
  TestQuestion,
  TestConfig,
  TestStatus,
  AttemptStatus,
  TestType,
  TestExtension,
  MCQAnswer,
  EssayAnswer,
  StudentAnswer,
} from '@/models/testSchema';

export type {
  Question,
  MCQQuestion,
  EssayQuestion,
  QuestionOption,
  QuestionBank,
  QuestionBankAssignment,
} from '@/models/questionBankSchema';

export type {
  StudentTestAssignment,
  TestAssignmentConfig,
  StudentAssignmentSummary,
  SelectableStudent,
} from '@/models/testAssignmentSchema';

// Mail
export type { MailDocument, MailDocumentData, MeetingEmailData } from '@/models/mailSchema';
export { MailStatus, EmailTemplateType } from '@/models/mailSchema';

// Billing
export type {
  BillingSettings,
  BillingSettingsDocument,
  BillingLineItem,
  BillingInvoiceDocument,
  BillingPaymentDocument,
  ParentPortalEntitlementDocument,
  BillingDiscountDocument,
  BillingInvoiceStatus,
  BillingFeeCode,
} from '@/models/billingSchema';

// Publications
export type {
  PublicationOrder,
  PublicationOrderItem,
  CustomerInfo,
  ShippingAddress,
  CreatePublicationOrder,
} from '@/models/publicationOrderSchema';

// Messages
export type { Message, MessageDocument, MessageData } from '@/models/messageSchema';

// Meetings
export type { MeetingBooking, TimeSlot, TeacherAvailability } from '@/models/meetingSchema';
