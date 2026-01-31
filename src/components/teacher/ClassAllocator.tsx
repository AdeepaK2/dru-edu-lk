import React from 'react';
import { Users } from 'lucide-react';

interface ClassData {
  id: string;
  name: string;
  subject: string;
  year: string;
}

interface ClassAllocatorProps {
  availableClasses: ClassData[];
  selectedClassIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  error?: string;
  className?: string;
}

export const ClassAllocator: React.FC<ClassAllocatorProps> = ({
  availableClasses,
  selectedClassIds,
  onSelectionChange,
  error,
  className = ''
}) => {
  return (
    <div className={`bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 ${className}`}>
      <h4 className="flex items-center text-md font-medium text-indigo-900 dark:text-indigo-300 mb-2">
        <Users className="w-5 h-5 mr-2" />
        Assign to Classes <span className="text-red-500">*</span>
      </h4>
      <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-3">
        Select which classes should receive this test template.
      </p>
      
      <div className="max-h-40 overflow-y-auto space-y-2 bg-white dark:bg-gray-800 p-3 rounded border border-indigo-200 dark:border-indigo-700">
        {availableClasses.length > 0 ? (
          availableClasses.map(cls => (
            <label key={cls.id} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
              <input
                type="checkbox"
                checked={selectedClassIds.includes(cls.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSelectionChange([...selectedClassIds, cls.id]);
                  } else {
                    onSelectionChange(selectedClassIds.filter(id => id !== cls.id));
                  }
                }}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                 <span className="font-medium text-gray-900 dark:text-white">{cls.name}</span>
                 <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({cls.year})</span>
              </div>
            </label>
          ))
        ) : (
          <p className="text-sm text-gray-500">No classes available.</p>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};
