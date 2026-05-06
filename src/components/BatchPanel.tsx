import { useState } from 'react';
import {
  Layers, Plus, Trash2, Printer, Wand2, CheckCircle2,
  XCircle, AlertTriangle, Package
} from 'lucide-react';
import { useBarcodeStore, BarcodeType, Product } from '../store/barcodeStore';
import { batchGenerate, BatchGenerateResult } from '../services/barcodeGenerator';
import { renderLabel, printLabels } from '../services/labelRenderer';
import * as productService from '../services/productService';
import ProductSearchPanel from './ProductSearchPanel';

export default function BatchPanel() {
  const {
    batchItems, addBatchItem, removeBatchItem, updateBatchItem,
    clearBatch, toggleBatchItemSelect,
    labelSettings, selectedPrinter,
    addToHistory, updateProductBarcode,
    products,
  } = useBarcodeStore();

  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchGenerateResult[]>([]);
  const [status, setStatus] = useState<string>('');

  const handleAddProduct = (product: Product) => {
    addBatchItem({
      product,
      copies: labelSettings.label_default_copies,
      barcodeType: labelSettings.label_barcode_type,
      generated: false,
      selected: true,
    });
  };

  const handleBatchGenerate = async () => {
    if (batchItems.length === 0) return;
    setGenerating(true);
    setStatus('Generating barcodes...');
    setBatchResults([]);
    try {
      const selectedItems = batchItems.filter(b => b.selected);
      const results = await batchGenerate({
        products: selectedItems.map(b => ({
          id: b.product.id,
          name: b.product.name,
          sku: b.product.sku,
          barcode: b.product.barcode,
          price: b.product.price,
          barcodeTypeOverride: b.barcodeType,
        })),
        barcodeType: labelSettings.label_barcode_type,
        includeQR: labelSettings.label_show_qr,
        qrPayloadType: labelSettings.qr_payload_type,
        overwriteExisting: overwrite,
      });
      setBatchResults(results);

      // Save to DB and history
      for (const r of results) {
        if (r.success) {
          await productService.updateProductBarcode(r.productId, r.barcodeValue, labelSettings.label_barcode_type);
          updateProductBarcode(r.productId, r.barcodeValue, labelSettings.label_barcode_type);
          updateBatchItem(r.productId, { generated: true });
          addToHistory({
            productId: r.productId,
            barcodeValue: r.barcodeValue,
            barcodeType: labelSettings.label_barcode_type,
            barcodeDataUrl: r.barcodeDataUrl ?? '',
            qrDataUrl: r.qrDataUrl,
            timestamp: new Date(),
          });
        }
      }
      setStatus(`Generated ${results.filter(r => r.success).length}/${results.length} barcodes successfully.`);
    } catch (e) {
      setStatus('Error: ' + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleBatchPrint = async () => {
    if (batchResults.length === 0) {
      setStatus('Please generate barcodes first.');
      return;
    }
    setPrinting(true);
    setStatus('Rendering labels...');
    try {
      const labelDataUrls: string[] = [];

      for (const result of batchResults) {
        if (!result.success || !result.barcodeDataUrl) continue;
        const batchItem = batchItems.find(b => b.product.id === result.productId);
        if (!batchItem || !batchItem.selected) continue;

        const product = products.find(p => p.id === result.productId) ?? batchItem.product;
        if (!product) continue;

        // Render with updated barcode
        const updatedProduct = { ...product, barcode: result.barcodeValue };
        const rendered = await renderLabel({
          product: updatedProduct,
          barcodeDataUrl: result.barcodeDataUrl,
          barcodeValue: result.barcodeValue,
          qrDataUrl: result.qrDataUrl,
          settings: labelSettings,
        });
        const copies = batchItem.copies;
        for (let i = 0; i < copies; i++) {
          labelDataUrls.push(rendered.dataUrl);
        }
      }

      if (labelDataUrls.length === 0) {
        setStatus('No labels to print. Make sure items are selected and generated.');
        return;
      }

      printLabels(labelDataUrls, labelSettings, selectedPrinter);
      setStatus(`Sent ${labelDataUrls.length} label(s) to ${selectedPrinter || 'printer'}.`);
    } catch (e) {
      setStatus('Print error: ' + (e as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  const allSelected = batchItems.length > 0 && batchItems.every(b => b.selected);
  const someSelected = batchItems.some(b => b.selected);

  return (
    <div className="flex flex-col gap-5">
      {/* Add Product */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Plus className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Add Products to Batch</span>
        </div>
        <ProductSearchPanel onAddToBatch={handleAddProduct} compact />
      </div>

      {/* Batch Options */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Layers className="w-4 h-4 text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Batch Options</span>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
            <span className="text-sm text-slate-600">Overwrite existing barcodes</span>
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">Default type:</span>
            <select
              value={labelSettings.label_barcode_type}
              onChange={e => {
                const { setLabelSettings } = useBarcodeStore.getState();
                setLabelSettings({ label_barcode_type: e.target.value as BarcodeType });
              }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
            >
              <option value="CODE128">CODE128</option>
              <option value="EAN13">EAN13</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Table */}
      {batchItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Batch Queue</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium">
                {batchItems.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const { batchItems: items } = useBarcodeStore.getState();
                  items.forEach(b => {
                    if (!allSelected) useBarcodeStore.getState().updateBatchItem(b.product.id, { selected: true });
                    else useBarcodeStore.getState().updateBatchItem(b.product.id, { selected: false });
                  });
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={clearBatch}
                className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        batchItems.forEach(b => {
                          useBarcodeStore.getState().updateBatchItem(b.product.id, { selected: !allSelected });
                        });
                      }}
                      className="accent-indigo-600"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left">Product</th>
                  <th className="px-4 py-2.5 text-left">Barcode</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Copies</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchItems.map(item => {
                  const result = batchResults.find(r => r.productId === item.product.id);
                  return (
                    <tr key={item.product.id} className={`hover:bg-slate-50 transition-colors
                      ${!item.selected ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleBatchItemSelect(item.product.id)}
                          className="accent-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-medium text-slate-700 text-sm">{item.product.name}</div>
                            <div className="text-xs text-slate-400">{item.product.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-600 max-w-[160px] truncate">
                          {result?.barcodeValue || item.product.barcode || '—'}
                        </div>
                        {result?.skipped && (
                          <span className="text-[10px] text-amber-600">existing (not overwritten)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.barcodeType}
                          onChange={e => updateBatchItem(item.product.id, { barcodeType: e.target.value as BarcodeType })}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none"
                        >
                          <option value="CODE128">CODE128</option>
                          <option value="EAN13">EAN13</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateBatchItem(item.product.id, { copies: Math.max(1, item.copies - 1) })}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold"
                          >−</button>
                          <span className="w-8 text-center text-sm font-semibold">{item.copies}</span>
                          <button
                            onClick={() => updateBatchItem(item.product.id, { copies: item.copies + 1 })}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold"
                          >+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {result ? (
                          result.success ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {result.skipped ? 'Kept' : 'Generated'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-500">
                              <XCircle className="w-3.5 h-3.5" />
                              Error
                            </span>
                          )
                        ) : item.generated ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Done
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeBatchItem(item.product.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {someSelected ? batchItems.filter(b => b.selected).length : 0} selected •{' '}
              {batchItems.reduce((sum, b) => sum + (b.selected ? b.copies : 0), 0)} total label(s)
            </span>
            <span className="text-slate-400">
              {selectedPrinter || <span className="text-amber-500">No printer selected</span>}
            </span>
          </div>
        </div>
      )}

      {/* Status message */}
      {status && (
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          {status.startsWith('Error') ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          {status}
        </div>
      )}

      {/* Empty state */}
      {batchItems.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Layers className="w-7 h-7 text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Batch queue is empty</p>
            <p className="text-xs text-slate-400 mt-1">Search and add products above to build a batch</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {batchItems.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleBatchGenerate}
            disabled={generating || !someSelected}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
          >
            <Wand2 className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
            {generating ? 'Generating...' : 'Batch Generate'}
          </button>

          <button
            onClick={handleBatchPrint}
            disabled={printing || batchResults.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
          >
            <Printer className={`w-4 h-4 ${printing ? 'animate-pulse' : ''}`} />
            {printing ? 'Printing...' : 'Batch Print Labels'}
          </button>

          <button
            onClick={() => { clearBatch(); setBatchResults([]); setStatus(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
