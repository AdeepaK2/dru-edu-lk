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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
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
      <div className={`min-h-screen bg-gradient-to-br ${theme === 'ben10' ? 'from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : 'from-blue-400 to-indigo-600'} flex items-center justify-center`}>
        <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
          {/* Theme-Specific Loading Animation */}
          <div className="relative mb-6 flex flex-col items-center">
            {/* Tinkerbell Loading GIF */}
            {theme === 'tinkerbell' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/tinkerbell-loading.gif" 
                  alt="Tinkerbell Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Ben 10 Loading GIF */}
            {theme === 'ben10' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/ben10-loading.gif" 
                  alt="Ben 10 Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading</span>
              </div>
            )}

            {/* BounceWorld Loading Animation */}
            {theme === 'bounceworld' && (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-[#1D428A] border-t-[#C8102E] rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl">🏀</span>
                  </div>
                </div>
                <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Meetings...</h2>
            <p className={`text-gray-600 font-medium ${theme === 'bounceworld' ? 'text-[#1D428A]' : ''}`}>
              {theme === 'bounceworld' ? 'Get ready to slam dunk your meeting schedule! 🏀' : 'Get ready to transform your learning!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if not authenticated
  if (!student) {
    return (
      <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : 'bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900'} p-6`}>
        <div className="flex items-center justify-center py-12">
          <div className="bg-gradient-to-r from-red-200 to-pink-200 rounded-3xl shadow-2xl border-4 border-black p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">😔</div>
              <h3 className="text-xl font-black text-black mb-2">Please Log In</h3>
              <p className="text-black font-bold">Please log in as a student to access your meetings!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={`meeting-${theme}`} className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20' : 'bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900'} p-6`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Theme-aware Header */}
        <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-lime-800' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : 'bg-gradient-to-r from-blue-600 via-indigo-700 to-slate-800'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-8 relative overflow-hidden`}>
          

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              <div className={`text-6xl ${theme === 'bounceworld' ? 'text-white' : ''}`}>{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : ''}</div>
              <div>
                <h1 className="text-4xl font-black text-black mb-2 flex items-center">
          
                  
                  <span className={`ml-2 text-4xl ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>Meeting</span>
                  <span className={`ml-2 text-4xl ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>Scheduler</span>
                 
                </h1>
                <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-white' : 'text-blue-100'}`}>
                  {theme === 'bounceworld'
                    ? `Welcome back, ${student?.name}! Slam dunk your one-on-one sessions with your teachers! 🏀`
                    : theme === 'ben10'
                    ? `Welcome back, ${student?.name}! Schedule heroic one-on-one sessions with your teachers!`
                    : theme === 'tinkerbell'
                    ? `Welcome back, ${student?.name}! Schedule magical one-on-one sessions with your teachers!`
                    : `Welcome back, ${student?.name}! Schedule one-on-one sessions with your teachers!`}
                </p>
              </div>
            </div>
            <Button
              onClick={loadInitialData}
              variant="outline"
              disabled={loading}
              className="bg-white hover:bg-gray-100 text-black font-black border-2 border-black rounded-full px-6 py-2"
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </Button>
          </div>
        </div>
          
          {/* Error display */}
          {error && (
            <div className="bg-gradient-to-r from-red-200 to-pink-200 rounded-3xl shadow-2xl border-4 border-black p-6 mt-6">
              <div className="flex items-center space-x-4">
                <div className="text-4xl">😔</div>
                <div>
                  <h3 className="text-xl font-black text-black mb-2">Oops! Something went wrong</h3>
                  <p className="text-black font-bold">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success display */}
          {successMessage && (
            <div className={`bg-gradient-to-r ${
              theme === 'ben10'
                ? 'from-[#64cc4f]/20 to-[#b2e05b]/20'
                : theme === 'tinkerbell'
                ? 'from-yellow-200 to-green-200'
                : theme === 'bounceworld'
                ? 'from-[#1D428A]/20 to-[#C8102E]/20'
                : 'from-blue-200 to-indigo-200'
            } rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-6 mt-6`}>
              <div className="flex items-center space-x-4">
                <div className="text-4xl">🎉</div>
                <div>
                  <h3 className="text-xl font-black text-black mb-2">Success!</h3>
                  <p className="text-black font-bold">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

        {/* Theme-aware Tabs */}
        <div className="bg-white rounded-3xl shadow-2xl border-4 border-black p-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('select')}
              className={`py-3 px-6 rounded-full font-black text-lg transition-all ${
                activeTab === 'select'
                  ? `${
                      theme === 'ben10'
                        ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]'
                        : theme === 'tinkerbell'
                        ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'
                        : theme === 'bounceworld'
                        ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]'
                        : 'bg-gradient-to-r from-blue-400 to-indigo-600'
                    } text-white border-2 border-black`
                  : 'bg-gray-100 hover:bg-gray-200 text-black border-2 border-gray-300'
              }`}
            >
              🎯 Select Teacher & Book
            </button>
            <button
              onClick={() => setActiveTab('booked')}
              className={`py-3 px-6 rounded-full font-black text-lg transition-all ${
                activeTab === 'booked'
                  ? `${
                      theme === 'ben10'
                        ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]'
                        : theme === 'tinkerbell'
                        ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'
                        : theme === 'bounceworld'
                        ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]'
                        : 'bg-gradient-to-r from-blue-400 to-indigo-600'
                    } text-white border-2 border-black`
                  : 'bg-gray-100 hover:bg-gray-200 text-black border-2 border-gray-300'
              }`}
            >
              📅 My Meetings ({bookedMeetings.length})
            </button>
          </nav>
        </div>

        {activeTab === 'select' && (
          <>
            {/* Theme-aware Class Selection */}
            <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} p-6`}>
              <div className="flex items-center space-x-4 mb-6">
              
                <div>
                  <h3 className="text-xl font-black text-black">Select Class (Optional)</h3>
                  <p className="text-gray-600 font-bold">Filter teachers by your enrolled classes </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-black text-black mb-3">
                    🎓 Class
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setExpandedTeacher(''); // Reset expanded teacher when class changes
                    }}
                    className="w-full p-4 border-4 border-black rounded-3xl bg-white text-black font-bold text-lg focus:ring-4 focus:ring-green-400 focus:border-black"
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

            {/* Theme-aware Teachers List */}
            <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} overflow-hidden`}>
              <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`}>
                <h2 className="text-2xl text-black font-black flex items-center">
                  <span className="text-3xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : '👨‍🏫'}</span>
                  Available Teachers
                </h2>
                <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-[#1D428A]' : 'text-blue-100'}`}>
                  {theme === 'bounceworld' ? 'Click on a teacher to slam dunk your time slot selection! 🏀' : 'Click on a teacher to see their time slots'}
                </p>
              </div>

              <div className="p-6">
                {getAvailableTeachers().length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-6">🎓</div>
                    <h3 className="text-2xl font-black text-black mb-4">
                      No Teachers Available Yet
                    </h3>
                    <p className="text-gray-600 font-bold text-lg">
                      {theme === 'ben10' ? 'Hero' : theme === 'tinkerbell' ? 'Magical' : theme === 'bounceworld' ? 'Slam dunk' : 'Learning'} teachers will appear here once they set up their schedules! {theme === 'ben10' ? '⚡' : theme === 'tinkerbell' ? '✨' : theme === 'bounceworld' ? '🏀' : '📚'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getAvailableTeachers().map((teacher) => {
                      const teacherSlots = getTeacherSlots(teacher.id);
                      const isExpanded = expandedTeacher === teacher.id;
                      
                      return (
                        <div
                          key={teacher.id}
                          className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : 'bg-gradient-to-r from-blue-600 to-indigo-700'} rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} overflow-hidden hover:scale-105 transition-all`}
                        >
                          {/* Teacher Header */}
                          <div
                            className="p-6 cursor-pointer transition-all"
                            onClick={() => handleTeacherExpand(teacher.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className={`w-16 h-16 ${theme === 'bounceworld' ? 'bg-gradient-to-br from-[#1D428A] to-[#C8102E]' : 'bg-gradient-to-br from-yellow-400 to-orange-400'} rounded-3xl flex items-center justify-center border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} shadow-lg`}>
                                  <span className={`text-2xl font-black ${theme === 'bounceworld' ? 'text-white' : 'text-black'}`}>
                                    {teacher.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="text-2xl font-black text-black mb-1">
                                    {teacher.name}
                                  </h3>
                                  <p className={`${theme === 'bounceworld' ? 'text-white' : 'text-indigo-100'} font-bold text-lg`}>
                                    {teacher.subjects.join(', ')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <span className={`bg-white text-black px-4 py-2 rounded-full font-black text-sm border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`}>
                                  {teacherSlots.length}  Slots Available
                                </span>
                                <ChevronRight 
                                  className={`w-8 h-8 ${theme === 'bounceworld' ? 'text-white' : 'text-white'} transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`} 
                                />
                              </div>
                            </div>
                          </div>

                          {/* Teacher Slots (Collapsible) */}
                          {isExpanded && (
                            <div className={`p-6 border-t-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} bg-white`}>
                              {teacherSlots.length === 0 ? (
                                <div className="text-center py-8">
                                  <div className="text-4xl mb-4">⏰</div>
                                  <h4 className="text-xl font-black text-black mb-2">
                                    No Available Slots
                                  </h4>
                                  <p className="text-gray-600 font-bold">
                                    This teacher has no available time slots right now
                                  </p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {teacherSlots.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="bg-gradient-to-r from-white to-gray-50 rounded-2xl border-2 border-gray-300 p-4 hover:border-black transition-all"
                                    >
                                      <div className="space-y-3 mb-4">
                                        <div className="flex items-center text-sm text-gray-600 font-bold">
                                          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                                          {formatDate(slot.date)}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 font-bold">
                                          <Clock className="w-5 h-5 mr-2 text-green-600" />
                                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 font-bold">
                                          <Video className="w-5 h-5 mr-2 text-purple-600" />
                                          {slot.duration} minutes
                                        </div>
                                        {slot.className && (
                                          <div className="flex items-center text-sm text-gray-600 font-bold">
                                            <BookOpen className="w-5 h-5 mr-2 text-orange-600" />
                                            {slot.className}
                                          </div>
                                        )}
                                      </div>
                                      
                                      <Button
                                        onClick={() => handleBookSlot(slot)}
                                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-3 rounded-full font-black text-sm transform hover:scale-105 transition-all border-2 border-black"
                                      >
                                        🎯 Book This Slot
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
          <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'} overflow-hidden`}>
            <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white p-6 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : 'border-black'}`}>
              <h2 className="text-2xl font-black flex items-center">
                <span className="text-3xl mr-3">{theme === 'ben10' ? '🦸‍♂️' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '🏀' : '📅'}</span>
                My Scheduled Meetings
              </h2>
            </div>

            <div className="p-6">
              {bookedMeetings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-6">{theme === 'ben10' ? 'Ω' : theme === 'tinkerbell' ? '✨' : theme === 'bounceworld' ? '🏀' : '📚'}</div>
                  <h3 className="text-2xl font-black text-black mb-4">
                    No Meetings Scheduled Yet
                  </h3>
                  <p className="text-gray-600 font-bold text-lg">
                    Book your first {theme === 'ben10' ? 'heroic' : theme === 'tinkerbell' ? 'magical' : theme === 'bounceworld' ? 'slam dunk' : 'enriching'} one-on-one session with a teacher! {theme === 'ben10' ? '⚡' : theme === 'tinkerbell' ? '✨' : theme === 'bounceworld' ? '🏀' : '📚'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {bookedMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="bg-gradient-to-r from-white to-gray-50 rounded-2xl border-2 border-gray-300 p-6 hover:border-black transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-2xl flex items-center justify-center border-2 border-black">
                              <span className="text-lg font-black text-white">
                                {meeting.teacherName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-black">
                                {meeting.teacherName}
                              </h4>
                              <span className={`px-3 py-1 text-sm font-black rounded-full border-2 border-black ${
                                meeting.status === 'upcoming'
                                  ? 'bg-blue-100 text-blue-800'
                                  : meeting.status === 'completed'
                                  ? theme === 'ben10'
                                    ? 'bg-[#64cc4f]/20 text-[#222222]'
                                    : theme === 'tinkerbell'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {meeting.status === 'upcoming' ? '⏰' : meeting.status === 'completed' ? '✅' : '❌'} {meeting.status}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600 font-bold">
                            <div className="flex items-center">
                              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                              {formatDate(meeting.date)}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-5 h-5 mr-2 text-green-600" />
                              {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                            </div>
                            <div className="flex items-center">
                              <BookOpen className="w-5 h-5 mr-2 text-purple-600" />
                              {meeting.subject}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-3 ml-6">
                          {meeting.status === 'upcoming' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(meeting.meetingLink, '_blank')}
                              className={`bg-gradient-to-r ${
                                theme === 'ben10'
                                  ? 'from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]'
                                  : theme === 'tinkerbell'
                                  ? 'from-yellow-400 to-green-500 hover:from-yellow-500 hover:to-green-600'
                                  : 'from-blue-400 to-indigo-600 hover:from-blue-500 hover:to-indigo-700'
                              } text-white px-6 py-3 rounded-full font-black text-sm border-2 border-black transform hover:scale-105 transition-all`}
                            >
                              <Video className="w-5 h-5 mr-2" />
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
              <div className="fixed inset-0 bg-black bg-opacity-50"></div>
              <div className="relative bg-white rounded-3xl shadow-2xl border-4 border-black max-w-md w-full p-8">
                <div className="flex items-center justify-center w-20 h-20 mx-auto bg-gradient-to-br from-yellow-400 to-orange-400 rounded-3xl mb-6 border-4 border-black">
                  <CheckCircle className="w-10 h-10 text-black" />
                </div>
                
                <h3 className="text-2xl font-black text-black text-center mb-6">
                  🎯 Confirm Your {theme === 'ben10' ? 'Hero' : theme === 'tinkerbell' ? 'Magical' : theme === 'bounceworld' ? 'Slam Dunk' : 'Learning'} Booking
                </h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200">
                    <span className="text-gray-600 font-bold">👨‍🏫 Teacher:</span>
                    <span className="font-black text-black">
                      {selectedSlot.teacherName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                    <span className="text-gray-600 font-bold">📅 Date:</span>
                    <span className="font-black text-black">
                      {formatDate(selectedSlot.date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
                    <span className="text-gray-600 font-bold">⏰ Time:</span>
                    <span className="font-black text-black">
                      {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border-2 border-yellow-200">
                    <span className="text-gray-600 font-bold">⏳ Duration:</span>
                    <span className="font-black text-black">
                      {selectedSlot.duration} minutes
                    </span>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-black font-black border-2 border-black rounded-full py-3"
                    onClick={() => {
                      setShowBookingModal(false);
                      setSelectedSlot(null);
                    }}
                  >
                    ❌ Cancel
                  </Button>
                  <Button
                    className={`flex-1 bg-gradient-to-r ${
                      theme === 'ben10'
                        ? 'from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]'
                        : theme === 'tinkerbell'
                        ? 'from-yellow-400 to-green-500 hover:from-yellow-500 hover:to-green-600'
                        : 'from-blue-400 to-indigo-600 hover:from-blue-500 hover:to-indigo-700'
                    } text-white font-black border-2 border-black rounded-full py-3 transform hover:scale-105 transition-all`}
                    onClick={confirmBooking}
                  >
                    🎯 Confirm Booking
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
