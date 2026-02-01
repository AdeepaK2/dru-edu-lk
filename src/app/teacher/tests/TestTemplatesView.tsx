import React from 'react';
import { 
  FileText, 
  ArrowLeft, 
  Clock, 
  Settings,
  Calendar,
  Search,
  BookOpen,
  Trash2
} from 'lucide-react';
import { Test, TestTemplate, LiveTest, FlexibleTest } from '@/models/testSchema';

interface TestTemplatesViewProps {
  templates: TestTemplate[];
  onBack: () => void;
  onUseTemplate: (template: TestTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
}

export function TestTemplatesView({ templates, onBack, onUseTemplate, onDeleteTemplate }: TestTemplatesViewProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Filter templates based on search term
  const filteredTemplates = templates.filter(template => 
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    template.subjectName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTemplateDuration = (template: TestTemplate) => {
    // Templates might not have duration if they are generic, 
    // but if they were created from a test, they capture configuration
    // We'll show question count mainly
    return `${template.questions.length} Qs`;
  };

  const formatDate = (date: any) => {
    if (!date) return 'Unknown';
    try {
      // Handle Firestore Timestamp
      const d = date.toDate ? date.toDate() : new Date(date);
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg mr-3">
              <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            Test Templates
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Browse and reuse configurations from your saved templates
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-100 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates by title or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-transparent dark:text-white"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div 
            key={template.id}
            className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 flex flex-col"
          >
            {/* Template Card Content */}
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                   Template
                </span>
                
                {template.subjectName && (
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {template.subjectName}
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {template.title}
              </h3>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-gray-400" />
                  {template.questions?.length || 0} Questions 
                  {template.config?.questionType && (
                    <span className="ml-1 text-gray-400">({template.config.questionType})</span>
                  )}
                </div>
                <div className="flex items-center text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Calendar className="w-3 h-3 mr-1" />
                  Created {formatDate(template.createdAt)}
                  <span className="ml-auto flex items-center text-indigo-600 dark:text-indigo-400">
                    <Settings className="w-3 h-3 mr-1" />
                    Use as Template
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-b-xl border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => onUseTemplate(template)}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 transition-colors"
                title="Use this template to create a new test"
              >
                <FileText className="w-4 h-4 mr-2" />
                Use Template
              </button>
              
              {onDeleteTemplate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this template?')) {
                      onDeleteTemplate(template.id);
                    }
                  }}
                  className="flex items-center justify-center px-3 py-2 bg-white dark:bg-gray-800 border-2 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 transition-colors"
                  title="Delete Template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No templates found</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}
