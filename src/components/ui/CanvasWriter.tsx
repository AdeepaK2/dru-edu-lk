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
  Palette,
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

const COLOR_PRESETS = ['#2833d7', '#1a1a1a', '#22c55e', '#a855f7'];

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
    eraserWidth,
    setEraserWidth,
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
    pageSequence,
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
      // Always preventDefault to stop iPadOS Scribble from eating Apple Pencil events
      e.preventDefault();

      if (e.touches.length === 2) {
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
      // Always preventDefault for stylus/pencil touches to stop iPadOS Scribble
      // from swallowing pointer events (known Safari bug since iPadOS 14).
      e.preventDefault();

      if (e.touches.length === 2) {

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const center = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };

        const stage = stageRef.current;

        // Panning — guard against null lastTouchCenter (happens on 1→2 finger transition)
        if (lastTouchCenter.current) {
          const dx = center.x - lastTouchCenter.current.x;
          const dy = center.y - lastTouchCenter.current.y;
          panBy(dx, dy);
        }

        // Pinch-zoom
        if (lastTouchDist.current > 0 && stage) {
          const ratio = dist / lastTouchDist.current;
          const currentScale = stage.scaleX();
          const newScale = Math.min(5, Math.max(0.3, currentScale * ratio));

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
        {/* Custom Color Picker (Palette Icon) */}
        <label
          className={`flex items-center justify-center w-6 h-6 rounded cursor-pointer transition-colors relative ${
            !COLOR_PRESETS.includes(strokeColor) && activeTool === 'pen'
              ? 'bg-gray-700 text-blue-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          title="Custom color"
        >
          <Palette size={16} />
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => {
              setStrokeColor(e.target.value);
              setActiveTool('pen');
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Stroke / Eraser width presets */}
        <div className="flex items-center gap-1 mx-1">
          {activeTool === 'eraser' ? (
            [5, 10, 20, 30, 50].map((size) => (
              <button
                key={size}
                onClick={() => setEraserWidth(size)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                  eraserWidth === size ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                title={`Eraser Size: ${size}px`}
              >
                <div
                  className="bg-white rounded-full transition-all border border-gray-400"
                  style={{
                    width: `${Math.min(size * 0.4, 20)}px`,
                    height: `${Math.min(size * 0.4, 20)}px`,
                  }}
                />
              </button>
            ))
          ) : (
            [1.5, 2, 3, 4, 6].map((size) => (
              <button
                key={size}
                onClick={() => setStrokeWidth(size)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                  strokeWidth === size ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                title={`Stroke: ${size}px`}
              >
                <div
                  className="bg-white rounded-full transition-all"
                  style={{
                    width: `${size + 1}px`, // Slight boost for visual clarity
                    height: `${size + 1}px`,
                  }}
                />
              </button>
            ))
          )}
        </div>

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

        {/* Add / Remove pages relative to scroll */}
        <button
          onClick={() => addPage()}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-700 hover:bg-green-600 transition-colors"
          title={`Insert a blank page after page ${currentPage + 1}`}
        >
          <PlusCircle size={13} />
          Page
        </button>
        {pageSequence[currentPage]?.type === 'blank' && pageSequence.length > 1 && (
          <button
            onClick={() => removePage()}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-800 hover:bg-red-700 transition-colors"
            title={`Remove blank page ${currentPage + 1}`}
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
              {pageSequence.map((config, pageIndex) => {
                const pageSize = getPageSize(pageIndex);
                const bgImage = config.type === 'pdf' ? pdfPageImages[config.pdfIndex] : null;

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

                    {/* Page Number Indicator */}
                    <Text
                      x={0}
                      y={pageSize.h - 25}
                      width={pageSize.w}
                      text={`- ${pageIndex + 1} -`}
                      align="center"
                      fontSize={12}
                      fontFamily="Inter, sans-serif"
                      fill={bgImage ? "rgba(0,0,0,0.6)" : "#9ca3af"}
                    />
                  </Group>
                );
              })}
            </Layer>

            {/* ── Layer 1.5: Interactive UI Layer for Delete Buttons ── */}
            <Layer>
              {pageSequence.map((config, pageIndex) => {
                const pageSize = getPageSize(pageIndex);
                const isBlank = config.type === 'blank';

                return (
                  <Group key={`ui-${pageIndex}`} y={getPageOffset(pageIndex)}>
                    {/* Inline Remove Button for Blank Pages (hide if it's the last page) */}
                    {isBlank && pageSequence.length > 1 && (
                      <Label
                        x={pageSize.w - 100}
                        y={10}
                        onPointerDown={(e) => {
                          e.cancelBubble = true; // Prevent drawing from triggering immediately
                        }}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          removePage(pageIndex);
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          removePage(pageIndex);
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'pointer';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                      >
                        <Tag
                          fill="#fef2f2" // red-50
                          stroke="#fca5a5" // red-300 border
                          strokeWidth={1}
                          cornerRadius={6}
                          lineJoin="round"
                          shadowColor="black"
                          shadowBlur={2}
                          shadowOffsetX={0}
                          shadowOffsetY={1}
                          shadowOpacity={0.05}
                        />
                        <Text
                          text="✕ Remove Page"
                          fontFamily="Inter, sans-serif"
                          fontSize={11}
                          padding={6}
                          fill="#991b1b" // red-800 text
                        />
                      </Label>
                    )}

                    {/* Inline Add Page Button (Spanning bottom of page) */}
                    <Label
                      x={20}
                      y={pageSize.h - 12}
                      onPointerDown={(e) => {
                        e.cancelBubble = true; // Prevent drawing from triggering immediately
                      }}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        addPage(pageIndex);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        addPage(pageIndex);
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = 'pointer';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = 'default';
                        }
                      }}
                    >
                      <Tag
                        fill="#f3f4f6" // gray-100 default
                        stroke="#d1d5db" // gray-300 border
                        strokeWidth={1}
                        cornerRadius={6}
                        lineJoin="round"
                        shadowColor="black"
                        shadowBlur={2}
                        shadowOffsetX={0}
                        shadowOffsetY={1}
                        shadowOpacity={0.1}
                      />
                      <Text
                        text="+ Add Blank Page Here"
                        fontFamily="Inter, sans-serif"
                        fontSize={12}
                        padding={8}
                        width={pageSize.w - 40}
                        align="center"
                        fill="#4b5563" // gray-600 outline look
                      />
                    </Label>
                  </Group>
                );
              })}
            </Layer>

            {/* ── Layer 2: Strokes (eraser uses destination-out, isolated here) ─ */}
            <Layer>
              {pageSequence.map((config, pageIndex) => {
                const pageSize = getPageSize(pageIndex);
                const draftImage = draftImages[config.id] || null;
                const lines = pageLines[config.id] || [];

                return (
                  <Group key={config.id} y={getPageOffset(pageIndex)}>
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
                      if (activeLine && activeLine.points && activeLine.points.length >= 4 && activeLine.pageId === config.id) {
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
