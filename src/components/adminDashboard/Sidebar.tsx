'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen,
  Video, 
  CreditCard, 
  FileQuestion, 
  Settings, 
  LogOut,
  Library,
  Calendar,
  FileCheck,
  MessageCircle
} from 'lucide-react';

// Define sidebar menu items with Lucide icons
const menuItems = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin' },
  { label: 'Students', icon: <Users size={20} />, path: '/admin/students' },
  { label: 'Teachers', icon: <GraduationCap size={20} />, path: '/admin/teachers' },
  { label: 'Subjects', icon: <Library size={20} />, path: '/admin/subjects' },
  { label: 'Classes', icon: <BookOpen size={20} />, path: '/admin/classes' },
  // TODO: Re-enable chat after mobile app production launch
  // { label: 'Chat', icon: <MessageCircle size={20} />, path: '/admin/chat' },
  { label: 'Books', icon: <BookOpen size={20} />, path: '/admin/books' },
  { label: 'Video Portal', icon: <Video size={20} />, path: '/admin/videos' },
  { label: 'Meetings', icon: <Video size={20} />, path: '/admin/meetings' },
  { label: 'Documents', icon: <FileCheck size={20} />, path: '/admin/documents' },
  { label: 'Transactions', icon: <CreditCard size={20} />, path: '/admin/transactions' },
  { label: 'Question Banks', icon: <FileQuestion size={20} />, path: '/admin/question-banks' },
];

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const pathname = usePathname();

  return (
    <div className={`sidebar transition-all duration-300 ${isOpen ? 'w-64' : 'w-16'} fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 shadow-xl z-10 border-r border-gray-200 dark:border-gray-700 flex flex-col`}>
      
      <nav className="flex-1 mt-6 pb-20 overflow-y-auto">
        <ul className="space-y-2 px-3">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                prefetch={true}
                className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 text-left group
                  ${pathname === item.path 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold shadow-sm border border-blue-200 dark:border-blue-800' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-500 hover:shadow-sm'}
                `}
              >
                <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                  {item.icon}
                </div>
                {isOpen && (
                  <span className="ml-3 transition-all duration-200 whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <Link
          href="/admin/logout"
          prefetch={false}
          className="flex items-center p-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 font-medium shadow-sm border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700"
        >
          <LogOut size={20} />
          {isOpen && <span className="ml-3 whitespace-nowrap">Sign Out</span>}
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;