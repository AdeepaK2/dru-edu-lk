// Real-time Background Submission Monitor Component
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Button from '@/components/ui/Button';

interface StatusUpdate {
  totalExpired: number;
  byTestType: { live: number; flexible: number };
  oldestExpired?: string;
  lastChecked: string;
}

interface ProcessingUpdate {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

interface SSEMessage {
  type: 'connected' | 'status' | 'processing_complete' | 'error';
  message?: string;
  data?: StatusUpdate | ProcessingUpdate;
  timestamp: string;
}

export default function BackgroundSubmissionMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastStatus, setLastStatus] = useState<StatusUpdate | null>(null);
  const [lastProcessing, setLastProcessing] = useState<ProcessingUpdate | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const connectToSSE = () => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionError(null);
    setErrors([]);

    try {
      const eventSource = new EventSource('/api/background/monitor', {
        withCredentials: true
      });

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('📡 Connected to background submission monitor');
      };

      eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              console.log('✅ SSE Connection established');
              break;
              
            case 'status':
              setLastStatus(message.data as StatusUpdate);
              break;
              
            case 'processing_complete':
              setLastProcessing(message.data as ProcessingUpdate);
              break;
              
            case 'error':
              setErrors(prev => [...prev.slice(-4), message.message || 'Unknown error']);
              break;
          }
        } catch (parseError) {
          console.error('Error parsing SSE message:', parseError);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setConnectionError('Connection lost. Attempting to reconnect...');
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            connectToSSE();
          }
        }, 5000);
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🔄 Background Submission Monitor
            <div className="flex gap-2">
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {!isConnected && (
                <Button onClick={connectToSSE} size="sm">
                  Connect
                </Button>
              )}
              {isConnected && (
                <Button onClick={disconnect} variant="outline" size="sm">
                  Disconnect
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectionError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{connectionError}</p>
            </div>
          )}

          {lastStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">
                    {lastStatus.totalExpired}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Expired</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm">Live Tests:</span>
                      <span className="font-semibold">{lastStatus.byTestType.live}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Flexible Tests:</span>
                      <span className="font-semibold">{lastStatus.byTestType.flexible}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm">
                    <p className="font-semibold">Last Checked:</p>
                    <p className="text-muted-foreground">
                      {new Date(lastStatus.lastChecked).toLocaleTimeString()}
                    </p>
                    {lastStatus.oldestExpired && (
                      <>
                        <p className="font-semibold mt-2">Oldest Expired:</p>
                        <p className="text-muted-foreground">
                          {new Date(lastStatus.oldestExpired).toLocaleString()}
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {lastProcessing && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Latest Processing Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xl font-bold">{lastProcessing.processed}</div>
                    <p className="text-sm text-muted-foreground">Processed</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-600">{lastProcessing.successful}</div>
                    <p className="text-sm text-muted-foreground">Successful</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-red-600">{lastProcessing.failed}</div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>

                {lastProcessing.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recent Errors:</h4>
                    <div className="space-y-1">
                      {lastProcessing.errors.slice(-3).map((error, index) => (
                        <div key={index} className="p-2 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-700 text-xs">{error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connection Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {errors.slice(-3).map((error, index) => (
                    <div key={index} className="p-2 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-700 text-xs">{error}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}