'use client';

import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface TestTimerProps {
  scheduledStartTime: Timestamp;
  duration: number; // in minutes
  onTimeExpired: () => void;
  clockOffsetMs?: number; // server clock calibration offset
}

export default function TestTimer({ scheduledStartTime, duration, onTimeExpired, clockOffsetMs = 0 }: TestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const startTime = scheduledStartTime.toDate();
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      const adjustedNow = new Date(Date.now() + clockOffsetMs);
      const remaining = endTime.getTime() - adjustedNow.getTime();
      
      return Math.max(0, remaining);
    };

    // Initial calculation
    const remaining = calculateTimeRemaining();
    setTimeRemaining(remaining);

    if (remaining === 0 && !hasExpired) {
      setHasExpired(true);
      onTimeExpired();
    }

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining === 0 && !hasExpired) {
        setHasExpired(true);
        onTimeExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledStartTime, duration, onTimeExpired, hasExpired]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getColorClass = (): string => {
    const minutes = Math.floor(timeRemaining / 60000);
    
    if (hasExpired) {
      return 'bg-red-100 border-red-500 text-red-900';
    } else if (minutes < 5) {
      return 'bg-red-50 border-red-400 text-red-800 animate-pulse';
    } else if (minutes < 10) {
      return 'bg-yellow-50 border-yellow-400 text-yellow-900';
    }
    return 'bg-green-50 border-green-400 text-green-900';
  };

  const shouldShowWarning = (): boolean => {
    const minutes = Math.floor(timeRemaining / 60000);
    return minutes < 5 && minutes > 0;
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${getColorClass()} transition-all duration-300`}>
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6" />
          <div>
            <p className="text-sm font-medium">Time Remaining</p>
            <p className="text-2xl font-bold font-mono tracking-wider">
              {hasExpired ? 'Time Expired' : formatTime(timeRemaining)}
            </p>
          </div>
        </div>
        
        {shouldShowWarning() && (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 animate-bounce" />
            <span>Hurry Up!</span>
          </div>
        )}
      </div>

      {hasExpired && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-bold text-red-900">Test Time Has Expired</h4>
              <p className="text-sm text-red-800 mt-1">
                You can no longer submit your answers online. If this was an offline test, 
                please hand in your answer sheets to the supervisor.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
