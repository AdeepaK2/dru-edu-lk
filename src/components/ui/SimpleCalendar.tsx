import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarDate {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvent?: boolean;
  eventCount?: number;
}

interface SimpleCalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  scheduledDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SimpleCalendar({
  selectedDate,
  onDateSelect,
  scheduledDates = [],
  minDate,
  maxDate
}: SimpleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  const generateCalendarDates = (): CalendarDate[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // First Sunday of the calendar (might be from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // Generate 42 days (6 weeks × 7 days)
    const dates: CalendarDate[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.getTime() === today.getTime();
      const isSelected = selectedDate ? date.getTime() === selectedDate.getTime() : false;
      
      // Count how many events are scheduled for this date
      const eventCount = scheduledDates.filter(scheduledDate => {
        const scheduled = new Date(scheduledDate);
        scheduled.setHours(0, 0, 0, 0);
        return scheduled.getTime() === date.getTime();
      }).length;
      
      dates.push({
        date,
        isCurrentMonth,
        isToday,
        isSelected,
        hasEvent: eventCount > 0,
        eventCount
      });
    }
    
    return dates;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const calendarDates = generateCalendarDates();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
        </div>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map(day => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDates.map((calendarDate, index) => {
          const { date, isCurrentMonth, isToday, isSelected, hasEvent, eventCount } = calendarDate;
          const disabled = isDateDisabled(date);
          const hasMultipleEvents = (eventCount || 0) > 1;
          
          return (
            <button
              key={index}
              onClick={() => !disabled && onDateSelect(date)}
              disabled={disabled}
              className={`
                aspect-square p-2 text-sm rounded-lg transition-all relative
                ${!isCurrentMonth 
                  ? 'text-gray-300 dark:text-gray-600' 
                  : 'text-gray-900 dark:text-white'
                }
                ${isToday 
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-semibold' 
                  : ''
                }
                ${isSelected 
                  ? 'bg-blue-600 text-white font-semibold' 
                  : hasEvent 
                    ? hasMultipleEvents
                      ? 'bg-[#fbbf24] dark:bg-[#fbbf24]/40 text-[#222222] dark:text-[#222222] font-bold border-2 border-[#f59e0b] hover:bg-[#f59e0b]'
                      : 'bg-[#b2e05b] dark:bg-[#b2e05b]/30 text-[#222222] dark:text-[#222222] font-medium border-2 border-[#64cc4f] hover:bg-[#64cc4f]' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'
                }
              `}
            >
              <span className="relative z-10">{date.getDate()}</span>
              
              {/* Event indicator - shows count badge for multiple classes, dot for single class */}
              {hasEvent && !isSelected && (
                hasMultipleEvents ? (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#f59e0b] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white">
                    {eventCount}
                  </div>
                ) : (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-[#64cc4f] rounded-full"></div>
                )
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900/50 rounded"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Today</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-[#b2e05b] border border-[#64cc4f] rounded relative">
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#64cc4f] rounded-full"></div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">1 Class</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-[#fbbf24] border border-[#f59e0b] rounded relative">
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#f59e0b] text-white text-[6px] font-bold rounded-full flex items-center justify-center">2</div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">2+ Classes</span>
        </div>
      </div>
    </div>
  );
}
