'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const CanvasWriter = dynamic(() => import('@/components/ui/CanvasWriter'), {
  ssr: false,
});
import { Toaster, toast } from 'react-hot-toast';
import { StudentPdfSubmission, PageAnnotations } from '@/models/canvasSchema';
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
  const [initialData, setInitialData] = useState<PageAnnotations>({});

  const handleSave = (pagesJson: Record<number, string>) => {
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
        pageAnnotations: pagesJson,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        submittedAt: Timestamp.now(),
    };

    console.log('✅ Generated Submission Object:', submission);
    toast.success('Submission saved! (Check Console)');
    
    // Simulate "Saved" state for resuming later
    setInitialData(pagesJson);
  };

  const handleLoadMockData = () => {
      // Create a dummy red circle drawing for page 1
      // This is a base64 png of a red dot
      const mockDrawing = "data:image/png;base64,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7NnxMcdc8+LFix03Xnstpk6ditmzZ79xzDGSZRmyLMPBgwfxhbPP4uvAByCrVq3CjTfeiFqthqGhIWzfvLkVxLvvvttrlm3btg3r168/poFs2bLltbcFsnv37u/09/ev11rP11o/sGjRov8TSJZlyPIMWZ59YIO1d+iFQgF5niNJkg/8/bHXXotp06Zh9uzZbxxzjGRZhjRNceDAAXz+/HP4ByAcOXIEX/rSl7Bq1SpUq1UMDAzg6aeeQp7nyPMcu3bt6t2O27Ztw/r1649pIOvWrXvlt7/97Uu3BbJnz57v9Pf3r0+SZL7Wev4DDzyAdevWneY60jSF1h9vEK01CoUCXNedUPz/2GuvxbRp0zB79uw3jjmG1hriOEaapp8I5MyZM5g1axYmFArYvXs3HnzwQWRZBizLoLXG7t27sWrVKmzevBnr168/5preeuutX7ktkN27d6/t7+9fnyTJfK31/AULFgDAhwLJsux0BvKj8TwPExMT8H0ftm0f65uOvfZaTJ069b+NOYaSJPnQ55988kmkSQKlFFiWIU1TvPLKK7jjjjveFci777573W2B/PSnP/1Of3//+iRJ5iut5y9YsAAAjncdaZoiSdI3nFz/P0d3dzemTp16zDH/A48//vga27b/8tKlSz/4/PPPX3tbyf9/Pfjgg2vt/xdIB53sL72W1AAAAABJRU5ErkJggg==";
      
      handleSave(mockDrawing);
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
