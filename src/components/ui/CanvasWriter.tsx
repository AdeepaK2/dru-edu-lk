'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Rect, Label, Tag, Text, Group } from 'react-konva';
import Konva from 'konva';
import {
  Pen,
  Eraser,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Ruler,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { useCanvasWriter } from './useCanvasWriter';

// ── Props (preserved exactly for all consumers) ──────────────────────────────

interface CanvasWriterProps {
  pdfUrl?: string;
  height?: number;
  className?: string;
  outputFormat?: 'pdf';
  onSave?: (strokePages: Record<number, import('./useCanvasWriter').LineData[]>) => void;
  onSavePdf?: (file: File) => void;
  autoSaveKey?: string;
  initialPageAnnotations?: Record<number, import('./useCanvasWriter').LineData[]>;
  onRegisterSubmit?: (fn: () => void) => void;
  onRegisterSave?: (fn: () => Promise<void>) => void;
}

// ── Color presets ────────────────────────────────────────────────────────────

const COLOR_PRESETS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

// ── Component ────────────────────────────────────────────────────────────────

export default function CanvasWriter(props: CanvasWriterProps) {
  const { height, className } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // ── Measure container ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height: h } = entries[0].contentRect;
      setContainerSize({ w: width, h });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Hook ───────────────────────────────────────────────────────────────
  const {
    pdfPageImages,
    isLoading,
    loadError,
    numPages,
    currentPage,
    getPageSize,
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
    stageScale,
    stagePos,
    setStagePos,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomTo,
    panBy,
    scrollToPage,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDrawing,
    getPageOffset,
    getTotalDocumentHeight,
    clampPos,
    pdfBasePages,
    extraPages,
    addPage,
    removePage,
  } = useCanvasWriter({ ...props, stageRef, containerSize });

  // ── Scrollbar drag state ─────────────────────────────────────────
  const isDraggingScrollbar = useRef(false);
  const scrollbarDragStartY = useRef(0);    // clientY when drag began
  const scrollbarDragStartScrollY = useRef(0); // stagePos.y when drag began

  const handleScrollbarPointerDown = useCallback((e: React.PointerEvent, thumbTop: number, thumbHeight: number, viewportH: number, maxScroll: number) => {
    e.stopPropagation();
    e.preventDefault();
    const trackEl = e.currentTarget.parentElement;
    if (!trackEl) return;
    const trackRect = trackEl.getBoundingClientRect();
    const localY = e.clientY - trackRect.top;

    if (localY >= thumbTop && localY <= thumbTop + thumbHeight) {
      // Clicked on thumb — start drag
      isDraggingScrollbar.current = true;
      scrollbarDragStartY.current = e.clientY;
      scrollbarDragStartScrollY.current = stagePos.y;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      // Clicked on track — jump to position
      const clickPct = Math.max(0, Math.min(1, localY / (viewportH - thumbHeight)));
      const newStageY = -(clickPct * maxScroll);
      setStagePos(prev => clampPos(prev.x, newStageY, stageScale));
    }
  }, [stagePos.y, setStagePos, clampPos, stageScale]);

  const handleScrollbarPointerMove = useCallback((e: React.PointerEvent, thumbHeight: number, viewportH: number, maxScroll: number) => {
    if (!isDraggingScrollbar.current) return;
    e.stopPropagation();
    const dy = e.clientY - scrollbarDragStartY.current;
    const scrollRange = viewportH - thumbHeight;
    const scrollDelta = scrollRange > 0 ? (dy / scrollRange) * maxScroll : 0;
    const newStageY = scrollbarDragStartScrollY.current - scrollDelta;
    setStagePos(prev => clampPos(prev.x, newStageY, stageScale));
  }, [setStagePos, clampPos, stageScale]);

  const handleScrollbarPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingScrollbar.current = false;
  }, []);



  // ── Mouse wheel zoom and Vertical Scroll ──────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      
      if (e.evt.ctrlKey) {
        // Pinch-to-zoom / Ctrl+Scroll Zoom
        const scaleBy = 1.08;
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const currentScale = stage.scaleX();
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? currentScale * scaleBy : currentScale / scaleBy;
        zoomTo(newScale, pointer);
      } else {
        // Vertical & Horizontal Scrolling
        panBy(-e.evt.deltaX, -e.evt.deltaY);
      }
    },
    [zoomTo, panBy]
  );

  // ── Native Mobile Touch (Pan & Zoom) ──────────────────────────────────
  // Konva's synthetic pointer events are unreliable for multi-touch on mobile.
  // We use standard DOM touch listeners for panning and zooming.
  const lastTouchCenter = useRef<{ x: number, y: number } | null>(null);
  const lastTouchDist = useRef<number>(0);

  // Ready to show the canvas (not loading, no error, container measured)
  const stageReady = !isLoading && !loadError && containerSize.w > 0 && containerSize.h > 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !stageReady) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // e.preventDefault(); // Stop native browser zooming/panning
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastTouchDist.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        lastTouchCenter.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      } else {
        lastTouchDist.current = 0;
        lastTouchCenter.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // prevent native scroll strictly when two fingers are active
        
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const center = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };

        const stage = stageRef.current;
        
        // Panning map
        if (lastTouchCenter.current) {
          const dx = center.x - lastTouchCenter.current.x;
          const dy = center.y - lastTouchCenter.current.y;
          panBy(dx, dy);
        }

        // Zoom map
        if (lastTouchDist.current > 0 && stage) {
          const ratio = dist / lastTouchDist.current;
          const currentScale = stage.scaleX();
          const newScale = Math.min(5, Math.max(0.3, currentScale * ratio));
          
          // Map browser center coordinates to Konva container offsets
          const containerRect = container.getBoundingClientRect();
          const pointerPos = {
            x: center.x - containerRect.left,
            y: center.y - containerRect.top
          };
          zoomTo(newScale, pointerPos);
        }

        lastTouchDist.current = dist;
        lastTouchCenter.current = center;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchDist.current = 0;
        lastTouchCenter.current = null;
      }
    };

    // passive: false is required so e.preventDefault() works during touchmove
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [stageReady, panBy, zoomTo]);





  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: height || '100%',
        minHeight: height || 600,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* ── Toolbar (always visible) ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white overflow-x-auto shrink-0 select-none">
        {/* Tool: Pen */}
        <button
          onClick={() => setActiveTool('pen')}
          className={`p-2 rounded transition-colors ${
            activeTool === 'pen' ? 'bg-blue-600' : 'hover:bg-gray-700'
          }`}
          title="Pen"
        >
          <Pen size={16} />
        </button>
        {/* Tool: Eraser */}
        <button
          onClick={() => setActiveTool('eraser')}
          className={`p-2 rounded transition-colors ${
            activeTool === 'eraser' ? 'bg-blue-600' : 'hover:bg-gray-700'
          }`}
          title="Eraser"
        >
          <Eraser size={16} />
        </button>
        {/* Tool: Straight Line (Ruler) */}
        <button
          onClick={() => setActiveTool('straight')}
          className={`p-2 rounded transition-colors ${
            activeTool === 'straight' ? 'bg-blue-600' : 'hover:bg-gray-700'
          }`}
          title="Straight Line"
        >
          <Ruler size={16} />
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Color presets */}
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setStrokeColor(c);
              setActiveTool('pen');
            }}
            style={{ background: c }}
            className={`w-6 h-6 rounded-full border-2 shrink-0 transition-all ${
              strokeColor === c && activeTool === 'pen'
                ? 'border-white scale-110'
                : 'border-transparent hover:border-gray-400'
            }`}
          />
        ))}
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => {
            setStrokeColor(e.target.value);
            setActiveTool('pen');
          }}
          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"
          title="Custom color"
        />

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Stroke width */}
        <input
          type="range"
          min={1}
          max={24}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-20 shrink-0 accent-blue-500"
          title={`Stroke: ${strokeWidth}px`}
        />
        <span className="text-[10px] text-gray-400 w-6 text-center shrink-0">
          {strokeWidth}
        </span>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>

        {/* Page navigation jump anchors */}
        {numPages > 1 && (
          <>
            <div className="w-px h-6 bg-gray-600 mx-1" />
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium min-w-[3rem] text-center shrink-0">
              {currentPage + 1} / {numPages}
            </span>
            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage === numPages - 1}
              className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Zoom */}
        <button
          onClick={zoomOut}
          className="p-2 rounded hover:bg-gray-700 transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs w-10 text-center shrink-0">
          {Math.round(stageScale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-2 rounded hover:bg-gray-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={resetZoom}
          className="p-2 rounded hover:bg-gray-700 transition-colors"
          title="Reset zoom"
        >
          <RotateCcw size={14} />
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Add / Remove extra pages */}
        <button
          onClick={addPage}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-700 hover:bg-green-600 transition-colors"
          title="Add a blank page after the last page"
        >
          <PlusCircle size={13} />
          Page
        </button>
        {extraPages > 0 && (
          <button
            onClick={removePage}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-800 hover:bg-red-700 transition-colors"
            title={`Remove the last added page (${extraPages} added)`}
          >
            <MinusCircle size={13} />
            Page
          </button>
        )}
      </div>

      {/* ── Stage container (ALWAYS mounted so ResizeObserver can measure it) */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-gray-200 relative"
        style={{ touchAction: 'none' }}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-200">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-500">Loading PDF...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-200">
            <p className="text-red-600 text-sm">{loadError}</p>
          </div>
        )}

        {/* Konva Stage */}
        {stageReady && (
          <Stage
            ref={stageRef}
            width={containerSize.w}
            height={containerSize.h}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* ── Layer 1: Background (PDF pages / white rects) ─────────────────── */}
            <Layer listening={false}>
              {Array.from({ length: numPages }).map((_, pageIndex) => {
                const pageNum = pageIndex + 1;
                const pageSize = getPageSize(pageIndex);
                const bgImage = pdfPageImages[pageIndex] || null;

                return (
                  <Group key={pageIndex} y={getPageOffset(pageIndex)}>
                    {bgImage ? (
                      <KonvaImage
                        image={bgImage}
                        x={0}
                        y={0}
                        width={pageSize.w}
                        height={pageSize.h}
                      />
                    ) : (
                      <Rect
                        x={0}
                        y={0}
                        width={pageSize.w}
                        height={pageSize.h}
                        fill="white"
                        shadowColor="#00000020"
                        shadowBlur={10}
                        shadowOffsetY={2}
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>

            {/* ── Layer 2: Strokes (eraser uses destination-out, isolated here) ─ */}
            <Layer>
              {Array.from({ length: numPages }).map((_, pageIndex) => {
                const pageNum = pageIndex + 1;
                const pageSize = getPageSize(pageIndex);
                const draftImage = draftImages[pageNum] || null;
                const lines = pageLines[pageNum] || [];

                return (
                  <Group key={pageIndex} y={getPageOffset(pageIndex)}>
                    {/* White backing rect so destination-out eraser only wipes this group */}
                    <Rect
                      listening={false}
                      x={0} y={0}
                      width={pageSize.w}
                      height={pageSize.h}
                      fill="transparent"
                    />

                    {/* Draft image (previously saved strokes, if any) */}
                    {draftImage && (
                      <KonvaImage
                        image={draftImage}
                        x={0}
                        y={0}
                        width={pageSize.w}
                        height={pageSize.h}
                      />
                    )}

                    {/* Active strokes */}
                    {lines.map((line, i) => (
                      <Line
                        key={i}
                        points={line.points}
                        stroke={line.tool === 'eraser' ? 'white' : line.color}
                        strokeWidth={line.strokeWidth}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation={
                          line.tool === 'eraser' ? 'destination-out' : 'source-over'
                        }
                      />
                    ))}

                    {/* Show length indicator when actively drawing a straight line on THIS page */}
                    {activeTool === 'straight' && isDrawing && lines.length > 0 && (() => {
                      const activeLine = lines[lines.length - 1];
                      // Only render distance if this page has the newly dragged line
                      if (activeLine && activeLine.points && activeLine.points.length >= 4 && activeLine.pageIdx === pageIndex) {
                        const x1 = activeLine.points[0];
                        const y1 = activeLine.points[1];
                        const x2 = activeLine.points[2];
                        const y2 = activeLine.points[3];
                        
                        const dist = Math.hypot(x2 - x1, y2 - y1);
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;

                        return (
                          <Label x={midX} y={midY} opacity={0.8}>
                            <Tag fill="black" pointerDirection="down" pointerWidth={10} pointerHeight={10} lineJoin="round" shadowColor="black" shadowBlur={10} shadowOffsetX={2} shadowOffsetY={2} shadowOpacity={0.5} />
                            <Text
                              text={`${dist.toFixed(1)} px`}
                              fontFamily="Inter, sans-serif"
                              fontSize={14}
                              padding={6}
                              fill="white"
                            />
                          </Label>
                        );
                      }
                      return null;
                    })()}
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        )}

        {/* ── Interactive Scrollbar ───────────────────────────────── */}
        {stageReady && getTotalDocumentHeight() * stageScale > containerSize.h && (() => {
          const totalH = getTotalDocumentHeight() * stageScale;
          const viewportH = containerSize.h;

          const thumbHeight = Math.max(44, viewportH * (viewportH / totalH));
          const maxScroll = totalH - viewportH;
          const currentScroll = Math.max(0, -stagePos.y);
          const scrollPct = maxScroll > 0 ? currentScroll / maxScroll : 0;
          const thumbTop = scrollPct * (viewportH - thumbHeight);

          return (
            <div
              className="absolute right-0 top-0 bottom-0 z-30 flex flex-col select-none"
              style={{ width: 14 }}
              onPointerDown={(e) => handleScrollbarPointerDown(e, thumbTop, thumbHeight, viewportH, maxScroll)}
              onPointerMove={(e) => handleScrollbarPointerMove(e, thumbHeight, viewportH, maxScroll)}
              onPointerUp={handleScrollbarPointerUp}
              onPointerCancel={handleScrollbarPointerUp}
            >
              {/* Track */}
              <div className="relative flex-1 bg-black/10 rounded-sm mx-1 cursor-pointer">

                {/* Page-jump markers — one per page boundary */}
                {numPages > 1 && Array.from({ length: numPages }).map((_, pi) => {
                  const pageStartY = getPageOffset(pi) * stageScale;
                  const markerPct = maxScroll > 0 ? pageStartY / maxScroll : 0;
                  const markerTop = markerPct * (viewportH - thumbHeight) + (pi === 0 ? 0 : 0);
                  const isCurrentPage = pi === currentPage;
                  return (
                    <div
                      key={pi}
                      title={`Page ${pi + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToPage(pi);
                      }}
                      className={`absolute left-0 right-0 flex items-center justify-center cursor-pointer group`}
                      style={{ top: Math.min(markerTop, viewportH - 16), height: 16, zIndex: 2 }}
                    >
                      {/* Tick line */}
                      <div className={`h-px w-full transition-colors ${isCurrentPage ? 'bg-blue-500' : 'bg-black/20 group-hover:bg-blue-400'}`} />
                      {/* Page label on hover */}
                      <span
                        className="absolute right-full mr-1.5 text-[9px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white rounded px-1 py-0.5 pointer-events-none"
                        style={{ top: '50%', transform: 'translateY(-50%)' }}
                      >
                        {pi + 1}
                      </span>
                    </div>
                  );
                })}

                {/* Thumb */}
                <div
                  className="absolute left-0 right-0 rounded-sm bg-gray-500/70 hover:bg-blue-500/80 active:bg-blue-600 transition-colors cursor-grab active:cursor-grabbing"
                  style={{ top: thumbTop, height: thumbHeight }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
