/**
 * Billing Compatibility Tester
 * Proves that generated barcodes are found by the billing scan lookup.
 * Mirrors: POST /api/billing/scan
 */
import { useState } from 'react';
import { ScanLine, CheckCircle2, XCircle, ShoppingCart } from 'lucide-react';
import { billingLookup } from '../data/mockProducts';
import { normalizeScannedCode } from '../store/barcodeStore';
import { formatCurrency } from '../utils/currency';

export default function BillingCompatTest() {
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<{
    found: boolean;
    product?: ReturnType<typeof billingLookup>;
    normalized?: string;
  } | null>(null);

  const handleScan = () => {
    if (!scanInput.trim()) return;
    const normalized = normalizeScannedCode(scanInput);
    const found = billingLookup(scanInput);
    setScanResult({ found: !!found, product: found, normalized });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
          <ScanLine className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <span className="text-sm font-semibold text-slate-700">Billing Scan Compatibility Test</span>
          <p className="text-[11px] text-slate-400">Verify generated barcodes are found by the billing scanner</p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="Enter or scan barcode / QR payload..."
            className="flex-1 text-sm font-mono border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
          <button
            onClick={handleScan}
            disabled={!scanInput.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            <ScanLine className="w-4 h-4" />
            Lookup
          </button>
        </div>

        {scanResult && (
          <div className={`rounded-xl border p-3 ${
            scanResult.found
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {scanResult.found ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-700">Product Found — Billing Compatible ✓</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-sm font-semibold text-red-600">Product Not Found</span>
                </>
              )}
            </div>

            {scanResult.normalized && (
              <p className="text-xs text-slate-500 mb-2">
                Normalized: <code className="font-mono bg-white px-1 rounded border border-slate-200">{scanResult.normalized}</code>
              </p>
            )}

            {scanResult.found && scanResult.product && (
              <div className="bg-white rounded-lg border border-emerald-200 p-2.5">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{scanResult.product.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{scanResult.product.sku}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-semibold">{formatCurrency(scanResult.product.price)}</span>
                      <span>•</span>
                      <span>{scanResult.product.stock} in stock</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!scanResult.found && (
              <p className="text-xs text-slate-500">
                Try: scan with plain barcode value or JSON format{' '}
                <code className="font-mono">{"{"}"type":"product","barcode":"VALUE"{"}"}</code>
              </p>
            )}
          </div>
        )}

        {/* Example payloads */}
        <div className="text-xs text-slate-400">
          <p className="font-medium text-slate-500 mb-1">Quick tests:</p>
          <div className="flex flex-wrap gap-1.5">
            {['8887191411001', '8887191411003', '{"type":"product","barcode":"8887191411005"}'].map(ex => (
              <button
                key={ex}
                onClick={() => { setScanInput(ex); setScanResult(null); }}
                className="font-mono bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[11px] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
