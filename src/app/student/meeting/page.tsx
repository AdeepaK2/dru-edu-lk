'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { 
  Calendar,
  Clock,
  Video,
  User,
  Search,
  Filter,
  BookOpen,
  CheckCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { TimeSlotService, MeetingBookingService } from '@/apiservices/meetingFireStoreServices';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { MailService } from '@/apiservices/mailService';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { TimeSlot as FirestoreTimeSlot, MeetingBooking as FirestoreMeetingBooking } from '@/models/meetingSchema';
import { TeacherDocument } from '@/models/teacherSchema';
import { ClassDocument } from '@/models/classSchema';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';

interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  classes: string[];
  avatar?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  teacherName: string;
}

interface TimeSlot {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherSubjects: string[];
  teacherClasses: string[];
  classId?: string;
  className?: string;
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  isBooked: boolean;
  meetingLink?: string;
}

interface BookedMeeting {
  id: string;
  teacherId: string;
  teacherName: string;
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  subject?: string;
  className?: string;
}

export default function StudentMeetingPage() {
  const { student, loading: authLoading } = useStudentAuth();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [bookedMeetings, setBookedMeetings] = useState<BookedMeeting[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [expandedTeacher, setExpandedTeacher] = useState<string>('');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [activeTab, setActiveTab] = useState<'select' | 'booked'>('select');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Load initial data
  useEffect(() => {
    if (student?.id) {
      loadInitialData();
    }
  }, [student?.id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!student?.id) return;

      console.log('Starting to load initial data for student:', student.id); // Debug log

      // Step 1: Load student's enrollments
      const studentEnrollments = await getEnrollmentsByStudent(student.id);
      console.log('Student enrollments:', studentEnrollments); // Debug log
      
      const activeEnrollments = studentEnrollments.filter(enrollment => 
        enrollment.status === 'Active'
      );
      console.log('Active enrollments:', activeEnrollments); // Debug log
      setEnrollments(activeEnrollments);

      // Step 2: Load teachers and classes for enrolled subjects
      if (activeEnrollments.length > 0) {
        const { teachers: loadedTeachers, classes: loadedClasses } = await loadEnrolledTeachersAndClasses(activeEnrollments);
        console.log('Loaded teachers:', loadedTeachers); // Debug log
        console.log('Loaded classes:', loadedClasses); // Debug log
        setTeachers(loadedTeachers);
        setClasses(loadedClasses);
        
        // Step 3: Load available time slots from enrolled teachers
        await loadTimeSlotsForTeachers(loadedTeachers);
      } else {
        console.log('No active enrollments found, clearing data'); // Debug log
        // No enrollments, clear the data
        setTeachers([]);
        setClasses([]);
        setTimeSlots([]);
      }
      
      // Step 4: Load student's booked meetings
      await loadBookedMeetings();
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load meeting data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStudentEnrollments = async () => {
    // This function is now incorporated into loadInitialData
    // Keeping it for backward compatibility if needed
    return [];
  };

  const loadEnrolledTeachersAndClasses = async (enrollments: StudentEnrollment[]) => {
    try {
      // Get unique class IDs from enrollments
      const classIds = Array.from(new Set(enrollments.map(e => e.classId)));
      
      // Load classes that the student is enrolled in
      const classPromises = classIds.map(classId => 
        ClassFirestoreService.getClassById(classId)
      );
      const classDocs = (await Promise.all(classPromises)).filter(Boolean) as ClassDocument[];

      // Get unique teacher IDs from the enrolled classes
      const teacherIds = Array.from(new Set(classDocs.map(cls => cls.teacherId).filter(Boolean)));
      
      // Load teachers for the enrolled classes
      const teacherPromises = teacherIds.map(teacherId => 
        TeacherFirestoreService.getTeacherById(teacherId!)
      );
      const teacherDocs = (await Promise.all(teacherPromises)).filter(Boolean) as TeacherDocument[];

      // Transform teacher data
      const transformedTeachers: Teacher[] = teacherDocs.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        subjects: teacher.subjects || [],
        classes: classDocs
          .filter(cls => cls.teacherId === teacher.id)
          .map(cls => cls.name)
      }));

      // Transform class data (only enrolled classes)
      const transformedClasses: ClassInfo[] = classDocs
        .filter(cls => cls.teacherId) // Only include classes with a teacher
        .map(cls => {
          const teacher = teacherDocs.find(t => t.id === cls.teacherId);
          const enrollment = enrollments.find(e => e.classId === cls.id);
          return {
            id: cls.id,
            name: enrollment?.className || cls.name, // Use enrollment name if available
            subject: enrollment?.subject || cls.subject,
            teacherId: cls.teacherId!,
            teacherName: teacher?.name || 'Unknown Teacher'
          };
        });

      return {
        teachers: transformedTeachers,
        classes: transformedClasses
      };
    } catch (err) {
      console.error('Error loading enrolled teachers and classes:', err);
      throw err;
    }
  };

  const loadTimeSlotsForTeachers = async (teachers: Teacher[]) => {
    try {
      // If no teachers loaded yet, don't load slots
      if (teachers.length === 0) {
        setTimeSlots([]);
        return;
      }

      console.log('Loading time slots for teachers:', teachers); // Debug log

      // Get all available slots first, then filter by enrolled teachers
      const allSlots = await TimeSlotService.getAllAvailableSlots();
      console.log('All available slots from Firestore:', allSlots); // Debug log

      // TEMPORARY: Show all slots regardless of teacher enrollment for debugging
      console.log('=== DEBUGGING: Showing ALL slots temporarily ==='); // Debug log
      
      // Transform all slots to see what's available
      const allTransformedSlots: TimeSlot[] = allSlots.map(slot => ({
        id: slot.id,
        teacherId: slot.teacherId,
        teacherName: slot.teacherName,
        teacherSubjects: slot.teacherSubjects,
        teacherClasses: [], // We'll populate this from our loaded data
        day: slot.day,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        isBooked: slot.isBooked,
        meetingLink: slot.meetingLink
      }));

      console.log('All transformed slots:', allTransformedSlots); // Debug log

      // Get teacher IDs from enrolled classes
      const enrolledTeacherIds = new Set(teachers.map(t => t.id));
      console.log('Enrolled teacher IDs:', Array.from(enrolledTeacherIds)); // Debug log

      // Show which slots match enrolled teachers
      allTransformedSlots.forEach(slot => {
        const isEnrolledTeacher = enrolledTeacherIds.has(slot.teacherId);
        console.log(`Slot ${slot.id} for teacher ${slot.teacherId} (${slot.teacherName}): enrolled=${isEnrolledTeacher}, booked=${slot.isBooked}, date=${slot.date}`); // Debug log
      });

      // Filter by enrolled teachers
      const teacherFilteredSlots = allTransformedSlots.filter(slot => 
        enrolledTeacherIds.has(slot.teacherId)
      );
      console.log('Slots after teacher filtering:', teacherFilteredSlots); // Debug log

      // Filter to only show slots in the next 30 days
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const filteredSlots = teacherFilteredSlots.filter(slot => {
        const isInDateRange = slot.date >= today && slot.date <= thirtyDaysFromNow;
        const isNotBooked = !slot.isBooked;
        console.log(`Slot ${slot.id} date ${slot.date}: inRange=${isInDateRange} (today=${today}, max=${thirtyDaysFromNow}), notBooked=${isNotBooked}`); // Debug log
        return isInDateRange && isNotBooked;
      });

      console.log('Final filtered slots:', filteredSlots); // Debug log
      
      // TEMPORARY: For debugging, let's also set all slots to see if the UI works
      // Comment out this line when debugging is done
      // setTimeSlots(allTransformedSlots.filter(slot => !slot.isBooked));
      
      setTimeSlots(filteredSlots);
    } catch (err) {
      console.error('Error loading time slots:', err);
      throw err;
    }
  };



  const loadBookedMeetings = async () => {
    try {
      if (!student?.id) return;

      const bookings = await MeetingBookingService.getStudentBookings(student.id);
      
      // Transform Firestore data to component format
      const transformedBookings: BookedMeeting[] = bookings.map(booking => ({
        id: booking.id,
        teacherId: booking.teacherId,
        teacherName: booking.teacherName,
        slotId: booking.slotId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        meetingLink: booking.meetingLink,
        status: booking.status === 'scheduled' ? 'upcoming' : 
                booking.status === 'completed' ? 'completed' : 'cancelled',
        subject: booking.subject,
        className: '' // We'll populate this when we load classes
      }));

      setBookedMeetings(transformedBookings);
    } catch (err) {
      console.error('Error loading booked meetings:', err);
      throw err;
    }
  };

  // Get available teachers based on selected class
  const getAvailableTeachers = () => {
    if (selectedClass) {
      const classInfo = classes.find(cls => cls.id === selectedClass);
      if (classInfo) {
        return teachers.filter(teacher => teacher.id === classInfo.teacherId);
      }
    }
    return teachers;
  };

  // Get time slots for a specific teacher
  const getTeacherSlots = (teacherId: string) => {
    const slots = timeSlots.filter(slot => {
      const isTeacherMatch = slot.teacherId === teacherId;
      const isNotBooked = !slot.isBooked;
      const isClassMatch = !selectedClass || classes.find(cls => cls.id === selectedClass)?.teacherId === teacherId;
      
      console.log(`Checking slot ${slot.id} for teacher ${teacherId}:`, {
        isTeacherMatch,
        isNotBooked,
        isClassMatch,
        slotTeacherId: slot.teacherId,
        slotBooked: slot.isBooked,
        selectedClass,
        result: isTeacherMatch && isNotBooked && isClassMatch
      }); // Debug log
      
      return isTeacherMatch && isNotBooked && isClassMatch;
    });
    
    console.log(`Total slots for teacher ${teacherId}:`, slots); // Debug log
    return slots;
  };

  const handleTeacherExpand = (teacherId: string) => {
    setExpandedTeacher(expandedTeacher === teacherId ? '' : teacherId);
  };

  const handleBookSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setShowBookingModal(true);
  };

  const confirmBooking = async () => {
    if (!selectedSlot || !student?.id) return;

    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      setSuccessMessage(''); // Clear any previous success messages

      // Book the time slot
      await TimeSlotService.bookTimeSlot(
        selectedSlot.id, 
        student.id, 
        student.name || 'Student'
      );

      // Create a meeting booking record
      await MeetingBookingService.createBooking({
        slotId: selectedSlot.id,
        availabilityId: '', // This should be populated from the slot data
        teacherId: selectedSlot.teacherId,
        teacherName: selectedSlot.teacherName,
        studentId: student.id,
        studentName: student.name || 'Student',
        subject: selectedSlot.teacherSubjects[0] || 'General',
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        duration: selectedSlot.duration,
        meetingLink: selectedSlot.meetingLink || '',
        status: 'scheduled',
        reminderSent: false,
        notes: ''
      });

      // Send email notifications to teacher and parent
      try {
        console.log('Sending meeting confirmation emails...');
        
        // Get teacher details for email
        const teacherDetails = await TeacherFirestoreService.getTeacherById(selectedSlot.teacherId);
        const teacherEmail = teacherDetails?.email || '';
        
        // Get student's parent details
        const parentName = student.parent?.name || 'Parent/Guardian';
        const parentEmail = student.parent?.email || student.email || '';
        
        if (teacherEmail && parentEmail) {
          const emailResult = await MailService.sendMeetingConfirmationEmails(
            selectedSlot.teacherName,
            teacherEmail,
            student.name || 'Student',
            parentName,
            parentEmail,
            selectedSlot.date,
            selectedSlot.startTime,
            selectedSlot.endTime,
            selectedSlot.meetingLink || '',
            selectedSlot.teacherSubjects[0] || 'General'
          );
          
          console.log('Email notifications sent successfully:', emailResult);
          setSuccessMessage(`Meeting successfully booked with ${selectedSlot.teacherName} on ${formatDate(selectedSlot.date)} at ${formatTime(selectedSlot.startTime)}. Confirmation emails have been sent to all parties.`);
        } else {
          console.warn('Missing email addresses - could not send notifications:', {
            teacherEmail,
            parentEmail,
            teacherDetails
          });
          setSuccessMessage(`Meeting successfully booked with ${selectedSlot.teacherName} on ${formatDate(selectedSlot.date)} at ${formatTime(selectedSlot.startTime)}. Note: Email notifications could not be sent due to missing contact information.`);
        }
      } catch (emailError) {
        console.error('Error sending email notifications:', emailError);
        // Don't fail the booking if emails fail
        setSuccessMessage(`Meeting successfully booked with ${selectedSlot.teacherName} on ${formatDate(selectedSlot.date)} at ${formatTime(selectedSlot.startTime)}. Note: Email notifications could not be sent.`);
      }

      // Refresh data
      await loadTimeSlotsForTeachers(teachers);
      await loadBookedMeetings();

      setShowBookingModal(false);
      setSelectedSlot(null);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      console.error('Error booking slot:', err);
      setError('Failed to book the meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTeacherById = (id: string) => {
    return teachers.find(teacher => teacher.id === id);
  };

  // Show loading spinner while authenticating or loading data
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading meeting data...</p>
        </div>
      </div>
    );
  }

  // Show error if not authenticated
  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 dark:bg-red-900/20 p-6 rounded-lg">
            <p className="text-red-600 dark:text-red-400 mb-4">
              Please log in as a student to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Book a Meeting
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Schedule one-on-one sessions with your teachers - <span className="text-green-600 dark:text-green-400 font-medium">Free of charge</span>
              </p>
            </div>
            <Button
              onClick={loadInitialData}
              variant="outline"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          
          {/* Error display */}
          {error && (
            <div className="mt-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Success display */}
          {successMessage && (
            <div className="mt-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                <p className="text-green-600 dark:text-green-400">{successMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('select')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'select'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Select Teacher & Book
            </button>
            <button
              onClick={() => setActiveTab('booked')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'booked'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              My Meetings ({bookedMeetings.length})
            </button>
          </nav>
        </div>

        {activeTab === 'select' && (
          <>
            {/* Class Selection */}
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-4 mb-4">
                <Filter className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Class (Optional)</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setExpandedTeacher(''); // Reset expanded teacher when class changes
                    }}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">All Classes</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} - {cls.subject}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Teachers List with Collapsible Slots */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Available Teachers
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Click on a teacher to see their available time slots
                </p>
              </div>

              <div className="p-6">
                {getAvailableTeachers().length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No teachers available</h3>
                    <p>Try selecting a different class</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getAvailableTeachers().map((teacher) => {
                      const teacherSlots = getTeacherSlots(teacher.id);
                      const isExpanded = expandedTeacher === teacher.id;
                      
                      return (
                        <div
                          key={teacher.id}
                          className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
                        >
                          {/* Teacher Header */}
                          <div
                            className="p-4 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                            onClick={() => handleTeacherExpand(teacher.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                  <span className="text-lg font-medium text-blue-600 dark:text-blue-300">
                                    {teacher.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                    {teacher.name}
                                  </h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {teacher.subjects.join(', ')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {teacherSlots.length} slots available
                                </span>
                                <ChevronRight 
                                  className={`w-5 h-5 text-gray-400 transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`} 
                                />
                              </div>
                            </div>
                          </div>

                          {/* Teacher Slots (Collapsible) */}
                          {isExpanded && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                              {teacherSlots.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                  <p>No available slots for this teacher</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {teacherSlots.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:shadow-md transition-shadow"
                                    >
                                      <div className="space-y-2 mb-3">
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                          <Calendar className="w-4 h-4 mr-2" />
                                          {formatDate(slot.date)}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                          <Clock className="w-4 h-4 mr-2" />
                                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                          <Video className="w-4 h-4 mr-2" />
                                          {slot.duration} minutes
                                        </div>
                                        {slot.className && (
                                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <BookOpen className="w-4 h-4 mr-2" />
                                            {slot.className}
                                          </div>
                                        )}
                                      </div>

                                      <Button
                                        onClick={() => handleBookSlot(slot)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-sm"
                                        size="sm"
                                      >
                                        Book This Slot
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'booked' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                My Scheduled Meetings
              </h2>
            </div>

            <div className="p-6">
              {bookedMeetings.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No meetings scheduled</h3>
                  <p>Book your first meeting with a teacher</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookedMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {meeting.teacherName}
                            </h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              meeting.status === 'upcoming'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                : meeting.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {meeting.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2" />
                              {formatDate(meeting.date)}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-2" />
                              {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                            </div>
                            <div className="flex items-center">
                              <BookOpen className="w-4 h-4 mr-2" />
                              {meeting.subject}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          {meeting.status === 'upcoming' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(meeting.meetingLink, '_blank')}
                            >
                              <Video className="w-4 h-4 mr-2" />
                              Join Meeting
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking Confirmation Modal */}
        {showBookingModal && selectedSlot && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75"></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                  <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-4">
                  Confirm Booking
                </h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Teacher:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedSlot.teacherName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedSlot.date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedSlot.duration} minutes
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowBookingModal(false);
                      setSelectedSlot(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={confirmBooking}
                  >
                    Confirm Booking
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
