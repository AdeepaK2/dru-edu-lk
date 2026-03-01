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
export const PAGE_GAP = 20; // 20px gap in continuous scroll

// ── Types ────────────────────────────────────────────────────────────────────

export interface LineData {
  points: number[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser' | 'straight';
  pageId?: string; // e.g. 'pdf-0' or 'blank-1234'
}

export type PageLines = Record<string, LineData[]>;

export type PageConfig =
  | { type: 'pdf'; pdfIndex: number; id: string }
  | { type: 'blank'; id: string };

export interface UseCanvasWriterProps {
  pdfUrl?: string;
  /** Called with raw stroke JSON (not images) - much lighter and lossless */
  onSave?: (strokePages: Record<number, LineData[]>, pageSequence: PageConfig[]) => void;
  onSavePdf?: (file: File) => void;
  autoSaveKey?: string;
  /** Restore saved strokes as raw LineData vectors (indexed 1 to N sequentially) */
  initialPageAnnotations?: Record<number, LineData[]>;
  /** Restore the exact page structure (PDF + blank positions) from a previous save */
  initialPageSequence?: PageConfig[];
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
  initialPageSequence,
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
  const [eraserWidth, setEraserWidth] = useState(20);



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
  const [draftImages, setDraftImages] = useState<Record<string, HTMLImageElement>>({});

  // ── History (per-page undo/redo) ─────────────────────────────────────────
  const historyRef = useRef<Record<string, LineData[][]>>({});
  const historyIndexRef = useRef<Record<string, number>>({});
  const [historyVersion, setHistoryVersion] = useState(0);

  // ── Auto-save timer ──────────────────────────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fit-to-page tracking ─────────────────────────────────────────────────
  const lastFitKeyRef = useRef('');

  // ── Page Sequence ────────────────────────────────────────────────────────
  const [pageSequence, setPageSequence] = useState<PageConfig[]>([]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const numPages = pageSequence.length;

  // Page dimensions in CSS pixels (raster / RENDER_SCALE).
  const getPageSize = useCallback(
    (pageIdx: number) => {
      const config = pageSequence[pageIdx];
      if (!config) return { w: 800, h: 1100 };

      // Original PDF pages
      if (config.type === 'pdf' && pdfPageDimensions[config.pdfIndex]) {
        return {
          w: pdfPageDimensions[config.pdfIndex].w / RENDER_SCALE,
          h: pdfPageDimensions[config.pdfIndex].h / RENDER_SCALE,
        };
      }

      // Extra blank pages: use the first PDF page size as a template (or sensible A4 default)
      const templateDim = pdfPageDimensions[0];
      if (templateDim) {
        return { w: templateDim.w / RENDER_SCALE, h: templateDim.h / RENDER_SCALE };
      }
      return { w: 800, h: 1100 }; // A4-ish blank canvas default
    },
    [pdfPageDimensions, pageSequence]
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
          
          // Initialize sequence
          const initialSequence: PageConfig[] = images.map((_, i) => ({
            type: 'pdf',
            pdfIndex: i,
            id: `pdf-${i}`
          }));
          setPageSequence(initialSequence);
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

  // ── Load draft annotations as JSON vectors ─────────────────────────────────
  useEffect(() => {
    // Wait for PDF to load so we have the base sequence
    if (pdfUrl && pdfPageImages.length === 0) return;
    if (!initialPageAnnotations) {
      if (!pdfUrl && pageSequence.length === 0) {
        // Fallback for no-PDF layout
        setPageSequence([{ type: 'blank', id: 'blank-init' }]);
      }
      return;
    }
    const entries = Object.entries(initialPageAnnotations);
    if (entries.length === 0) {
      if (!pdfUrl && pageSequence.length === 0) {
        setPageSequence([{ type: 'blank', id: 'blank-init' }]);
      }
      return;
    }

    // Construct the page sequence for restoration
    let seq: PageConfig[];

    if (initialPageSequence && initialPageSequence.length > 0) {
      // We have the exact page structure from the previous save — use it.
      // Re-map PDF pages to use current pdfPageImages, keep blanks as-is.
      seq = initialPageSequence.map((config) => {
        if (config.type === 'pdf') {
          return { type: 'pdf' as const, pdfIndex: config.pdfIndex, id: config.id };
        }
        return { type: 'blank' as const, id: config.id };
      });
    } else {
      // Legacy fallback: no saved pageSequence — guess by appending blanks at the end
      const baseLen = pdfUrl ? pdfPageImages.length : 1;
      let maxPageNum = 0;
      entries.forEach(([pageStr]) => {
        maxPageNum = Math.max(maxPageNum, parseInt(pageStr, 10));
      });
      const neededBlanks = Math.max(0, maxPageNum - baseLen);

      seq = [...pageSequence];
      if (!pdfUrl && seq.length === 0) {
        seq = [{ type: 'blank', id: 'blank-init' }];
      }
      for (let i = 0; i < neededBlanks; i++) {
        seq.push({ type: 'blank', id: `blank-restored-${i}` });
      }
    }

    setPageSequence(seq);

    // Map strokes from sequential 1-based indexes back to page IDs
    const restored: PageLines = {};
    entries.forEach(([pageStr, lines]) => {
      const zeroIdx = parseInt(pageStr, 10) - 1;
      const config = seq[zeroIdx];
      if (Array.isArray(lines) && lines.length > 0 && config) {
        // Rewrite the internal pageId back into the linestroke
        const remappedLines = lines.map(l => ({ ...l, pageId: config.id }));
        restored[config.id] = remappedLines as LineData[];
      }
    });

    if (Object.keys(restored).length > 0) {
      setPageLines(restored);
    }
  }, [initialPageAnnotations, initialPageSequence, pdfUrl, pdfPageImages.length]);

  // ── History helpers ──────────────────────────────────────────────────────
  const pushHistory = useCallback(
    (pageId: string, lines: LineData[]) => {
      if (!historyRef.current[pageId]) {
        historyRef.current[pageId] = [[]];
        historyIndexRef.current[pageId] = 0;
      }
      const idx = historyIndexRef.current[pageId];
      // Truncate any redo states
      historyRef.current[pageId] = historyRef.current[pageId].slice(0, idx + 1);
      // Push new snapshot (deep copy)
      historyRef.current[pageId].push(JSON.parse(JSON.stringify(lines)));
      // Cap history
      if (historyRef.current[pageId].length > MAX_HISTORY) {
        historyRef.current[pageId].shift();
      } else {
        historyIndexRef.current[pageId]++;
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
  const [activeHistoryPageIdx, setActiveHistoryPageIdx] = useState(0);

  // Safely get ID from sequence or fail gracefully
  const activeHistoryPageId = pageSequence[activeHistoryPageIdx]?.id || 'unknown';

  const canUndo =
    (historyRef.current[activeHistoryPageId]?.length ?? 0) > 0 &&
    (historyIndexRef.current[activeHistoryPageId] ?? 0) > 0;

  const canRedo =
    (historyIndexRef.current[activeHistoryPageId] ?? 0) <
    (historyRef.current[activeHistoryPageId]?.length ?? 1) - 1;

  const undo = useCallback(() => {
    const pageId = activeHistoryPageId;
    const idx = historyIndexRef.current[pageId];
    if (idx === undefined || idx <= 0) return;
    historyIndexRef.current[pageId] = idx - 1;
    const snapshot = historyRef.current[pageId][idx - 1];
    setPageLines((prev) => ({ ...prev, [pageId]: JSON.parse(JSON.stringify(snapshot)) }));
    setHistoryVersion((v) => v + 1);
  }, [activeHistoryPageId]);

  const redo = useCallback(() => {
    const pageId = activeHistoryPageId;
    const idx = historyIndexRef.current[pageId];
    const maxIdx = (historyRef.current[pageId]?.length ?? 1) - 1;
    if (idx === undefined || idx >= maxIdx) return;
    historyIndexRef.current[pageId] = idx + 1;
    const snapshot = historyRef.current[pageId][idx + 1];
    setPageLines((prev) => ({ ...prev, [pageId]: JSON.parse(JSON.stringify(snapshot)) }));
    setHistoryVersion((v) => v + 1);
  }, [activeHistoryPageId]);

  // ── Pointer handlers (stylus/mouse = draw; touch = blocked, DOM handler does pan) ──
  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      if (e.evt.pointerType === 'touch') return; // touch handled by DOM

      const stage = stageRef.current;
      if (!stage) return;

      const rawPos = stage.getRelativePointerPosition();
      if (!rawPos) return;

      const { pageIdx, localY, pageH } = getPageFromY(rawPos.y);
      const config = pageSequence[pageIdx];
      if (!config) return;

      const pageSize = getPageSize(pageIdx);
      if (rawPos.x < 0 || rawPos.x > pageSize.w || localY < 0 || localY > pageH) return;

      isDrawingRef.current = true;
      setIsDrawing(true);
      setActiveHistoryPageIdx(pageIdx);

      currentLineRef.current = {
        points: [rawPos.x, localY],
        color: strokeColor,
        strokeWidth: activeTool === 'eraser' ? eraserWidth : strokeWidth,
        tool: activeTool,
        pageId: config.id,
      };

      const pageId = config.id;
      setPageLines((prev) => ({
        ...prev,
        [pageId]: [...(prev[pageId] || []), { ...currentLineRef.current! }],
      }));
    },
    [stageRef, strokeColor, strokeWidth, eraserWidth, activeTool, getPageFromY, getPageSize, pageSequence]
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      if (e.evt.pointerType === 'touch') return;
      if (!isDrawingRef.current || !currentLineRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const rawPos = stage.getRelativePointerPosition();
      if (!rawPos) return;

      const startPageId = (currentLineRef.current as any).pageId;
      const startPageIdx = pageSequence.findIndex(p => p.id === startPageId);
      if (startPageIdx === -1) return;

      const pageSize        = getPageSize(startPageIdx);
      const startPageOffset = getPageOffset(startPageIdx);
      const rawLocalY       = rawPos.y - startPageOffset;
      const pos = {
        x: Math.max(0, Math.min(rawPos.x, pageSize.w)),
        y: Math.max(0, Math.min(rawLocalY, pageSize.h)),
      };

      if (currentLineRef.current.tool === 'straight') {
        currentLineRef.current.points = [
          currentLineRef.current.points[0], currentLineRef.current.points[1],
          pos.x, pos.y,
        ];
      } else {
        currentLineRef.current.points = [...currentLineRef.current.points, pos.x, pos.y];
      }

      const updatedLine = { ...currentLineRef.current };
      setPageLines((prev) => {
        const lines = [...(prev[startPageId] || [])];
        lines[lines.length - 1] = updatedLine;
        return { ...prev, [startPageId]: lines };
      });
    },
    [stageRef, getPageSize, getPageOffset, pageSequence]
  );

  const handlePointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      if (e.evt.pointerType === 'touch') return;
      if (!isDrawingRef.current || !currentLineRef.current) return;

      const pageId = (currentLineRef.current as any).pageId;
      isDrawingRef.current   = false;
      setIsDrawing(false);
      currentLineRef.current = null;

      setPageLines((prev) => {
        pushHistory(pageId, prev[pageId] || []);
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

  // ── Add / Remove extra blank pages ──────────────────────────────────────
  const addPage = useCallback((afterIndex?: number) => {
    // Insert after the specified page, or the current page if not given
    const insertAfterIdx = Math.max(0, afterIndex ?? currentPage);
    const newId = `blank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    setPageSequence(prev => {
      const next = [...prev];
      next.splice(insertAfterIdx + 1, 0, { type: 'blank', id: newId });
      return next;
    });

    // Scroll to the new page right after state update
    setTimeout(() => {
      scrollToPage(insertAfterIdx + 1);
    }, 50);
  }, [currentPage, scrollToPage]);

  const removePage = useCallback(() => {
    const config = pageSequence[currentPage];
    if (!config || config.type === 'pdf') return; // Cannot delete original PDF pages
    
    // Clear any strokes on the page being removed
    const idToRemove = config.id;
    setPageLines((prev) => {
      const next = { ...prev };
      delete next[idToRemove];
      return next;
    });
    
    setPageSequence(prev => {
      const next = [...prev];
      next.splice(currentPage, 1);
      return next;
    });

    // Nudge zoom to auto-fix scroll
    setTimeout(() => {
      setStagePos(prev => clampPos(prev.x, prev.y, scaleRef.current));
    }, 50);
  }, [currentPage, pageSequence, clampPos]);

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

    for (let i = 0; i < pageSequence.length; i++) {
      const config = pageSequence[i];
      const pageNum = i + 1; // Translate back to 1-based index for the outside world
      const lines = pageLines[config.id];
      const draftImg = draftImages[config.id];
      
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
                  'source-over',
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
  }, [pageSequence, pageLines, draftImages, getPageSize]);

  // ── Trigger Manual or Auto Save ──────────────────────────────────────────
  // Saves raw stroke JSON (LineData[]) — fast, lossless, no rendering needed.
  // Translates id-based pageLines into strict sequential 1-based indexes.
  const triggerSave = useCallback(async () => {
    try {
      if (Object.keys(pageLines).length === 0) return;

      const sequentialPages: Record<number, LineData[]> = {};
      for (let i = 0; i < pageSequence.length; i++) {
        const config = pageSequence[i];
        const lines = pageLines[config.id];
        if (lines && lines.length > 0) {
          // Remove internal pageId from saved data so it's clean and backwards-compatible
          const cleanLines = lines.map(({ pageId, ...rest }) => rest);
          sequentialPages[i + 1] = cleanLines as LineData[];
        }
      }

      // Pass raw vectors + page structure to parent (Firestore, etc.)
      onSave?.(sequentialPages, pageSequence);

      // Persist to localStorage for crash-recovery
      if (autoSaveKey) {
        try {
          localStorage.setItem(
            autoSaveKey,
            JSON.stringify({ pages: sequentialPages, pageSequence, timestamp: Date.now() })
          );
        } catch (e) {
          console.warn('[CanvasWriter] localStorage save failed', e);
        }
      }
    } catch (e) {
      console.warn('[CanvasWriter] triggerSave failed', e);
    }
  }, [pageLines, onSave, autoSaveKey]);

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
      // Create a fresh blank PDF document to assemble everything in sequential order
      const finalPdfDoc = await PDFDocument.create();
      
      // Load the original document if we have one so we can copy its pages
      let originalPdfDoc: PDFDocument | null = null;
      let originalPages: import('pdf-lib').PDFPage[] = [];
      if (pdfUrl && pdfRawBytesRef.current) {
        originalPdfDoc = await PDFDocument.load(pdfRawBytesRef.current);
        originalPages = originalPdfDoc.getPages();
      }

      // Build the final PDF matching our pageSequence
      for (let i = 0; i < pageSequence.length; i++) {
        const config = pageSequence[i];
        const lines = pageLines[config.id];
        const draftImgUrl = draftImages[config.id];
        
        let pdfPage: import('pdf-lib').PDFPage;
        let pWidth = 800;
        let pHeight = 1100;

        if (config.type === 'pdf' && originalPdfDoc && originalPages[config.pdfIndex]) {
          // Copy over the native PDF page
          const [copiedPage] = await finalPdfDoc.copyPages(originalPdfDoc, [config.pdfIndex]);
          pdfPage = finalPdfDoc.addPage(copiedPage);
          const size = pdfPage.getSize();
          pWidth = size.width;
          pHeight = size.height;
        } else {
          // Blank page requested
          const ps = getPageSize(i);
          pWidth = ps.w;
          pHeight = ps.h;
          pdfPage = finalPdfDoc.addPage([pWidth, pHeight]);
        }

        // If there are annotations or strokes on this page, render them and stamp onto the page
        if ((lines && lines.length > 0) || draftImgUrl) {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.left = '-9999px';
          div.style.top = '-9999px';
          document.body.appendChild(div);

          try {
            const offStage = new Konva.Stage({
              container: div,
              width: pWidth,
              height: pHeight,
            });
            const layer = new Konva.Layer();
            offStage.add(layer);

            if (draftImgUrl) {
              layer.add(
                new Konva.Image({
                  image: draftImgUrl as any,
                  x: 0, y: 0,
                  width: pWidth, height: pHeight,
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
            const embeddedImage = await finalPdfDoc.embedPng(pngBytes);
            pdfPage.drawImage(embeddedImage, { x: 0, y: 0, width: pWidth, height: pHeight });
          } finally {
            document.body.removeChild(div);
          }
        }
      }

      if (finalPdfDoc.getPageCount() === 0) {
        // Fallback for absolutely empty
        const s = getPageSize(0);
        finalPdfDoc.addPage([s.w, s.h]);
      }

      const pdfBytes = await finalPdfDoc.save();
      const filename = pdfUrl ? 'annotated-answer.pdf' : 'canvas-answer.pdf';
      const file = new File([pdfBytes as BlobPart], filename, {
        type: 'application/pdf',
      });
      onSavePdf?.(file);
    } catch (err) {
      console.error('[CanvasWriter] PDF export failed:', err);
    }
  }, [pdfUrl, pageSequence, pageLines, draftImages, getPageSize, onSavePdf]);

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
    eraserWidth,
    setEraserWidth,
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
    getTotalDocumentHeight,
    clampPos,
    // New sequence controls
    pageSequence,
    addPage,
    removePage,
  };
}
