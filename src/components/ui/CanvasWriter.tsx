'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Rect } from 'react-konva';
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
} from 'lucide-react';
import { useCanvasWriter } from './useCanvasWriter';

// ── Props (preserved exactly for all consumers) ──────────────────────────────

interface CanvasWriterProps {
  pdfUrl?: string;
  height?: number;
  className?: string;
  outputFormat?: 'pdf';
  onSave?: (strokePages: Record<number, string>) => void;
  onSavePdf?: (file: File) => void;
  autoSaveKey?: string;
  initialPageAnnotations?: Record<number, string>;
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
    stageScale,
    stagePos,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomTo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchStart,
    handleTouchEnd,
  } = useCanvasWriter({ ...props, stageRef, containerSize });

  // ── Pinch-to-zoom (stable — reads refs, no dependency churn) ───────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const content = stage.getContent();
    if (!content) return;

    let lastDist = 0;

    const onPinch = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      // Center must be relative to the container, not the viewport
      const rect = content.getBoundingClientRect();
      const center = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };

      if (lastDist > 0) {
        const ratio = dist / lastDist;
        const s = stageRef.current;
        if (s) {
          const currentScale = s.scaleX();
          const newScale = Math.min(5, Math.max(0.3, currentScale * ratio));
          zoomTo(newScale, center);
        }
      }

      lastDist = dist;
    };

    const onPinchEnd = () => {
      lastDist = 0;
    };

    content.addEventListener('touchmove', onPinch, { passive: false });
    content.addEventListener('touchend', onPinchEnd);
    return () => {
      content.removeEventListener('touchmove', onPinch);
      content.removeEventListener('touchend', onPinchEnd);
    };
    // zoomTo is stable (uses refs), so this effect only runs once on mount
  }, [zoomTo]);

  // ── Mouse wheel zoom ──────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const currentScale = stage.scaleX();
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? currentScale * scaleBy : currentScale / scaleBy;
      zoomTo(newScale, pointer);
    },
    [zoomTo]
  );

  // ── Current page data ─────────────────────────────────────────────────
  const pageNum = currentPage + 1;
  const currentLines = pageLines[pageNum] || [];
  const bgImage = pdfPageImages[currentPage] || null;
  const draftImage = draftImages[pageNum] || null;
  const pageSize = getPageSize(currentPage);

  // Ready to show the canvas (not loading, no error, container measured)
  const stageReady = !isLoading && !loadError && containerSize.w > 0 && containerSize.h > 0;

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

        {/* Page navigation */}
        {numPages > 1 && (
          <>
            <div className="w-px h-6 bg-gray-600 mx-1" />
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium w-12 text-center shrink-0">
              {currentPage + 1} / {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
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
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {/* Background layer */}
            <Layer listening={false}>
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
            </Layer>

            {/* Draft annotation layer */}
            {draftImage && (
              <Layer listening={false}>
                <KonvaImage
                  image={draftImage}
                  x={0}
                  y={0}
                  width={pageSize.w}
                  height={pageSize.h}
                />
              </Layer>
            )}

            {/* Drawing layer */}
            <Layer>
              {currentLines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.tool === 'eraser' ? '#ffffff' : line.color}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
