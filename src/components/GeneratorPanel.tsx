import { useState, useEffect } from 'react';
import {
  Barcode, QrCode, Wand2, Printer, Copy, CheckCircle2,
  AlertCircle, RotateCcw, Info
} from 'lucide-react';
import { useBarcodeStore, BarcodeType, QRPayloadType } from '../store/barcodeStore';
import {
  generateBarcode, generateQRCode, autoGenerateBarcodeValue, generateUniqueBarcode
} from '../services/barcodeGenerator';
import { printLabels } from '../services/labelRenderer';
import * as productService from '../services/productService';
import ProductSearchPanel from './ProductSearchPanel';
import LabelPreview from './LabelPreview';

export default function GeneratorPanel() {
  const {
    selectedProduct,
    barcodeType, setBarcodeType,
    qrPayloadType, setQrPayloadType,
    manualBarcodeValue, setManualBarcodeValue,
    autoGenerateBarcode, setAutoGenerateBarcode,
    generatedBarcodeHistory, addGeneratedBarcodeToHistory,
    products, batchItems, barcodeExistsAnywhere,
    copies, setCopies,
    generatedLabel, setGeneratedLabel,
    labelSettings,
    selectedPrinter,
    setPrintStatus, printStatus, printMessage,
    addToHistory,
    updateProductBarcode,
    updateProduct,
  } = useBarcodeStore();

  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);
  const [rackInput, setRackInput] = useState('');

  // Phase 7: Sync rackInput when selectedProduct changes
  useEffect(() => {
    if (selectedProduct) {
      setRackInput(selectedProduct.rackNo || '');
    } else {
      setRackInput('');
    }
  }, [selectedProduct?.id]);

  useEffect(() => {
    if (!selectedProduct) return;
    if (!autoGenerateBarcode) {
      setManualBarcodeValue(selectedProduct.barcode || '');
      return;
    }
    if (selectedProduct.barcode?.trim() && !manualBarcodeValue.trim()) {
      setManualBarcodeValue(selectedProduct.barcode);
      return;
    }
    if (!selectedProduct.barcode?.trim() && !manualBarcodeValue.trim()) {
      handleRegenerateBarcode();
    }
  }, [selectedProduct?.id, autoGenerateBarcode]);

  const validateBarcodeInput = (value: string, effectiveBarcodeType: BarcodeType): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error('Barcode value cannot be empty');
    if (effectiveBarcodeType !== 'CODE128' || /^\d+$/.test(normalized)) {
      if (!/^\d+$/.test(normalized)) throw new Error('Barcode must contain only numbers');
    }
    if (normalized.length < 6 || normalized.length > 20) {
      throw new Error('Barcode length must be between 6 and 20 characters');
    }
    if (barcodeExistsAnywhere(normalized, selectedProduct?.id)) {
      throw new Error('Barcode already exists. Generate a new one or enter another barcode.');
    }
    return normalized;
  };

  const handleRegenerateBarcode = () => {
    const existing = [
      ...products.map(p => p.barcode),
      ...generatedBarcodeHistory,
      ...batchItems.map(b => b.product.barcode),
    ];
    const unique = generateUniqueBarcode(existing);
    setManualBarcodeValue(unique);
    setGenError(null);
  };

  const handleGenerate = async () => {
    if (!selectedProduct) return;
    setGenerating(true);
    setGenError(null);
    setSavedToDb(false);

    try {
      const effectiveBarcodeType = barcodeType === 'QR' ? 'CODE128' : barcodeType;
      let rawValue = manualBarcodeValue.trim();
      if (autoGenerateBarcode && !rawValue) {
        rawValue = selectedProduct.barcode?.trim()
          ? selectedProduct.barcode.trim()
          : generateUniqueBarcode([
              ...products.map(p => p.barcode),
              ...generatedBarcodeHistory,
              ...batchItems.map(b => b.product.barcode),
            ]);
        setManualBarcodeValue(rawValue);
      }
      if (!autoGenerateBarcode && !rawValue) {
        rawValue = autoGenerateBarcodeValue(selectedProduct, effectiveBarcodeType);
      }
      rawValue = validateBarcodeInput(rawValue, effectiveBarcodeType);

      // Generate barcode
      const bcResult = await generateBarcode(rawValue, effectiveBarcodeType, {
        displayValue: labelSettings.label_show_barcode_text,
        fontSize: labelSettings.label_font_size,
      });
      setBarcodeDataUrl(bcResult.dataUrl);

      // Generate QR if needed
      let qrUrl: string | null = null;
      if (barcodeType === 'QR' || labelSettings.label_show_qr) {
        const qrResult = await generateQRCode(bcResult.value, qrPayloadType);
        qrUrl = qrResult.dataUrl;
      }
      setQrDataUrl(qrUrl);

      // Save barcode to product in DB
      await productService.updateProductBarcode(selectedProduct.id, bcResult.value, effectiveBarcodeType as BarcodeType);
      updateProductBarcode(selectedProduct.id, bcResult.value, effectiveBarcodeType);
      addGeneratedBarcodeToHistory(bcResult.value);

      // Save rack number if changed
      const currentRack = selectedProduct.rackNo ?? '';
      if (rackInput.trim() !== currentRack) {
        await productService.updateProductRackNo(selectedProduct.id, rackInput.trim());
        updateProduct(selectedProduct.id, { rackNo: rackInput.trim() });
      }

      setSavedToDb(true);

      const label = {
        productId: selectedProduct.id,
        barcodeValue: bcResult.value,
        barcodeType: effectiveBarcodeType as BarcodeType,
        barcodeDataUrl: bcResult.dataUrl,
        qrDataUrl: qrUrl ?? undefined,
        timestamp: new Date(),
      };
      setGeneratedLabel(label);
      addToHistory(label);
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (!barcodeDataUrl || !selectedProduct) return;
    setPrinting(true);
    setPrintStatus('printing');
    try {
      // We need a rendered label; import dynamically to avoid circular deps
      const { renderLabel } = await import('../services/labelRenderer');
      const rendered = await renderLabel({
        product: selectedProduct,
        barcodeDataUrl,
        barcodeValue: generatedLabel?.barcodeValue || manualBarcodeValue || selectedProduct.barcode,
        qrDataUrl: qrDataUrl ?? undefined,
        settings: labelSettings,
      });
      const labelDataUrls = Array.from({ length: copies }, () => rendered.dataUrl);
      printLabels(labelDataUrls, labelSettings, selectedPrinter);
      setPrintStatus('success', `Sent ${copies} label(s) to ${selectedPrinter || 'printer'}`);
    } catch (e) {
      setPrintStatus('error', (e as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  const handleReset = () => {
    setBarcodeDataUrl(null);
    setQrDataUrl(null);
    setGeneratedLabel(null);
    setManualBarcodeValue('');
    setGenError(null);
    setSavedToDb(false);
  };

  const barcodeTypeOptions: { value: BarcodeType; label: string; desc: string }[] = [
    { value: 'CODE128', label: 'CODE128', desc: 'Alphanumeric, any length' },
    { value: 'EAN13', label: 'EAN13', desc: '13-digit numeric retail' },
    { value: 'QR', label: 'QR Code', desc: 'Scan with smartphone' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
      {/* Left column */}
      <div className="flex flex-col gap-5">
        {/* Product Search */}
        <Card title="1. Search Product" icon={<Barcode className="w-4 h-4 text-indigo-600" />}>
          <ProductSearchPanel />
        </Card>

        {/* Barcode Type Selector */}
        <Card title="2. Barcode / QR Type" icon={<QrCode className="w-4 h-4 text-violet-600" />}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {barcodeTypeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBarcodeType(opt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                  ${barcodeType === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="text-[11px] text-center opacity-70 leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* QR Payload selector (visible when QR selected) */}
          {(barcodeType === 'QR' || labelSettings.label_show_qr) && (
            <div className="flex gap-2 mb-3">
              <span className="text-xs text-slate-500 self-center mr-1">QR payload:</span>
              {(['plain', 'json'] as QRPayloadType[]).map(pt => (
                <button
                  key={pt}
                  onClick={() => setQrPayloadType(pt)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all
                    ${qrPayloadType === pt
                      ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {pt === 'plain' ? 'Plain barcode' : 'JSON {"type":"product",...}'}
                </button>
              ))}
            </div>
          )}

          {/* Manual Barcode Input */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">
              Barcode Value (leave empty to auto-generate)
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 mb-2">
              <input
                type="checkbox"
                checked={autoGenerateBarcode}
                onChange={e => setAutoGenerateBarcode(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              Auto Generate Barcode
            </label>
            <input
              type="text"
              placeholder={autoGenerateBarcode ? 'Auto generated barcode' : 'Enter barcode manually'}
              value={manualBarcodeValue}
              onChange={e => setManualBarcodeValue(e.target.value)}
              readOnly={autoGenerateBarcode}
              className="w-full text-sm font-mono border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {autoGenerateBarcode && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleRegenerateBarcode}
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  Generate New
                </button>
                <button
                  onClick={handleRegenerateBarcode}
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  Regenerate Barcode
                </button>
              </div>
            )}
          </div>

          {/* Rack Number Input (Phase 7) */}
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">
              Rack / Location (stored with product)
            </label>
            <input
              type="text"
              placeholder="e.g. A-12, B-04..."
              value={rackInput}
              onChange={e => setRackInput(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </Card>

        {/* Generate Actions */}
        <Card title="3. Generate & Print" icon={<Wand2 className="w-4 h-4 text-emerald-600" />}>
          {/* Copies */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Copies:</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCopies(Math.max(1, copies - 1))}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm transition-colors"
              >−</button>
              <input
                type="number"
                min={1} max={999}
                value={copies}
                onChange={e => setCopies(Math.max(1, +e.target.value))}
                className="w-14 text-center text-sm font-semibold border border-slate-200 rounded-lg py-1 outline-none focus:border-indigo-400"
              />
              <button
                onClick={() => setCopies(copies + 1)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm transition-colors"
              >+</button>
            </div>
            <span className="text-xs text-slate-400">label(s)</span>
          </div>

          {/* Error */}
          {genError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {genError}
            </div>
          )}

          {/* Saved to DB notice */}
          {savedToDb && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Barcode saved to product database — billing scan will find this product.
            </div>
          )}

          {/* Print status */}
          {printStatus !== 'idle' && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3 border
              ${printStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                printStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                'bg-blue-50 text-blue-600 border-blue-200'}`}>
              {printStatus === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> :
               printStatus === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> :
               <Copy className="w-4 h-4 shrink-0 animate-pulse" />}
              {printMessage}
            </div>
          )}

          {/* Billing compatibility info */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-4">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span>
              Generated barcodes are saved to the product record. The billing scanner
              uses the same normalization — scanned value will always match the saved value.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={!selectedProduct || generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
            >
              <Wand2 className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
              {generating ? 'Generating...' : 'Generate Barcode'}
            </button>

            <button
              onClick={handlePrint}
              disabled={!barcodeDataUrl || printing}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
            >
              <Printer className={`w-4 h-4 ${printing ? 'animate-pulse' : ''}`} />
              {printing ? 'Printing...' : `Print ${copies} Label${copies > 1 ? 's' : ''}`}
            </button>

            {barcodeDataUrl && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          {/* Printer indicator */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <Printer className="w-3.5 h-3.5" />
            {selectedPrinter
              ? <span>Printer: <strong className="text-slate-600">{selectedPrinter}</strong></span>
              : <span className="text-amber-500">No printer selected — go to Settings tab to configure</span>}
          </div>
        </Card>
      </div>

      {/* Right column — Preview */}
      <div className="flex flex-col gap-4">
        <LabelPreview barcodeDataUrl={barcodeDataUrl} qrDataUrl={qrDataUrl} />

        {/* Generated barcode raw images */}
        {barcodeDataUrl && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Generated Assets</h4>
            <div className="flex flex-col gap-2">
              <div className="border border-slate-100 rounded-xl p-3 bg-white flex flex-col items-center gap-1">
                <img src={barcodeDataUrl} alt="Barcode" className="max-w-full" />
                <span className="text-[10px] text-slate-400">
                  {generatedLabel?.barcodeType} — {generatedLabel?.barcodeValue}
                </span>
              </div>
              {qrDataUrl && (
                <div className="border border-slate-100 rounded-xl p-3 bg-white flex flex-col items-center gap-1">
                  <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
                  <span className="text-[10px] text-slate-400">QR Code</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, icon, children }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">{icon}</div>
        )}
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
