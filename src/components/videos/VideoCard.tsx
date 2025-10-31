import React, { useState, useEffect, useRef } from 'react';
import { formatDuration } from '@/models/videoSchema';
import Link from 'next/link';
import { Trash2, Users, MoreVertical } from 'lucide-react';

interface VideoCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  subject: string;
  duration?: number;
  views: number;
  timestamp: string;
  price?: number; // Price in dollars
  className?: string;
  onDelete?: (videoId: string) => void;
  onAssignToClass?: (videoId: string) => void;
  showActions?: boolean;
}

export default function VideoCard({
  id,
  title,
  thumbnailUrl,
  subject,
  duration,
  views,
  timestamp,
  price,
  className = '',
  onDelete,
  onAssignToClass,
  showActions = false,
}: VideoCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
    setShowDropdown(false);
  };

  const handleAssignToClass = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAssignToClass) {
      onAssignToClass(id);
    }
    setShowDropdown(false);
  };  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow relative ${className}`}>      {/* Action buttons */}
      {showActions && (
        <div className="absolute top-2 right-2 z-10" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1.5 rounded-full transition-all"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                <button
                  onClick={handleAssignToClass}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Assign to Classes
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Video
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <Link href={`/admin/videos/${id}`} className="block"><div className="relative aspect-video">
          <img
            src={thumbnailUrl || '/placeholder-thumbnail.jpg'}
            alt={title}
            className="w-full h-full object-cover"
          />
          {/* Price badge */}
          {price !== undefined && (
            <div className="absolute top-2 left-2 bg-[#64cc4f] text-white text-xs px-2 py-1 rounded-full font-medium">
              {price === 0 ? 'FREE' : `$${price.toFixed(2)}`}
            </div>
          )}
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(duration)}
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">{title}</h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-blue-600 dark:text-blue-400">{subject}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{views} views</span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {timestamp}
          </div>
        </div>
      </Link>
    </div>
  );
}
