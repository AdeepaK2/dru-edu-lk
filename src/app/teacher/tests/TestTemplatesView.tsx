import React from 'react';
import { 
  FileText, 
  ArrowLeft, 
  Settings,
  Calendar,
  Search,
  BookOpen,
  Trash2,
  Download,
  Eye
} from 'lucide-react';
import { TestTemplate } from '@/models/testSchema';
import { ClassDocument } from '@/models/classSchema';
import { generateTemplatePDF } from '@/utils/generateTemplatePDF';
import TestTemplatePreviewModal from '@/components/modals/TestTemplatePreviewModal';

interface TestTemplatesViewProps {
  templates: TestTemplate[];
  classes?: ClassDocument[];
  onBack: () => void;
  onUseTemplate: (template: TestTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
}

type TimeRangeFilter = 'all' | '7' | '30' | '90' | '365';
type SortFilter = 'newest' | 'oldest' | 'title';

export function TestTemplatesView({ templates, classes = [], onBack, onUseTemplate, onDeleteTemplate }: TestTemplatesViewProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = React.useState<TestTemplate | null>(null);
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [selectedGrade, setSelectedGrade] = React.useState('');
  const [selectedSubjectId, setSelectedSubjectId] = React.useState('');
  const [timeRange, setTimeRange] = React.useState<TimeRangeFilter>('all');
  const [sortBy, setSortBy] = React.useState<SortFilter>('newest');

  const uniqueGrades = React.useMemo(
    () => Array.from(new Set(classes.map(classItem => classItem.year).filter(Boolean))).sort(),
    [classes]
  );

  const uniqueSubjects = React.useMemo(() => {
    const subjects = new Map<string, string>();

    classes.forEach(classItem => {
      if (classItem.subjectId) {
        subjects.set(classItem.subjectId, classItem.subject || classItem.subjectId);
      }
    });

    templates.forEach(template => {
      if (template.subjectId) {
        subjects.set(template.subjectId, template.subjectName || template.subjectId);
      }
    });

    return Array.from(subjects.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, templates]);

  const getTemplateDate = (template: TestTemplate) => {
    const date = template.createdAt;

    if (!date) return null;

    try {
      return date.toDate ? date.toDate() : new Date(date as any);
    } catch {
      return null;
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedClassId('');
    setSelectedGrade('');
    setSelectedSubjectId('');
    setTimeRange('all');
    setSortBy('newest');
  };

  const filteredTemplates = React.useMemo(() => {
    const selectedClass = classes.find(classItem => classItem.id === selectedClassId);
    const rangeDays = timeRange === 'all' ? null : Number(timeRange);
    const rangeStart = rangeDays ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000) : null;

    return templates
      .filter(template => {
        const search = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !search ||
          template.title.toLowerCase().includes(search) ||
          template.subjectName?.toLowerCase().includes(search);

        const matchesClass = !selectedClass || template.subjectId === selectedClass.subjectId;
        const matchesGrade =
          !selectedGrade ||
          classes.some(classItem => classItem.year === selectedGrade && classItem.subjectId === template.subjectId);
        const matchesSubject = !selectedSubjectId || template.subjectId === selectedSubjectId;
        const createdDate = getTemplateDate(template);
        const matchesTimeRange = !rangeStart || (createdDate !== null && createdDate >= rangeStart);

        return matchesSearch && matchesClass && matchesGrade && matchesSubject && matchesTimeRange;
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }

        const aDate = getTemplateDate(a)?.getTime() || 0;
        const bDate = getTemplateDate(b)?.getTime() || 0;

        return sortBy === 'newest' ? bDate - aDate : aDate - bDate;
      });
  }, [classes, searchTerm, selectedClassId, selectedGrade, selectedSubjectId, sortBy, templates, timeRange]);

  const hasActiveFilters =
    searchTerm ||
    selectedClassId ||
    selectedGrade ||
    selectedSubjectId ||
    timeRange !== 'all' ||
    sortBy !== 'newest';

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

  const handleDownloadPDF = async (template: TestTemplate) => {
    try {
      setDownloadingId(template.id);
      await generateTemplatePDF(template);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingId(null);
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-100 dark:border-gray-700 space-y-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Class
            </label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All classes</option>
              {classes.map(classItem => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Grade
            </label>
            <select
              value={selectedGrade}
              onChange={(event) => setSelectedGrade(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All grades</option>
              {uniqueGrades.map(grade => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All subjects</option>
              {uniqueSubjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRangeFilter)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortFilter)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Showing {filteredTemplates.length} of {templates.length} template{templates.length !== 1 ? 's' : ''}
          </span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
            >
              Clear filters
            </button>
          )}
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
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-b-xl border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUseTemplate(template);
                }}
                className="flex-1 min-w-[130px] flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 transition-colors"
                title="Use this template to create a new test"
              >
                <FileText className="w-4 h-4 mr-2" />
                Use Template
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewTemplate(template);
                }}
                className="flex-1 min-w-[110px] flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-800 border-2 border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 transition-colors"
                title="Preview questions and answers"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadPDF(template);
                }}
                disabled={downloadingId === template.id}
                className="flex items-center justify-center px-3 py-2 bg-white dark:bg-gray-800 border-2 border-green-100 dark:border-green-900/50 text-green-600 dark:text-green-400 font-medium rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download questions as PDF"
              >
                {downloadingId === template.id ? (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
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

      <TestTemplatePreviewModal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        template={previewTemplate}
      />
    </div>
  );
}
