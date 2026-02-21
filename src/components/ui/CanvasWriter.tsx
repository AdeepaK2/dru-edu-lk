'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Paintbrush, Eraser, Ruler, Trash2, Undo, ZoomIn, ZoomOut, Save, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CanvasWriterProps {
  pdfUrl?: string;
  initialPageAnnotations?: Record<number, string>;
  onSave?: (pagesJson: Record<number, string>) => void;
  onSavePdf?: (file: File) => void;
  onRegisterSubmit?: (fn: () => Promise<void>) => void;
  autoSaveKey?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  initialImage?: string;
  outputFormat?: 'image' | 'pdf';
}

type Tool = 'pen' | 'eraser' | 'ruler';

const COLORS = ['#1a1a1a', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'];
const STROKE_SIZES = [2, 4, 6, 10, 16];

// ─── Ruler overlay state ─────────────────────────────────────────────────────
interface RulerLine {
  x1: number; y1: number;
  x2: number; y2: number;
  pageIndex: number;
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
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1a1a1a');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ruler drag state
  const [rulerDrag, setRulerDrag] = useState<RulerLine | null>(null);
  // Extra blank pages appended after the PDF
  const [extraPages, setExtraPages] = useState<number[]>([]);
  const extraPageIdCounter = useRef(0);
  // Ref to track the scaled PDF page width so extra pages match
  const pdfPageWidthRef = useRef<number>(0);

  const fabricCanvases = useRef<Map<number, any>>(new Map());
  const pageWrappers = useRef<Map<number, HTMLDivElement>>(new Map());
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const initialisedPages = useRef<Set<number>>(new Set());
  const extraPagesRestoredRef = useRef(false);

  // ─── Load PDF ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfUrl) return;
    setLoadingPdf(true);
    fetch(`/api/pdf?url=${encodeURIComponent(pdfUrl)}`)
      .then(r => r.blob())
      .then(blob => { setPdfBlob(blob); setLoadingPdf(false); })
      .catch(() => { toast.error('Failed to load PDF'); setLoadingPdf(false); });
  }, [pdfUrl]);

  // ─── Collect JSON ─────────────────────────────────────────────────────────
  const collectPagesJson = useCallback((): Record<number, string> => {
    const result: Record<number, string> = {};
    fabricCanvases.current.forEach((fc, idx) => {
      if (fc) result[idx + 1] = JSON.stringify(fc.toJSON());
    });
    return result;
  }, []);

  // ─── Auto-save ────────────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback(() => {
    if (!onSave) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const pagesJson = collectPagesJson();
      if (Object.keys(pagesJson).length > 0) {
        onSave(pagesJson);
        if (autoSaveKey) {
          try { localStorage.setItem(autoSaveKey, JSON.stringify({ timestamp: Date.now(), pages: pagesJson })); } catch (_) {}
        }
      }
    }, 3000);
  }, [onSave, collectPagesJson, autoSaveKey]);

  // ─── Init Fabric for a page ───────────────────────────────────────────────
  const initFabricCanvas = useCallback(async (pageIndex: number, wrapperEl: HTMLDivElement) => {
    // If instance already exists, check if we need to re-attach to new DOM node
    if (fabricCanvases.current.has(pageIndex)) {
      const fc = fabricCanvases.current.get(pageIndex);
      // Fabric wraps canvas in a .canvas-container div. Check if that container is inside our wrapper.
      if (fc.wrapperEl && fc.wrapperEl.parentNode !== wrapperEl) {
        // Re-attach existing canvas to new wrapper
        wrapperEl.appendChild(fc.wrapperEl);
      }
      // Always sync dimensions to match current wrapper size
      const rect = wrapperEl.getBoundingClientRect();
      const w = rect.width || wrapperEl.offsetWidth || 800;
      const h = rect.height || wrapperEl.offsetHeight || 1100;
      fc.setDimensions({ width: w, height: h });
      fc.calcOffset();
      fc.renderAll();
      return;
    }

    const { fabric } = await import('fabric');

    const rect = wrapperEl.getBoundingClientRect();
    const w = rect.width || wrapperEl.offsetWidth || 800;
    const h = rect.height || wrapperEl.offsetHeight || 1100;

    // Don't set CSS width/height — let Fabric manage both canvases at exact pixel size
    const canvasEl = document.createElement('canvas');
    canvasEl.width = w;
    canvasEl.height = h;
    wrapperEl.appendChild(canvasEl);

    const fc = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: w,
      height: h,
      backgroundColor: 'transparent',
      selection: false,
    });

    fc.freeDrawingBrush = new fabric.PencilBrush(fc);
    fc.freeDrawingBrush.color = color;
    fc.freeDrawingBrush.width = strokeWidth;
    // Reduce path decimation to preserve detail on long strokes
    (fc.freeDrawingBrush as any).decimate = 2;

    // Prevent browser scroll-detection hold from swallowing the first stylus/touch event.
    // Without this, the start of every stroke (especially with a pen stylus) is clipped
    // because the browser delays pointer events while deciding whether it's a scroll.
    if ((fc as any).wrapperEl) ((fc as any).wrapperEl as HTMLElement).style.touchAction = 'none';
    if ((fc as any).upperCanvasEl) ((fc as any).upperCanvasEl as HTMLElement).style.touchAction = 'none';
    if ((fc as any).lowerCanvasEl) ((fc as any).lowerCanvasEl as HTMLElement).style.touchAction = 'none';

    fc.on('path:created', () => scheduleAutoSave());
    fabricCanvases.current.set(pageIndex, fc);

    const savedJson = initialPageAnnotations[pageIndex + 1];
    if (savedJson && !initialisedPages.current.has(pageIndex)) {
      initialisedPages.current.add(pageIndex);
      try {
        await new Promise<void>((resolve) => {
          fc.loadFromJSON(JSON.parse(savedJson), () => { fc.renderAll(); resolve(); });
        });
        fc.isDrawingMode = true;
      } catch (e) {
        console.error('[CanvasWriter] Failed to restore strokes', e);
      }
    }
  }, [color, strokeWidth, scheduleAutoSave, initialPageAnnotations]);

  // ─── Resize canvases when PDF scale changes ────────────────────────────────
  useEffect(() => {
    if (!numPages) return;
    // Wait for PDF pages to re-render at new scale
    const timer = setTimeout(() => {
      fabricCanvases.current.forEach((fc, pageIndex) => {
        const wrapper = pageWrappers.current.get(pageIndex);
        if (!wrapper || !fc) return;
        const rect = wrapper.getBoundingClientRect();
        const w = rect.width || wrapper.offsetWidth;
        const h = rect.height || wrapper.offsetHeight;
        if (w > 0 && h > 0) {
          fc.setDimensions({ width: w, height: h });
          fc.calcOffset();
          fc.renderAll();
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [pdfScale, numPages]);

  // ─── Restore extra pages saved in initialPageAnnotations ─────────────────
  // When the canvas remounts (page reload, Edit Answer re-open), saved strokes
  // for extra-page indices exist in initialPageAnnotations but no divs are
  // rendered for them yet. Detect how many extra pages were saved and add them
  // back so their Fabric canvases can be initialised and strokes restored.
  useEffect(() => {
    if (!numPages || extraPagesRestoredRef.current) return;
    extraPagesRestoredRef.current = true;

    const savedKeys = Object.keys(initialPageAnnotations).map(Number);
    const extraCount = savedKeys.filter(k => k > numPages).length;

    if (extraCount > 0) {
      const newPages: number[] = [];
      for (let i = 0; i < extraCount; i++) {
        extraPageIdCounter.current += 1;
        newPages.push(extraPageIdCounter.current);
      }
      setExtraPages(newPages);
    }
  }, [numPages, initialPageAnnotations]);

  // ─── Sync tool/color/strokeWidth to all canvases ─────────────────────────
  useEffect(() => {
    const update = async () => {
      const { fabric } = await import('fabric');
      fabricCanvases.current.forEach((fc) => {
        if (!fc) return;

        // Remove any existing eraser handler
        fc.off('path:created', (fc as any).__eraserHandler);
        (fc as any).__eraserHandler = null;

        if (tool === 'eraser') {
          const brush = new fabric.PencilBrush(fc);
          brush.color = 'rgba(255,100,100,0.3)'; // visible preview while drawing
          brush.width = strokeWidth * 4;
          (brush as any).decimate = 2;
          fc.freeDrawingBrush = brush;
          fc.isDrawingMode = true;
          // After commit, set opaque stroke + destination-out to erase
          const applyEraser = (e: any) => {
            const path = e.path as fabric.Path;
            if (!path) return;
            path.set({
              stroke: 'rgba(0,0,0,1)',
              globalCompositeOperation: 'destination-out',
            });
            fc.renderAll();
            scheduleAutoSave();
          };
          (fc as any).__eraserHandler = applyEraser;
          fc.on('path:created', applyEraser);
        } else if (tool === 'ruler') {
          // Ruler: disable fabric drawing; we handle it ourselves via React events
          fc.isDrawingMode = false;
        } else {
          const brush = new fabric.PencilBrush(fc);
          brush.color = color;
          brush.width = strokeWidth;
          (brush as any).decimate = 2;
          fc.freeDrawingBrush = brush;
          fc.isDrawingMode = true;
        }
      });
    };
    update();
  }, [tool, color, strokeWidth, scheduleAutoSave]);

  // ─── Undo ─────────────────────────────────────────────────────────────────
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

  // ─── Clear ────────────────────────────────────────────────────────────────
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

  // ─── Manual save ─────────────────────────────────────────────────────────
  const handleManualSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const pagesJson = collectPagesJson();
      if (onSave) { onSave(pagesJson); toast.success('Progress saved!'); }
    } finally { setIsSaving(false); }
  }, [collectPagesJson, onSave]);

  // ─── Submit (generate PDF) ───────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!onSavePdf) return;
    setIsSubmitting(true);
    try {
      toast.loading('Generating PDF...', { id: 'pdf-gen' });
      const pagesJson = collectPagesJson();
      if (onSave) onSave(pagesJson);

      const pdfDoc = await PDFDocument.create();
      const { default: html2canvas } = await import('html2canvas');

      // Capture all PDF pages
      const pageElements = document.querySelectorAll('.react-pdf__Page');
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, logging: false, allowTaint: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]);
        page.drawImage(img, { x: 0, y: 0, width: canvas.width / 2, height: canvas.height / 2 });
      }

      // Capture extra blank pages (via wrapper divs that hold Fabric canvases)
      const totalPdf = pageElements.length;
      for (let j = 0; j < extraPages.length; j++) {
        const fabricIndex = totalPdf + j;
        const wrapperEl = pageWrappers.current.get(fabricIndex);
        if (!wrapperEl) continue;
        const canvas = await html2canvas(wrapperEl, { scale: 2, useCORS: true, logging: false, allowTaint: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]);
        page.drawImage(img, { x: 0, y: 0, width: canvas.width / 2, height: canvas.height / 2 });
      }

      const pdfBytes = await pdfDoc.save() as unknown as Uint8Array<ArrayBuffer>;
      const file = new File([pdfBytes], `answer-${Date.now()}.pdf`, { type: 'application/pdf' });
      toast.dismiss('pdf-gen');
      onSavePdf(file);
    } catch (err) {
      console.error('[CanvasWriter] Submit failed:', err);
      toast.dismiss('pdf-gen');
      toast.error('Failed to generate PDF. Please try again.');
    } finally { setIsSubmitting(false); }
  }, [collectPagesJson, onSave, onSavePdf, extraPages]);

  // Register submit with parent
  useEffect(() => {
    if (onRegisterSubmit) onRegisterSubmit(handleSubmit);
  }, [onRegisterSubmit, handleSubmit]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      fabricCanvases.current.forEach((fc) => fc?.dispose());
      fabricCanvases.current.clear();
    };
  }, []);

  // ─── Ruler: commit a straight line to Fabric ─────────────────────────────
  const commitRulerLine = useCallback(async (line: RulerLine) => {
    const fc = fabricCanvases.current.get(line.pageIndex);
    if (!fc) return;
    // Skip tiny accidental taps
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    if (Math.sqrt(dx * dx + dy * dy) < 4) return;
    const { fabric } = await import('fabric');
    const fabricLine = new fabric.Line([line.x1, line.y1, line.x2, line.y2], {
      stroke: color,
      strokeWidth,
      selectable: false,
      evented: false,
    });
    fc.add(fabricLine);
    fc.renderAll();
    scheduleAutoSave();
  }, [color, strokeWidth, scheduleAutoSave]);

  // ─── Ruler event helpers (mouse + touch) ─────────────────────────────────
  const rulerStart = useCallback((pageIndex: number, clientX: number, clientY: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setRulerDrag({ x1: x, y1: y, x2: x, y2: y, pageIndex });
  }, []);

  const rulerMove = useCallback((pageIndex: number, clientX: number, clientY: number, rect: DOMRect, shiftKey: boolean) => {
    if (!rulerDrag || rulerDrag.pageIndex !== pageIndex) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (shiftKey) {
      const dx = x - rulerDrag.x1;
      const dy = y - rulerDrag.y1;
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.sqrt(dx * dx + dy * dy);
      setRulerDrag(r => r ? { ...r, x2: r.x1 + Math.cos(snapped) * dist, y2: r.y1 + Math.sin(snapped) * dist } : r);
    } else {
      setRulerDrag(r => r ? { ...r, x2: x, y2: y } : r);
    }
  }, [rulerDrag]);

  const rulerEnd = useCallback((pageIndex: number) => {
    if (rulerDrag && rulerDrag.pageIndex === pageIndex) {
      commitRulerLine(rulerDrag);
      setRulerDrag(null);
    }
  }, [rulerDrag, commitRulerLine]);

  // ─── Page wrapper ref callback ────────────────────────────────────────────

  const setPageWrapperRef = useCallback((pageIndex: number) => (el: HTMLDivElement | null) => {
    // Handle unmount/change
    const currentCached = pageWrappers.current.get(pageIndex);
    
    // If element is gone, remove from map
    if (!el && currentCached) {
        pageWrappers.current.delete(pageIndex);
        return;
    }

    // If new element or changed element
    if (el && currentCached !== el) {
      pageWrappers.current.set(pageIndex, el);
      // Use shorter timeout to reduce visible flicker
      setTimeout(() => initFabricCanvas(pageIndex, el), 100);
    }
  }, [initFabricCanvas]);

  // ─── Cursor style ─────────────────────────────────────────────────────────
  const getCursor = (_pageIndex: number) => {
    if (tool === 'ruler') return 'crosshair';
    if (tool === 'eraser') {
      const s = strokeWidth * 4 + 8;
      const half = s / 2;
      return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'%3E%3Crect x='2' y='2' width='${s - 4}' height='${s - 4}' rx='2' fill='rgba(255,255,255,0.85)' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E") ${half} ${half}, cell`;
    }
    return 'crosshair';
  };

  // ─── Toolbar helpers ──────────────────────────────────────────────────────
  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button
      key={t}
      title={label}
      onClick={() => setTool(t)}
      className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 group select-none
        ${tool === t
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 active:bg-indigo-700 active:scale-95'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 active:scale-95'}`}
    >
      {icon}
      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        {label}
      </span>
    </button>
  );

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200 shadow-sm flex-wrap">

        {/* Tool group */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl mr-1">
          {toolBtn('pen',    <Paintbrush size={17} />, 'Pen (draw)')}
          {toolBtn('eraser', <Eraser size={17} />,     'Eraser')}
          {toolBtn('ruler',  <Ruler size={17} />,      'Straight line')}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-gray-200 mx-1" />

        {/* Color swatches */}
        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => { setColor(c); if (tool === 'eraser' || tool === 'ruler') {} }}
              className={`w-7 h-7 rounded-full transition-all duration-150 select-none active:scale-90
                ${color === c
                  ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                  : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-gray-200 mx-1" />

        {/* Stroke size */}
        <div className="flex items-center gap-1">
          {STROKE_SIZES.map(size => (
            <button
              key={size}
              title={`${size}px`}
              onClick={() => setStrokeWidth(size)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 select-none active:scale-90
                ${strokeWidth === size ? 'bg-indigo-50 ring-2 ring-indigo-400 shadow-sm' : 'hover:bg-gray-100 active:bg-gray-200'}`}
            >
              <div className="rounded-full bg-gray-700" style={{ width: size, height: size }} />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-gray-200 mx-1" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg px-1">
          <button
            onClick={() => setPdfScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="p-2 text-gray-500 hover:text-gray-800 active:bg-gray-200 active:scale-90 rounded-md transition-all select-none"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono text-gray-600 w-11 text-center select-none">
            {Math.round(pdfScale * 100)}%
          </span>
          <button
            onClick={() => setPdfScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}
            className="p-2 text-gray-500 hover:text-gray-800 active:bg-gray-200 active:scale-90 rounded-md transition-all select-none"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={handleUndo}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 active:scale-90 transition-all select-none"
            title="Undo last stroke"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={handleClear}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 active:bg-red-100 active:scale-90 transition-all select-none"
            title="Clear all drawings"
          >
            <Trash2 size={16} />
          </button>
          {onSave && (
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 disabled:opacity-40 transition-all select-none"
              title="Save progress"
            >
              <Save size={14} />
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Ruler active banner */}
      {tool === 'ruler' && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-xs font-medium">
          <Ruler size={13} />
          <span>Straight line — drag to draw. Release to commit.</span>
        </div>
      )}

      {/* ── Drawing area ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'radial-gradient(circle at center, #e8eaf0 0%, #d5d9e3 100%)', WebkitOverflowScrolling: 'touch' }}
      >
        {loadingPdf && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading exam paper…</p>
          </div>
        )}

        {pdfBlob && (
          <div className="min-h-full flex flex-col items-center py-8 px-4">
            <Document
              file={pdfBlob}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            >
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <div
                  key={i}
                  className="relative shadow-2xl rounded overflow-hidden mx-auto"
                  style={{ display: 'block', marginBottom: '24px' }}
                >
                  <Page
                    pageNumber={i + 1}
                    scale={pdfScale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={i === 0 ? (page) => {
                      // Record rendered width so extra pages can match
                      pdfPageWidthRef.current = page.width * pdfScale;
                    } : undefined}
                  />

                  {/* Fabric drawing overlay */}
                  <div
                    ref={setPageWrapperRef(i)}
                    className="absolute inset-0"
                    style={{ cursor: getCursor(i), touchAction: 'none' }}
                    onMouseDown={tool === 'ruler' ? (e) => {
                      rulerStart(i, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect());
                    } : undefined}
                    onMouseMove={tool === 'ruler' && rulerDrag ? (e) => {
                      rulerMove(i, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), e.shiftKey);
                    } : undefined}
                    onMouseUp={tool === 'ruler' && rulerDrag ? () => rulerEnd(i) : undefined}
                    onMouseLeave={tool === 'ruler' ? () => rulerEnd(i) : undefined}
                    onTouchStart={tool === 'ruler' ? (e) => {
                      e.preventDefault();
                      const t = e.touches[0];
                      rulerStart(i, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect());
                    } : undefined}
                    onTouchMove={tool === 'ruler' && rulerDrag ? (e) => {
                      e.preventDefault();
                      const t = e.touches[0];
                      rulerMove(i, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), false);
                    } : undefined}
                    onTouchEnd={tool === 'ruler' ? (e) => {
                      e.preventDefault();
                      rulerEnd(i);
                    } : undefined}
                  />

                  {/* Ruler live SVG preview */}
                  {rulerDrag && rulerDrag.pageIndex === i && (
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: '100%', height: '100%', overflow: 'visible' }}
                    >
                      {/* Line */}
                      <line
                        x1={rulerDrag.x1} y1={rulerDrag.y1}
                        x2={rulerDrag.x2} y2={rulerDrag.y2}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray="6 3"
                      />
                      {/* End-point circle */}
                      <circle cx={rulerDrag.x2} cy={rulerDrag.y2} r={5} fill={color} opacity={0.8} />
                    </svg>
                  )}
                </div>
              ))}
            </Document>

              {/* ── Extra blank pages ──────────────────────────────────── */}
              {extraPages.map((pid, arrIdx) => {
                // Fabric index starts after all PDF pages
                const fabricIndex = (numPages || 0) + arrIdx;
                return (
                  <div key={pid} className="relative mx-auto" style={{ display: 'block', marginBottom: '24px' }}>
                    {/* Page label */}
                    <div className="absolute -top-6 left-0 text-[11px] text-gray-400 font-medium select-none">
                      Extra page {arrIdx + 1}
                    </div>
                    {/* Blank white canvas */}
                    <div
                      ref={setPageWrapperRef(fabricIndex)}
                      className="relative bg-white shadow-2xl rounded"
                      style={{
                        width: pdfPageWidthRef.current || 794,
                        height: Math.round((pdfPageWidthRef.current || 794) * 1.414), // A4 ratio
                        cursor: getCursor(fabricIndex),
                        touchAction: 'none',
                      }}
                      onMouseDown={tool === 'ruler' ? (e) => {
                        rulerStart(fabricIndex, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect());
                      } : undefined}
                      onMouseMove={tool === 'ruler' && rulerDrag ? (e) => {
                        rulerMove(fabricIndex, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), e.shiftKey);
                      } : undefined}
                      onMouseUp={tool === 'ruler' && rulerDrag ? () => rulerEnd(fabricIndex) : undefined}
                      onMouseLeave={tool === 'ruler' ? () => rulerEnd(fabricIndex) : undefined}
                      onTouchStart={tool === 'ruler' ? (e) => {
                        e.preventDefault();
                        const t = e.touches[0];
                        rulerStart(fabricIndex, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect());
                      } : undefined}
                      onTouchMove={tool === 'ruler' && rulerDrag ? (e) => {
                        e.preventDefault();
                        const t = e.touches[0];
                        rulerMove(fabricIndex, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), false);
                      } : undefined}
                      onTouchEnd={tool === 'ruler' ? (e) => {
                        e.preventDefault();
                        rulerEnd(fabricIndex);
                      } : undefined}
                    />
                    {/* Line SVG preview for extra pages */}
                    {rulerDrag && rulerDrag.pageIndex === fabricIndex && (
                      <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <line x1={rulerDrag.x1} y1={rulerDrag.y1} x2={rulerDrag.x2} y2={rulerDrag.y2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="6 3" />
                        <circle cx={rulerDrag.x2} cy={rulerDrag.y2} r={5} fill={color} opacity={0.8} />
                      </svg>
                    )}
                  </div>
                );
              })}

              {/* Add Page button */}
              <button
                onClick={() => {
                  extraPageIdCounter.current += 1;
                  setExtraPages(p => [...p, extraPageIdCounter.current]);
                }}
                className="flex items-center gap-2 px-5 py-3 mt-2 mb-8 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all text-sm font-medium select-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add extra page
              </button>
          </div>
        )}

        {/* Plain canvas (no PDF) */}
        {!pdfUrl && (
          <div className="flex justify-center py-8 px-4">
            <div
              ref={setPageWrapperRef(0)}
              className="relative bg-white shadow-2xl rounded"
              style={{ width: 800, height: 1100, cursor: getCursor(0) }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      {(onSave || onSavePdf) && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-white border-t border-gray-200">
          {onSave && (
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-[0.97] text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 transition-all select-none"
            >
              <Save size={14} />
              {isSaving ? 'Saving…' : 'Save Progress'}
            </button>
          )}
          {onSavePdf && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-[0.97] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-sm select-none"
            >
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
              ) : (
                <><CheckCircle size={15} /> Submit Answer</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CanvasWriter;
