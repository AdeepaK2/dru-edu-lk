'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { TeacherAvailabilityService, TimeSlotService, MeetingBookingService } from '@/apiservices/meetingFireStoreServices';
import { 
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit,
  Users,
  Video,
  Save,
  X,
  AlertCircle
} from 'lucide-react';

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  isBooked?: boolean;
  studentId?: string;
  studentName?: string;
  meetingLink?: string;
}

interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  slotDuration: number; // in minutes (15, 30, 45, 60)
}

const SLOT_DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' }
];

export default function TeacherMeetingPage() {
  const { teacher, loading: authLoading } = useTeacherAuth();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [bookedMeetings, setBookedMeetings] = useState<TimeSlot[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    slotDuration: 30
  });

  // Load teacher's availability on component mount
  useEffect(() => {
    if (teacher?.id) {
      loadTeacherData();
    }
  }, [teacher?.id]);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      if (!teacher?.id) return;

      // Load both availability and booked meetings
      await Promise.all([
        loadTeacherAvailability(),
        loadBookedMeetings()
      ]);
    } catch (err) {
      console.error('Error loading teacher data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherAvailability = async () => {
    try {
      if (!teacher?.id) return;

      const availability = await TeacherAvailabilityService.getTeacherAvailability(teacher.id);
      setAvailabilitySlots(availability.map(slot => ({
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotDuration: slot.slotDuration
      })));
    } catch (err) {
      console.error('Error loading availability:', err);
      throw err;
    }
  };

  const loadBookedMeetings = async () => {
    try {
      if (!teacher?.id) return;

      const bookings = await MeetingBookingService.getTeacherBookings(teacher.id);
      
      // Transform bookings to TimeSlot format for display
      const meetings: TimeSlot[] = bookings
        .filter(booking => booking.status === 'scheduled') // Only show scheduled meetings
        .map(booking => ({
          id: booking.id,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.duration,
          isBooked: true,
          studentId: booking.studentId,
          studentName: booking.studentName,
          meetingLink: booking.meetingLink
        }));

      setBookedMeetings(meetings);
    } catch (err) {
      console.error('Error loading booked meetings:', err);
      throw err;
    }
  };

  const validateForm = (): string | null => {
    const { date, startTime, endTime, slotDuration } = formData;

    if (!date || !startTime || !endTime) {
      return 'Please fill all fields';
    }

    // Validate date is not in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    if (selectedDate < today) {
      return 'Please select a future date';
    }

    // Validate start time is before end time
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    
    if (start >= end) {
      return 'End time must be after start time';
    }

    // Validate minimum duration
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (durationMinutes < slotDuration) {
      return `Duration must be at least ${slotDuration} minutes`;
    }

    return null;
  };

  const handleAddSlot = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!teacher?.id) {
      setError('Teacher authentication required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingSlot) {
        // Update existing availability
        await TeacherAvailabilityService.updateAvailability(editingSlot.id, {
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          slotDuration: formData.slotDuration,
          isActive: true
        });
      } else {
        // Create new availability
        const getDayOfWeek = (dateString: string): "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday" => {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
          const date = new Date(dateString);
          return days[date.getDay()];
        };

        const availabilityData = {
          teacherId: teacher.id,
          teacherName: teacher.name,
          teacherSubjects: teacher.subjects || [],
          date: formData.date,
          day: getDayOfWeek(formData.date),
          startTime: formData.startTime,
          endTime: formData.endTime,
          slotDuration: formData.slotDuration,
          isActive: true,
          meetingLink: 'https://zoom.us/j/92969040081?pwd=WZL2d5mUF6oLqAandkcOlCvpZ2b3N5.1'
        };

        const availabilityId = await TeacherAvailabilityService.createAvailability(availabilityData);
        
        // Generate and create time slots
        const availabilityWithId = { 
          ...availabilityData, 
          id: availabilityId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await TimeSlotService.createTimeSlotsFromAvailability(availabilityWithId);
      }

      // Reload availability
      await loadTeacherData();

      // Reset form
      setFormData({
        date: '',
        startTime: '',
        endTime: '',
        slotDuration: 30
      });
      setShowAddForm(false);
      setEditingSlot(null);
    } catch (err) {
      console.error('Error saving availability:', err);
      setError('Failed to save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setFormData({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotDuration: slot.slotDuration
    });
    setEditingSlot(slot);
    setShowAddForm(true);
    setError('');
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this availability slot? All associated time slots will also be deleted.')) {
      return;
    }

    try {
      setSaving(true);
      await TeacherAvailabilityService.deleteAvailability(id);
      await loadTeacherData();
    } catch (err) {
      console.error('Error deleting availability:', err);
      setError('Failed to delete availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generateTimeSlots = (availability: AvailabilitySlot): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const start = new Date(`${availability.date}T${availability.startTime}`);
    const end = new Date(`${availability.date}T${availability.endTime}`);
    
    while (start < end) {
      const slotEnd = new Date(start.getTime() + availability.slotDuration * 60000);
      if (slotEnd <= end) {
        slots.push({
          id: `${availability.id}-${start.getTime()}`,
          date: availability.date,
          startTime: start.toTimeString().slice(0, 5),
          endTime: slotEnd.toTimeString().slice(0, 5),
          duration: availability.slotDuration,
          meetingLink: 'https://zoom.us/j/92969040081?pwd=WZL2d5mUF6oLqAandkcOlCvpZ2b3N5.1'
        });
      }
      start.setTime(start.getTime() + availability.slotDuration * 60000);
    }
    
    return slots;
  };

  const getAllTimeSlots = (): TimeSlot[] => {
    const now = new Date();
    
    return availabilitySlots
      .filter(availability => {
        // Filter out past availability dates
        const availabilityDate = new Date(availability.date);
        return availabilityDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
      })
      .flatMap(availability => {
        const slots = generateTimeSlots(availability);
        // Filter out past time slots within the same day
        return slots.filter(slot => {
          const slotDateTime = new Date(`${slot.date}T${slot.startTime}`);
          return slotDateTime > now;
        });
      });
  };

  const getMeetingStatus = (meeting: TimeSlot) => {
    const now = new Date();
    const meetingDate = new Date(`${meeting.date}T${meeting.startTime}`);
    const meetingEndDate = new Date(`${meeting.date}T${meeting.endTime}`);
    
    if (now < meetingDate) {
      return { status: 'upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' };
    } else if (now >= meetingDate && now <= meetingEndDate) {
      return { status: 'in progress', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
    } else {
      return { status: 'completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Show loading spinner while authenticating or loading data
  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading availability data...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  // Show error if not authenticated
  if (!teacher) {
    return (
      <TeacherLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-100 dark:bg-red-900/20 p-6 rounded-lg">
              <p className="text-red-600 dark:text-red-400 mb-4">
                Please log in as a teacher to access this page.
              </p>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Meeting Scheduler
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your availability and scheduled meetings - <span className="text-green-600 dark:text-green-400 font-medium">All meetings are free</span>
          </p>
          
          {/* Error display */}
          {error && (
            <div className="mt-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Availability Management */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  My Availability
                </h2>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={loadTeacherData}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(true);
                      setError('');
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={saving}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Time Slot
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Add/Edit Form */}
              {showAddForm && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {editingSlot ? 'Edit Availability' : 'Add Availability'}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingSlot(null);
                        setFormData({
                          date: '',
                          startTime: '',
                          endTime: '',
                          slotDuration: 30
                        });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        min={new Date().toISOString().split('T')[0]} // Prevent past dates
                        onChange={(e) => {
                          setFormData({ ...formData, date: e.target.value });
                          setError(''); // Clear error when user changes input
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => {
                          setFormData({ ...formData, startTime: e.target.value });
                          setError(''); // Clear error when user changes input
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => {
                          setFormData({ ...formData, endTime: e.target.value });
                          setError(''); // Clear error when user changes input
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Slot Duration
                      </label>
                      <select
                        value={formData.slotDuration}
                        onChange={(e) => setFormData({ ...formData, slotDuration: Number(e.target.value) })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        {SLOT_DURATIONS.map(duration => (
                          <option key={duration.value} value={duration.value}>
                            {duration.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingSlot(null);
                        setError('');
                        setFormData({
                          date: '',
                          startTime: '',
                          endTime: '',
                          slotDuration: 30
                        });
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddSlot}
                      disabled={saving}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Saving...' : (editingSlot ? 'Update' : 'Save')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Availability List */}
              <div className="space-y-4">
                {availabilitySlots.filter(slot => {
                  // Only show current and future availability slots
                  const now = new Date();
                  const slotDate = new Date(slot.date);
                  return slotDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
                }).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming availability slots</p>
                  </div>
                ) : (
                  availabilitySlots
                    .filter(slot => {
                      // Only show current and future availability slots
                      const now = new Date();
                      const slotDate = new Date(slot.date);
                      return slotDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    })
                    .map((slot) => (
                    <div
                      key={slot.id}
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {formatDate(slot.date)}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {slot.startTime} - {slot.endTime} ({slot.slotDuration} min slots)
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {generateTimeSlots(slot).length} slots available
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSlot(slot)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Generated Time Slots Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Available Time Slots
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Students will see these slots for booking
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {getAllTimeSlots().length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No time slots available</p>
                  </div>
                ) : (
                  getAllTimeSlots().map((slot, index) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {slot.startTime} - {slot.endTime}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(slot.date)} ({slot.duration} min)
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                          Available
                        </span>
                        <Video className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Upcoming Meetings
            </h2>
          </div>

          <div className="p-6">
            {bookedMeetings.filter(meeting => {
              // Only show current and future meetings
              const now = new Date();
              const meetingDate = new Date(`${meeting.date}T${meeting.startTime}`);
              return meetingDate > now;
            }).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming meetings scheduled</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookedMeetings
                  .filter(meeting => {
                    // Only show current and future meetings
                    const now = new Date();
                    const meetingDate = new Date(`${meeting.date}T${meeting.startTime}`);
                    return meetingDate > now;
                  })
                  .map((meeting) => {
                  const meetingStatus = getMeetingStatus(meeting);
                  return (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Meeting with {meeting.studentName}
                          </h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${meetingStatus.color}`}>
                            {meetingStatus.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(meeting.date)} at {meeting.startTime} - {meeting.endTime}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Duration: {meeting.duration} minutes
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {meeting.meetingLink && (
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
