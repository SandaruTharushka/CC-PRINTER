import { useEffect, useMemo, useState } from 'react';
import { Settings, Save, CheckCircle2, ChevronDown } from 'lucide-react';
import { useBarcodeStore, BarcodeType, LabelSize, validatePriceCodeKey, encodePriceToCode, DEFAULT_LABEL_SETTINGS, DEFAULT_LABEL_TEMPLATE, DEFAULT_PRICE_CODE_KEY } from '../store/barcodeStore';
import { renderLabelTemplate, renderLabel, printLabels } from '../services/labelRenderer';
import { generateBarcode } from '../services/barcodeGenerator';

const PRESET_SIZES: Record<LabelSize, { width: number; height: number; label: string }> = {
  small:  { width: 38,  height: 25,  label: '38×25mm (Small)' },
  medium: { width: 62,  height: 29,  label: '62×29mm (Medium)' },
  large:  { width: 100, height: 50,  label: '100×50mm (Large)' },
  custom: { width: 0,   height: 0,   label: 'Custom' },
};

export default function LabelSettingsPanel() {
  const { labelSettings, setLabelSettings, settingsSaved, setSettingsSaved, selectedPrinter } = useBarcodeStore();
  const [labelSizeKey, setLabelSizeKey] = useState<LabelSize>('medium');
  const [layoutElement, setLayoutElement] = useState<'productName' | 'encryptedPrice' | 'barcode' | 'barcodeNumber' | 'normalPrice'>('productName');

  const keyValidation = validatePriceCodeKey(labelSettings.price_code_key);
  const encoded1250 = keyValidation.valid ? encodePriceToCode(1250, labelSettings.price_code_key) : '--';
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<'100%' | '150%' | '200%' | 'fit'>('150%');
  const [showGrid, setShowGrid] = useState(true);
  const [showBounds, setShowBounds] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [testPrintStatus, setTestPrintStatus] = useState<'idle' | 'printing' | 'done'>('idle');

  const sampleProduct = useMemo(() => ({ id: 'sample', sku: 'SAMPLE-001', name: 'SAMPLE PRODUCT NAME', barcode: '201234567890', barcode_type: 'CODE128' as const, price: 1250, category: 'Sample', stock: 1 }), []);
  const sampleBarcode = useMemo(() => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="440" height="120"><rect width="440" height="120" fill="white"/><g fill="black">${Array.from({length: 55}).map((_,i)=>`<rect x="${i*8}" y="0" width="${i%3===0?4:2}" height="90"/>`).join('')}</g><text x="220" y="112" font-size="16" text-anchor="middle">201234567890</text></svg>`)}`, []);

  useEffect(() => {
    const run = async () => {
      const rendered = await renderLabelTemplate(labelSettings, {
        product: sampleProduct as any,
        barcodeDataUrl: sampleBarcode,
        barcodeValue: '201234567890',
        mode: 'preview',
        previewScale: previewZoom === '100%' ? 2 : previewZoom === '150%' ? 3 : previewZoom === '200%' ? 4 : 2,
        previewOptions: { showGrid, showElementBounds: showBounds, showSafeArea, selectedElement: layoutElement },
      }, 'preview');
      setPreviewDataUrl(rendered.dataUrl);
    };
    run();
  }, [labelSettings, layoutElement, previewZoom, showGrid, showBounds, showSafeArea, sampleProduct, sampleBarcode]);


  const handleSave = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };
  const showResetToast = () => {
    setToastMessage('Label settings reset successfully.');
    setTimeout(() => setToastMessage(''), 2500);
  };
  const resetToDefaultTemplate = () => {
    setLabelSettings({
      label_width_mm: 50,
      label_height_mm: 25,
      show_normal_price: false,
      label_show_price: false,
      label_template: { ...DEFAULT_LABEL_TEMPLATE, priceCodeKey: DEFAULT_PRICE_CODE_KEY },
    });
    showResetToast();
  };
  const resetSelectedElement = () => {
    setLabelSettings({
      label_template: {
        ...labelSettings.label_template,
        [layoutElement]: DEFAULT_LABEL_TEMPLATE[layoutElement],
      } as any
    });
    showResetToast();
  };
  const resetPrintQuality = () => {
    setLabelSettings({ printDpi: 203, barcodeModuleWidth: 1.2, barcodeHeightMm: 10.5, debugGuides: false });
    setShowGrid(false); setShowBounds(false); setShowSafeArea(false);
    showResetToast();
  };
  const resetAllLabelSettings = () => {
    if (!window.confirm('Are you sure you want to reset all label settings?')) return;
    localStorage.removeItem('gms_label_settings');
    setLabelSettings({ ...DEFAULT_LABEL_SETTINGS, price_code_key: DEFAULT_PRICE_CODE_KEY, label_template: { ...DEFAULT_LABEL_TEMPLATE, priceCodeKey: DEFAULT_PRICE_CODE_KEY } });
    setShowGrid(false); setShowBounds(false); setShowSafeArea(false);
    showResetToast();
  };

  const handleTestPrint = async () => {
    setTestPrintStatus('printing');
    setToastMessage('Sending test label to printer...');
    try {
      const bcResult = await generateBarcode('201234567890', 'CODE128', { displayValue: true });
      const rendered = await renderLabel({
        product: sampleProduct as any,
        barcodeDataUrl: bcResult.dataUrl,
        barcodeValue: '201234567890',
        settings: labelSettings,
        mode: 'print',
      });
      const result = await printLabels([rendered.dataUrl], labelSettings, selectedPrinter);
      setToastMessage(result.success ? 'Test label printed.' : `Test print failed: ${result.failureReason ?? 'unknown error'}`);
    } catch (e) {
      setToastMessage(`Test print error: ${(e as Error).message}`);
    } finally {
      setTestPrintStatus('done');
      setTimeout(() => setTestPrintStatus('idle'), 3000);
    }
  };

  const handleCalibrationPrint = async () => {
    setTestPrintStatus('printing');
    setToastMessage('Sending calibration sheet...');
    try {
      const bcResult = await generateBarcode('CALIBRATION', 'CODE128', { displayValue: true });
      // Render 8 calibration labels with crosshair-like content
      const rendered = await renderLabel({
        product: { ...sampleProduct, name: '--- CALIBRATION ---' } as any,
        barcodeDataUrl: bcResult.dataUrl,
        barcodeValue: 'CALIBRATION',
        settings: labelSettings,
        mode: 'print',
      });
      const count = Math.max(1, (labelSettings.columns ?? 2) * (labelSettings.rows ?? 1));
      const urls = Array.from({ length: count }, () => rendered.dataUrl);
      const result = await printLabels(urls, labelSettings, selectedPrinter);
      setToastMessage(result.success ? 'Calibration sheet printed.' : `Calibration failed: ${result.failureReason ?? 'unknown error'}`);
    } catch (e) {
      setToastMessage(`Calibration error: ${(e as Error).message}`);
    } finally {
      setTestPrintStatus('done');
      setTimeout(() => setTestPrintStatus('idle'), 3000);
    }
  };

  const handlePreset = (size: LabelSize) => {
    setLabelSizeKey(size);
    if (size !== 'custom') {
      const preset = PRESET_SIZES[size];
      setLabelSettings({ label_width_mm: preset.width, label_height_mm: preset.height });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-700">Label Settings</span>
      </div>

      {/* Label Size */}
      <Section title="Label Size">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PRESET_SIZES) as LabelSize[]).map(key => (
            <button
              key={key}
              onClick={() => handlePreset(key)}
              className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all
                ${labelSizeKey === key
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              {PRESET_SIZES[key].label}
            </button>
          ))}
        </div>

        {/* Custom size inputs */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <LabelInput
            label="Width (mm)"
            type="number"
            value={labelSettings.label_width_mm}
            min={20} max={300}
            onChange={v => { setLabelSizeKey('custom'); setLabelSettings({ label_width_mm: +v }); }}
          />
          <LabelInput
            label="Height (mm)"
            type="number"
            value={labelSettings.label_height_mm}
            min={10} max={300}
            onChange={v => { setLabelSizeKey('custom'); setLabelSettings({ label_height_mm: +v }); }}
          />
          <LabelInput
            label="Gap (mm)"
            type="number"
            value={labelSettings.label_gap_mm}
            min={0} max={20}
            onChange={v => setLabelSettings({ label_gap_mm: +v })}
          />
        </div>
      </Section>
      <Section title="Label Layout Editor">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Element</label>
            <select value={layoutElement} onChange={e => setLayoutElement(e.target.value as typeof layoutElement)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
              <option value="productName">Product Name</option><option value="encryptedPrice">Encrypted Price</option><option value="barcode">Barcode</option><option value="barcodeNumber">Barcode Number</option><option value="normalPrice">Normal Price</option>
            </select>
          </div>
          {(['xMm','yMm','widthMm','heightMm'] as const).map(k => (
            <LabelInput key={k} label={k} type="number" value={(labelSettings.label_template as any)[layoutElement][k]}
              onChange={v => setLabelSettings({ label_template: { ...labelSettings.label_template, [layoutElement]: { ...(labelSettings.label_template as any)[layoutElement], [k]: +v || 0 } } })} />
          ))}
          <Toggle label="Show/Hide" checked={(labelSettings.label_template as any)[layoutElement].visible}
            onChange={v => setLabelSettings({ label_template: { ...labelSettings.label_template, [layoutElement]: { ...(labelSettings.label_template as any)[layoutElement], visible: v } } })} />
          {layoutElement !== 'barcode' && (
            <>
              <LabelInput label="Font size" type="number" value={(labelSettings.label_template as any)[layoutElement].fontSizePx ?? 7}
                onChange={v => setLabelSettings({ label_template: { ...labelSettings.label_template, [layoutElement]: { ...(labelSettings.label_template as any)[layoutElement], fontSizePx: +v || 0 } } })} />
              <Toggle label="Bold" checked={Boolean((labelSettings.label_template as any)[layoutElement].bold)}
                onChange={v => setLabelSettings({ label_template: { ...labelSettings.label_template, [layoutElement]: { ...(labelSettings.label_template as any)[layoutElement], bold: v } } })} />
            </>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={resetToDefaultTemplate} className="px-3 py-2 text-xs rounded-lg border border-slate-300">Reset to default</button>
          <button onClick={() => setLabelSettings({ label_template: { ...labelSettings.label_template, labelWidthMm: labelSettings.label_width_mm, labelHeightMm: labelSettings.label_height_mm, priceCodeKey: labelSettings.price_code_key } })} className="px-3 py-2 text-xs rounded-lg border border-indigo-300 text-indigo-600">Save template</button>
        </div>
      </Section>


      <Section title="Live Label Preview">
        <div className="flex items-center gap-2 mb-2">
          {(['100%','150%','200%','fit'] as const).map(z => <button key={z} onClick={() => setPreviewZoom(z)} className={`px-2 py-1 text-xs rounded border ${previewZoom===z?'border-indigo-500 text-indigo-600':'border-slate-300'}`}>{z === 'fit' ? 'Fit to screen' : z}</button>)}
        </div>
        <div className="flex gap-3 mb-2 text-xs">
          <label><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} /> Show Grid</label>
          <label><input type="checkbox" checked={showBounds} onChange={e=>setShowBounds(e.target.checked)} /> Show Element Bounds</label>
          <label><input type="checkbox" checked={showSafeArea} onChange={e=>setShowSafeArea(e.target.checked)} /> Show Safe Area</label>
        </div>
        <div className="bg-slate-100 overflow-auto p-3">
          {previewDataUrl && <img src={previewDataUrl} alt="Live Label Preview" className="bg-white border border-slate-400" />}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSave} className="px-3 py-2 text-xs rounded-lg border border-indigo-300 text-indigo-600">Save Template</button>
          <button onClick={resetSelectedElement} className="px-3 py-2 text-xs rounded-lg border border-slate-300">Reset Selected</button>
          <button onClick={resetToDefaultTemplate} className="px-3 py-2 text-xs rounded-lg border border-slate-300">Reset Template</button>
          <button onClick={resetAllLabelSettings} className="px-3 py-2 text-xs rounded-lg border border-slate-300">Reset All</button>
          <button onClick={resetPrintQuality} className="px-3 py-2 text-xs rounded-lg border border-slate-300">Reset Print Quality</button>
          <button
            onClick={handleTestPrint}
            disabled={testPrintStatus === 'printing'}
            className="px-3 py-2 text-xs rounded-lg border border-emerald-300 text-emerald-700 disabled:opacity-50"
          >
            {testPrintStatus === 'printing' ? 'Printing...' : 'Test Print'}
          </button>
          <button
            onClick={handleCalibrationPrint}
            disabled={testPrintStatus === 'printing'}
            className="px-3 py-2 text-xs rounded-lg border border-violet-300 text-violet-700 disabled:opacity-50"
          >
            {testPrintStatus === 'printing' ? 'Printing...' : 'Print Calibration Sheet'}
          </button>
        </div>
      </Section>

      {/* Barcode Options */}
      <Section title="Barcode Options">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Default Barcode Type</label>
            <div className="relative">
              <select
                value={labelSettings.label_barcode_type}
                onChange={e => setLabelSettings({ label_barcode_type: e.target.value as BarcodeType })}
                className="w-full appearance-none text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 outline-none focus:border-indigo-400 bg-white"
              >
                <option value="CODE128">CODE128</option>
                <option value="EAN13">EAN13</option>
                <option value="QR">QR Code</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <LabelInput
            label="Font Size (pt)"
            type="number"
            value={labelSettings.label_font_size}
            min={6} max={20}
            onChange={v => setLabelSettings({ label_font_size: +v })}
          />

          <LabelInput
            label="Default Copies"
            type="number"
            value={labelSettings.label_default_copies}
            min={1} max={999}
            onChange={v => setLabelSettings({ label_default_copies: +v })}
          />
        </div>
      </Section>

      <Section title="Print Layout / Calibration (mm)">
        <div className="grid grid-cols-2 gap-3">
          <LabelInput label="Columns" type="number" value={labelSettings.columns} min={1} max={10}
            onChange={v => setLabelSettings({ columns: Math.max(1, +v || 1) })} />
          <LabelInput label="Rows" type="number" value={labelSettings.rows} min={1} max={10}
            onChange={v => setLabelSettings({ rows: Math.max(1, +v || 1) })} />
          <LabelInput label="Top Margin (mm)" type="number" value={labelSettings.marginTopMm}
            onChange={v => setLabelSettings({ marginTopMm: +v || 0 })} />
          <LabelInput label="Left Margin (mm)" type="number" value={labelSettings.marginLeftMm}
            onChange={v => setLabelSettings({ marginLeftMm: +v || 0 })} />
          <LabelInput label="Move Left/Right (mm)" type="number" value={labelSettings.xOffsetMm}
            onChange={v => setLabelSettings({ xOffsetMm: +v || 0 })} />
          <LabelInput label="Move Up/Down (mm)" type="number" value={labelSettings.yOffsetMm}
            onChange={v => setLabelSettings({ yOffsetMm: +v || 0 })} />
          <LabelInput label="Barcode Width (mm)" type="number" value={labelSettings.barcodeWidthMm}
            onChange={v => setLabelSettings({ barcodeWidthMm: +v || 0 })} />
          <LabelInput label="Barcode Height (mm)" type="number" value={labelSettings.barcodeHeightMm}
            onChange={v => setLabelSettings({ barcodeHeightMm: +v || 0 })} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Orientation</label>
            <select value={labelSettings.orientation} onChange={e => setLabelSettings({ orientation: e.target.value as 'portrait' | 'landscape' })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400">
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Rotate Barcode</label>
            <select value={labelSettings.barcodeRotate} onChange={e => setLabelSettings({ barcodeRotate: Number(e.target.value) as 0 | 90 | 180 | 270 })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400">
              <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Label Content */}
      <Section title="Label Content">
        <div className="flex flex-col gap-2.5">
          <Toggle
            label="Show Product Name"
            checked={labelSettings.label_show_product_name}
            onChange={v => setLabelSettings({ label_show_product_name: v })}
          />
          <Toggle
            label="Show Encrypted Price Code"
            checked={labelSettings.show_encrypted_price_code}
            onChange={v => setLabelSettings({ show_encrypted_price_code: v, price_code_enabled: v })}
          />
          <Toggle
            label="Show Normal Price"
            checked={labelSettings.show_normal_price}
            onChange={v => setLabelSettings({ show_normal_price: v, label_show_price: v })}
          />
          <Toggle
            label="Show Barcode Number"
            checked={labelSettings.label_show_barcode_text}
            onChange={v => setLabelSettings({ label_show_barcode_text: v })}
          />
          <Toggle
            label="Show QR Code"
            checked={labelSettings.label_show_qr}
            onChange={v => setLabelSettings({ label_show_qr: v })}
          />
          <Toggle
            label="Show Company Name"
            checked={labelSettings.label_show_company}
            onChange={v => setLabelSettings({ label_show_company: v })}
          />
          {labelSettings.label_show_company && (
            <input
              type="text"
              value={labelSettings.label_company_name}
              onChange={e => setLabelSettings({ label_company_name: e.target.value })}
              placeholder="Company name"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 mt-1"
            />
          )}
        </div>
      </Section>

      {/* Price Encryption */}
      <Section title="Price Encryption (GMS Code)">
        <div className="flex flex-col gap-2">
          <Toggle
            label="Enable Price Code"
            checked={labelSettings.price_code_enabled}
            onChange={v => setLabelSettings({ price_code_enabled: v })}
          />
          <LabelInput
            label="10-Character Encryption Key"
            value={labelSettings.price_code_key}
            onChange={v => setLabelSettings({ price_code_key: v })}
          />
          {!keyValidation.valid && (
            <p className="text-[10px] text-red-500 font-medium">
              ⚠️ {keyValidation.error}
            </p>
          )}
          <p className="text-[10px] text-slate-400 leading-tight italic">
            Used to encode cost price on labels. Must be 10 unique characters.
            Live preview (1250): <span className="font-semibold text-slate-600">{encoded1250}</span>
          </p>
        </div>
      </Section>

      {/* QR Payload Type */}
      <Section title="QR Payload Format">
        <div className="flex flex-col gap-2">
          <QRPayloadOption
            value="plain"
            current={labelSettings.qr_payload_type}
            onChange={v => setLabelSettings({ qr_payload_type: v as 'plain' | 'json' })}
            label="Plain Barcode"
            example='8887191411868'
          />
          <QRPayloadOption
            value="json"
            current={labelSettings.qr_payload_type}
            onChange={v => setLabelSettings({ qr_payload_type: v as 'plain' | 'json' })}
            label="JSON Payload"
            example='{"type":"product","barcode":"8887191411868"}'
          />
        </div>
        <p className="text-xs text-slate-400 mt-2 italic">
          Billing scanner supports both formats.
        </p>
      </Section>

      {/* Save Button */}
      {toastMessage && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{toastMessage}</div>}
      <button
        onClick={handleSave}
        disabled={!keyValidation.valid}
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all
          ${!keyValidation.valid ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
            settingsSaved
            ? 'bg-emerald-500 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
      >
        {settingsSaved ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Settings Saved!
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Label Settings
          </>
        )}
      </button>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</h4>
      {children}
    </div>
  );
}

function LabelInput({
  label, type = 'text', value, min, max, onChange
}: {
  label: string;
  type?: string;
  value: string | number;
  min?: number;
  max?: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-600">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex w-9 h-5 items-center rounded-full transition-colors
          ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
      >
        <span
          className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform
            ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
        />
      </button>
    </label>
  );
}

function QRPayloadOption({ value, current, onChange, label, example }: {
  value: string;
  current: string;
  onChange: (v: string) => void;
  label: string;
  example: string;
}) {
  const selected = value === current;
  return (
    <button
      onClick={() => onChange(value)}
      className={`text-left px-3 py-2.5 rounded-xl border transition-all
        ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center
          ${selected ? 'border-indigo-600' : 'border-slate-300'}`}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <code className="text-xs text-slate-400 pl-5 block truncate">{example}</code>
    </button>
  );
}
