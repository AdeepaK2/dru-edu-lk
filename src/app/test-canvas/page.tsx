'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const CanvasWriter = dynamic(() => import('@/components/ui/CanvasWriter'), {
  ssr: false,
});
import { Toaster, toast } from 'react-hot-toast';
import { StudentPdfSubmission } from '@/models/canvasSchema';
import type { LineData } from '@/components/ui/useCanvasWriter';
import { Timestamp } from 'firebase/firestore';

// Mock Data
const CLASSES = [
  { id: 'class_001', name: 'Mathematics 101' },
  { id: 'class_002', name: 'Science 202' },
  { id: 'class_003', name: 'History 303' },
];

const STUDENTS = [
  { id: 'stu_001', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 'stu_002', name: 'Bob Smith', email: 'bob@example.com' },
  { id: 'stu_003', name: 'Charlie Brown', email: 'charlie@example.com' },
];

export default function TestCanvasPage() {
  const [mode, setMode] = useState<'plain' | 'pdf'>('plain'); // Keep plain mode for basic testing
  const [pdfUrl, setPdfUrl] = useState('https://pdfobject.com/pdf/sample.pdf');
  
  // Selection State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [submissionTitle, setSubmissionTitle] = useState('My Worksheet Submission');

  // Mock Loading State
  const [initialData, setInitialData] = useState<Record<number, LineData[]>>({});

  const handleSave = (pagesJson: Record<number, LineData[]>) => {
    // Basic validation
    if (!selectedClassId || !selectedStudentId) {
        toast.error('Please select a Class and Student first!');
        return;
    }

    const selectedClass = CLASSES.find(c => c.id === selectedClassId);
    const selectedStudent = STUDENTS.find(s => s.id === selectedStudentId);

    if (!selectedClass || !selectedStudent) return;

    const submission: StudentPdfSubmission = {
        id: `sub_${Date.now()}`,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentEmail: selectedStudent.email,
        classId: selectedClass.id,
        className: selectedClass.name,
        originalPdfUrl: mode === 'pdf' ? pdfUrl : 'plain-canvas',
        submissionType: 'homework',
        title: submissionTitle,
        status: 'submitted',
        pageAnnotations: {} as any, // pageAnnotations now stored as JSON in Firestore separately
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        submittedAt: Timestamp.now(),
    };

    console.log('✅ Generated Submission Object:', submission);
    console.log('✅ Stroke JSON:', pagesJson);
    toast.success('Submission saved! (Check Console)');
    
    // Simulate "Saved" state for resuming later
    setInitialData(pagesJson);
  };

  const handleLoadMockData = () => {
      // Create a dummy stroke for page 1 (previously a base64 PNG, now LineData JSON)
      const mockStroke: LineData = {
        points: [100, 100, 150, 150, 200, 100],
        color: '#e53e3e',
        strokeWidth: 4,
        tool: 'pen',
      };
      
      setInitialData({ 1: [mockStroke] });
      toast.success('Mock data loaded!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster />
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Canvas Submission Demo</h1>
            <p className="text-gray-500 mt-2">Test the PDF annotation and submission schema generation.</p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">1. Submission Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                    <select 
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                        <option value="">-- Select Class --</option>
                        {CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
                    <select 
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                    >
                        <option value="">-- Select Student --</option>
                        {STUDENTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Submission Title</label>
                    <input 
                        type="text" 
                        value={submissionTitle}
                        onChange={(e) => setSubmissionTitle(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>
            
            {/* Simulation Controls */}
            <div className="flex justify-end pt-2">
                 <button 
                    onClick={handleLoadMockData}
                    className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border"
                 >
                    Simulate "Load Previous Work"
                 </button>
            </div>
        </div>

        {/* Canvas Mode Selection */}
         <div className="flex justify-center gap-4">
            <button 
                onClick={() => setMode('plain')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'plain' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
                Plain Canvas
            </button>
            <button 
                onClick={() => setMode('pdf')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'pdf' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
                PDF Annotation
            </button>
        </div>

        {mode === 'pdf' && (
             <div className="max-w-xl mx-auto">
                <input 
                    type="text" 
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center"
                    placeholder="Enter PDF URL..."
                />
            </div>
        )}

        {/* Canvas Area */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">
                <span>2. {mode === 'plain' ? 'Answer Area' : 'Worksheet'}</span>
                <span className="text-xs font-normal text-gray-500">Draw/write your answers below (Ctrl+S to save)</span>
            </h2>
            
            {mode === 'plain' ? (
                <CanvasWriter 
                    height={500}
                    onSave={handleSave}
                    initialPageAnnotations={initialData}
                />
            ) : (
                <CanvasWriter 
                    pdfUrl={pdfUrl}
                    onSave={handleSave}
                    initialPageAnnotations={initialData}
                />
            )}
        </div>
      </div>
    </div>
  );
}
