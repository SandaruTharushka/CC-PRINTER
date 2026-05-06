/**
 * Printer Manager Service
 * Mirrors: services/barcode_label/printer_manager.py
 * GET  /api/barcode-label/printers
 * POST /api/barcode-label/printer/save
 *
 * In a desktop Electron/PyInstaller app, win32print would be called
 * via a Python backend API. Here we simulate detection via the
 * browser Print API and localStorage persistence.
 *
 * Desktop integration note:
 *   - If window.__GMS_PRINTERS__ is injected by PyInstaller/Electron bridge,
 *     it will be used for real printer data.
 *   - Otherwise falls back to browser navigator detection.
 */

export interface DetectedPrinter {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'unknown';
  isDefault: boolean;
  type: 'thermal' | 'inkjet' | 'laser' | 'unknown';
  connection: string; // e.g., 'usb', 'network', 'unknown'
  isManual?: boolean;
}

const MANUAL_PRINTERS_KEY = 'gms_manual_printers';
const DEFAULT_PRINTER_KEY = 'gms_default_printer';
const PRINTER_PROFILE_KEY = 'gms_printer_profiles';

// ── Simulated / Browser-Compatible Printer List ───────────────────────────────
// In a real desktop app these come from win32print via the Python API
const SIMULATED_SYSTEM_PRINTERS: DetectedPrinter[] = [
  {
    id: 'pdf',
    name: 'Microsoft Print to PDF',
    status: 'connected',
    isDefault: false,
    type: 'unknown',
    connection: 'virtual',
  },
  {
    id: 'dymo',
    name: 'DYMO LabelWriter 450',
    status: 'connected',
    isDefault: false,
    type: 'thermal',
    connection: 'usb',
  },
  {
    id: 'zebra',
    name: 'Zebra ZD220 (ZPL)',
    status: 'connected',
    isDefault: false,
    type: 'thermal',
    connection: 'usb',
  },
  {
    id: 'brother',
    name: 'Brother QL-820NWB',
    status: 'disconnected',
    isDefault: false,
    type: 'thermal',
    connection: 'usb',
  },
];

// ── Desktop Bridge (PyInstaller / Electron) ───────────────────────────────────
declare global {
  interface Window {
    __GMS_PRINTERS__?: DetectedPrinter[];
    __GMS_WIN32PRINT_AVAILABLE__?: boolean;
  }
}

/**
 * Detect installed printers
 * Priority: Electron API → Desktop bridge → Simulated fallback
 * Mirrors: GET /api/barcode-label/printers
 *          GET /api/printing/printers
 */
export async function detectPrinters(): Promise<{
  printers: DetectedPrinter[];
  win32Available: boolean;
  source: 'win32' | 'bridge' | 'simulated';
}> {
  const manualPrinters = loadManualPrinters();
  const defaultPrinter = getDefaultPrinterName();

  // 1. Electron API — real system printers via webContents.getPrintersAsync()
  if (window.electronAPI && typeof window.electronAPI.getPrinters === 'function') {
    try {
      const raw = await window.electronAPI.getPrinters();
      if (Array.isArray(raw) && raw.length > 0) {
        const detected: DetectedPrinter[] = raw.map((p: any) => ({
          id: p.deviceName ?? p.name,
          name: p.displayName ?? p.deviceName ?? p.name,
          status: p.status === 0 ? 'connected' : 'disconnected',
          isDefault: p.isDefault ?? false,
          type: 'unknown' as const,
          connection: 'system',
        }));
        const all = mergeWithManual(detected, manualPrinters, defaultPrinter);
        return { printers: all, win32Available: true, source: 'bridge' };
      }
    } catch {
      // fall through to other detection methods
    }
  }

  // 2. Check if desktop bridge injected printer list (PyInstaller / Electron)
  if (window.__GMS_PRINTERS__ && Array.isArray(window.__GMS_PRINTERS__)) {
    const all = mergeWithManual(window.__GMS_PRINTERS__, manualPrinters, defaultPrinter);
    return { printers: all, win32Available: true, source: 'bridge' };
  }

  // 3. Simulate detection (browser / dev environment)
  await new Promise(r => setTimeout(r, 600)); // Simulate async detection
  const all = mergeWithManual(SIMULATED_SYSTEM_PRINTERS, manualPrinters, defaultPrinter);
  return { printers: all, win32Available: window.__GMS_WIN32PRINT_AVAILABLE__ ?? false, source: 'simulated' };
}

function mergeWithManual(
  system: DetectedPrinter[],
  manual: DetectedPrinter[],
  defaultName: string
): DetectedPrinter[] {
  const all = [...system];
  for (const m of manual) {
    if (!all.find(p => p.name === m.name)) all.push(m);
  }
  return all.map(p => ({ ...p, isDefault: p.name === defaultName }));
}

// ── Manual Printer Management ─────────────────────────────────────────────────

export function loadManualPrinters(): DetectedPrinter[] {
  try {
    const stored = localStorage.getItem(MANUAL_PRINTERS_KEY);
    if (stored) return JSON.parse(stored) as DetectedPrinter[];
  } catch {}
  return [];
}

export function addManualPrinter(name: string, type: DetectedPrinter['type'] = 'thermal'): DetectedPrinter {
  const existing = loadManualPrinters();
  const printer: DetectedPrinter = {
    id: `manual-${Date.now()}`,
    name: name.trim(),
    status: 'unknown',
    isDefault: false,
    type,
    connection: 'manual',
    isManual: true,
  };
  const updated = [...existing.filter(p => p.name !== name.trim()), printer];
  localStorage.setItem(MANUAL_PRINTERS_KEY, JSON.stringify(updated));
  return printer;
}

export function removeManualPrinter(name: string): void {
  const existing = loadManualPrinters();
  localStorage.setItem(
    MANUAL_PRINTERS_KEY,
    JSON.stringify(existing.filter(p => p.name !== name))
  );
}

// ── Default Printer Settings ──────────────────────────────────────────────────

export function saveDefaultPrinter(name: string): void {
  localStorage.setItem(DEFAULT_PRINTER_KEY, name);
}

export function getDefaultPrinterName(): string {
  return localStorage.getItem(DEFAULT_PRINTER_KEY) ?? '';
}

/**
 * Save printer settings
 * Mirrors: POST /api/barcode-label/printer/save
 *          POST /api/printing/settings/label
 */
export function savePrinterSettings(settings: {
  printerName: string;
  printerType: string;
}): void {
  saveDefaultPrinter(settings.printerName);
}

export function savePrinterProfile(printerName: string, profile: Record<string, unknown>): void {
  if (!printerName) return;
  const all = loadPrinterProfiles();
  all[printerName] = profile;
  localStorage.setItem(PRINTER_PROFILE_KEY, JSON.stringify(all));
}

export function loadPrinterProfile(printerName: string): Record<string, unknown> | null {
  if (!printerName) return null;
  return loadPrinterProfiles()[printerName] ?? null;
}

function loadPrinterProfiles(): Record<string, Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(PRINTER_PROFILE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Record<string, unknown>>;
  } catch {}
  return {};
}

/**
 * Test print — sends a test page to the selected printer
 * In desktop app, triggers win32print test page
 */
export function testPrint(printerName: string): Promise<{ success: boolean; message: string }> {
  return new Promise(resolve => {
    if (!printerName) {
      resolve({ success: false, message: 'No printer selected' });
      return;
    }

    // In desktop packaged app: call Python API /api/barcode-label/printer/test
    // For browser: open a simple print window
    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) {
      resolve({ success: false, message: 'Popup blocked. Please allow popups.' });
      return;
    }

    const escapedPrinterName = printerName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    win.document.write(`<!DOCTYPE html>
<html><head><title>Test Print</title>
<style>
body { font-family: Arial; padding: 20px; }
.test-label { border: 2px dashed #333; padding: 10px; width: 200px; }
h3 { margin: 0 0 8px; font-size: 14px; }
p { margin: 0; font-size: 11px; color: #666; }
</style>
</head><body>
<div class="test-label">
  <h3>&#x2713; Test Print</h3>
  <p>Printer: ${escapedPrinterName}</p>
  <p>Garage Management System</p>
  <p>Label Generator Module</p>
  <p>${new Date().toLocaleString()}</p>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);}<\/script>
</body></html>`);
    win.document.close();
    resolve({ success: true, message: `Test page sent to ${printerName}` });
  });
}
