'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

type State = 'verifying' | 'success' | 'already' | 'error';

export default function VerifyTestimonialPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>('verifying');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/testimonials/verify/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setState(data.alreadyVerified ? 'already' : 'success');
        } else {
          setState('error');
        }
      })
      .catch(() => setState('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0]">
        <Navbar />
      </div>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        {state === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-12 h-12 border-4 border-[#0088e0] border-t-transparent rounded-full" />
            <p className="text-gray-500">Verifying your testimonial…</p>
          </div>
        )}

        {state === 'success' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#01143d] mb-3">Testimonial Verified!</h2>
            <p className="text-gray-500 mb-2">
              Thank you for verifying your email. Your testimonial is now pending review by our team.
            </p>
            <p className="text-gray-400 text-sm mb-8">
              Once approved, it will appear on our testimonials page with an <strong>Email Verified</strong> badge.
            </p>
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium px-3 py-1.5 rounded-full mb-8">
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Email Verified
            </div>
            <br />
            <Link
              href="/testimonials"
              className="inline-block bg-[#0088e0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0066b3] transition-colors"
            >
              View Testimonials Page
            </Link>
          </div>
        )}

        {state === 'already' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#01143d] mb-3">Already Verified</h2>
            <p className="text-gray-500 mb-8">
              Your testimonial has already been verified. Our team will review it shortly.
            </p>
            <Link
              href="/testimonials"
              className="inline-block bg-[#0088e0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0066b3] transition-colors"
            >
              View Testimonials Page
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#01143d] mb-3">Link Not Valid</h2>
            <p className="text-gray-500 mb-8">
              This verification link is invalid or has expired. If you believe this is an error, please
              contact us.
            </p>
            <Link
              href="/"
              className="inline-block bg-[#0088e0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0066b3] transition-colors"
            >
              Go to Homepage
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
