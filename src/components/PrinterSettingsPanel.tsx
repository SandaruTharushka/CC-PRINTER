import { useState, useEffect } from 'react';
import {
  Printer, RefreshCw, CheckCircle2, XCircle, Plus, Trash2,
  Save, TestTube, Wifi, WifiOff, AlertCircle, Settings
} from 'lucide-react';
import { useBarcodeStore, PrinterInfo } from '../store/barcodeStore';
import {
  detectPrinters, addManualPrinter, removeManualPrinter,
  savePrinterSettings, testPrint, DetectedPrinter, savePrinterProfile, loadPrinterProfile
} from '../services/printerManager';

export default function PrinterSettingsPanel() {
  const {
    printers, setPrinters,
    selectedPrinter, setSelectedPrinter,
    printersLoading, setPrintersLoading,
    printerError, setPrinterError,
    labelSettings, setLabelSettings, setSettingsSaved,
  } = useBarcodeStore();

  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<DetectedPrinter['type']>('thermal');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [win32Available, setWin32Available] = useState<boolean | null>(null);
  const [detectionSource, setDetectionSource] = useState('');

  const handleDetect = async () => {
    setPrintersLoading(true);
    setPrinterError(null);
    try {
      const result = await detectPrinters();
      setPrinters(result.printers);
      setWin32Available(result.win32Available);
      setDetectionSource(result.source);
      // Auto-select default
      const def = result.printers.find(p => p.isDefault);
      if (def && !selectedPrinter) setSelectedPrinter(def.name);
    } catch (e) {
      setPrinterError('Printer detection failed: ' + (e as Error).message);
    } finally {
      setPrintersLoading(false);
    }
  };

  useEffect(() => {
    handleDetect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    addManualPrinter(manualName.trim(), manualType);
    setPrinters([
      ...printers,
      { name: manualName.trim(), status: 'unknown', isDefault: false, type: manualType, isManual: true },
    ]);
    setManualName('');
  };

  const handleRemoveManual = (name: string) => {
    removeManualPrinter(name);
    setPrinters(printers.filter(p => p.name !== name));
    if (selectedPrinter === name) setSelectedPrinter('');
  };

  const handleSave = () => {
    savePrinterSettings({ printerName: selectedPrinter, printerType: labelSettings.label_printer_type });
    savePrinterProfile(selectedPrinter, labelSettings as unknown as Record<string, unknown>);
    setLabelSettings({ label_printer_name: selectedPrinter });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  useEffect(() => {
    if (!selectedPrinter) return;
    const profile = loadPrinterProfile(selectedPrinter);
    if (profile) {
      setLabelSettings(profile as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrinter]);

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      setTestMsg('Please select a printer first');
      setTestStatus('error');
      return;
    }
    setTestStatus('testing');
    const result = await testPrint(selectedPrinter);
    setTestStatus(result.success ? 'success' : 'error');
    setTestMsg(result.message);
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const statusIcon = (p: PrinterInfo) => {
    if (p.status === 'connected') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (p.status === 'disconnected') return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Win32 Status Banner */}
      <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm
        ${win32Available === true ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        : win32Available === false ? 'bg-amber-50 border border-amber-200 text-amber-700'
        : 'bg-slate-50 border border-slate-200 text-slate-500'}`}
      >
        {win32Available === true ? <Wifi className="w-4 h-4" /> :
         win32Available === false ? <WifiOff className="w-4 h-4" /> :
         <Settings className="w-4 h-4" />}
        <div>
          {win32Available === true
            ? 'Native printing detected — system printers are available'
            : win32Available === false
            ? 'No system printers detected — add a printer manually or run in Electron desktop mode'
            : 'Detecting printer system...'}
          {detectionSource && (
            <span className="ml-2 text-xs opacity-70">source: {detectionSource}</span>
          )}
        </div>
      </div>

      {/* Detected Printers */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Detected Printers</span>
            {printers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium">
                {printers.length}
              </span>
            )}
          </div>
          <button
            onClick={handleDetect}
            disabled={printersLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${printersLoading ? 'animate-spin' : ''}`} />
            {printersLoading ? 'Detecting...' : 'Refresh'}
          </button>
        </div>

        {printerError && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            {printerError}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {printers.length === 0 && !printersLoading && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              <Printer className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No printers detected
            </div>
          )}
          {printers.map(printer => (
            <label
              key={printer.name}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                ${selectedPrinter === printer.name ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
            >
              <input
                type="radio"
                name="printer"
                checked={selectedPrinter === printer.name}
                onChange={() => setSelectedPrinter(printer.name)}
                className="w-4 h-4 text-indigo-600 accent-indigo-600"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 truncate">{printer.name}</span>
                  {printer.isManual && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                      Manual
                    </span>
                  )}
                  {printer.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {statusIcon(printer)}
                  <span className="text-xs text-slate-400 capitalize">{printer.status}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400 capitalize">{printer.type ?? 'unknown'}</span>
                </div>
              </div>
              {printer.isManual && (
                <button
                  onClick={e => { e.preventDefault(); handleRemoveManual(printer.name); }}
                  className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Add Manual Printer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-500" />
          Add Manual Printer
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Printer name (e.g. DYMO LabelWriter 550)"
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddManual()}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          <select
            value={manualType}
            onChange={e => setManualType(e.target.value as DetectedPrinter['type'])}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-indigo-400"
          >
            <option value="thermal">Thermal</option>
            <option value="inkjet">Inkjet</option>
            <option value="laser">Laser</option>
            <option value="unknown">Unknown</option>
          </select>
          <button
            onClick={handleAddManual}
            disabled={!manualName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTestPrint}
          disabled={!selectedPrinter || testStatus === 'testing'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
            ${testStatus === 'success' ? 'bg-emerald-100 text-emerald-700' :
              testStatus === 'error' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 hover:bg-slate-200 text-slate-700'}
            disabled:opacity-40`}
        >
          <TestTube className="w-4 h-4" />
          {testStatus === 'testing' ? 'Testing...' : 'Test Print'}
        </button>

        {testMsg && (
          <span className={`text-xs ${testStatus === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
            {testMsg}
          </span>
        )}

        <button
          onClick={handleSave}
          disabled={!selectedPrinter}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Default Printer
        </button>
      </div>
    </div>
  );
}
