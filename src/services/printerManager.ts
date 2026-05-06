/**
 * Printer Manager Service
 * Mirrors: services/barcode_label/printer_manager.py
 * GET  /api/barcode-label/printers
 * POST /api/barcode-label/printer/save
 *
 * Printer detection priority:
 *   1. Electron webContents.getPrintersAsync() — real system printers
 *   2. Desktop bridge window.__GMS_PRINTERS__ — injected by PyInstaller/Electron
 *   3. No system printers available — shows only user-added manual printers
 */

export interface DetectedPrinter {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'unknown';
  isDefault: boolean;
  type: 'thermal' | 'inkjet' | 'laser' | 'unknown';
  connection: string;
  isManual?: boolean;
}

const MANUAL_PRINTERS_KEY = 'gms_manual_printers';
const DEFAULT_PRINTER_KEY = 'gms_default_printer';
const PRINTER_PROFILE_KEY = 'gms_printer_profiles';

// ── Desktop Bridge (PyInstaller / Electron) ───────────────────────────────────
declare global {
  interface Window {
    __GMS_PRINTERS__?: DetectedPrinter[];
    __GMS_WIN32PRINT_AVAILABLE__?: boolean;
  }
}

/**
 * Detect installed printers.
 * Priority: Electron API → Desktop bridge → manual-only fallback.
 * No fake/simulated printers are ever returned.
 */
export async function detectPrinters(): Promise<{
  printers: DetectedPrinter[];
  win32Available: boolean;
  source: 'win32' | 'bridge' | 'none';
}> {
  const manualPrinters = loadManualPrinters();
  const defaultPrinter = getDefaultPrinterName();

  // 1. Electron API — real system printers via webContents.getPrintersAsync()
  if (window.electronAPI && typeof window.electronAPI.getPrinters === 'function') {
    try {
      const raw = await window.electronAPI.getPrinters();
      if (Array.isArray(raw) && raw.length > 0) {
        const detected: DetectedPrinter[] = raw.map((p: Record<string, unknown>) => ({
          id: (p.deviceName ?? p.name) as string,
          name: (p.displayName ?? p.deviceName ?? p.name) as string,
          status: p.status === 0 ? 'connected' : ('disconnected' as const),
          isDefault: (p.isDefault ?? false) as boolean,
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

  // 3. No system printer detection available — return only user-added manual printers
  const all = mergeWithManual([], manualPrinters, defaultPrinter);
  return { printers: all, win32Available: false, source: 'none' };
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
 * Save printer settings.
 * Mirrors: POST /api/barcode-label/printer/save
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
 * Test print — sends a 50mm × 25mm test label to the selected printer via Electron.
 * Returns failure if not running in Electron desktop mode.
 */
export async function testPrint(printerName: string): Promise<{ success: boolean; message: string }> {
  if (!printerName) {
    return { success: false, message: 'No printer selected' };
  }

  if (!window.electronAPI || typeof window.electronAPI.printLabel !== 'function') {
    return {
      success: false,
      message: 'Native Electron printing is not available. Run the app in Electron desktop mode.',
    };
  }

  const escapedName = printerName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const testHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 50mm 25mm; margin: 0; }
    html, body { width: 50mm; height: 25mm; font-family: Arial, sans-serif; }
    .label { width: 50mm; height: 25mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3mm; }
    h3 { font-size: 10pt; margin-bottom: 2mm; }
    p { font-size: 7pt; color: #555; margin: 0.5mm 0; }
  </style>
</head>
<body>
  <div class="label">
    <h3>&#x2713; Test Print</h3>
    <p>${escapedName}</p>
    <p>${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;

  try {
    const result = await window.electronAPI.printLabel(testHtml, printerName, {
      silent: true,
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: { width: 50000, height: 25000 },
    });
    if (result.success) {
      return { success: true, message: `Test page sent to ${printerName}` };
    }
    return { success: false, message: result.failureReason ?? 'Printer returned failure' };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
