'use client';

import Link from 'next/link';
import Image from 'next/image';

interface FooterProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

export default function Footer({ variant = 'default', className = '' }: FooterProps) {
  if (variant === 'minimal') {
    return (
      <footer className={`bg-gray-900 text-white py-8 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Image
                src="/Logo.png"
                alt="Dr. U Education"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-bold">Dr. U Education</span>
            </div>
            <div className="text-gray-400 text-sm text-center md:text-right">
              <p>© {new Date().getFullYear()} Dr. U Education. All rights reserved.</p>
              <p className="mt-1">
                ©{new Date().getFullYear()} Dr.U All Rights Reserved | Powered By{' '}
                <a 
                  href="https://www.adeepa.tech/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  AdeepaK
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`bg-gradient-to-br from-gray-900 to-gray-800 text-white ${className} relative z-10`}>
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-6">
              <Image
                src="/Logo.png"
                alt="Dr. U Education"
                width={50}
                height={50}
                className="rounded-lg"
              />
              <div>
                <h3 className="text-xl font-bold">Dr. U Education</h3>
                <p className="text-secondary-400 text-sm">Excellence in Education</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Empowering students across Melbourne with personalized coaching, 
              expert guidance, and innovative learning methods for academic success.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/courses" className="text-gray-300 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                  Our Courses
                </Link>
              </li>
              <li>
                <Link href="/enroll" className="text-gray-300 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                  Enrolment
                </Link>
              </li>
              <li>
                <Link href="/books" className="text-gray-300 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                  Publications
                </Link>
              </li>
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Portals</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/student/login" className="text-gray-300 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                  Student Portal
                </Link>
              </li>
              <li>
                <Link href="/teacher/login" className="text-gray-300 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                  Teacher Portal
                </Link>
              </li>
              <li>
                <Link href="/admin/login" className="text-gray-300 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                  Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Office & Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Office</h4>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 mt-1 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-gray-300 text-sm leading-relaxed">63A High Street Cranbourne</p>
                  <p className="text-gray-300 text-sm leading-relaxed">230/A Blackburn Road, Glen Waverley</p>
                  <p className="text-gray-300 text-sm leading-relaxed">Melbourne, Victoria, Australia</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a 
                  href="mailto:info@drueducation.com" 
                  className="text-gray-300 hover:text-white transition-colors duration-200 text-sm cursor-pointer relative z-20 p-1"
                >
                  info@drueducation.com
                </a>
              </div>
              
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a 
                  href="tel:+61478716402" 
                  className="text-gray-300 hover:text-white transition-colors duration-200 text-sm cursor-pointer relative z-20 p-1"
                >
                  0478 716 402
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0 text-center md:text-left">
              <p>©{new Date().getFullYear()} Dr.U All Rights Reserved | Powered By{' '}
                <a 
                  href="https://www.adeepa.tech/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer transition-colors duration-200 relative z-20 p-1"
                >
                  AdeepaK
                </a>
              </p>
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                Terms of Service
              </Link>
              <Link href="/sitemap" className="text-gray-400 hover:text-white transition-colors duration-200 cursor-pointer inline-block relative z-20 p-1">
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
