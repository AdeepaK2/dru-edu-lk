'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Paintbrush, Eraser, Trash2, Undo, Redo, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CanvasWriterProps {
  pdfUrl?: string;
  initialPageAnnotations?: Record<number, string>; // page (1-based) -> Fabric JSON string
  onSave?: (pagesJson: Record<number, string>) => void; // called on auto-save (stroke data)
  onSavePdf?: (file: File) => void; // called on final submit
  onRegisterSubmit?: (fn: () => Promise<void>) => void;
  autoSaveKey?: string;
  className?: string;
  // Legacy props kept for compatibility
  width?: number | string;
  height?: number | string;
  initialImage?: string;
  outputFormat?: 'image' | 'pdf';
}

const COLORS = ['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
const STROKE_SIZES = [2, 4, 6, 10, 16];

// Per-page Fabric canvas manager
interface PageCanvasState {
  fabricCanvas: any | null;
  containerEl: HTMLDivElement | null;
}

const CanvasWriter: React.FC<CanvasWriterProps> = ({
  pdfUrl,
  initialPageAnnotations = {},
  onSave,
  onSavePdf,
  onRegisterSubmit,
  autoSaveKey,
  className = '',
}) => {
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map of page index (0-based) -> fabric.Canvas instance
  const fabricCanvases = useRef<Map<number, any>>(new Map());
  // Map of page index -> wrapper div (to size the fabric canvas)
  const pageWrappers = useRef<Map<number, HTMLDivElement>>(new Map());
  // Auto-save debounce timer
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  // Track which pages have been initialised with saved strokes
  const initialisedPages = useRef<Set<number>>(new Set());

  // Load PDF blob via proxy to avoid CORS
  useEffect(() => {
    if (!pdfUrl) return;
    setLoadingPdf(true);
    fetch(`/api/pdf?url=${encodeURIComponent(pdfUrl)}`)
      .then(r => r.blob())
      .then(blob => { setPdfBlob(blob); setLoadingPdf(false); })
      .catch(err => { console.error(err); toast.error('Failed to load PDF'); setLoadingPdf(false); });
  }, [pdfUrl]);

  // Collect all page JSON data
  const collectPagesJson = useCallback((): Record<number, string> => {
    const result: Record<number, string> = {};
    fabricCanvases.current.forEach((fc, idx) => {
      if (fc) {
        result[idx + 1] = JSON.stringify(fc.toJSON());
      }
    });
    return result;
  }, []);

  // Trigger auto-save (debounced)
  const scheduleAutoSave = useCallback(() => {
    if (!onSave) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const pagesJson = collectPagesJson();
      if (Object.keys(pagesJson).length > 0) {
        onSave(pagesJson);
        // Also persist to localStorage as crash backup
        if (autoSaveKey) {
          try {
            localStorage.setItem(autoSaveKey, JSON.stringify({ timestamp: Date.now(), pages: pagesJson }));
          } catch (_) {}
        }
      }
    }, 3000);
  }, [onSave, collectPagesJson, autoSaveKey]);

  // Initialise a Fabric canvas on a page wrapper div
  const initFabricCanvas = useCallback(async (pageIndex: number, wrapperEl: HTMLDivElement) => {
    if (fabricCanvases.current.has(pageIndex)) return; // already initialised

    // Dynamically import fabric (client-only)
    const { fabric } = await import('fabric');

    const rect = wrapperEl.getBoundingClientRect();
    const w = rect.width || wrapperEl.offsetWidth || 800;
    const h = rect.height || wrapperEl.offsetHeight || 1100;

    // Create a canvas element inside the wrapper
    const canvasEl = document.createElement('canvas');
    canvasEl.width = w;
    canvasEl.height = h;
    canvasEl.style.position = 'absolute';
    canvasEl.style.inset = '0';
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    wrapperEl.appendChild(canvasEl);

    const fc = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: w,
      height: h,
      backgroundColor: 'transparent',
      selection: false,
    });

    // Set brush
    fc.freeDrawingBrush = new fabric.PencilBrush(fc);
    fc.freeDrawingBrush.color = color;
    fc.freeDrawingBrush.width = strokeWidth;

    // Listen for drawing events to trigger auto-save
    fc.on('path:created', () => scheduleAutoSave());

    fabricCanvases.current.set(pageIndex, fc);

    // Restore saved strokes if available
    const savedJson = initialPageAnnotations[pageIndex + 1];
    if (savedJson && !initialisedPages.current.has(pageIndex)) {
      initialisedPages.current.add(pageIndex);
      try {
        await new Promise<void>((resolve) => {
          fc.loadFromJSON(JSON.parse(savedJson), () => {
            fc.renderAll();
            resolve();
          });
        });
        // Re-enable drawing mode after loading
        fc.isDrawingMode = true;
      } catch (e) {
        console.error('[CanvasWriter] Failed to restore strokes for page', pageIndex + 1, e);
      }
    }
  }, [color, strokeWidth, scheduleAutoSave, initialPageAnnotations]);

  // Update all fabric canvases when tool/color/strokeWidth changes
  useEffect(() => {
    const updateBrushes = async () => {
      const { fabric } = await import('fabric');
      fabricCanvases.current.forEach((fc) => {
        if (!fc) return;
        if (tool === 'eraser') {
          // Use destination-out so eraser only removes student strokes,
          // NOT the underlying PDF (which is a separate DOM element entirely)
          const brush = new fabric.PencilBrush(fc);
          // Any colour works — destination-out ignores colour, uses alpha only
          brush.color = 'rgba(0,0,0,1)';
          brush.width = strokeWidth * 4;
          fc.freeDrawingBrush = brush;
          fc.isDrawingMode = true;

          // After each eraser stroke is committed, flip it to destination-out
          // so it punches transparent holes in the canvas overlay
          const applyEraser = (e: any) => {
            const path = e.path as fabric.Path;
            if (!path) return;
            path.set('globalCompositeOperation', 'destination-out');
            fc.renderAll();
            scheduleAutoSave();
          };
          // Remove any existing listener first to avoid stacking
          fc.off('path:created', (fc as any).__eraserHandler);
          (fc as any).__eraserHandler = applyEraser;
          fc.on('path:created', applyEraser);
        } else {
          // Restore normal pen — remove any eraser handler
          fc.off('path:created', (fc as any).__eraserHandler);
          (fc as any).__eraserHandler = null;

          fc.freeDrawingBrush = new fabric.PencilBrush(fc);
          fc.freeDrawingBrush.color = color;
          fc.freeDrawingBrush.width = strokeWidth;
          fc.isDrawingMode = true;
        }
      });
    };
    updateBrushes();
  }, [tool, color, strokeWidth]);

  // Undo last stroke on all canvases (removes last path object)
  const handleUndo = () => {
    fabricCanvases.current.forEach((fc) => {
      if (!fc) return;
      const objects = fc.getObjects();
      if (objects.length > 0) {
        fc.remove(objects[objects.length - 1]);
        fc.renderAll();
      }
    });
    scheduleAutoSave();
  };

  // Clear all canvases
  const handleClear = () => {
    if (!confirm('Clear all drawings on all pages?')) return;
    fabricCanvases.current.forEach((fc) => {
      if (!fc) return;
      fc.clear();
      fc.backgroundColor = 'transparent';
      fc.renderAll();
    });
    scheduleAutoSave();
  };

  // Manual save (strokes only)
  const handleManualSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const pagesJson = collectPagesJson();
      if (onSave) {
        onSave(pagesJson);
        toast.success('Progress saved!');
      }
    } finally {
      setIsSaving(false);
    }
  }, [collectPagesJson, onSave]);

  // Final submit: render each page (PDF background + fabric strokes) into a PDF
  const handleSubmit = useCallback(async () => {
    if (!onSavePdf) return;
    setIsSubmitting(true);
    try {
      toast.loading('Generating PDF...', { id: 'pdf-gen' });

      // First save strokes
      const pagesJson = collectPagesJson();
      if (onSave) onSave(pagesJson);

      // Build PDF using pdf-lib
      const pdfDoc = await PDFDocument.create();

      const pageElements = document.querySelectorAll('.react-pdf__Page');
      const { default: html2canvas } = await import('html2canvas');

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedJpg(imgBytes);

        const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: canvas.width / 2,
          height: canvas.height / 2,
        });
      }

      const pdfBytes = await pdfDoc.save() as unknown as Uint8Array<ArrayBuffer>;
      const file = new File([pdfBytes], `answer-${Date.now()}.pdf`, { type: 'application/pdf' });

      toast.dismiss('pdf-gen');
      onSavePdf(file);
    } catch (err) {
      console.error('[CanvasWriter] Submit failed:', err);
      toast.dismiss('pdf-gen');
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [collectPagesJson, onSave, onSavePdf]);

  // Register submit function with parent
  useEffect(() => {
    if (onRegisterSubmit) {
      onRegisterSubmit(handleSubmit);
    }
  }, [onRegisterSubmit, handleSubmit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      fabricCanvases.current.forEach((fc) => fc?.dispose());
      fabricCanvases.current.clear();
    };
  }, []);

  // Callback ref for each page wrapper div
  const setPageWrapperRef = useCallback((pageIndex: number) => (el: HTMLDivElement | null) => {
    if (el && !pageWrappers.current.has(pageIndex)) {
      pageWrappers.current.set(pageIndex, el);
      // Wait for the PDF page to render before initialising fabric
      setTimeout(() => initFabricCanvas(pageIndex, el), 500);
    }
  }, [initFabricCanvas]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b shadow-sm">
        {/* Tool */}
        <div className="flex items-center gap-1 border-r pr-2">
          <button
            onClick={() => setTool('pen')}
            title="Pen"
            className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <Paintbrush size={18} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="Eraser"
            className={`p-2 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <Eraser size={18} />
          </button>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 border-r pr-2">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c && tool === 'pen' ? 'border-gray-900 scale-125' : 'border-transparent hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Stroke sizes */}
        <div className="flex items-center gap-1 border-r pr-2">
          {STROKE_SIZES.map(size => (
            <button
              key={size}
              onClick={() => setStrokeWidth(size)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${strokeWidth === size ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <div className="rounded-full bg-gray-700" style={{ width: size, height: size }} />
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 border-r pr-2">
          <button onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Zoom out"><ZoomOut size={16} /></button>
          <span className="text-xs font-mono w-10 text-center">{Math.round(pdfScale * 100)}%</span>
          <button onClick={() => setPdfScale(s => Math.min(3, s + 0.25))} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Zoom in"><ZoomIn size={16} /></button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={handleUndo} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Undo last stroke"><Undo size={16} /></button>
          <button onClick={handleClear} className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Clear all"><Trash2 size={16} /></button>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="p-2 hover:bg-green-50 rounded-lg text-green-600 disabled:opacity-50"
            title="Save progress (Ctrl+S)"
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* PDF + Canvas area */}
      <div
        className="flex-1 overflow-auto bg-gray-100"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {loadingPdf && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        )}

        {pdfBlob && (
          <div className="flex justify-center py-6 px-4">
            <Document
              file={pdfBlob}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              className="space-y-6"
            >
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <div key={i} className="relative shadow-xl rounded-sm overflow-hidden" style={{ display: 'inline-block' }}>
                  {/* PDF page render */}
                  <Page
                    pageNumber={i + 1}
                    scale={pdfScale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  {/* Fabric.js drawing overlay — absolutely positioned over the PDF page */}
                  <div
                    ref={setPageWrapperRef(i)}
                    className="absolute inset-0"
                    style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
                  />
                </div>
              ))}
            </Document>
          </div>
        )}

        {/* Plain canvas (no PDF) */}
        {!pdfUrl && (
          <div className="flex justify-center py-6 px-4">
            <div
              ref={setPageWrapperRef(0)}
              className="relative bg-white shadow-xl"
              style={{ width: 800, height: 1100, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            />
          </div>
        )}
      </div>

      {/* Footer save button */}
      {(onSave || onSavePdf) && (
        <div className="flex justify-end gap-2 px-4 py-3 bg-white border-t">
          {onSave && (
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Save size={15} />
              {isSaving ? 'Saving...' : 'Save Progress'}
            </button>
          )}
          {onSavePdf && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
              ) : (
                <>Submit Answer</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CanvasWriter;
