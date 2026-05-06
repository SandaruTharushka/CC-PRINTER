import { useState } from 'react';
import {
  History, Trash2, Printer, Search, Download,
  RotateCcw, Package, ChevronRight
} from 'lucide-react';
import { useBarcodeStore, GeneratedLabel } from '../store/barcodeStore';
import { renderLabel, printLabels } from '../services/labelRenderer';
export default function HistoryPanel() {
  const { labelHistory, clearHistory, labelSettings, selectedPrinter, copies, products } = useBarcodeStore();
  const [searchQ, setSearchQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState<string | null>(null);

  const filtered = labelHistory.filter(h =>
    !searchQ ||
    h.barcodeValue.toLowerCase().includes(searchQ.toLowerCase()) ||
    h.productId.toLowerCase().includes(searchQ.toLowerCase())
  );

  const handleReprint = async (label: GeneratedLabel, reprintKey: string) => {
    if (!label.barcodeDataUrl) return;
    setReprinting(reprintKey);
    try {
      const product = products.find(p => p.id === label.productId);
      if (!product) { alert('Product not found in database.'); return; }

      const rendered = await renderLabel({
        product,
        barcodeDataUrl: label.barcodeDataUrl,
        barcodeValue: label.barcodeValue,
        qrDataUrl: label.qrDataUrl,
        settings: labelSettings,
      });
      const labelDataUrls = Array.from({ length: copies }, () => rendered.dataUrl);
      printLabels(labelDataUrls, labelSettings, selectedPrinter);
    } catch (e) {
      alert('Reprint failed: ' + (e as Error).message);
    } finally {
      setReprinting(null);
    }
  };

  const handleDownloadBarcode = (label: GeneratedLabel) => {
    if (!label.barcodeDataUrl) return;
    const a = document.createElement('a');
    a.href = label.barcodeDataUrl;
    a.download = `barcode_${label.productId}_${label.barcodeValue}.png`;
    a.click();
  };

  const formatTime = (d: Date) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-400 transition-all">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search history by barcode or product ID..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
          />
        </div>
        <button
          onClick={clearHistory}
          disabled={labelHistory.length === 0}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl disabled:opacity-40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>

      {/* Stats */}
      {labelHistory.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Labels" value={labelHistory.length} />
          <StatCard
            label="Last Generated"
            value={labelHistory[0] ? formatTime(labelHistory[0].timestamp).split(',')[0] : '—'}
          />
          <StatCard
            label="Unique Products"
            value={new Set(labelHistory.map(h => h.productId)).size}
          />
        </div>
      )}

      {/* History List */}
      {filtered.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Label History</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium ml-1">
              {filtered.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((label, idx) => {
              const key = `${label.productId}-${label.barcodeValue}-${idx}`;
              const isExpanded = expanded === key;
              return (
                <div key={key} className="hover:bg-slate-50 transition-colors">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : key)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        {getProductName(label.productId)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-slate-500">{label.barcodeValue}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                          {label.barcodeType}
                        </span>
                        {label.qrDataUrl && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">
                            QR
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400">{formatTime(label.timestamp)}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1">
                      <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-3">
                        {/* Barcode preview */}
                        <div className="flex gap-3 items-start flex-wrap">
                          {label.barcodeDataUrl && (
                            <div className="border border-slate-200 rounded-lg p-2 bg-white">
                              <img src={label.barcodeDataUrl} alt="Barcode" className="h-12" />
                              <p className="text-[10px] text-slate-400 text-center mt-1">{label.barcodeType}</p>
                            </div>
                          )}
                          {label.qrDataUrl && (
                            <div className="border border-slate-200 rounded-lg p-2 bg-white">
                              <img src={label.qrDataUrl} alt="QR" className="w-12 h-12" />
                              <p className="text-[10px] text-slate-400 text-center mt-1">QR</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleReprint(label, key)}
                            disabled={reprinting === key}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            {reprinting === key ? 'Printing...' : 'Reprint'}
                          </button>
                          <button
                            onClick={() => handleDownloadBarcode(label)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <History className="w-7 h-7 text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              {searchQ ? 'No matching history entries' : 'No label history yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQ ? 'Try a different search term' : 'Generated labels will appear here'}
            </p>
          </div>
          {searchQ && (
            <button
              onClick={() => setSearchQ('')}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-slate-700">{value}</p>
    </div>
  );
}
