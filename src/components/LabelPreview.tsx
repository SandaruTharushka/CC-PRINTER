import { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, RefreshCw, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useBarcodeStore } from '../store/barcodeStore';
import { renderLabel } from '../services/labelRenderer';

interface LabelPreviewProps {
  barcodeDataUrl: string | null;
  qrDataUrl: string | null;
}

export default function LabelPreview({ barcodeDataUrl, qrDataUrl }: LabelPreviewProps) {
  const { selectedProduct, labelSettings, generatedLabel, manualBarcodeValue } = useBarcodeStore();
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const renderPreview = useCallback(async () => {
    if (!selectedProduct || !barcodeDataUrl) {
      setPreviewDataUrl(null);
      return;
    }
    setRendering(true);
    try {
      const rendered = await renderLabel({
        product: selectedProduct,
        barcodeDataUrl,
        barcodeValue: generatedLabel?.barcodeValue || manualBarcodeValue || selectedProduct.barcode,
        qrDataUrl: qrDataUrl ?? undefined,
        settings: labelSettings,
        previewScale: zoom,
      });
      setPreviewDataUrl(rendered.dataUrl);
      canvasRef.current = rendered.canvas;
    } catch (e) {
      console.error('Preview render error:', e);
    } finally {
      setRendering(false);
    }
  }, [selectedProduct, barcodeDataUrl, qrDataUrl, labelSettings, zoom, generatedLabel?.barcodeValue, manualBarcodeValue]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const handleDownload = () => {
    if (!previewDataUrl || !selectedProduct) return;
    const a = document.createElement('a');
    a.href = previewDataUrl;
    a.download = `label_${selectedProduct.sku}_${Date.now()}.png`;
    a.click();
  };

  const widthMm = labelSettings.label_width_mm;
  const heightMm = labelSettings.label_height_mm;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Eye className="w-4 h-4 text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Label Preview</span>
          <span className="text-xs text-slate-400 ml-1">
            {widthMm}mm × {heightMm}mm
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(1, z - 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-500 w-8 text-center">{zoom}x</span>
          <button
            onClick={() => setZoom(z => Math.min(5, z + 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            onClick={renderPreview}
            disabled={rendering}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
            title="Refresh preview"
          >
            <RefreshCw className={`w-4 h-4 ${rendering ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDownload}
            disabled={!previewDataUrl}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
            title="Download label PNG"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex items-center justify-center bg-slate-50 min-h-[220px] p-6">
        {rendering ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-violet-200 border-t-violet-600 animate-spin" />
            <p className="text-sm text-slate-500">Rendering label...</p>
          </div>
        ) : previewDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            {/* Shadow container mimicking physical label */}
            <div
              className="rounded-lg overflow-hidden"
              style={{
                boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)',
                background: 'white',
              }}
            >
              <img
                src={previewDataUrl}
                alt="Label preview"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                }}
              />
            </div>
            {/* Ruler-style dimension indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="h-px w-8 bg-slate-300" />
              <span>{widthMm}mm × {heightMm}mm</span>
              <div className="h-px w-8 bg-slate-300" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Eye className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">No preview available</p>
              <p className="text-xs text-slate-400 mt-1">
                Search and select a product, then generate a barcode
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
