'use client';

import 'tldraw/tldraw.css';
import {
  Tldraw,
  Editor,
  createTLStore,
  loadSnapshot,
  getSnapshot,
  AssetRecordType,
  createShapeId,
  type TLUiComponents,
  type TLShapeId,
  type TLAsset,
} from 'tldraw';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Configure pdfjs worker (same path as PDFViewer.tsx)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

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
}

const RENDER_SCALE = 2;
const AUTO_SAVE_INTERVAL = 3000;

export default function CanvasWriter({
  pdfUrl,
  height,
  className,
  onSave,
  onSavePdf,
  autoSaveKey,
  initialPageAnnotations,
  onRegisterSubmit,
}: CanvasWriterProps) {
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ w: number; h: number }[]>([]);
  const [isLoading, setIsLoading] = useState(!!pdfUrl);
  const [loadError, setLoadError] = useState<string | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundShapeIdsRef = useRef<Map<number, TLShapeId>>(new Map());
  const pdfRawBytesRef = useRef<ArrayBuffer | null>(null);
  const hasSetupRef = useRef(false);
  const storeRef = useRef(createTLStore());

  // ── Load tldraw snapshot from localStorage on mount ───────────────────
  useEffect(() => {
    if (!autoSaveKey) return;
    const savedJson = localStorage.getItem(`${autoSaveKey}_tldraw`);
    if (savedJson) {
      try {
        const snapshot = JSON.parse(savedJson);
        loadSnapshot(storeRef.current, snapshot);
      } catch {
        console.warn('[CanvasWriter] Could not parse saved tldraw snapshot');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load PDF pages to images ──────────────────────────────────────────
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

        const numPages = pdf.numPages;
        const images: string[] = [];
        const dims: { w: number; h: number }[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          // pdfjs-dist v5 requires `canvas` in RenderParameters
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          images.push(canvas.toDataURL('image/png'));
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

  // ── Setup tldraw pages with PDF backgrounds ──────────────────────────
  const setupPdfPages = useCallback(
    (editor: Editor) => {
      if (pdfPageImages.length === 0) return;

      editor.run(
        () => {
          const existingPages = editor.getPages();

          // Rename first page
          editor.renamePage(existingPages[0].id, 'Page 1');

          // Create additional pages
          for (let i = 1; i < pdfPageImages.length; i++) {
            editor.createPage({ name: `Page ${i + 1}` });
          }

          const allPages = editor.getPages();

          for (let i = 0; i < pdfPageImages.length; i++) {
            editor.setCurrentPage(allPages[i].id);

            const { w, h } = pdfPageDimensions[i];
            const assetId = AssetRecordType.createId();
            const shapeId = createShapeId(`bg-page-${i}`);

            const asset: TLAsset = AssetRecordType.create({
              id: assetId,
              type: 'image',
              props: {
                name: `page-${i + 1}.png`,
                src: pdfPageImages[i],
                w,
                h,
                mimeType: 'image/png',
                isAnimated: false,
              },
            });

            editor.createAssets([asset]);

            editor.createShape({
              id: shapeId,
              type: 'image',
              x: 0,
              y: 0,
              isLocked: true,
              props: { assetId, w, h },
            });

            backgroundShapeIdsRef.current.set(i, shapeId);
            editor.sendToBack([shapeId]);
          }

          // Return to page 1
          editor.setCurrentPage(allPages[0].id);
        },
        { history: 'ignore' }
      );
    },
    [pdfPageImages, pdfPageDimensions]
  );

  // ── Import legacy annotations as image shapes ─────────────────────────
  const importLegacyAnnotations = useCallback(
    (editor: Editor) => {
      if (!initialPageAnnotations || Object.keys(initialPageAnnotations).length === 0) return;

      const pages = editor.getPages();

      editor.run(
        () => {
          for (const [pageNumStr, dataUrl] of Object.entries(initialPageAnnotations)) {
            const pageIdx = parseInt(pageNumStr) - 1;
            if (pageIdx < 0 || pageIdx >= pages.length) continue;
            if (!dataUrl) continue;

            editor.setCurrentPage(pages[pageIdx].id);

            const { w, h } = pdfPageDimensions[pageIdx] ?? { w: 800, h: 1100 };
            const assetId = AssetRecordType.createId();
            const shapeId = createShapeId(`legacy-ann-${pageIdx}`);

            const asset: TLAsset = AssetRecordType.create({
              id: assetId,
              type: 'image',
              props: {
                name: `annotation-page-${pageIdx + 1}.png`,
                src: dataUrl,
                w,
                h,
                mimeType: 'image/png',
                isAnimated: false,
              },
            });

            editor.createAssets([asset]);

            editor.createShape({
              id: shapeId,
              type: 'image',
              x: 0,
              y: 0,
              props: { assetId, w, h },
            });
          }

          editor.setCurrentPage(pages[0].id);
        },
        { history: 'ignore' }
      );
    },
    [initialPageAnnotations, pdfPageDimensions]
  );

  // ── Export annotation shapes per page as PNG data URLs ─────────────────
  const exportAnnotationsPerPage = useCallback(
    async (editor: Editor): Promise<Record<number, string>> => {
      const result: Record<number, string> = {};
      const pages = editor.getPages();
      const currentPageId = editor.getCurrentPageId();

      for (let i = 0; i < pages.length; i++) {
        editor.setCurrentPage(pages[i].id);

        const allShapeIds = [...editor.getCurrentPageShapeIds()];
        const bgShapeId = backgroundShapeIdsRef.current.get(i);
        const annotationIds = allShapeIds.filter((id) => id !== bgShapeId);

        if (annotationIds.length === 0) continue;

        try {
          const { url } = await editor.toImageDataUrl(annotationIds, {
            format: 'png',
            background: false,
            padding: 0,
          });
          result[i + 1] = url;
        } catch {
          // Skip pages that fail to export
        }
      }

      editor.setCurrentPage(currentPageId);
      return result;
    },
    []
  );

  // ── PDF export ────────────────────────────────────────────────────────
  const handleSubmitPdf = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      if (pdfUrl && pdfRawBytesRef.current) {
        // PDF overlay mode — merge annotations onto original PDF
        const pdfDoc = await PDFDocument.load(pdfRawBytesRef.current);
        const pdfPages = pdfDoc.getPages();
        const tldrawPages = editor.getPages();
        const currentPageId = editor.getCurrentPageId();

        for (let i = 0; i < Math.min(pdfPages.length, tldrawPages.length); i++) {
          editor.setCurrentPage(tldrawPages[i].id);

          const allShapeIds = [...editor.getCurrentPageShapeIds()];
          const bgShapeId = backgroundShapeIdsRef.current.get(i);
          const annotationIds = allShapeIds.filter((id) => id !== bgShapeId);

          if (annotationIds.length === 0) continue;

          const { blob } = await editor.toImage(annotationIds, {
            format: 'png',
            background: false,
            padding: 0,
          });
          const pngBytes = new Uint8Array(await blob.arrayBuffer());

          const embeddedImage = await pdfDoc.embedPng(pngBytes);
          const pdfPage = pdfPages[i];
          const { width: pw, height: ph } = pdfPage.getSize();

          pdfPage.drawImage(embeddedImage, { x: 0, y: 0, width: pw, height: ph });
        }

        editor.setCurrentPage(currentPageId);

        const pdfBytes = await pdfDoc.save();
        const file = new File([pdfBytes as BlobPart], 'annotated-answer.pdf', { type: 'application/pdf' });
        onSavePdf?.(file);
      } else {
        // Plain canvas mode — create PDF from scratch
        const allShapeIds = [...editor.getCurrentPageShapeIds()];
        if (allShapeIds.length === 0) return;

        const { blob } = await editor.toImage(allShapeIds, {
          format: 'png',
          background: true,
          padding: 0,
        });

        const pdfDoc = await PDFDocument.create();
        const pngBytes = new Uint8Array(await blob.arrayBuffer());
        const img = await pdfDoc.embedPng(pngBytes);
        const { width, height: imgHeight } = img;
        const pdfPage = pdfDoc.addPage([width, imgHeight]);
        pdfPage.drawImage(img, { x: 0, y: 0, width, height: imgHeight });

        const pdfBytes = await pdfDoc.save();
        const file = new File([pdfBytes as BlobPart], 'canvas-answer.pdf', { type: 'application/pdf' });
        onSavePdf?.(file);
      }
    } catch (err) {
      console.error('[CanvasWriter] PDF export failed:', err);
    }
  }, [pdfUrl, onSavePdf]);

  // ── Auto-save ─────────────────────────────────────────────────────────
  const startAutoSave = useCallback(
    (editor: Editor) => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);

      autoSaveTimerRef.current = setInterval(async () => {
        // Save tldraw snapshot to localStorage
        if (autoSaveKey) {
          try {
            const snapshot = getSnapshot(editor.store);
            // Strip background image asset srcs to save space
            const stripped = JSON.parse(JSON.stringify(snapshot));
            localStorage.setItem(`${autoSaveKey}_tldraw`, JSON.stringify(stripped));
          } catch (e) {
            console.warn('[CanvasWriter] localStorage save failed', e);
          }
        }

        // Export annotations and call onSave
        if (onSave) {
          try {
            const strokePages = await exportAnnotationsPerPage(editor);
            onSave(strokePages);
          } catch (e) {
            console.warn('[CanvasWriter] onSave export failed', e);
          }
        }
      }, AUTO_SAVE_INTERVAL);
    },
    [autoSaveKey, onSave, exportAnnotationsPerPage]
  );

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, []);

  // ── Setup backgrounds after PDF images are ready ──────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    if (pdfUrl && pdfPageImages.length === 0) return;
    if (hasSetupRef.current) return;
    hasSetupRef.current = true;

    const editor = editorRef.current;

    // Check if we already loaded a tldraw snapshot
    const hasTldrawSnapshot = autoSaveKey && localStorage.getItem(`${autoSaveKey}_tldraw`);

    if (pdfUrl && pdfPageImages.length > 0) {
      if (hasTldrawSnapshot) {
        // Snapshot restored page structure; just re-inject backgrounds
        injectBackgroundsOnly(editor, pdfPageImages, pdfPageDimensions);
      } else {
        setupPdfPages(editor);
        importLegacyAnnotations(editor);
      }
    }

    // Start auto-save
    if (onSave || autoSaveKey) {
      startAutoSave(editor);
    }
  }, [
    pdfUrl,
    pdfPageImages,
    pdfPageDimensions,
    autoSaveKey,
    onSave,
    setupPdfPages,
    importLegacyAnnotations,
    startAutoSave,
  ]);

  // ── Inject backgrounds into existing snapshot pages ───────────────────
  function injectBackgroundsOnly(
    editor: Editor,
    pageImages: string[],
    dims: { w: number; h: number }[]
  ) {
    const pages = editor.getPages();

    editor.run(
      () => {
        for (let i = 0; i < Math.min(pages.length, pageImages.length); i++) {
          editor.setCurrentPage(pages[i].id);

          const shapeId = createShapeId(`bg-page-${i}`);
          // Remove old background if exists
          const existing = editor.getShape(shapeId);
          if (existing) {
            editor.deleteShape(shapeId);
          }

          const { w, h } = dims[i];
          const assetId = AssetRecordType.createId();

          const asset: TLAsset = AssetRecordType.create({
            id: assetId,
            type: 'image',
            props: {
              name: `page-${i + 1}.png`,
              src: pageImages[i],
              w,
              h,
              mimeType: 'image/png',
              isAnimated: false,
            },
          });

          editor.createAssets([asset]);

          editor.createShape({
            id: shapeId,
            type: 'image',
            x: 0,
            y: 0,
            isLocked: true,
            props: { assetId, w, h },
          });

          backgroundShapeIdsRef.current.set(i, shapeId);
          editor.sendToBack([shapeId]);
        }

        editor.setCurrentPage(pages[0].id);
      },
      { history: 'ignore' }
    );
  }

  // ── Editor mount handler ──────────────────────────────────────────────
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      // Register submit callback for parent
      if (onRegisterSubmit) {
        onRegisterSubmit(() => handleSubmitPdf());
      }

      // If PDF is already loaded (or no PDF), run setup immediately
      if (!pdfUrl || pdfPageImages.length > 0) {
        if (!hasSetupRef.current) {
          hasSetupRef.current = true;

          const hasTldrawSnapshot = autoSaveKey && localStorage.getItem(`${autoSaveKey}_tldraw`);

          if (pdfUrl && pdfPageImages.length > 0) {
            if (hasTldrawSnapshot) {
              injectBackgroundsOnly(editor, pdfPageImages, pdfPageDimensions);
            } else {
              setupPdfPages(editor);
              importLegacyAnnotations(editor);
            }
          }

          if (onSave || autoSaveKey) {
            startAutoSave(editor);
          }
        }
      }
    },
    [
      pdfUrl,
      pdfPageImages,
      pdfPageDimensions,
      autoSaveKey,
      onSave,
      onRegisterSubmit,
      handleSubmitPdf,
      setupPdfPages,
      importLegacyAnnotations,
      startAutoSave,
    ]
  );

  // ── Custom UI components ──────────────────────────────────────────────
  const components: TLUiComponents = useMemo(
    () => ({
      HelpMenu: null,
      DebugMenu: null,
      SharePanel: onSavePdf
        ? () => (
            <button
              onClick={handleSubmitPdf}
              style={{
                padding: '6px 14px',
                background: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Submit Answer
            </button>
          )
        : undefined,
    }),
    [onSavePdf, handleSubmitPdf]
  );

  // ── Render ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center ${className || ''}`}
        style={{ height: height || 600 }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={`flex items-center justify-center ${className || ''}`}
        style={{ height: height || 600 }}
      >
        <p className="text-red-600 text-sm">{loadError}</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: '100%', height: height || '100%', position: 'relative' }}
    >
      <Tldraw
        store={storeRef.current}
        onMount={handleMount}
        components={components}
      />
    </div>
  );
}
