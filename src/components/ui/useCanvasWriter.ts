'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

// ── Constants ────────────────────────────────────────────────────────────────

const RENDER_SCALE = 2;
const AUTO_SAVE_INTERVAL = 3000;
const MAX_HISTORY = 50;
const PAGE_GAP = 20; // 20px gap in continuous scroll

// ── Types ────────────────────────────────────────────────────────────────────

export interface LineData {
  points: number[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser' | 'straight';
  pageIdx?: number;
}

export type PageLines = Record<number, LineData[]>;

export interface UseCanvasWriterProps {
  pdfUrl?: string;
  onSave?: (strokePages: Record<number, string>) => void;
  onSavePdf?: (file: File) => void;
  autoSaveKey?: string;
  initialPageAnnotations?: Record<number, string>;
  onRegisterSubmit?: (fn: () => void) => void;
  onRegisterSave?: (fn: () => Promise<void>) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  containerSize: { w: number; h: number };
}



// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCanvasWriter({
  pdfUrl,
  onSave,
  onSavePdf,
  autoSaveKey,
  initialPageAnnotations,
  onRegisterSubmit,
  onRegisterSave,
  stageRef,
  containerSize,
}: UseCanvasWriterProps) {
  // ── PDF state ────────────────────────────────────────────────────────────
  const [pdfPageImages, setPdfPageImages] = useState<HTMLImageElement[]>([]);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ w: number; h: number }[]>([]);
  const [isLoading, setIsLoading] = useState(!!pdfUrl);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pdfRawBytesRef = useRef<ArrayBuffer | null>(null);

  // ── Drawing state ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(0);
  const [pageLines, setPageLines] = useState<PageLines>({});
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'straight'>('pen');
  const [strokeColor, setStrokeColor] = useState('#1a1a1a');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // ── Multi-touch tracking (PointerEvents) ──────────────────────────────────
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number>(0);

  // ── Zoom / pan ───────────────────────────────────────────────────────────
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Keep latest scale/pos in refs so pinch-to-zoom closures aren't stale
  const scaleRef = useRef(stageScale);
  const posRef = useRef(stagePos);
  useEffect(() => { scaleRef.current = stageScale; }, [stageScale]);
  useEffect(() => { posRef.current = stagePos; }, [stagePos]);

  // ── Drawing refs (mutable for performance) ───────────────────────────────
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const currentLineRef = useRef<LineData | null>(null);

  // ── Draft images ─────────────────────────────────────────────────────────
  const [draftImages, setDraftImages] = useState<Record<number, HTMLImageElement>>({});

  // ── History (per-page undo/redo) ─────────────────────────────────────────
  const historyRef = useRef<Record<number, LineData[][]>>({});
  const historyIndexRef = useRef<Record<number, number>>({});
  const [historyVersion, setHistoryVersion] = useState(0);

  // ── Auto-save timer ──────────────────────────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fit-to-page tracking ─────────────────────────────────────────────────
  const lastFitKeyRef = useRef('');

  // ── Computed ──────────────────────────────────────────────────────────────
  const numPages = pdfUrl ? pdfPageImages.length : 1;

  // Page dimensions in CSS pixels (raster / RENDER_SCALE).
  // Stable: only depends on pdfPageDimensions (set once on PDF load).
  const getPageSize = useCallback(
    (pageIdx: number) => {
      if (pdfPageDimensions[pageIdx]) {
        return {
          w: pdfPageDimensions[pageIdx].w / RENDER_SCALE,
          h: pdfPageDimensions[pageIdx].h / RENDER_SCALE,
        };
      }
      // Blank canvas — use fixed default (not containerSize, to avoid dependency churn)
      return { w: 800, h: 600 };
    },
    [pdfPageDimensions]
  );

  // ── Continuous Scroll Layout ──────────────────────────────────────────────
  const getPageOffset = useCallback(
    (pageIdx: number): number => {
      let offset = 0;
      for (let i = 0; i < pageIdx; i++) {
        offset += getPageSize(i).h + PAGE_GAP;
      }
      return offset;
    },
    [getPageSize]
  );

  const getTotalDocumentHeight = useCallback((): number => {
    let total = 0;
    for (let i = 0; i < numPages; i++) {
      total += getPageSize(i).h;
      if (i < numPages - 1) total += PAGE_GAP;
    }
    return total;
  }, [numPages, getPageSize]);

  // Maps an absolute Y pixel to a specific page index + local Y coordinate.
  const getPageFromY = useCallback(
    (absoluteY: number) => {
      let offset = 0;
      for (let i = 0; i < numPages; i++) {
        const h = getPageSize(i).h;
        if (absoluteY >= offset && absoluteY <= offset + h + PAGE_GAP) {
          return { pageIdx: i, localY: absoluteY - offset, pageH: h };
        }
        offset += h + PAGE_GAP;
      }
      // Out of bounds bottom, snap to last page
      const lastIdx = Math.max(0, numPages - 1);
      return { 
        pageIdx: lastIdx, 
        localY: absoluteY - getPageOffset(lastIdx), 
        pageH: getPageSize(lastIdx).h 
      };
    },
    [numPages, getPageSize, getPageOffset]
  );

  // ── Load PDF pages ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfUrl) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const proxyUrl = `/api/pdf?url=${encodeURIComponent(pdfUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        pdfRawBytesRef.current = arrayBuffer;

        loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const images: HTMLImageElement[] = [];
        const dims: { w: number; h: number }[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

          const dataUrl = canvas.toDataURL('image/png');
          const img = new window.Image();
          img.src = dataUrl;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
          });

          images.push(img);
          dims.push({ w: viewport.width, h: viewport.height });
        }

        if (!cancelled) {
          setPdfPageImages(images);
          setPdfPageDimensions(dims);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [pdfUrl]);

  // ── Load draft annotations as images ─────────────────────────────────────
  useEffect(() => {
    if (!initialPageAnnotations) return;
    const entries = Object.entries(initialPageAnnotations);
    if (entries.length === 0) return;

    const loaded: Record<number, HTMLImageElement> = {};
    let remaining = entries.length;

    entries.forEach(([pageStr, dataUrl]) => {
      if (!dataUrl) {
        remaining--;
        return;
      }
      const pageNum = parseInt(pageStr);
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => {
        loaded[pageNum] = img;
        remaining--;
        if (remaining <= 0) {
          setDraftImages({ ...loaded });
        }
      };
      img.onerror = () => {
        remaining--;
        if (remaining <= 0) {
          setDraftImages({ ...loaded });
        }
      };
    });
  }, [initialPageAnnotations]);

  // ── History helpers ──────────────────────────────────────────────────────
  const pushHistory = useCallback(
    (page: number, lines: LineData[]) => {
      if (!historyRef.current[page]) {
        historyRef.current[page] = [[]];
        historyIndexRef.current[page] = 0;
      }
      const idx = historyIndexRef.current[page];
      // Truncate any redo states
      historyRef.current[page] = historyRef.current[page].slice(0, idx + 1);
      // Push new snapshot (deep copy)
      historyRef.current[page].push(JSON.parse(JSON.stringify(lines)));
      // Cap history
      if (historyRef.current[page].length > MAX_HISTORY) {
        historyRef.current[page].shift();
      } else {
        historyIndexRef.current[page]++;
      }
      setHistoryVersion((v) => v + 1);
    },
    []
  );

  // Allow undo/redo based on whichever page actually has history, 
  // or globally cross-page. For continuous scroll, we can just look 
  // at the page where the last stroke was drawn, or broadly track a 
  // global timeline. 
  // Since history is currently per-page, we'll track the "active page" 
  // implicitly derived from the last stroke or default to page 0.
  // We'll keep a soft reference to the last drawn page.
  const [activeHistoryPage, setActiveHistoryPage] = useState(0);

  const canUndo =
    (historyRef.current[activeHistoryPage + 1]?.length ?? 0) > 0 &&
    (historyIndexRef.current[activeHistoryPage + 1] ?? 0) > 0;

  const canRedo =
    (historyIndexRef.current[activeHistoryPage + 1] ?? 0) <
    (historyRef.current[activeHistoryPage + 1]?.length ?? 1) - 1;

  const undo = useCallback(() => {
    const page = activeHistoryPage + 1;
    const idx = historyIndexRef.current[page];
    if (idx === undefined || idx <= 0) return;
    historyIndexRef.current[page] = idx - 1;
    const snapshot = historyRef.current[page][idx - 1];
    setPageLines((prev) => ({ ...prev, [page]: JSON.parse(JSON.stringify(snapshot)) }));
    setHistoryVersion((v) => v + 1);
  }, [activeHistoryPage]);

  const redo = useCallback(() => {
    const page = activeHistoryPage + 1;
    const idx = historyIndexRef.current[page];
    const maxIdx = (historyRef.current[page]?.length ?? 1) - 1;
    if (idx === undefined || idx >= maxIdx) return;
    historyIndexRef.current[page] = idx + 1;
    const snapshot = historyRef.current[page][idx + 1];
    setPageLines((prev) => ({ ...prev, [page]: JSON.parse(JSON.stringify(snapshot)) }));
    setHistoryVersion((v) => v + 1);
  }, [activeHistoryPage]);

  // ── Pointer handlers ─────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const pointerId = e.evt.pointerId;
      const pointerType = e.evt.pointerType;

      if (pointerType === 'touch') {
        const stage = stageRef.current;
        if (!stage) return;
        const pos = stage.getPointerPosition();
        if (pos) {
          activePointersRef.current.set(pointerId, { x: pos.x, y: pos.y });
        }
        return; // Don't draw with touch
      }

      const stage = stageRef.current;
      if (!stage) return;

      const rawPos = stage.getRelativePointerPosition();
      if (!rawPos) return;

      const { pageIdx, localY, pageH } = getPageFromY(rawPos.y);
      const pageSize = getPageSize(pageIdx);
      
      // Ensure drawing starts strictly inside the PDF bounds
      if (rawPos.x < 0 || rawPos.x > pageSize.w || localY < 0 || localY > pageH) {
        return;
      }

      isDrawingRef.current = true;
      setIsDrawing(true);
      setActiveHistoryPage(pageIdx);
      
      // The current stroke is locked to the page it started on
      currentLineRef.current = {
        points: [rawPos.x, localY],
        color: strokeColor,
        strokeWidth: strokeWidth,
        tool: activeTool,
        pageIdx: pageIdx // track the page for this active stroke
      };

      const page = pageIdx + 1;
      const newLine = { ...currentLineRef.current };
      setPageLines((prev) => ({
        ...prev,
        [page]: [...(prev[page] || []), newLine],
      }));
    },
    [stageRef, strokeColor, strokeWidth, activeTool, getPageFromY, getPageSize]
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      
      const pointerId = e.evt.pointerId;
      const pointerType = e.evt.pointerType;
      const stage = stageRef.current;
      if (!stage) return;

      if (pointerType === 'touch') {
        const pos = stage.getPointerPosition(); // Use absolute pointer position for screen tracking
        if (!pos) return;
        
        activePointersRef.current.set(pointerId, { x: pos.x, y: pos.y });

        const activeTouchIds = Array.from(activePointersRef.current.keys());

        if (activeTouchIds.length >= 2) {
          const id1 = activeTouchIds[0];
          const id2 = activeTouchIds[1];
          const t1 = activePointersRef.current.get(id1)!;
          const t2 = activePointersRef.current.get(id2)!;

          const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
          const center = {
            x: (t1.x + t2.x) / 2,
            y: (t1.y + t2.y) / 2,
          };

          if (lastCenterRef.current) {
            const dx = center.x - lastCenterRef.current.x;
            const dy = center.y - lastCenterRef.current.y;
            panBy(dx, dy);
          }

          if (lastDistRef.current > 0) {
            const ratio = dist / lastDistRef.current;
            const currentScale = scaleRef.current;
            const newScale = Math.min(5, Math.max(0.3, currentScale * ratio));
            
            // Adjust zoom to center
            zoomTo(newScale, center);
          }

          lastDistRef.current = dist;
          lastCenterRef.current = center;
        }
        return; // Don't draw with touch
      }

      if (!isDrawingRef.current || !currentLineRef.current) return;

      const rawPos = stage.getRelativePointerPosition();
      if (!rawPos) return;

      const startPageIdx = (currentLineRef.current as any).pageIdx;
      const pageSize = getPageSize(startPageIdx);
      const startPageOffset = getPageOffset(startPageIdx);
      
      // Calculate local Y relative to the page this stroke locked onto
      const rawLocalY = rawPos.y - startPageOffset;

      // Clamp coordinates to strictly stay within the page's boundaries
      const pos = {
        x: Math.max(0, Math.min(rawPos.x, pageSize.w)),
        y: Math.max(0, Math.min(rawLocalY, pageSize.h)),
      };

      if (currentLineRef.current.tool === 'straight') {
        const startX = currentLineRef.current.points[0];
        const startY = currentLineRef.current.points[1];
        currentLineRef.current.points = [startX, startY, pos.x, pos.y];
      } else {
        currentLineRef.current.points = [
          ...currentLineRef.current.points,
          pos.x,
          pos.y,
        ];
      }

      const page = startPageIdx + 1;
      const updatedLine = { ...currentLineRef.current };
      setPageLines((prev) => {
        const lines = [...(prev[page] || [])];
        lines[lines.length - 1] = updatedLine;
        return { ...prev, [page]: lines };
      });
    },
    [stageRef, getPageSize, getPageOffset]
  );

  const handlePointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const pointerId = e.evt.pointerId;
      const pointerType = e.evt.pointerType;

      if (pointerType === 'touch') {
        activePointersRef.current.delete(pointerId);
        if (activePointersRef.current.size < 2) {
          lastDistRef.current = 0;
          lastCenterRef.current = null;
        }
        return; // Don't draw with touch
      }

      const pageIdx = (currentLineRef.current as any).pageIdx;

      isDrawingRef.current = false;
      setIsDrawing(false);
      currentLineRef.current = null;

      const page = pageIdx + 1;
      setPageLines((prev) => {
        const lines = prev[page] || [];
        pushHistory(page, lines);
        return prev;
      });
    },
    [pushHistory]
  );

  // ── Touch handlers (fingers = zoom only, no pan) ──────────────────────────
  // Single-finger touch is ignored (no drag). Pinch-to-zoom is handled
  // via native touchmove listener in CanvasWriter.tsx.
  const handleTouchStart = useCallback(
    (_e: KonvaEventObject<TouchEvent>) => {
      // no-op — pinch is handled externally on the DOM element
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    // no-op
  }, []);

  // ── Zoom helpers (use refs to avoid stale closures) ───────────────────────
  const containerSizeRef = useRef(containerSize);
  useEffect(() => { containerSizeRef.current = containerSize; }, [containerSize]);

  // ── Pan/Zoom constraints ──────────────────────────────────────────────────
  // Do not let pan drift way off into the gray area
  const clampPos = useCallback(
    (x: number, y: number, scale: number) => {
      const cs = containerSizeRef.current;
      const pad = 20;

      const docW = getPageSize(0).w * scale; // Assume width is fairly uniform for bounds check
      const docH = getTotalDocumentHeight() * scale;

      // x minimums and maximums
      // If doc is smaller than container width, keep it centered or freely padded, 
      // but if it's larger, it shouldn't drift past its own edge + padding.
      const minX = Math.min(pad, cs.w - docW - pad);
      const maxX = Math.max(-pad, pad);
      
      const minY = Math.min(pad, cs.h - docH - pad);
      const maxY = Math.max(-pad, pad);

      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
      };
    },
    [getPageSize, getTotalDocumentHeight]
  );

  const zoomTo = useCallback(
    (newScale: number, center?: { x: number; y: number }) => {
      const cs = containerSizeRef.current;
      const pad = 20;
      
      // Compute minimum allowed scale: Fit the doc width to the container with 20px padding on each side
      const docW = getPageSize(0).w || 800; // prevent divide by zero
      const minScale = Math.max(0.1, (cs.w - pad * 2) / docW);

      const clamped = Math.min(5, Math.max(minScale, newScale));
      const oldScale = scaleRef.current;
      const oldPos = posRef.current;
      const c = center || { x: cs.w / 2, y: cs.h / 2 };
      
      let newX = c.x - (c.x - oldPos.x) * (clamped / oldScale);
      let newY = c.y - (c.y - oldPos.y) * (clamped / oldScale);

      const clampedPos = clampPos(newX, newY, clamped);

      setStageScale(clamped);
      setStagePos(clampedPos);
    },
    [clampPos, getPageSize]
  );

  const zoomIn = useCallback(() => zoomTo(scaleRef.current * 1.2), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(scaleRef.current / 1.2), [zoomTo]);
  const resetZoom = useCallback(() => {
    // Determine the ideal fit-to-width scale
    const cs = containerSizeRef.current;
    if (cs.w === 0 || cs.h === 0) {
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
      return;
    }

    const docW = getPageSize(0).w || 800;
    const padding = 20;
    const idealScale = Math.max(0.1, (cs.w - padding * 2) / docW);
    
    setStageScale(idealScale);
    setStagePos({ x: padding, y: padding }); // Top left padding
  }, [getPageSize]);

  const panBy = useCallback((dx: number, dy: number) => {
    setStagePos((prev) => clampPos(prev.x + dx, prev.y + dy, scaleRef.current));
  }, [clampPos]);

  // ── Initial fit-to-width on load ───────────────────────────────────────
  useEffect(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return;
    const ps = getPageSize(0);
    if (!ps.w || !ps.h) return;

    // Deduplicate — only re-fit when these inputs actually change
    const fitKey = `${pdfPageImages.length}-${Math.round(containerSize.w)}-${Math.round(containerSize.h)}`;
    if (fitKey === lastFitKeyRef.current) return;
    lastFitKeyRef.current = fitKey;

    resetZoom(); // Applies the fit-to-width with 20px padding naturally
  }, [pdfPageImages.length, containerSize, getPageSize, resetZoom]);

  // ── Scroll to page helper ──────────────────────────────────────────────
  const scrollToPage = useCallback(
    (pageIdx: number) => {
      const targetIdx = Math.max(0, Math.min(numPages - 1, pageIdx));
      const targetY = -(getPageOffset(targetIdx) * scaleRef.current);
      // Let panBy's clamping ensure we don't overscroll past the bounds
      setStagePos((prev) => clampPos(prev.x, targetY, scaleRef.current));
      setCurrentPage(targetIdx);
    },
    [numPages, getPageOffset, clampPos]
  );

  // ── Track Visible Page ─────────────────────────────────────────────────
  useEffect(() => {
    // Find what page is roughly at the center of the viewport
    const viewportCenterY = -stagePos.y + (containerSize.h / 2);
    // Convert screen Y to document absolute Y
    const documentY = viewportCenterY / stageScale;
    
    // Check against layout
    const { pageIdx } = getPageFromY(documentY);
    setCurrentPage(pageIdx);
  }, [stagePos.y, stageScale, containerSize.h, getPageFromY]);

  // ── Export all pages as PNG data URLs ─────────────────────────────────────
  const exportAllPages = useCallback(async (): Promise<Record<number, string>> => {
    const result: Record<number, string> = {};

    const pages = pdfUrl ? pdfPageImages.length : 1;
    for (let i = 0; i < pages; i++) {
      const pageNum = i + 1;
      const lines = pageLines[pageNum];
      const draftImg = draftImages[pageNum];
      
      // Only skip if there are NO new lines AND NO existing draft
      if ((!lines || lines.length === 0) && !draftImg) continue;

      const ps = getPageSize(i);
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.left = '-9999px';
      div.style.top = '-9999px';
      document.body.appendChild(div);

      try {
        const offStage = new Konva.Stage({
          container: div,
          width: ps.w,
          height: ps.h,
        });
        const layer = new Konva.Layer();
        offStage.add(layer);

        // Render previous draft underlying the new strokes, if it exists
        if (draftImg) {
          layer.add(
            new Konva.Image({
              image: draftImg,
              x: 0,
              y: 0,
              width: ps.w,
              height: ps.h,
            })
          );
        }

        // Render newly drawn lines
        if (lines) {
          for (const line of lines) {
            layer.add(
              new Konva.Line({
                points: line.points,
                stroke: line.tool === 'eraser' ? '#ffffff' : line.color,
                strokeWidth: line.strokeWidth,
                tension: 0.5,
                lineCap: 'round',
                lineJoin: 'round',
                globalCompositeOperation:
                  line.tool === 'eraser' ? 'destination-out' : 'source-over',
              })
            );
          }
        }

        layer.draw();
        result[pageNum] = offStage.toDataURL({ pixelRatio: RENDER_SCALE });
        offStage.destroy();
      } finally {
        document.body.removeChild(div);
      }
    }

    return result;
  }, [pdfUrl, pdfPageImages.length, pageLines, draftImages, getPageSize]);

  // ── Trigger Manual or Auto Save ──────────────────────────────────────────
  const triggerSave = useCallback(async () => {
    try {
      const exported = await exportAllPages();
      if (Object.keys(exported).length === 0) return;

      onSave?.(exported);

      if (autoSaveKey) {
        try {
          localStorage.setItem(
            autoSaveKey,
            JSON.stringify({ pages: exported, timestamp: Date.now() })
          );
        } catch (e) {
          console.warn('[CanvasWriter] localStorage save failed', e);
        }
      }
    } catch (e) {
      console.warn('[CanvasWriter] triggerSave failed', e);
    }
  }, [exportAllPages, onSave, autoSaveKey]);

  // ── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onSave && !autoSaveKey) return;

    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setInterval(triggerSave, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [onSave, autoSaveKey, triggerSave]);

  // ── PDF export (submit) ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    try {
      if (pdfUrl && pdfRawBytesRef.current && pdfPageImages.length > 0) {
        const pdfDoc = await PDFDocument.load(pdfRawBytesRef.current);
        const pdfPages = pdfDoc.getPages();

        for (let i = 0; i < Math.min(pdfPages.length, pdfPageImages.length); i++) {
          const pageNum = i + 1;
          const lines = pageLines[pageNum];
          const hasDraft = !!draftImages[pageNum];
          if ((!lines || lines.length === 0) && !hasDraft) continue;

          const ps = getPageSize(i);
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.left = '-9999px';
          div.style.top = '-9999px';
          document.body.appendChild(div);

          try {
            const offStage = new Konva.Stage({
              container: div,
              width: ps.w,
              height: ps.h,
            });
            const layer = new Konva.Layer();
            offStage.add(layer);

            if (draftImages[pageNum]) {
              layer.add(
                new Konva.Image({
                  image: draftImages[pageNum],
                  x: 0,
                  y: 0,
                  width: ps.w,
                  height: ps.h,
                })
              );
            }

            if (lines) {
              for (const line of lines) {
                layer.add(
                  new Konva.Line({
                    points: line.points,
                    stroke: line.tool === 'eraser' ? '#ffffff' : line.color,
                    strokeWidth: line.strokeWidth,
                    tension: 0.5,
                    lineCap: 'round',
                    lineJoin: 'round',
                    globalCompositeOperation:
                      line.tool === 'eraser' ? 'destination-out' : 'source-over',
                  })
                );
              }
            }

            layer.draw();
            const dataUrl = offStage.toDataURL({ pixelRatio: RENDER_SCALE });
            offStage.destroy();

            const base64 = dataUrl.split(',')[1];
            const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const embeddedImage = await pdfDoc.embedPng(pngBytes);
            const pdfPage = pdfPages[i];
            const { width: pw, height: ph } = pdfPage.getSize();
            pdfPage.drawImage(embeddedImage, { x: 0, y: 0, width: pw, height: ph });
          } finally {
            document.body.removeChild(div);
          }
        }

        const pdfBytes = await pdfDoc.save();
        const file = new File([pdfBytes as BlobPart], 'annotated-answer.pdf', {
          type: 'application/pdf',
        });
        onSavePdf?.(file);
      } else if (onSavePdf) {
        // Fallback for blank canvas (no PDF URL)
        // Find all pages that have either lines or draft images
        const activePages = new Set([1, ...Object.keys(pageLines).map(Number), ...Object.keys(draftImages).map(Number)]);
        const sortedPages = Array.from(activePages).sort((a, b) => a - b);
        
        const ps = getPageSize(0);
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        div.style.top = '-9999px';
        document.body.appendChild(div);

        try {
          const pdfDoc = await PDFDocument.create();

          for (const pageNum of sortedPages) {
            const lines = pageLines[pageNum];
            const draftImg = draftImages[pageNum];
            
            if ((!lines || lines.length === 0) && !draftImg) continue;

            const offStage = new Konva.Stage({
              container: div,
              width: ps.w,
              height: ps.h,
            });
            const bgLayer = new Konva.Layer();
            offStage.add(bgLayer);
            bgLayer.add(
              new Konva.Rect({ x: 0, y: 0, width: ps.w, height: ps.h, fill: 'white' })
            );

            // Drawing Layer (Draft + Lines)
            const drawLayer = new Konva.Layer();
            offStage.add(drawLayer);

            if (draftImg) {
              drawLayer.add(
                new Konva.Image({
                  image: draftImg,
                  x: 0,
                  y: 0,
                  width: ps.w,
                  height: ps.h,
                })
              );
            }

            if (lines) {
              for (const line of lines) {
                drawLayer.add(
                  new Konva.Line({
                    points: line.points,
                    stroke: line.tool === 'eraser' ? '#ffffff' : line.color,
                    strokeWidth: line.strokeWidth,
                    tension: 0.5,
                    lineCap: 'round',
                    lineJoin: 'round',
                    globalCompositeOperation:
                      line.tool === 'eraser' ? 'destination-out' : 'source-over',
                  })
                );
              }
            }

            bgLayer.draw();
            drawLayer.draw();
            const dataUrl = offStage.toDataURL({ pixelRatio: RENDER_SCALE });
            offStage.destroy();

            const base64 = dataUrl.split(',')[1];
            const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

            const img = await pdfDoc.embedPng(pngBytes);
            const { width, height } = img;
            const pdfPage = pdfDoc.addPage([width, height]);
            pdfPage.drawImage(img, { x: 0, y: 0, width, height });
          }

          if (pdfDoc.getPageCount() === 0) {
            pdfDoc.addPage([ps.w, ps.h]); // guarantee at least one page
          }

          const pdfBytes = await pdfDoc.save();
          const file = new File([pdfBytes as BlobPart], 'canvas-answer.pdf', {
            type: 'application/pdf',
          });
          onSavePdf(file);
        } finally {
          document.body.removeChild(div);
        }
      }
    } catch (err) {
      console.error('[CanvasWriter] PDF export failed:', err);
    }
  }, [pdfUrl, pdfPageImages, pageLines, draftImages, getPageSize, onSavePdf]);

  // ── Register submit callback ─────────────────────────────────────────────
  useEffect(() => {
    onRegisterSubmit?.(handleSubmit);
  }, [onRegisterSubmit, handleSubmit]);

  // ── Register save callback ───────────────────────────────────────────────
  useEffect(() => {
    onRegisterSave?.(triggerSave);
  }, [onRegisterSave, triggerSave]);

  return {
    pdfPageImages,
    pdfPageDimensions,
    isLoading,
    loadError,
    numPages,
    getPageSize,
    currentPage,
    setCurrentPage,
    pageLines,
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    draftImages,
    undo,
    redo,
    canUndo,
    canRedo,
    historyVersion,
    stageScale,
    stagePos,
    setStagePos,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomTo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchStart,
    handleTouchEnd,
    handleSubmit,
    triggerSave,
    panBy,
    scrollToPage,
    isDrawing,
    getPageOffset,
  };
}
