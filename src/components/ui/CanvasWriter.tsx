'use client';

import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import Button from './Button'; 
import { Paintbrush, Eraser, Trash2, Undo, Redo, Download, Save, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';

// Ensure worker is configured
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

interface CanvasWriterProps {
  width?: number | string;
  height?: number | string;
  initialImage?: string;
  pdfUrl?: string; // New prop for PDF support
  initialPageAnnotations?: Record<number, string>; // Page 1-based index -> DataURL
  onSave?: (data: string | string[]) => void; // string for single image, string[] for PDF pages
  className?: string;
}

interface DrawingCanvasProps {
    width?: number;
    height?: number;
    tool: 'pen' | 'eraser';
    color: string;
    strokeWidth: number;
    onHistoryChange?: (hasUndo: boolean, hasRedo: boolean) => void;
    backgroundImage?: string;
    initialDataUrl?: string;
    className?: string;
}

export interface DrawingCanvasHandle {
    undo: () => void;
    redo: () => void;
    clear: () => void;
    getDataUrl: () => string;
    isEmpty: () => boolean;
}

// Sub-component for the actual drawing surface
const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(({
    width,
    height,
    tool,
    color,
    strokeWidth,
    onHistoryChange,
    backgroundImage,
    initialDataUrl,
    className
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    // Initial Resize & Observer
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const updateSize = () => {
             const rect = container.getBoundingClientRect();
             // Only update if dimensions actually changed
             if (canvas.width !== rect.width || canvas.height !== rect.height) {
                 // Save current content
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = canvas.width;
                 tempCanvas.height = canvas.height;
                 const tempCtx = tempCanvas.getContext('2d');
                 if (tempCtx && canvas.width > 0 && canvas.height > 0) {
                     tempCtx.drawImage(canvas, 0, 0);
                 }

                 canvas.width = rect.width;
                 canvas.height = rect.height;

                 const ctx = canvas.getContext('2d');
                 if (ctx) {
                     ctx.lineCap = 'round';
                     ctx.lineJoin = 'round';
                     // Restore content
                     if (tempCanvas.width > 0) {
                         ctx.drawImage(tempCanvas, 0, 0);
                     } else if (historyIndex >= 0 && history[historyIndex]) {
                         ctx.putImageData(history[historyIndex], 0, 0);
                     } else if (initialDataUrl) {
                        // Load initial data if strictly needed here? 
                        // Better to rely on the dedicated initial load effect below to avoid race/double draw
                     } else if (backgroundImage) {
                         const img = new Image();
                         img.src = backgroundImage;
                         img.onload = () => {
                             ctx.drawImage(img, 0, 0, rect.width, rect.height);
                             saveHistory();
                         };
                     }
                 }
             }
        };

        // Initial sizing
        if (width && height) {
            canvas.width = width;
            canvas.height = height;
        } else {
            updateSize();
            const resizeObserver = new ResizeObserver(() => updateSize());
            resizeObserver.observe(container);
            return () => resizeObserver.disconnect();
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
        }
    }, [width, height, backgroundImage]);

    // Load Initial Data URL
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !initialDataUrl) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.src = initialDataUrl;
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Stretch to fit? Or maintain aspect?
            // For annotations, we assume they match the canvas size.
            saveHistory();
        };
    }, [initialDataUrl]);

    const saveHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            return [...newHistory, imageData];
        });
        setHistoryIndex(prev => {
            const newIndex = prev + 1;
            return newIndex;
        });
    }, [historyIndex]);

    // Notify parent about history state for global toolbar
    useEffect(() => {
        onHistoryChange?.(historyIndex > 0, historyIndex < history.length - 1);
    }, [historyIndex, history.length, onHistoryChange]);

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                ctx.putImageData(history[newIndex], 0, 0);
            }
        } else if (historyIndex === 0) {
            // Clear to initial state?
            // If index goes to -1, we clear
             setHistoryIndex(-1);
             const canvas = canvasRef.current;
             const ctx = canvas?.getContext('2d');
             if (canvas && ctx) {
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
             }
             if (backgroundImage) {
                 // re-draw background?
             }
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                ctx.putImageData(history[newIndex], 0, 0);
            }
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveHistory();
        }
    };

    const getDataUrl = () => {
        return canvasRef.current?.toDataURL('image/png') || '';
    };

    const isEmpty = () => {
        return historyIndex === -1; 
    };

    useImperativeHandle(ref, () => ({
        undo,
        redo,
        clear,
        getDataUrl,
        isEmpty
    }));

    const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out'; // True transparency for eraser
            ctx.lineWidth = strokeWidth * 2; // Make eraser slightly bigger
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
        }
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            ctx?.closePath();
            saveHistory();
        }
    };

    return (
        <div ref={containerRef} className={`w-full h-full relative ${className}`} style={{ minHeight: '1px' }}>
            <canvas
                ref={canvasRef}
                className="block touch-none absolute inset-0"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
            />
        </div>
    );
});
DrawingCanvas.displayName = 'DrawingCanvas';

const COLORS = [
  '#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'
];

const STROKE_SIZES = [2, 4, 6, 8, 12];

const CanvasWriter: React.FC<CanvasWriterProps> = ({
  width = '100%',
  height = 500, // Default height for plain mode
  initialImage,
  pdfUrl,
  initialPageAnnotations,
  onSave,
  className = '',
}) => {
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  
  // PDF Rendering State
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  
  // Refs for current canvas (Plain mode)
  const plainCanvasRef = useRef<DrawingCanvasHandle>(null);

  // Refs for multiple canvases (PDF mode)
  const pdfCanvasRefs = useRef<Map<number, DrawingCanvasHandle>>(new Map());
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // For PDF, we need to fetch blob like PDFViewer to avoid CORS
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    if (pdfUrl) {
      setLoadingPdf(true);
      fetch(`/api/pdf?url=${encodeURIComponent(pdfUrl)}`)
        .then(res => res.blob())
        .then(blob => {
            setPdfBlob(blob);
            setLoadingPdf(false);
        })
        .catch(err => {
            console.error(err);
            toast.error("Failed to load PDF");
            setLoadingPdf(false);
        });
    }
  }, [pdfUrl]);

  // Handle Ctrl+S for Save
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              handleSaveAction();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, numPages, pdfUrl]); // Dependencies for save action

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleAction = (action: 'undo' | 'redo' | 'clear') => {
      if (pdfUrl) {
          if (action === 'clear') {
              if (confirm('Clear drawings on all pages?')) {
                  pdfCanvasRefs.current.forEach(ref => ref.clear());
              }
          }
           if (action === 'undo' || action === 'redo') {
               toast("Undo/Redo per page allows better control - implemented via per-page controls in future?");
           }
      } else {
          // Plain mode
          if (action === 'undo') plainCanvasRef.current?.undo();
          if (action === 'redo') plainCanvasRef.current?.redo();
          if (action === 'clear') plainCanvasRef.current?.clear();
      }
  };

  const handleSaveAction = () => {
      if (!onSave) return;
      
      if (pdfUrl) {
          // Collect all pages
          const pagesData: string[] = [];
          for (let i = 0; i < (numPages || 0); i++) {
              const ref = pdfCanvasRefs.current.get(i);
              if (ref) {
                  pagesData.push(ref.getDataUrl());
              } else {
                   // If no ref, check if we have initial data?
                   // If ref is missing (e.g. valid page but not rendered yet?), we might lose data.
                   // But typically all pages render in this simple view.
                   // If virtualized, we'd need to merge with initialAnnotations.
                   const initial = initialPageAnnotations?.[i + 1];
                   pagesData.push(initial || '');
              }
          }
          // Merge with initial data for pages not currently rendered (if using virtualization)?
          // Current implementation renders all pages, so refs should exist.
          onSave(pagesData); 
          toast.success('Progress saved!');
      } else {
          if (plainCanvasRef.current) {
              onSave(plainCanvasRef.current.getDataUrl());
              toast.success('Drawing saved!');
          }
      }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 p-3 bg-white border rounded-xl shadow-sm">
        <div className="flex items-center gap-2 border-r pr-3">
            <button onClick={() => setTool('pen')} className={`p-2 rounded-lg ${tool === 'pen' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}><Paintbrush size={20}/></button>
            <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}><Eraser size={20}/></button>
        </div>

        <div className="flex items-center gap-2 border-r pr-3">
            {COLORS.map(c => (
                <button
                    key={c}
                    onClick={() => { setColor(c); setTool('pen'); }}
                    className={`w-6 h-6 rounded-full border-2 ${color === c && tool === 'pen' ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
        </div>

        <div className="flex items-center gap-2 border-r pr-3">
             {STROKE_SIZES.map(size => (
                <button
                    key={size}
                    onClick={() => setStrokeWidth(size)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg ${strokeWidth === size ? 'bg-gray-100 ring-1 ring-gray-300' : ''}`}
                >
                    <div className="rounded-full bg-gray-600" style={{ width: size, height: size }} />
                </button>
             ))}
        </div>

        {/* PDF Specific Controls */}
        {pdfUrl && (
            <div className="flex items-center gap-2 border-r pr-3">
                <button onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-gray-100 rounded-lg"><ZoomOut size={18}/></button>
                <span className="text-xs font-mono">{Math.round(pdfScale * 100)}%</span>
                <button onClick={() => setPdfScale(s => Math.min(3, s + 0.25))} className="p-2 hover:bg-gray-100 rounded-lg"><ZoomIn size={18}/></button>
            </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
             {!pdfUrl && (
                 <>
                    <button onClick={() => handleAction('undo')} className="p-2 hover:bg-gray-100 rounded-lg"><Undo size={18}/></button>
                    <button onClick={() => handleAction('redo')} className="p-2 hover:bg-gray-100 rounded-lg"><Redo size={18}/></button>
                 </>
             )}
             <button onClick={() => handleAction('clear')} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
             <button onClick={handleSaveAction} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Save (Ctrl+S)">
                <Save size={18} />
             </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative bg-gray-100 border rounded-xl overflow-auto shadow-inner" style={{ height: pdfUrl ? '80vh' : height }}>
         {pdfUrl ? (
             <div className="flex justify-center min-h-full p-8">
                 {loadingPdf && <div className="text-center mt-10">Loading PDF...</div>}
                 {pdfBlob && (
                     <Document
                        file={pdfBlob}
                        onLoadSuccess={handleDocumentLoadSuccess}
                        className="space-y-4"
                     >
                         {Array.from(new Array(numPages || 0), (_, index) => (
                             <div key={index} className="relative shadow-lg">
                                 <Page 
                                    pageNumber={index + 1} 
                                    scale={pdfScale}
                                    renderTextLayer={false} 
                                    renderAnnotationLayer={false}
                                 />
                                 <div className="absolute inset-0 z-10">
                                     <DrawingCanvas
                                        ref={(el) => {
                                            if (el) pdfCanvasRefs.current.set(index, el);
                                            else pdfCanvasRefs.current.delete(index);
                                        }}
                                        width={undefined} 
                                        tool={tool}
                                        color={color}
                                        strokeWidth={strokeWidth}
                                        initialDataUrl={initialPageAnnotations?.[index + 1]}
                                     />
                                 </div>
                             </div>
                         ))}
                     </Document>
                 )}
             </div>
         ) : (
             <div className="bg-white min-h-full">
                 <DrawingCanvas
                    ref={plainCanvasRef}
                    width={typeof width === 'number' ? width : undefined} 
                    height={typeof height === 'number' ? height : 400}
                    tool={tool}
                    color={color}
                    strokeWidth={strokeWidth}
                    backgroundImage={initialImage}
                    onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
                    initialDataUrl={initialPageAnnotations?.[1]}
                 />
             </div>
         )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2">
            {onSave && (
                <Button onClick={handleSaveAction} className="flex items-center gap-2">
                    <Save size={16} />
                    Save Answer
                </Button>
            )}
      </div>
    </div>
  );
};

export default CanvasWriter;
