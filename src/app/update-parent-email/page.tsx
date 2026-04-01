'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface StudentSummary {
  id: string;
  name: string;
  email: string;
  parentName: string;
  parentEmail: string;
}

function UpdateParentEmailForm() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId')?.trim() || '';

  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [studentError, setStudentError] = useState('');

  const [requesterName, setRequesterName] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const adminWhatsApp = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '+61400000000';
  const whatsappDigits = adminWhatsApp.replace(/[^0-9]/g, '');

  useEffect(() => {
    const loadStudent = async () => {
      setStudentLoading(true);
      setStudentError('');

      if (!studentId) {
        setStudent(null);
        setStudentError('Invalid or expired link. Please use the update link from the email again.');
        setStudentLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/parent/email-update-request?studentId=${encodeURIComponent(studentId)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setStudent(null);
          setStudentError(data?.error || 'Student record was not found. Please contact the administrator.');
          setStudentLoading(false);
          return;
        }

        const studentData = data?.student;

        if (!studentData?.id) {
          setStudent(null);
          setStudentError('Student record was not found. Please contact the administrator.');
          setStudentLoading(false);
          return;
        }

        const summary: StudentSummary = {
          id: studentData.id,
          name: studentData.name || '',
          email: studentData.email || '',
          parentName: studentData.parentName || '',
          parentEmail: studentData.parentEmail || '',
        };
        setStudent(summary);
        setRequesterName(summary.parentName || '');
      } catch (err) {
        console.error('Error loading student for parent email request:', err);
        setStudent(null);
        setStudentError('Could not load student details. Please try again or contact the administrator.');
      } finally {
        setStudentLoading(false);
      }
    };

    loadStudent();
  }, [studentId]);

  const whatsappLink = useMemo(() => {
    if (!whatsappDigits) return '';
    const message = encodeURIComponent(
      `Hi, I need help with a parent email update request for student ${student?.name || ''} (${student?.email || ''}).`,
    );
    return `https://wa.me/${whatsappDigits}?text=${message}`;
  }, [student?.email, student?.name, whatsappDigits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!student) {
      setError('Student record is not loaded. Please refresh the page and try again.');
      return;
    }

    if (!newParentEmail.trim()) {
      setError('Please enter the new parent email address.');
      return;
    }

    const normalizedNewParentEmail = newParentEmail.trim().toLowerCase();
    const normalizedStudentEmail = student.email.trim().toLowerCase();
    const normalizedCurrentParentEmail = student.parentEmail.trim().toLowerCase();

    if (normalizedStudentEmail === normalizedNewParentEmail) {
      setError('The new parent email cannot be the same as the student email. Please provide a distinct email address for the parent.');
      return;
    }

    if (normalizedCurrentParentEmail === normalizedNewParentEmail) {
      setError('This email is already set as the parent email. Please use a different email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/parent/email-update-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          requesterName: requesterName.trim(),
          newParentEmail: normalizedNewParentEmail,
        }),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(responseData?.error || 'An error occurred while submitting your request. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setNewParentEmail('');
    } catch (err) {
      console.error('Error creating parent email update request:', err);
      setError('An error occurred while submitting your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Request Parent Email Update
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w">
          Submit your request. Admin will review and approve before any student record is changed.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <p className="text-sm text-green-700">
                  Your request has been submitted. The admin team will review it and update the record after approval.
                </p>
              </div>
            )}

            {studentError && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="text-sm text-red-700">{studentError}</p>
              </div>
            )}

            <div>
              <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700">
                Student Email Address
              </label>
              <div className="mt-1">
                <input
                  id="studentEmail"
                  name="studentEmail"
                  type="email"
                  readOnly
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={student?.email || ''}
                  placeholder={studentLoading ? 'Loading student email...' : 'Student email'}
                />
              </div>
            </div>

            <div>
              <label htmlFor="requesterName" className="block text-sm font-medium text-gray-700">
                Parent Name (Optional)
              </label>
              <div className="mt-1">
                <input
                  id="requesterName"
                  name="requesterName"
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="Parent or guardian name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="newParentEmail" className="block text-sm font-medium text-gray-700">
                Requested New Parent Email
              </label>
              <div className="mt-1">
                <input
                  id="newParentEmail"
                  name="newParentEmail"
                  type="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={newParentEmail}
                  onChange={(e) => setNewParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || studentLoading || !student}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {loading ? 'Submitting...' : 'Submit Update Request'}
              </button>
            </div>

            {whatsappLink && (
              <div className="pt-2">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-green-500 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Contact Admin on WhatsApp
                </a>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function UpdateParentEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <p className="text-sm text-gray-500">Loading parent email update form...</p>
        </div>
      }
    >
      <UpdateParentEmailForm />
    </Suspense>
  );
}
