'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/form/TextArea';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Calendar,
  School,
  MapPin,
  BookOpen,
  DollarSign,
  Filter,
  Search,
  Eye
} from 'lucide-react';
import { EnrollmentRequestDocument } from '@/models/enrollmentRequestSchema';
import { Student } from '@/models/studentSchema';
import { createStudentEnrollment } from '@/services/studentEnrollmentService';
import { firestore } from '@/utils/firebase-client';
import { collection, query, where, getDocs } from 'firebase/firestore';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminEnrollmentPage() {
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequestDocument[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<EnrollmentRequestDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EnrollmentRequestDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseType, setResponseType] = useState<'approve' | 'reject'>('approve');
  const [responseMessage, setResponseMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchEnrollmentRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [enrollmentRequests, filterStatus, searchQuery]);

  const fetchEnrollmentRequests = async () => {
    try {
      const response = await fetch('/api/enrollment-request');
      if (response.ok) {
        const data = await response.json();
        setEnrollmentRequests(data);
      } else {
        console.error('Failed to fetch enrollment requests');
      }
    } catch (error) {
      console.error('Error fetching enrollment requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = enrollmentRequests;

    // Filter by status
    if (filterStatus !== 'all') {
      const statusMap = {
        'pending': 'Pending',
        'approved': 'Approved', 
        'rejected': 'Rejected'
      } as const;
      filtered = filtered.filter(request => request.status === statusMap[filterStatus as keyof typeof statusMap]);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request =>
        request.student.name.toLowerCase().includes(query) ||
        request.student.email.toLowerCase().includes(query) ||
        request.className.toLowerCase().includes(query) ||
        request.subject.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleStatusUpdate = async (requestId: string, status: 'Approved' | 'Rejected', message?: string) => {
    setProcessing(requestId);
    
    let emailWarning = '';

    try {
      // Find the explicit request we are updating
      const requestToUpdate = enrollmentRequests.find(r => r.id === requestId);
      
      if (status === 'Approved' && requestToUpdate) {
        // 1. Check if the student already exists
        const studentsQuery = query(
          collection(firestore, 'students'),
          where('email', '==', requestToUpdate.student.email)
        );
        const existingStudentSnapshot = await getDocs(studentsQuery);
        
        let studentId: string;
        
        if (!existingStudentSnapshot.empty) {
          // Student exists
          studentId = existingStudentSnapshot.docs[0].id;
        } else {
          // 2. Create the student if they don't exist
          const newStudent: Omit<Student, 'id'> = {
            name: requestToUpdate.student.name,
            email: requestToUpdate.student.email,
            phone: requestToUpdate.student.phone,
            dateOfBirth: requestToUpdate.student.dateOfBirth,
            year: requestToUpdate.student.year,
            school: requestToUpdate.student.school,
            status: 'Active',
            enrollmentDate: new Date().toISOString().split('T')[0],
            coursesEnrolled: 0,
            avatar: requestToUpdate.student.name.substring(0, 2).toUpperCase(),
            parent: {
              name: requestToUpdate.parent.name,
              email: requestToUpdate.parent.email,
              phone: requestToUpdate.parent.phone,
            },
            payment: {
              status: 'Pending',
              method: '',
              lastPayment: 'N/A'
            },
          };
          
          const studentResponse = await fetch('/api/student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStudent),
          });
          
          if (!studentResponse.ok) {
            const errorData = await studentResponse.json();
            throw new Error(`Failed to create student account: ${errorData.error || errorData.message || 'Unknown error'}`);
          }
          
          const createdStudent = await studentResponse.json();
          studentId = createdStudent.id;
          
          if (createdStudent.emailSuccess === false) {
            emailWarning = '\n\nWARNING: Student created successfully, but the welcome email failed to send. Please resend it from the Students page.';
          }
        }
        
        // 3. Create the enrollment tracking record
        try {
          await createStudentEnrollment({
            studentId: studentId,
            classId: requestToUpdate.classId,
            studentName: requestToUpdate.student.name,
            studentEmail: requestToUpdate.student.email,
            className: requestToUpdate.className,
            subject: requestToUpdate.subject,
            enrolledAt: new Date(),
            status: 'Active',
            attendance: 0,
            notes: requestToUpdate.additionalNotes || undefined,
          });
        } catch (enrollmentError) {
          console.error("Failed to create student enrollment record", enrollmentError);
          // Let it continue to approve the request, but log the error
        }
      }

      // Finally, update the request status
      const response = await fetch('/api/enrollment-request', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: requestId,
          status,
          adminResponse: message,
          ...(status === 'Approved' ? { processedAt: new Date().toISOString() } : {})
        }),
      });

      if (response.ok) {
        // Refresh the data
        await fetchEnrollmentRequests();
        setShowResponseModal(false);
        setResponseMessage('');
        setSelectedRequest(null);
        alert(`Request updated successfully!${status === 'Approved' ? ' Student account and enrollment created.' : ''}${emailWarning}`);
      } else {
        const errorData = await response.json();
        alert('Failed to update request: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error updating enrollment request:', error);
      alert(error.message || 'Failed to update request. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickApprove = (request: EnrollmentRequestDocument) => {
    handleStatusUpdate(request.id, 'Approved');
  };

  const handleResponseWithMessage = (request: EnrollmentRequestDocument, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setResponseType(type);
    setResponseMessage('');
    setShowResponseModal(true);
  };

  const submitResponse = () => {
    if (!selectedRequest) return;
    
    const statusMap = {
      'approve': 'Approved' as const,
      'reject': 'Rejected' as const
    };
    
    handleStatusUpdate(
      selectedRequest.id,
      statusMap[responseType],
      responseMessage.trim() || undefined
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="warning" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'Approved':
        return <Badge variant="success" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'Rejected':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-[#0088e0] border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading enrollment requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Enrollment Management</h1>
          <p className="mt-2 text-blue-100">
            Review and manage student enrollment requests
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0]"
              >
                <option value="all">All Requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2 max-w-md w-full">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by student name, email, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0] w-full"
            />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#01143d]">
                {enrollmentRequests.length}
              </div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {enrollmentRequests.filter(r => r.status === 'Pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {enrollmentRequests.filter(r => r.status === 'Approved').length}
              </div>
              <div className="text-sm text-gray-600">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {enrollmentRequests.filter(r => r.status === 'Rejected').length}
              </div>
              <div className="text-sm text-gray-600">Rejected</div>
            </CardContent>
          </Card>
        </div>

        {/* Enrollment Requests List */}
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                {searchQuery || filterStatus !== 'all' 
                  ? 'No matching requests found' 
                  : 'No enrollment requests yet'
                }
              </h3>
              <p className="text-gray-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Enrollment requests will appear here when students apply.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg text-[#01143d]">
                        {request.student.name}
                      </CardTitle>
                      <p className="text-gray-600">{request.className} - {request.subject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
                      <span className="text-sm text-gray-500">
                        {formatDate(request.createdAt.seconds ? new Date(request.createdAt.seconds * 1000).toISOString() : request.createdAt.toString())}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      {request.student.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      {request.student.phone}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <School className="w-4 h-4 mr-2" />
                      {request.student.year}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="w-4 h-4 mr-2" />
                      ${request.sessionFee}/session
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      Preferred start: {formatDate(request.preferredStartDate)}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowDetailModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                      
                      {request.status === 'Pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleQuickApprove(request)}
                            disabled={processing === request.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {processing === request.id ? 'Processing...' : 'Quick Approve'}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResponseWithMessage(request, 'approve')}
                            disabled={processing === request.id}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            Approve with Message
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResponseWithMessage(request, 'reject')}
                            disabled={processing === request.id}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <Modal
          title="Enrollment Request Details"
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          className="max-w-4xl"
        >
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Enrollment Request Details</h2>
              {getStatusBadge(selectedRequest.status)}
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Student Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Student Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Name:</span>
                    <span className="ml-2">{selectedRequest.student.name}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Email:</span>
                    <span className="ml-2">{selectedRequest.student.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Phone:</span>
                    <span className="ml-2">{selectedRequest.student.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Date of Birth:</span>
                    <span className="ml-2">{formatDate(selectedRequest.student.dateOfBirth)}</span>
                  </div>
                  <div className="flex items-center">
                    <School className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Year:</span>
                    <span className="ml-2">{selectedRequest.student.year}</span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">School:</span>
                    <span className="ml-2">{selectedRequest.student.school}</span>
                  </div>
                </div>
              </div>

              {/* Parent Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Parent/Guardian Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Name:</span>
                    <span className="ml-2">{selectedRequest.parent.name}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Email:</span>
                    <span className="ml-2">{selectedRequest.parent.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">Phone:</span>
                    <span className="ml-2">{selectedRequest.parent.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">Relationship:</span>
                    <span className="ml-2">{selectedRequest.parent.relationship}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Class Information */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="font-medium">Class:</span>
                  <span className="ml-2">{selectedRequest.className}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium">Subject:</span>
                  <span className="ml-2">{selectedRequest.subject}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="font-medium">Center:</span>
                  <span className="ml-2">{selectedRequest.centerName}</span>
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="font-medium">Session Fee:</span>
                  <span className="ml-2">${selectedRequest.sessionFee}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="font-medium">Preferred Start:</span>
                  <span className="ml-2">{formatDate(selectedRequest.preferredStartDate)}</span>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            {selectedRequest.additionalNotes && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Additional Notes</h3>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {selectedRequest.additionalNotes}
                </p>
              </div>
            )}

            {/* Admin Notes */}
            {selectedRequest.adminNotes && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Notes</h3>
                <p className="text-gray-600 bg-blue-50 p-3 rounded-lg">
                  {selectedRequest.adminNotes}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
              {selectedRequest.status === 'Pending' && (
                <>
                  <Button
                    onClick={() => handleResponseWithMessage(selectedRequest, 'approve')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleResponseWithMessage(selectedRequest, 'reject')}
                    variant="outline"
                    className="border-red-600 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Response Modal */}
      {showResponseModal && selectedRequest && (
        <Modal
          title={`${responseType === 'approve' ? 'Approve' : 'Reject'} Enrollment Request`}
          isOpen={showResponseModal}
          onClose={() => setShowResponseModal(false)}
          className="max-w-2xl"
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {responseType === 'approve' ? 'Approve' : 'Reject'} Enrollment Request
            </h2>
            
            <p className="text-gray-600 mb-4">
              Student: <span className="font-medium">{selectedRequest.student.name}</span><br />
              Class: <span className="font-medium">{selectedRequest.className}</span>
            </p>
            
            <Textarea
              label={`${responseType === 'approve' ? 'Approval' : 'Rejection'} Message (Optional)`}
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder={
                responseType === 'approve'
                  ? 'Welcome to our program! Please contact us to complete enrollment...'
                  : 'Thank you for your interest. Unfortunately...'
              }
              rows={4}
            />
            
            <div className="flex justify-end space-x-4 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowResponseModal(false)}
                disabled={processing === selectedRequest.id}
              >
                Cancel
              </Button>
              <Button
                onClick={submitResponse}
                disabled={processing === selectedRequest.id}
                className={
                  responseType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }
              >
                {processing === selectedRequest.id ? 'Processing...' : 
                 responseType === 'approve' ? 'Approve Request' : 'Reject Request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
