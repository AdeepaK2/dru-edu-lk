'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LineData {
  points: number[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser';
}

export type PageLines = Record<number, LineData[]>;

export interface UseCanvasWriterProps {
  pdfUrl?: string;
  onSave?: (strokePages: Record<number, string>) => void;
  onSavePdf?: (file: File) => void;
  autoSaveKey?: string;
  initialPageAnnotations?: Record<number, string>;
  onRegisterSubmit?: (fn: () => void) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  containerSize: { w: number; h: number };
}

const RENDER_SCALE = 2;
const AUTO_SAVE_INTERVAL = 3000;
const MAX_HISTORY = 50;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCanvasWriter({
  pdfUrl,
  onSave,
  onSavePdf,
  autoSaveKey,
  initialPageAnnotations,
  onRegisterSubmit,
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
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState('#1a1a1a');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // ── Zoom / pan ───────────────────────────────────────────────────────────
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // ── Drawing refs (mutable for performance) ───────────────────────────────
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

  // ── Computed ──────────────────────────────────────────────────────────────
  const numPages = pdfUrl ? pdfPageImages.length : 1;

  // Page dimensions in CSS pixels (raster / RENDER_SCALE)
  const getPageSize = useCallback(
    (pageIdx: number) => {
      if (pdfPageDimensions[pageIdx]) {
        return {
          w: pdfPageDimensions[pageIdx].w / RENDER_SCALE,
          h: pdfPageDimensions[pageIdx].h / RENDER_SCALE,
        };
      }
      // Blank canvas — fill container
      return { w: containerSize.w || 800, h: containerSize.h || 600 };
    },
    [pdfPageDimensions, containerSize]
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

  const canUndo =
    (historyRef.current[currentPage + 1]?.length ?? 0) > 0 &&
    (historyIndexRef.current[currentPage + 1] ?? 0) > 0;

  const canRedo =
    (historyIndexRef.current[currentPage + 1] ?? 0) <
    (historyRef.current[currentPage + 1]?.length ?? 1) - 1;

  const undo = useCallback(() => {
    const page = currentPage + 1;
    const idx = historyIndexRef.current[page];
    if (idx === undefined || idx <= 0) return;
    historyIndexRef.current[page] = idx - 1;
    const snapshot = historyRef.current[page][idx - 1];
    setPageLines((prev) => ({ ...prev, [page]: JSON.parse(JSON.stringify(snapshot)) }));
    setHistoryVersion((v) => v + 1);
  }, [currentPage]);

  const redo = useCallback(() => {
    const page = currentPage + 1;
    const idx = historyIndexRef.current[page];
    const maxIdx = (historyRef.current[page]?.length ?? 1) - 1;
    if (idx === undefined || idx >= maxIdx) return;
    historyIndexRef.current[page] = idx + 1;
    const snapshot = historyRef.current[page][idx + 1];
    setPageLines((prev) => ({ ...prev, [page]: JSON.parse(JSON.stringify(snapshot)) }));
    setHistoryVersion((v) => v + 1);
  }, [currentPage]);

  // ── Pointer handlers ─────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const pointerType = e.evt.pointerType;
      // Touch → pan/zoom only, don't draw
      if (pointerType === 'touch') return;

      const stage = stageRef.current;
      if (!stage) return;

      // Disable stage dragging while drawing
      stage.draggable(false);

      isDrawingRef.current = true;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      currentLineRef.current = {
        points: [pos.x, pos.y],
        color: strokeColor,
        strokeWidth: strokeWidth,
        tool: activeTool,
      };

      const page = currentPage + 1;
      setPageLines((prev) => ({
        ...prev,
        [page]: [...(prev[page] || []), currentLineRef.current!],
      }));
    },
    [stageRef, strokeColor, strokeWidth, activeTool, currentPage]
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!isDrawingRef.current || !currentLineRef.current) return;
      if (e.evt.pointerType === 'touch') return;

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      currentLineRef.current.points = [
        ...currentLineRef.current.points,
        pos.x,
        pos.y,
      ];

      const page = currentPage + 1;
      setPageLines((prev) => {
        const lines = [...(prev[page] || [])];
        lines[lines.length - 1] = { ...currentLineRef.current! };
        return { ...prev, [page]: lines };
      });
    },
    [stageRef, currentPage]
  );

  const handlePointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!isDrawingRef.current) return;
      if (e.evt.pointerType === 'touch') return;

      isDrawingRef.current = false;
      currentLineRef.current = null;

      const page = currentPage + 1;
      setPageLines((prev) => {
        const lines = prev[page] || [];
        pushHistory(page, lines);
        return prev;
      });
    },
    [currentPage, pushHistory]
  );

  // ── Touch pan (single finger) ───────────────────────────────────────────
  const handleTouchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length === 1) {
        // Single finger → enable stage dragging for pan
        const stage = stageRef.current;
        if (stage && !isDrawingRef.current) {
          stage.draggable(true);
        }
      }
    },
    [stageRef]
  );

  const handleTouchEnd = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.draggable(false);
    }
  }, [stageRef]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────
  const zoomTo = useCallback(
    (newScale: number, center?: { x: number; y: number }) => {
      const clamped = Math.min(5, Math.max(0.3, newScale));
      const c = center || { x: containerSize.w / 2, y: containerSize.h / 2 };
      const newPos = {
        x: c.x - (c.x - stagePos.x) * (clamped / stageScale),
        y: c.y - (c.y - stagePos.y) * (clamped / stageScale),
      };
      setStageScale(clamped);
      setStagePos(newPos);
    },
    [containerSize, stagePos, stageScale]
  );

  const zoomIn = useCallback(() => zoomTo(stageScale * 1.2), [zoomTo, stageScale]);
  const zoomOut = useCallback(() => zoomTo(stageScale / 1.2), [zoomTo, stageScale]);
  const resetZoom = useCallback(() => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  }, []);

  // ── Fit page to container on page change / PDF load ──────────────────────
  useEffect(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return;
    const ps = getPageSize(currentPage);
    if (!ps.w || !ps.h) return;

    const scaleX = containerSize.w / ps.w;
    const scaleY = containerSize.h / ps.h;
    const fitScale = Math.min(scaleX, scaleY, 1); // don't upscale past 1
    const offsetX = (containerSize.w - ps.w * fitScale) / 2;
    const offsetY = (containerSize.h - ps.h * fitScale) / 2;

    setStageScale(fitScale);
    setStagePos({ x: offsetX, y: offsetY });
  }, [currentPage, pdfPageImages.length, containerSize, getPageSize]);

  // ── Export all pages as PNG data URLs ─────────────────────────────────────
  const exportAllPages = useCallback(async (): Promise<Record<number, string>> => {
    const result: Record<number, string> = {};

    const pages = pdfUrl ? pdfPageImages.length : 1;
    for (let i = 0; i < pages; i++) {
      const pageNum = i + 1;
      const lines = pageLines[pageNum];
      if (!lines || lines.length === 0) continue;

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

        // Draw lines only (no background — annotations layer)
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

        layer.draw();
        result[pageNum] = offStage.toDataURL({ pixelRatio: RENDER_SCALE });
        offStage.destroy();
      } finally {
        document.body.removeChild(div);
      }
    }

    return result;
  }, [pdfUrl, pdfPageImages.length, pageLines, getPageSize]);

  // ── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onSave && !autoSaveKey) return;

    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setInterval(async () => {
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
        console.warn('[CanvasWriter] auto-save failed', e);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [onSave, autoSaveKey, exportAllPages]);

  // ── PDF export (submit) ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    try {
      if (pdfUrl && pdfRawBytesRef.current && pdfPageImages.length > 0) {
        // PDF overlay mode
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

            // Draft annotation image
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

            // New strokes
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

            // Convert data URL to bytes and embed into PDF
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
        // Plain canvas mode — create PDF from scratch
        const ps = getPageSize(0);
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
          const bgLayer = new Konva.Layer();
          offStage.add(bgLayer);
          bgLayer.add(
            new Konva.Rect({ x: 0, y: 0, width: ps.w, height: ps.h, fill: 'white' })
          );

          const drawLayer = new Konva.Layer();
          offStage.add(drawLayer);

          const lines = pageLines[1] || [];
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

          bgLayer.draw();
          drawLayer.draw();
          const dataUrl = offStage.toDataURL({ pixelRatio: RENDER_SCALE });
          offStage.destroy();

          const base64 = dataUrl.split(',')[1];
          const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

          const pdfDoc = await PDFDocument.create();
          const img = await pdfDoc.embedPng(pngBytes);
          const { width, height } = img;
          const pdfPage = pdfDoc.addPage([width, height]);
          pdfPage.drawImage(img, { x: 0, y: 0, width, height });

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

  return {
    // PDF
    pdfPageImages,
    pdfPageDimensions,
    isLoading,
    loadError,
    numPages,
    getPageSize,
    // Drawing
    currentPage,
    setCurrentPage,
    pageLines,
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    // Drafts
    draftImages,
    // History
    undo,
    redo,
    canUndo,
    canRedo,
    historyVersion,
    // Zoom/pan
    stageScale,
    stagePos,
    setStagePos,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomTo,
    // Pointer handlers
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchStart,
    handleTouchEnd,
    // Submit
    handleSubmit,
  };
}
