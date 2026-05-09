# DRU-EDU — Web Application Architecture Reference

> **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Firebase · Tailwind CSS
> **Purpose:** Educational management platform for Dr. U Education (Melbourne-based VCE coaching)
> **Roles:** Students, Teachers, Administrators

---

## Project Structure

```
dru-edu/
├── src/
│   ├── app/                    # Next.js 15 App Router (pages + API routes)
│   ├── components/             # React components organized by role/feature
│   │   ├── student/            # Student portal components
│   │   ├── teacher/            # Teacher portal components
│   │   ├── adminDashboard/     # Admin dashboard components
│   │   ├── ui/                 # Shared UI components (Button, Modal, Card, etc.)
│   │   ├── questions/          # Question display/management
│   │   ├── chat/               # Chat interface
│   │   ├── videos/             # Video components
│   │   ├── study-materials/    # Study content display
│   │   └── modals/             # Modal dialogs
│   ├── contexts/               # React Context providers (Theme, Sidebar)
│   ├── hooks/                  # Custom hooks (useStudentAuth, useTeacherAuth, etc.)
│   ├── models/                 # Zod schemas & TypeScript types
│   ├── services/               # Business logic services
│   ├── apiservices/            # Firestore/API integration services (~61 files)
│   └── utils/                  # Utility functions
├── public/                     # Static assets (themes, images)
├── scripts/                    # Build/utility scripts
├── functions/                  # Firebase Cloud Functions
├── firebase.json               # Firebase config
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Composite indexes
└── next.config.ts              # Next.js configuration
```

---

## Authentication

- **Firebase Auth** (email/password + Google OAuth)
- **Custom Claims:** `student`, `teacher`, `admin`, `role`
- **Key Hooks:**
  - `useStudentAuth()` → validates `claims.student || claims.role === 'student'`
  - `useTeacherAuth()` → validates `claims.teacher || claims.role === 'teacher'`
- **Key Files:**
  - `src/utils/firebase-client.ts` — Client SDK init
  - `src/utils/firebase-admin.ts` — Admin SDK init
  - `src/hooks/useStudentAuth.ts`, `src/hooks/useTeacherAuth.ts`

---

## Routing Overview

### Student Portal (`/student/`)
| Route | Purpose |
|-------|---------|
| `/student/dashboard` | Main dashboard |
| `/student/classes/[classId]` | Class details |
| `/student/test/[testId]` | Test taking interface |
| `/student/in-class/[testId]` | In-class test submission |
| `/student/homework` | Homework assignments |
| `/student/results` | Test results/grades |
| `/student/study` | Study materials |
| `/student/video/[videoId]` | Video content |
| `/student/sheets/[classId]` | Google Sheets |
| `/student/meeting` | Live meetings |

### Teacher Portal (`/teacher/`)
| Route | Purpose |
|-------|---------|
| `/teacher/dashboard` | Main dashboard |
| `/teacher/classes/[classId]` | Class management |
| `/teacher/tests/[testId]` | Test creation/editing |
| `/teacher/questions/[id]` | Question bank editing |
| `/teacher/grades/[classId]` | Grading interface |
| `/teacher/homework/[materialId]` | Homework management |
| `/teacher/videos` | Video management |
| `/teacher/sheets` | Google Sheets integration |
| `/teacher/chat` | Messaging |
| `/teacher/transactions` | Payment history |

### Admin Portal (`/admin/`)
| Route | Purpose |
|-------|---------|
| `/admin/students` | Student management |
| `/admin/teachers` | Teacher management |
| `/admin/classes` | Class configuration |
| `/admin/subjects` | Subject management |
| `/admin/question-banks/[id]` | Question bank admin |
| `/admin/videos/*` | Video management |
| `/admin/books` | Publication management |
| `/admin/orders` | Order management |
| `/admin/enrollment` | Enrollment management |
| `/admin/parents` | Parent management |
| `/admin/transactions` | Transaction management |

### Public Routes
`/`, `/about`, `/privacy`, `/terms`, `/consult`, `/courses`, `/enroll`, `/books`, `/schedule`

---

## API Routes (`/api/`)

### Key Endpoints
| Category | Endpoints |
|----------|-----------|
| **Auth** | `/api/student/verify`, `/api/student/enrollments` |
| **Students** | `/api/students/`, `/api/students/[id]`, `/api/students/batch` |
| **Tests** | `/api/test/`, `/api/tests/extend-deadline`, `/api/tests/clear-extension-flags` |
| **Classes** | `/api/classes/`, `/api/classes/[classId]` |
| **Grading** | `/api/ai-grade-essay/`, `/api/analytics/precomputed` |
| **Payments** | `/api/stripe/create-payment-intent`, `/api/stripe/webhook`, `/api/drupay/` |
| **Sheets** | `/api/sheets/`, `/api/sheets/student`, `/api/sheets/templates` |
| **Email** | `/api/send-email/`, `/api/whatsapp/` |
| **Parents** | `/api/parent/check`, `/api/parent/invite`, `/api/parent/invites` |
| **Publications** | `/api/publications/`, `/api/publications/order` |
| **Cron Jobs** | `/api/cron/precompute-analytics`, `/api/cron/schedule-classes`, `/api/cron/test-not-attempt` |
| **Background** | `/api/background/submissions`, `/api/background/monitor` |

---

## Firestore Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `students` | Student profiles | name, email, phone, year, school, status, parent info |
| `teachers` | Teacher profiles | name, email, subjects, qualifications, profileImageUrl |
| `classes` | Class definitions | name, subject, teacherId, studentIds, schedule |
| `tests` | All test types | title, type (live/flexible/in-class), classIds, questions, totalMarks |
| `studentSubmissions` | Live/flexible test submissions | testId, studentId, answers, score, status |
| `inClassSubmissions` | In-class test submissions (SEPARATE!) | testId, studentId, marks, feedback, status |
| `studentEnrollments` | Class enrollments | studentId, classId, status, enrolledAt |
| `testAssignments` | Individual test assignments | testId, studentId, classId |
| `testAttempts` | Test attempt timing | testId, studentId, answers, startTime, endTime |
| `studyMaterials` | Study materials | title, classId, type, isRequired |
| `homeworkSubmissions` | Homework submissions | studentId, materialId, feedback, marks |
| `questions` | Question bank | content, type (mcq/essay), options, difficultyLevel |
| `questionBanks` | Question bank groups | name, teacherId, questions, lessons |
| `subjects` | Subject definitions | name, description, color, icon |
| `videos` | Video library | title, url, classId, subjectId |
| `meetings` | Scheduled meetings | title, teacherId, scheduledTime, joinUrl |
| `transactions` | Payment transactions | userId, amount, status, type |
| `precomputedAnalytics` | Cached analytics | metric, value, timestamp |
| `mail` | Email queue | to, subject, body, status |
| `publications` | Published materials | title, price, imageUrl |
| `publicationOrders` | Book orders | quantity, totalPrice, status |

---

## Key Features

### Test System (3 Types)
- **Live Tests:** Timed, countdown timer, auto-submit on timeout
- **Flexible Tests:** Deadline-based, can pause/resume
- **In-Class Tests:** Offline submission support, manual grading
- **AI Grading:** Gemini API for essay auto-grading + teacher review
- **Test Extensions:** Teachers can extend deadlines with reason tracking

### Study Materials & Homework
- Multiple files grouped as single material
- Types: PDFs, Videos, Documents, Links
- Completion tracking per student, organized by class/week
- Homework submissions with teacher feedback

### Payments
- **Stripe:** Video purchases and payments
- **DRUPay:** In-house payment system
- **Teacher Payouts:** Earnings tracking and payouts
- **Publication Orders:** Book purchase flow

### Communication
- Chat (student-teacher messaging)
- Email (Nodemailer SMTP)
- WhatsApp (GreenAPI)
- Document reminders (automated)

## State Management

- **React Context:** SidebarContext
- **SWR** for client-side data fetching with caching
- **Zod** for data validation (models directory)
- **Custom Hooks:** useStudentAuth, useTeacherAuth, useAdminCache, useFastAnalytics

---

## UI Stack

- **Tailwind CSS 3.3** — Styling
- **Lucide React** — Icons
- **React Hot Toast** — Notifications
- **tldraw / Fabric.js / Konva** — Drawing/canvas
- **React PDF / jspdf / pdf-lib** — PDF viewing/generation
- **XLSX** — Excel handling

---

## Deployment

- **Frontend:** Firebase Hosting (static export)
- **Backend:** Firebase Cloud Functions (Node.js 22)
- **Database:** Firestore (default + production databases)
- **Storage:** Firebase Storage
- **Region:** australia-southeast1
- **Timezone:** Australia/Melbourne

```bash
npm run dev              # Dev server (Turbopack)
npm run build:firebase   # Firebase build
npm run deploy           # Full deployment
npm run deploy:hosting   # Hosting only
npm run deploy:functions # Functions only
```

---

## External Integrations

| Service | Purpose |
|---------|---------|
| **Stripe** | Payments (video purchases, subscriptions) |
| **Gemini AI** | Essay auto-grading |
| **Google Sheets API** | Spreadsheet integration |
| **GreenAPI** | WhatsApp messaging |
| **Nodemailer** | Email (SMTP) |
| **Google Cloud Storage** | File storage |
| **Vercel Analytics** | Performance monitoring |

---

## Important Gotchas

- In-class submissions use `inClassSubmissions` collection (NOT `studentSubmissions`)
- Test type can be `'in-class'` or `'inclass'` — always check both
- Firestore timestamps need `.toDate?.()` conversion
- Two Firestore databases: `(default)` and `production`
- `totalMarks` may be 0 for in-class tests until teacher grades
- Melbourne timezone handling is critical — use `melbourne-date.ts` utilities
