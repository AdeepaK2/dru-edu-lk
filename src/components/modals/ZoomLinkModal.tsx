'use client';

import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Modal, Button, Input } from '../ui';

interface ZoomLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (zoomLink: string) => Promise<void>;
  loading?: boolean;
  currentZoomLink?: string;
  className?: string;
}

export default function ZoomLinkModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  currentZoomLink = '',
  className = ''
}: ZoomLinkModalProps) {
  const [zoomLink, setZoomLink] = useState(currentZoomLink);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or currentZoomLink changes
  useEffect(() => {
    if (isOpen) {
      setZoomLink(currentZoomLink);
      setError(null);
    }
  }, [isOpen, currentZoomLink]);

  const validateZoomUrl = (url: string): boolean => {
    if (!url.trim()) return true; // Empty is allowed (removes zoom link)
    
    // Zoom URL patterns
    const zoomPatterns = [
      /^https?:\/\/.*zoom\.us\/j\/\d+/,
      /^https?:\/\/.*zoom\.us\/meeting\/\d+/,
      /^https?:\/\/.*zoom\.us\/my\//,
      /^https?:\/\/.*zoom\.com\/j\/\d+/,
      /^https?:\/\/.*zoom\.com\/meeting\/\d+/,
      /^https?:\/\/.*zoom\.com\/my\//,
    ];

    return zoomPatterns.some(pattern => pattern.test(url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLink = zoomLink.trim();

    // Validate Zoom URL format if not empty
    if (trimmedLink && !validateZoomUrl(trimmedLink)) {
      setError('Please enter a valid Zoom meeting URL (e.g., https://zoom.us/j/1234567890)');
      return;
    }

    try {
      await onSubmit(trimmedLink);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update Zoom link');
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className={className} title="Set Class Zoom Link">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Set Class Zoom Link
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Add or update the default Zoom meeting link for this class
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="zoomLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Zoom Meeting Link
              </label>
              <Input
                id="zoomLink"
                type="url"
                placeholder="https://zoom.us/j/1234567890"
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                className="w-full"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to remove the Zoom link. Enter a valid Zoom meeting URL.
              </p>
            </div>

            {/* Preview */}
            {zoomLink.trim() && validateZoomUrl(zoomLink.trim()) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3">
                <div className="flex items-center">
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-sm text-blue-800 dark:text-blue-200">
                    Preview: Students will see this as a clickable "Join Meeting" button
                  </span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {currentZoomLink ? 'Update Link' : 'Add Link'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}