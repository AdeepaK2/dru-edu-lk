import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarDate {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvent?: boolean;
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
      
      // Check if this date has a scheduled event
      const hasEvent = scheduledDates.some(scheduledDate => {
        const scheduled = new Date(scheduledDate);
        scheduled.setHours(0, 0, 0, 0);
        return scheduled.getTime() === date.getTime();
      });
      
      dates.push({
        date,
        isCurrentMonth,
        isToday,
        isSelected,
        hasEvent
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
          const { date, isCurrentMonth, isToday, isSelected, hasEvent } = calendarDate;
          const disabled = isDateDisabled(date);
          
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
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'
                }
              `}
            >
              <span className="relative z-10">{date.getDate()}</span>
              
              {/* Event indicator */}
              {hasEvent && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900/50 rounded"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Today</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded relative">
            <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Scheduled</span>
        </div>
      </div>
    </div>
  );
}
