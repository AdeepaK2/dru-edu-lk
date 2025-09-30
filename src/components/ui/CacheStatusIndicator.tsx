import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, Database } from 'lucide-react';

interface CacheStatusProps {
  isFromCache?: boolean;
  lastCalculated?: Date;
  isCalculating?: boolean;
  className?: string;
}

export const CacheStatusIndicator: React.FC<CacheStatusProps> = ({
  isFromCache = false,
  lastCalculated,
  isCalculating = false,
  className = ""
}) => {
  if (isCalculating) {
    return (
      <Badge variant="secondary" className={`flex items-center gap-1 ${className}`}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        Recalculating...
      </Badge>
    );
  }

  if (isFromCache && lastCalculated) {
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastCalculated.getTime()) / (1000 * 60));
    
    let timeText = '';
    if (minutesAgo < 1) {
      timeText = 'Just now';
    } else if (minutesAgo < 60) {
      timeText = `${minutesAgo}m ago`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      timeText = `${hoursAgo}h ago`;
    }

    return (
      <Badge variant="success" className={`flex items-center gap-1 ${className}`}>
        <Database className="h-3 w-3" />
        Cached • {timeText}
      </Badge>
    );
  }

  return null;
};

export const CacheStatusCard: React.FC<CacheStatusProps & { title: string }> = ({
  title,
  isFromCache = false,
  lastCalculated,
  isCalculating = false,
  className = ""
}) => {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">{title}</span>
        </div>
        <CacheStatusIndicator 
          isFromCache={isFromCache}
          lastCalculated={lastCalculated}
          isCalculating={isCalculating}
        />
      </div>
      {isFromCache && lastCalculated && !isCalculating && (
        <p className="text-xs text-blue-600 mt-1">
          Data loaded from cache for faster performance. Analytics are recalculated in the background.
        </p>
      )}
      {isCalculating && (
        <p className="text-xs text-blue-600 mt-1">
          Recalculating analytics with latest data. This may take a moment...
        </p>
      )}
    </div>
  );
};