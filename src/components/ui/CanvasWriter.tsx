'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Paintbrush, Eraser, Ruler, Trash2, Undo, ZoomIn, ZoomOut, Save, CheckCircle, Hand, PenLine } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface RulerLine {
  x1: number; y1: number;
  x2: number; y2: number;
  pageIndex: number;
}

interface StrokePoint { x: number; y: number; }

interface DrawnStroke {
  points: StrokePoint[];
  color: string;
  width: number;
  compositeOp: string; // 'source-over' | 'destination-out'
}

interface PageCanvasData {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  strokes: DrawnStroke[];
}

// ─── Rendering helpers ───────────────────────────────────────────────────────

function renderStroke(ctx: CanvasRenderingContext2D, stroke: DrawnStroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.globalCompositeOperation = stroke.compositeOp as GlobalCompositeOperation;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 4, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
}

function renderAllStrokes(ctx: CanvasRenderingContext2D, strokes: DrawnStroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  for (const s of strokes) renderStroke(ctx, s);
  ctx.globalCompositeOperation = 'source-over';
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  const [fingerMode, setFingerMode] = useState<'draw' | 'scroll'>('scroll');
  const fingerModeRef = useRef<'draw' | 'scroll'>('scroll');
  fingerModeRef.current = fingerMode;
  const [pdfScale, setPdfScale] = useState(1.0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rulerDrag, setRulerDrag] = useState<RulerLine | null>(null);
  const [extraPages, setExtraPages] = useState<number[]>([]);
  const extraPageIdCounter = useRef(0);
  const pdfPageWidthRef = useRef<number>(0);

  // Canvas data per page (replaces fabricCanvases)
  const pageCanvasData = useRef<Map<number, PageCanvasData>>(new Map());
  const pageWrappers = useRef<Map<number, HTMLDivElement>>(new Map());
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const initialisedPages = useRef<Set<number>>(new Set());
  const lastDrawnPageRef = useRef<number | null>(null);
  const initialAnnotationsRef = useRef(initialPageAnnotations);
  initialAnnotationsRef.current = initialPageAnnotations;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;

  // ─── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfUrl) return;
    setLoadingPdf(true);
    fetch(`/api/pdf?url=${encodeURIComponent(pdfUrl)}`)
      .then(r => r.blob())
      .then(blob => { setPdfBlob(blob); setLoadingPdf(false); })
      .catch(() => { toast.error('Failed to load PDF'); setLoadingPdf(false); });
  }, [pdfUrl]);

  // ─── Collect JSON ──────────────────────────────────────────────────────────
  const collectPagesJson = useCallback((): Record<number, string> => {
    const result: Record<number, string> = {};
    pageCanvasData.current.forEach((data, idx) => {
      if (data.strokes.length > 0) {
        result[idx + 1] = JSON.stringify({ version: 2, strokes: data.strokes });
      }
    });
    return result;
  }, []);

  // ─── Auto-save ─────────────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback(() => {
    if (!onSaveRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const pagesJson = collectPagesJson();
      if (Object.keys(pagesJson).length > 0) {
        onSaveRef.current?.(pagesJson);
        if (autoSaveKey) {
          try { localStorage.setItem(autoSaveKey, JSON.stringify({ timestamp: Date.now(), pages: pagesJson })); } catch (_) {}
        }
      }
    }, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectPagesJson, autoSaveKey]);

  // ─── Init canvas for a page ────────────────────────────────────────────────
  const initCanvas = useCallback((pageIndex: number, wrapperEl: HTMLDivElement) => {
    // Already exists — re-attach / resize
    if (pageCanvasData.current.has(pageIndex)) {
      const data = pageCanvasData.current.get(pageIndex)!;
      if (data.canvas.parentNode !== wrapperEl) wrapperEl.appendChild(data.canvas);
      const rect = wrapperEl.getBoundingClientRect();
      const w = rect.width || wrapperEl.offsetWidth || 800;
      const h = rect.height || wrapperEl.offsetHeight || 1100;
      if (data.canvas.width !== Math.round(w) || data.canvas.height !== Math.round(h)) {
        data.canvas.width = w;
        data.canvas.height = h;
        renderAllStrokes(data.ctx, data.strokes, w, h);
      }
      return;
    }

    const rect = wrapperEl.getBoundingClientRect();
    const w = rect.width || wrapperEl.offsetWidth || 800;
    const h = rect.height || wrapperEl.offsetHeight || 1100;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.style.touchAction = fingerModeRef.current === 'scroll' ? 'manipulation' : 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    (canvas.style as any).webkitTouchCallout = 'none';
    wrapperEl.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    const data: PageCanvasData = { canvas, ctx, strokes: [] };
    pageCanvasData.current.set(pageIndex, data);

    // ── Pointer event handlers (Excalidraw-style) ────────────────────────
    let isDrawing = false;
    let currentStroke: DrawnStroke | null = null;
    let lastPt: StrokePoint | null = null;
    let penActive = false;
    const PEN_THRESHOLD = 0.01;

    const getCanvasXY = (e: PointerEvent): StrokePoint => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvas.width / r.width),
        y: (e.clientY - r.top) * (canvas.height / r.height),
      };
    };

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      // pointerdown only fires on physical contact — hovering only generates
      // pointermove.  No pressure filter here; light/quick taps can report
      // very low pressure on the first event and must not be rejected.
      if (e.pointerType === 'pen') penActive = true;

      // Finger in scroll mode → don't draw (browser scrolls via touch-action)
      if (e.pointerType === 'touch' && fingerModeRef.current === 'scroll') return;
      // Palm rejection
      if (e.pointerType === 'touch' && penActive) return;
      // Ruler handled by React events
      if (toolRef.current === 'ruler') return;

      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);

      const pt = getCanvasXY(e);
      const isEraser = toolRef.current === 'eraser';
      currentStroke = {
        points: [pt],
        color: isEraser ? 'rgba(0,0,0,1)' : colorRef.current,
        width: isEraser ? strokeWidthRef.current * 4 : strokeWidthRef.current,
        compositeOp: isEraser ? 'destination-out' : 'source-over',
      };
      lastPt = pt;
      isDrawing = true;

      // Draw a dot
      ctx.globalCompositeOperation = currentStroke.compositeOp as GlobalCompositeOperation;
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + 0.1, pt.y);
      ctx.stroke();
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'pen' && e.pressure < PEN_THRESHOLD && !isDrawing) {
        e.preventDefault();
        return;
      }
      if (!isDrawing || !currentStroke || !lastPt) return;
      e.preventDefault();

      const pt = getCanvasXY(e);
      currentStroke.points.push(pt);

      // Incremental draw
      ctx.globalCompositeOperation = currentStroke.compositeOp as GlobalCompositeOperation;
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPt = pt;
    });

    const commitStroke = () => {
      if (!isDrawing || !currentStroke) { isDrawing = false; return; }
      data.strokes.push(currentStroke);
      // Full re-render with smooth curves
      renderAllStrokes(ctx, data.strokes, canvas.width, canvas.height);
      currentStroke = null;
      lastPt = null;
      isDrawing = false;
      ctx.globalCompositeOperation = 'source-over';
      lastDrawnPageRef.current = pageIndex;
      scheduleAutoSave();
    };

    canvas.addEventListener('pointerup', (e: PointerEvent) => {
      if (e.pointerType === 'pen') setTimeout(() => { penActive = false; }, 120);
      commitStroke();
    });

    // With setPointerCapture, pointerup fires on the capturing element even
    // if the pointer leaves the canvas.  pointerleave should NOT commit
    // because it can fire mid-stroke on some browsers/devices and truncate
    // the drawing.  We use lostpointercapture as a safety net instead.
    canvas.addEventListener('pointerleave', (e: PointerEvent) => {
      if (e.pointerType === 'pen') penActive = false;
      // Do NOT commitStroke here — let pointerup handle it
    });

    canvas.addEventListener('lostpointercapture', () => {
      // Fallback: if capture was lost without pointerup (e.g. system gesture),
      // commit any in-progress stroke so it's not silently discarded.
      commitStroke();
    });

    canvas.addEventListener('pointercancel', (e: PointerEvent) => {
      if (e.pointerType === 'pen') penActive = false;
      if (isDrawing) {
        // Discard — re-render without current stroke
        renderAllStrokes(ctx, data.strokes, canvas.width, canvas.height);
      }
      currentStroke = null;
      lastPt = null;
      isDrawing = false;
      ctx.globalCompositeOperation = 'source-over';
    });

    // ── Load saved annotations ───────────────────────────────────────────
    const savedJson = initialAnnotationsRef.current[pageIndex + 1];
    if (savedJson && !initialisedPages.current.has(pageIndex)) {
      initialisedPages.current.add(pageIndex);
      try {
        const parsed = JSON.parse(savedJson);
        if (parsed.version === 2 && Array.isArray(parsed.strokes)) {
          data.strokes = parsed.strokes;
          renderAllStrokes(ctx, data.strokes, w, h);
        }
        // Old Fabric format (has objects array) cannot be loaded in new engine
      } catch (e) {
        console.error('[CanvasWriter] Failed to restore strokes', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleAutoSave]);

  // ─── Resize canvases when PDF scale changes ────────────────────────────────
  useEffect(() => {
    if (!numPages) return;
    const timer = setTimeout(() => {
      pageCanvasData.current.forEach((data, pageIndex) => {
        const wrapper = pageWrappers.current.get(pageIndex);
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const w = rect.width || wrapper.offsetWidth;
        const h = rect.height || wrapper.offsetHeight;
        if (w > 0 && h > 0 && (data.canvas.width !== Math.round(w) || data.canvas.height !== Math.round(h))) {
          data.canvas.width = w;
          data.canvas.height = h;
          renderAllStrokes(data.ctx, data.strokes, w, h);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [pdfScale, numPages]);

  // ─── Restore extra pages from saved annotations ────────────────────────────
  useEffect(() => {
    if (!numPages) return;
    const savedKeys = Object.keys(initialPageAnnotations).map(Number).filter(k => !isNaN(k));
    const neededExtraCount = savedKeys.filter(k => k > numPages).length;
    if (neededExtraCount === 0) return;
    setExtraPages(prev => {
      if (prev.length >= neededExtraCount) return prev;
      const newPages = [...prev];
      for (let i = prev.length; i < neededExtraCount; i++) {
        extraPageIdCounter.current += 1;
        newPages.push(extraPageIdCounter.current);
      }
      return newPages;
    });
  }, [numPages, initialPageAnnotations]);

  // ─── Prevent double-tap zoom & long-press context menu ─────────────────────
  useEffect(() => {
    const scrollContainer = document.getElementById('canvas-writer-scroll');
    if (!scrollContainer) return;
    let lastTap = 0;
    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 400) e.preventDefault();
      lastTap = now;
    };
    const preventCtx = (e: Event) => { e.preventDefault(); };
    scrollContainer.addEventListener('touchstart', preventDoubleTap, { passive: false });
    scrollContainer.addEventListener('contextmenu', preventCtx);
    return () => {
      scrollContainer.removeEventListener('touchstart', preventDoubleTap);
      scrollContainer.removeEventListener('contextmenu', preventCtx);
    };
  }, []);

  // ─── Sync touchAction when fingerMode changes ─────────────────────────────
  useEffect(() => {
    const ta = fingerMode === 'scroll' ? 'manipulation' : 'none';
    pageCanvasData.current.forEach((data) => {
      data.canvas.style.touchAction = ta;
    });
  }, [fingerMode]);

  // ─── Undo ──────────────────────────────────────────────────────────────────
  const handleUndo = () => {
    const pageIndex = lastDrawnPageRef.current;
    if (pageIndex === null) return;
    const data = pageCanvasData.current.get(pageIndex);
    if (!data || data.strokes.length === 0) return;
    data.strokes.pop();
    renderAllStrokes(data.ctx, data.strokes, data.canvas.width, data.canvas.height);
    scheduleAutoSave();
  };

  // ─── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (!confirm('Clear all drawings on all pages?')) return;
    pageCanvasData.current.forEach((data) => {
      data.strokes = [];
      data.ctx.clearRect(0, 0, data.canvas.width, data.canvas.height);
    });
    scheduleAutoSave();
  };

  // ─── Manual save ───────────────────────────────────────────────────────────
  const handleManualSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const pagesJson = collectPagesJson();
      if (onSaveRef.current) { onSaveRef.current(pagesJson); toast.success('Progress saved!'); }
    } finally { setIsSaving(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectPagesJson]);

  // ─── Submit (generate PDF) ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!onSavePdf) return;
    setIsSubmitting(true);
    try {
      toast.loading('Generating PDF...', { id: 'pdf-gen' });
      const pagesJson = collectPagesJson();
      if (onSaveRef.current) onSaveRef.current(pagesJson);

      const pdfDoc = await PDFDocument.create();
      const { default: html2canvas } = await import('html2canvas');

      const pageElements = document.querySelectorAll('.react-pdf__Page');
      for (let i = 0; i < pageElements.length; i++) {
        const captureEl = (pageElements[i].parentElement ?? pageElements[i]) as HTMLElement;
        const cvs = await html2canvas(captureEl, { scale: 2, useCORS: true, logging: false, allowTaint: true });
        const imgData = cvs.toDataURL('image/jpeg', 0.92);
        const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([cvs.width / 2, cvs.height / 2]);
        page.drawImage(img, { x: 0, y: 0, width: cvs.width / 2, height: cvs.height / 2 });
      }

      const totalPdf = pageElements.length;
      for (let j = 0; j < extraPages.length; j++) {
        const wrapperEl = pageWrappers.current.get(totalPdf + j);
        if (!wrapperEl) continue;
        const cvs = await html2canvas(wrapperEl, { scale: 2, useCORS: true, logging: false, allowTaint: true, backgroundColor: '#ffffff' });
        const imgData = cvs.toDataURL('image/jpeg', 0.92);
        const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([cvs.width / 2, cvs.height / 2]);
        page.drawImage(img, { x: 0, y: 0, width: cvs.width / 2, height: cvs.height / 2 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectPagesJson, onSavePdf, extraPages]);

  useEffect(() => {
    if (onRegisterSubmit) onRegisterSubmit(handleSubmit);
  }, [onRegisterSubmit, handleSubmit]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      pageCanvasData.current.forEach((data) => {
        data.canvas.remove();
      });
      pageCanvasData.current.clear();
    };
  }, []);

  // ─── Ruler ─────────────────────────────────────────────────────────────────
  const commitRulerLine = useCallback((line: RulerLine) => {
    const data = pageCanvasData.current.get(line.pageIndex);
    if (!data) return;
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    if (Math.sqrt(dx * dx + dy * dy) < 4) return;
    const stroke: DrawnStroke = {
      points: [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }],
      color,
      width: strokeWidth,
      compositeOp: 'source-over',
    };
    data.strokes.push(stroke);
    renderAllStrokes(data.ctx, data.strokes, data.canvas.width, data.canvas.height);
    lastDrawnPageRef.current = line.pageIndex;
    scheduleAutoSave();
  }, [color, strokeWidth, scheduleAutoSave]);

  const rulerStart = useCallback((pageIndex: number, clientX: number, clientY: number, rect: DOMRect) => {
    setRulerDrag({ x1: clientX - rect.left, y1: clientY - rect.top, x2: clientX - rect.left, y2: clientY - rect.top, pageIndex });
  }, []);

  const rulerMove = useCallback((pageIndex: number, clientX: number, clientY: number, rect: DOMRect, shiftKey: boolean) => {
    if (!rulerDrag || rulerDrag.pageIndex !== pageIndex) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (shiftKey) {
      const dx2 = x - rulerDrag.x1;
      const dy2 = y - rulerDrag.y1;
      const angle = Math.atan2(dy2, dx2);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
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
    const currentCached = pageWrappers.current.get(pageIndex);
    if (!el && currentCached) {
      pageWrappers.current.delete(pageIndex);
      return;
    }
    if (el && currentCached !== el) {
      pageWrappers.current.set(pageIndex, el);
      setTimeout(() => initCanvas(pageIndex, el), 100);
    }
  }, [initCanvas]);

  // ─── Cursor style ─────────────────────────────────────────────────────────
  const getCursor = () => {
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
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl mr-1">
          {toolBtn('pen',    <Paintbrush size={17} />, 'Pen (draw)')}
          {toolBtn('eraser', <Eraser size={17} />,     'Eraser')}
          {toolBtn('ruler',  <Ruler size={17} />,      'Straight line')}
        </div>

        <button
          title={fingerMode === 'scroll'
            ? 'Touch: Scroll & pan (click to let finger draw)'
            : 'Touch: Draw (click to scroll with finger)'}
          onClick={() => setFingerMode(m => m === 'scroll' ? 'draw' : 'scroll')}
          className={`relative flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-medium transition-all duration-150 select-none group
            ${fingerMode === 'scroll'
              ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-300 hover:bg-sky-200'
              : 'bg-orange-100 text-orange-700 ring-1 ring-orange-300 hover:bg-orange-200'}`}
        >
          {fingerMode === 'scroll' ? <Hand size={15} /> : <PenLine size={15} />}
          <span className="hidden sm:inline">{fingerMode === 'scroll' ? 'Scroll' : 'Draw'}</span>
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            {fingerMode === 'scroll' ? 'Finger scrolls page' : 'Finger draws'}
          </span>
        </button>

        <div className="w-px h-7 bg-gray-200 mx-1" />

        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-all duration-150 select-none active:scale-90
                ${color === c
                  ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                  : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="w-px h-7 bg-gray-200 mx-1" />

        <div className="flex items-center gap-2 px-1">
          <div
            className="rounded-full bg-gray-700 flex-shrink-0 transition-all duration-100"
            style={{ width: Math.min(strokeWidth, 20), height: Math.min(strokeWidth, 20) }}
          />
          <input
            type="range" min={1} max={20} step={1} value={strokeWidth}
            onChange={e => setStrokeWidth(Number(e.target.value))}
            title={`Stroke size: ${strokeWidth}px`}
            className="w-20 accent-indigo-600 cursor-pointer"
            style={{ height: 4 }}
          />
          <span className="text-[11px] font-mono text-gray-500 w-5 text-right select-none">{strokeWidth}</span>
        </div>

        <div className="w-px h-7 bg-gray-200 mx-1" />

        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg px-1">
          <button
            onClick={() => setPdfScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="p-2 text-gray-500 hover:text-gray-800 active:bg-gray-200 active:scale-90 rounded-md transition-all select-none"
            title="Zoom out"
          ><ZoomOut size={16} /></button>
          <span className="text-xs font-mono text-gray-600 w-11 text-center select-none">{Math.round(pdfScale * 100)}%</span>
          <button
            onClick={() => setPdfScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}
            className="p-2 text-gray-500 hover:text-gray-800 active:bg-gray-200 active:scale-90 rounded-md transition-all select-none"
            title="Zoom in"
          ><ZoomIn size={16} /></button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={handleUndo} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 active:scale-90 transition-all select-none" title="Undo last stroke">
            <Undo size={16} />
          </button>
          <button onClick={handleClear} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 active:bg-red-100 active:scale-90 transition-all select-none" title="Clear all drawings">
            <Trash2 size={16} />
          </button>
          {onSave && (
            <button onClick={handleManualSave} disabled={isSaving}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 disabled:opacity-40 transition-all select-none"
              title="Save progress"
            >
              <Save size={14} />{isSaving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {tool === 'ruler' && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-xs font-medium">
          <Ruler size={13} /><span>Straight line — drag to draw. Release to commit.</span>
        </div>
      )}

      {/* ── Drawing area ─────────────────────────────────────────────────── */}
      <div
        id="canvas-writer-scroll"
        className="flex-1 overflow-auto"
        style={{
          background: 'radial-gradient(circle at center, #e8eaf0 0%, #d5d9e3 100%)',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'manipulation',
        }}
      >
        {loadingPdf && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading exam paper…</p>
          </div>
        )}

        {pdfBlob && (
          <div className="min-h-full flex flex-col items-center py-8 px-4">
            <Document file={pdfBlob} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <div key={i} className="relative shadow-2xl rounded overflow-hidden mx-auto"
                  style={{ display: 'block', marginBottom: '24px', userSelect: 'none', WebkitUserSelect: 'none', willChange: 'transform' }}>
                  <Page pageNumber={i + 1} scale={pdfScale} renderTextLayer={false} renderAnnotationLayer={false}
                    onRenderSuccess={i === 0 ? (page) => { pdfPageWidthRef.current = page.width * pdfScale; } : undefined} />

                  {/* Canvas drawing overlay */}
                  <div ref={setPageWrapperRef(i)} className="absolute inset-0"
                    style={{ cursor: getCursor(), touchAction: fingerMode === 'scroll' ? 'manipulation' : 'none' }}
                    onMouseDown={tool === 'ruler' ? (e) => rulerStart(i, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect()) : undefined}
                    onMouseMove={tool === 'ruler' && rulerDrag ? (e) => rulerMove(i, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), e.shiftKey) : undefined}
                    onMouseUp={tool === 'ruler' && rulerDrag ? () => rulerEnd(i) : undefined}
                    onMouseLeave={tool === 'ruler' ? () => rulerEnd(i) : undefined}
                    onTouchStart={tool === 'ruler' ? (e) => { e.preventDefault(); const t = e.touches[0]; rulerStart(i, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect()); } : undefined}
                    onTouchMove={tool === 'ruler' && rulerDrag ? (e) => { e.preventDefault(); const t = e.touches[0]; rulerMove(i, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), false); } : undefined}
                    onTouchEnd={tool === 'ruler' ? (e) => { e.preventDefault(); rulerEnd(i); } : undefined}
                  />

                  {rulerDrag && rulerDrag.pageIndex === i && (
                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <line x1={rulerDrag.x1} y1={rulerDrag.y1} x2={rulerDrag.x2} y2={rulerDrag.y2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="6 3" />
                      <circle cx={rulerDrag.x2} cy={rulerDrag.y2} r={5} fill={color} opacity={0.8} />
                    </svg>
                  )}
                </div>
              ))}
            </Document>

            {extraPages.map((pid, arrIdx) => {
              const idx = (numPages || 0) + arrIdx;
              return (
                <div key={pid} className="relative mx-auto overflow-hidden" style={{ display: 'block', marginBottom: '24px', userSelect: 'none', WebkitUserSelect: 'none', willChange: 'transform' }}>
                  <div className="absolute -top-6 left-0 text-[11px] text-gray-400 font-medium select-none">Extra page {arrIdx + 1}</div>
                  <div ref={setPageWrapperRef(idx)} className="relative bg-white shadow-2xl rounded"
                    style={{
                      width: pdfPageWidthRef.current || 794,
                      height: Math.round((pdfPageWidthRef.current || 794) * 1.414),
                      cursor: getCursor(),
                      touchAction: fingerMode === 'scroll' ? 'manipulation' : 'none',
                    }}
                    onMouseDown={tool === 'ruler' ? (e) => rulerStart(idx, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect()) : undefined}
                    onMouseMove={tool === 'ruler' && rulerDrag ? (e) => rulerMove(idx, e.clientX, e.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), e.shiftKey) : undefined}
                    onMouseUp={tool === 'ruler' && rulerDrag ? () => rulerEnd(idx) : undefined}
                    onMouseLeave={tool === 'ruler' ? () => rulerEnd(idx) : undefined}
                    onTouchStart={tool === 'ruler' ? (e) => { e.preventDefault(); const t = e.touches[0]; rulerStart(idx, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect()); } : undefined}
                    onTouchMove={tool === 'ruler' && rulerDrag ? (e) => { e.preventDefault(); const t = e.touches[0]; rulerMove(idx, t.clientX, t.clientY, (e.currentTarget as HTMLDivElement).getBoundingClientRect(), false); } : undefined}
                    onTouchEnd={tool === 'ruler' ? (e) => { e.preventDefault(); rulerEnd(idx); } : undefined}
                  />
                  {rulerDrag && rulerDrag.pageIndex === idx && (
                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <line x1={rulerDrag.x1} y1={rulerDrag.y1} x2={rulerDrag.x2} y2={rulerDrag.y2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="6 3" />
                      <circle cx={rulerDrag.x2} cy={rulerDrag.y2} r={5} fill={color} opacity={0.8} />
                    </svg>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => { extraPageIdCounter.current += 1; setExtraPages(p => [...p, extraPageIdCounter.current]); }}
              className="flex items-center gap-2 px-5 py-3 mt-2 mb-8 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all text-sm font-medium select-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add extra page
            </button>
          </div>
        )}

        {!pdfUrl && (
          <div className="flex justify-center py-8 px-4">
            <div ref={setPageWrapperRef(0)} className="relative bg-white shadow-2xl rounded"
              style={{ width: 800, height: 1100, cursor: getCursor(), touchAction: fingerMode === 'scroll' ? 'manipulation' : 'none', userSelect: 'none', WebkitUserSelect: 'none', willChange: 'transform' }}
            />
          </div>
        )}
      </div>

      {(onSave || onSavePdf) && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-white border-t border-gray-200">
          {onSave && (
            <button onClick={handleManualSave} disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-[0.97] text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 transition-all select-none">
              <Save size={14} />{isSaving ? 'Saving…' : 'Save Progress'}
            </button>
          )}
          {onSavePdf && (
            <button onClick={handleSubmit} disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-[0.97] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-sm select-none">
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
