'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail as MailIcon, 
  Send, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  Search,
  Filter,
  X
} from 'lucide-react';
import { Button } from '@/components/ui';
import { ComMailFirestoreService } from '@/apiservices/comMailFirestoreService';
import { MailService } from '@/apiservices/mailService';
import { ComMail, ComMailData } from '@/models/comMailSchema';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';

interface MailProps {
  classId: string;
  enrollments: any[];
  teacherId?: string;
  teacherName?: string;
  classData?: any;
}

export default function Mail({ 
  classId, 
  enrollments, 
  teacherId, 
  teacherName, 
  classData 
}: MailProps) {
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<'students' | 'parents' | 'both'>('students');
  const [emailHistory, setEmailHistory] = useState<ComMail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [teacherData, setTeacherData] = useState<any>(null);
  
  // Alert states for success/failure feedback
  const [alertState, setAlertState] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Get dynamic teacher and class names with fallback detection
  const actualTeacherName = teacherData?.name || teacherName || classData?.teacherName || 'DRU Education';
  const actualClassName = classData?.name || 'Class';
  
  // Check if we have valid dynamic data - only use fallback if we truly can't get teacher name
  const hasValidTeacherData = !!(teacherData?.name || teacherName || classData?.teacherName);
  const hasValidClassData = !!(classData?.name);
  const fallbackMode = !hasValidTeacherData;

  // Debug logging
  useEffect(() => {
    console.log('Mail Component Data Check:', {
      teacherData: teacherData,
      teacherName: teacherName,
      classData: classData,
      actualTeacherName: actualTeacherName,
      actualClassName: actualClassName,
      hasValidTeacherData: hasValidTeacherData,
      hasValidClassData: hasValidClassData,
      fallbackMode: fallbackMode
    });
  }, [teacherData, teacherName, classData]);

  // Helper functions for showing alerts
  const showSuccessAlert = (title: string, message: string) => {
    setAlertState({
      show: true,
      type: 'success',
      title,
      message
    });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setAlertState(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const showErrorAlert = (title: string, message: string) => {
    setAlertState({
      show: true,
      type: 'error',
      title,
      message
    });
    // Auto-hide after 8 seconds (longer for errors)
    setTimeout(() => {
      setAlertState(prev => ({ ...prev, show: false }));
    }, 8000);
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, show: false }));
  };

  // Load teacher data using client-side Firebase
  useEffect(() => {
    const fetchTeacherData = async () => {
      if (!classData?.teacherId) return;
      
      try {
        const teacher = await TeacherFirestoreService.getTeacherById(classData.teacherId);
        setTeacherData(teacher);
      } catch (error) {
        console.error('Failed to fetch teacher data:', error);
      }
    };

    fetchTeacherData();
  }, [classData?.teacherId]);

  // Load email history on component mount
  useEffect(() => {
    const loadEmailHistory = async () => {
      setIsLoading(true);
      try {
        const history = await ComMailFirestoreService.getComMailsByClass(classId);
        setEmailHistory(history);
      } catch (error) {
        console.error('Failed to load email history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEmailHistory();
  }, [classId]);

  const handleSendEmail = async () => {
    // Validate required fields
    if (!subject.trim()) {
      showErrorAlert(
        'Subject Required',
        'Please enter a subject for your email before sending.'
      );
      return;
    }
    
    if (!emailBody.trim()) {
      showErrorAlert(
        'Message Required',
        'Please enter a message for your email before sending.'
      );
      return;
    }
    
    // If no students are selected, ask for confirmation
    if (selectedStudents.length === 0) {
      const confirmed = window.confirm(
        `No students are selected. This will send the email to ALL ${recipientType === 'students' ? 'students' : 
          recipientType === 'parents' ? 'parents' : 'students and parents'} in the class. Do you want to continue?`
      );
      if (!confirmed) return;
    }
    
    setIsSending(true);

    try {
      const getRecipientsList = () => {
        const recipients = [];
        
        if (recipientType === 'students' || recipientType === 'both') {
          recipients.push(selectedStudents.length === 0 ? 'All Students' : `${selectedStudents.length} Selected Students`);
        }
        if (recipientType === 'parents' || recipientType === 'both') {
          recipients.push(selectedStudents.length === 0 ? 'All Parents' : `${selectedStudents.length} Selected Parents`);
        }
        
        return recipients;
      };

      const emailData: ComMailData = {
        classId,
        teacherId: classData?.teacherId || teacherId || 'unknown',
        teacherName: fallbackMode ? 'DRU Education' : actualTeacherName,
        subject: subject.trim(),
        body: emailBody.trim(),
        recipientType,
        selectedStudentIds: selectedStudents.length === 0 ? [] : selectedStudents,
        recipientsList: getRecipientsList(),
        priority,
        attachmentNames: [],
        attachmentUrls: [],
        deliveredCount: 0,
        readCount: 0,
        sentAt: new Date(),
        status: 'sent',
        emailType: 'general',
        isScheduled: false
      };

      // Save email to Firestore (comMails collection for history)
      const emailId = await ComMailFirestoreService.createComMail(emailData);
      
      // ALSO save to mail collection for Firebase Mail Extension (actual sending)
      const recipients = getRecipientsList();
      const emailPromises = [];

      // Get actual email addresses based on recipient type and selection
      let emailAddresses: { email: string, name: string }[] = [];
      
      if (selectedStudents.length === 0) {
        // Send to all students/parents
        enrollments.forEach((student: any) => {
          if (recipientType === 'students' || recipientType === 'both') {
            if (student.studentEmail) {
              emailAddresses.push({ 
                email: student.studentEmail, 
                name: student.studentName 
              });
            }
          }
          if (recipientType === 'parents' || recipientType === 'both') {
            if (student.parent?.email) {
              emailAddresses.push({ 
                email: student.parent.email, 
                name: student.parent.name || 'Parent' 
              });
            }
          }
        });
      } else {
        // Send to selected students/parents only
        selectedStudents.forEach(studentId => {
          const student = enrollments.find((s: any) => (s.studentId || s.id) === studentId);
          if (student) {
            if (recipientType === 'students' || recipientType === 'both') {
              if (student.studentEmail) {
                emailAddresses.push({ 
                  email: student.studentEmail, 
                  name: student.studentName 
                });
              }
            }
            if (recipientType === 'parents' || recipientType === 'both') {
              if (student.parent?.email) {
                emailAddresses.push({ 
                  email: student.parent.email, 
                  name: student.parent.name || 'Parent' 
                });
              }
            }
          }
        });
      }

      // Create mail documents for Firebase Mail Extension
      for (const recipient of emailAddresses) {
        const mailPromise = MailService.createMailDocument({
          to: recipient.email,
          subject: subject.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #4F46E5; text-align: center;">${fallbackMode ? 'Message from DRU Education' : `Message from ${actualTeacherName}`}</h2>
              
              <p>Hello ${recipient.name},</p>
              
              <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #374151; margin-top: 0;">Subject: ${subject.trim()}</h3>
                <div style="color: #4B5563; line-height: 1.6;">
                  ${emailBody.trim().replace(/\n/g, '<br>')}
                </div>
              </div>
              
              <p>Best regards,<br>
              ${fallbackMode ? 'DRU Education' : actualTeacherName}<br>
              Dr U Education</p>
              
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
              <p style="font-size: 12px; color: #6B7280; text-align: center;">
                This message was sent through Dr U Education platform.
              </p>
            </div>
          `
        });
        emailPromises.push(mailPromise);
      }

      // Wait for all emails to be queued for sending
      await Promise.all(emailPromises);
      
      console.log(`✅ Email queued for sending to ${emailAddresses.length} recipients via Firebase Mail Extension`);
      
      // Show success alert
      const recipientCount = emailAddresses.length;
      const recipientText = recipientCount === 1 ? 'recipient' : 'recipients';
      showSuccessAlert(
        'Email Sent Successfully!',
        `Your email "${subject.trim()}" has been sent to ${recipientCount} ${recipientText}. Recipients will receive it shortly.`
      );
      
      // TODO: Handle file uploads to Firebase Storage and update attachmentUrls
      
      // Refresh email history
      const updatedHistory = await ComMailFirestoreService.getComMailsByClass(classId);
      setEmailHistory(updatedHistory);

      // Clear form
      setSubject('');
      setEmailBody('');
      setSelectedStudents([]);
      setPriority('normal');
      
      console.log('✅ Email saved successfully with ID:', emailId);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      
      // Show error alert
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorAlert(
        'Failed to Send Email',
        `There was a problem sending your email: ${errorMessage}. Please check your internet connection and try again.`
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectAllStudents = () => {
    if (selectedStudents.length === enrollments.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(enrollments.map(student => student.studentId || student.id));
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const filteredStudents = enrollments.filter(student =>
    student.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Alert */}
      {alertState.show && (
        <div className={`fixed top-4 right-4 max-w-md w-full z-50 ${
          alertState.type === 'success' 
            ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
            : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
        } rounded-lg shadow-lg p-4 transition-all duration-300 ease-in-out`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {alertState.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${
                alertState.type === 'success' 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {alertState.title}
              </h3>
              <p className={`mt-1 text-sm ${
                alertState.type === 'success' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {alertState.message}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={hideAlert}
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  alertState.type === 'success'
                    ? 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 focus:ring-green-600'
                    : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 focus:ring-red-600'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
            <MailIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Class Email
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Send emails to students and parents
            </p>
          </div>
        </div>
      </div>

      {/* Email Composer */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Compose Email
        </h4>

        {/* Recipient Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Send To
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setRecipientType('students')}
              className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-colors ${
                recipientType === 'students'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-center">
                <User className="w-5 h-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Students Only</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Direct to students</div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setRecipientType('parents')}
              className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-colors ${
                recipientType === 'parents'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-center">
                <Users className="w-5 h-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Parents Only</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Direct to parents</div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setRecipientType('both')}
              className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-colors ${
                recipientType === 'both'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-center">
                <Users className="w-5 h-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Students & Parents</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Send to both</div>
              </div>
            </button>
          </div>
        </div>

        {/* Recipients */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Recipients ({selectedStudents.length} selected)
            </label>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllStudents}
              >
                {selectedStudents.length === enrollments.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {/* Search Students */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Students List */}
          <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
            {filteredStudents.map((student) => (
              <div
                key={student.studentId || student.id}
                className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.studentId || student.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleStudentSelection(student.studentId || student.id);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3 cursor-pointer"
                />
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => toggleStudentSelection(student.studentId || student.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {student.studentName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {student.studentEmail}
                        {recipientType === 'parents' && student.parent?.email && (
                          <span> • Parent: {student.parent.email}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      {recipientType === 'both' && (
                        <div className="flex flex-col items-end space-y-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                            Student
                          </span>
                          {student.parent?.email && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                              Parent
                            </span>
                          )}
                        </div>
                      )}
                      {recipientType === 'parents' && student.parent?.email && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {student.parent.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Selection Info */}
          {selectedStudents.length === 0 && (
            <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex">
                <AlertCircle className="flex-shrink-0 w-4 h-4 text-amber-500 mt-0.5" />
                <div className="ml-2">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    No students selected. Email will be sent to <strong>ALL</strong> {recipientType === 'students' ? 'students' : 
                      recipientType === 'parents' ? 'parents' : 'students and parents'} in this class.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subject and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Email Body */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Body *
          </label>
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Type your email message here..."
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {emailBody.length}/2000 characters
          </p>
        </div>

        {/* Send Summary */}
        {(subject.trim() || emailBody.trim() || selectedStudents.length > 0) && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Email Summary</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Recipients:</span>
                <div className="mt-1">
                  {recipientType === 'students' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                      {selectedStudents.length || enrollments.length} Students
                    </span>
                  )}
                  {recipientType === 'parents' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                      {selectedStudents.length || enrollments.length} Parents
                    </span>
                  )}
                  {recipientType === 'both' && (
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                        {selectedStudents.length || enrollments.length} Students
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                        {selectedStudents.length || enrollments.length} Parents
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium">Priority & Length:</span>
                <div className="mt-1 space-y-1">
                  <div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(priority)}`}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </span>
                  </div>
                  <div>
                    <span className={`${emailBody.length > 1800 ? 'text-orange-600' : 'text-gray-600 dark:text-gray-400'}`}>
                      {emailBody.length}/2000 chars
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSendEmail}
            disabled={!subject.trim() || !emailBody.trim() || isSending}
            className="flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Sending...' : 'Send Email'}</span>
          </Button>
        </div>
      </div>

      {/* Email History */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Email History
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recent emails sent to class
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {emailHistory.length === 0 ? (
            <div className="p-6 text-center">
              <MailIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No emails sent yet</p>
            </div>
          ) : (
            emailHistory.map((email) => (
              <div key={email.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                      </span>
                      {email.priority && email.priority !== 'normal' && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(email.priority)}`}>
                          {email.priority.charAt(0).toUpperCase() + email.priority.slice(1)} Priority
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {email.sentAt.toLocaleString('en-AU', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                      {email.subject}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                      {email.body}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>To: {email.recipientsList.join(', ')}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>Delivered: {email.deliveredCount}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-blue-500" />
                        <span>Read: {email.readCount}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
