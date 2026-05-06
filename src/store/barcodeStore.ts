import { create } from 'zustand';

export type BarcodeType = 'CODE128' | 'EAN13' | 'QR';
export type QRPayloadType = 'plain' | 'json';
export type LabelSize = 'small' | 'medium' | 'large' | 'custom';
export type LabelAlign = 'left' | 'center' | 'right';

export interface LabelElementSettings {
  visible: boolean;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSizePx?: number;
  bold?: boolean;
  align?: LabelAlign;
  letterSpacingPx?: number;
}

export interface LabelTemplateSettings {
  labelWidthMm: number;
  labelHeightMm: number;
  productName: LabelElementSettings;
  encryptedPrice: LabelElementSettings;
  barcode: {
    visible: boolean;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    quietZoneMm: number;
    type: BarcodeType;
    showText: boolean;
  };
  barcodeNumber: LabelElementSettings;
  normalPrice: LabelElementSettings;
  priceCodeKey: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  barcode_type: BarcodeType;
  price: number;
  category: string;
  stock: number;
  description?: string;
  rackNo?: string;
}

export interface PrinterInfo {
  name: string;
  status: 'connected' | 'disconnected' | 'unknown';
  isDefault: boolean;
  type?: 'thermal' | 'inkjet' | 'laser' | 'unknown';
  isManual?: boolean;
}

export interface LabelSettings {
  label_printer_name: string;
  label_printer_type: string;
  label_width_mm: number;
  label_height_mm: number;
  label_gap_mm: number;
  label_font_size: number;
  label_show_price: boolean;
  label_show_product_name: boolean;
  label_show_barcode_text: boolean;
  label_show_qr: boolean;
  label_barcode_type: BarcodeType;
  label_default_copies: number;
  label_show_company: boolean;
  label_company_name: string;
  qr_payload_type: QRPayloadType;
  price_code_key: string;
  show_encrypted_price_code: boolean;
  price_code_enabled: boolean;
  show_normal_price: boolean;
  columns: number;
  rows: number;
  orientation: 'portrait' | 'landscape';
  marginTopMm: number;
  marginLeftMm: number;
  xOffsetMm: number;
  yOffsetMm: number;
  barcodeWidthMm: number;
  barcodeHeightMm: number;
  barcodeRotate: 0 | 90 | 180 | 270;
  printDpi: number;
  barcodeModuleWidth: number;
  debugGuides: boolean;
  label_template: LabelTemplateSettings;
}

export interface BatchItem {
  product: Product;
  copies: number;
  barcodeType: BarcodeType;
  generated: boolean;
  selected: boolean;
}

export interface GeneratedLabel {
  productId: string;
  barcodeValue: string;
  barcodeType: BarcodeType;
  barcodeDataUrl: string;
  qrDataUrl?: string;
  timestamp: Date;
}

interface BarcodeStore {
  // Products
  products: Product[];
  searchQuery: string;
  searchResults: Product[];
  selectedProduct: Product | null;

  // Generation
  barcodeType: BarcodeType;
  qrPayloadType: QRPayloadType;
  manualBarcodeValue: string;
  autoGenerateBarcode: boolean;
  generatedBarcodeHistory: string[];
  copies: number;
  generatedLabel: GeneratedLabel | null;

  // Printers
  printers: PrinterInfo[];
  selectedPrinter: string;
  printersLoading: boolean;
  printerError: string | null;

  // Settings
  labelSettings: LabelSettings;
  settingsSaved: boolean;

  // Batch
  batchItems: BatchItem[];

  // UI state
  activeTab: 'generator' | 'batch' | 'settings' | 'history' | 'products' | 'chart';
  printStatus: 'idle' | 'printing' | 'success' | 'error';
  printMessage: string;

  // History
  labelHistory: GeneratedLabel[];

  // Actions
  setSearchQuery: (q: string) => void;
  setSearchResults: (results: Product[]) => void;
  setSelectedProduct: (product: Product | null) => void;
  setBarcodeType: (type: BarcodeType) => void;
  setQrPayloadType: (type: QRPayloadType) => void;
  setManualBarcodeValue: (val: string) => void;
  setAutoGenerateBarcode: (enabled: boolean) => void;
  addGeneratedBarcodeToHistory: (barcode: string) => void;
  barcodeExistsAnywhere: (barcode: string, excludeProductId?: string) => boolean;
  setCopies: (n: number) => void;
  setGeneratedLabel: (label: GeneratedLabel | null) => void;
  setPrinters: (printers: PrinterInfo[]) => void;
  setSelectedPrinter: (name: string) => void;
  setPrintersLoading: (loading: boolean) => void;
  setPrinterError: (err: string | null) => void;
  setLabelSettings: (settings: Partial<LabelSettings>) => void;
  setSettingsSaved: (saved: boolean) => void;
  addBatchItem: (item: BatchItem) => void;
  removeBatchItem: (productId: string) => void;
  updateBatchItem: (productId: string, updates: Partial<BatchItem>) => void;
  clearBatch: () => void;
  toggleBatchItemSelect: (productId: string) => void;
  setActiveTab: (tab: 'generator' | 'batch' | 'settings' | 'history' | 'products' | 'chart') => void;
  addProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  setPrintStatus: (status: 'idle' | 'printing' | 'success' | 'error', message?: string) => void;
  addToHistory: (label: GeneratedLabel) => void;
  clearHistory: () => void;
  updateProductBarcode: (productId: string, barcode: string, barcodeType: BarcodeType) => void;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
}

const DEFAULT_SETTINGS: LabelSettings = {
  label_printer_name: '',
  label_printer_type: 'thermal',
  label_width_mm: 50,
  label_height_mm: 25,
  label_gap_mm: 4,
  label_font_size: 10,
  label_show_price: true,
  label_show_product_name: true,
  label_show_barcode_text: true,
  label_show_qr: false,
  label_barcode_type: 'CODE128',
  label_default_copies: 1,
  label_show_company: true,
  label_company_name: 'Garage Management System',
  qr_payload_type: 'plain',
  price_code_key: 'sfav0urite',
  show_encrypted_price_code: true,
  price_code_enabled: true,
  show_normal_price: false,
  columns: 2,
  rows: 1,
  orientation: 'portrait',
  marginTopMm: 0,
  marginLeftMm: 0,
  xOffsetMm: 0,
  yOffsetMm: 0,
  barcodeWidthMm: 0,
  barcodeHeightMm: 0,
  barcodeRotate: 0,
  printDpi: 203,
  barcodeModuleWidth: 1.2,
  debugGuides: false,
  label_template: {
    labelWidthMm: 50,
    labelHeightMm: 25,
    productName: { visible: true, xMm: 1, yMm: 1, widthMm: 48, heightMm: 4, fontSizePx: 8, bold: true, align: 'center' },
    encryptedPrice: { visible: true, xMm: 1, yMm: 5, widthMm: 48, heightMm: 3, fontSizePx: 7, bold: true, align: 'center', letterSpacingPx: 0.4 },
    barcode: { visible: true, xMm: 3, yMm: 8, widthMm: 44, heightMm: 12, quietZoneMm: 2, type: 'CODE128', showText: true },
    barcodeNumber: { visible: true, xMm: 1, yMm: 20.5, widthMm: 48, heightMm: 3, fontSizePx: 7, align: 'center', letterSpacingPx: 0.3 },
    normalPrice: { visible: false, xMm: 1, yMm: 5, widthMm: 48, heightMm: 3, fontSizePx: 7, bold: true, align: 'center' },
    priceCodeKey: 'sfav0urite',
  },
};

export const DEFAULT_PRICE_CODE_KEY = 'sfav0urite';
export const DEFAULT_LABEL_TEMPLATE: LabelTemplateSettings = DEFAULT_SETTINGS.label_template;
export const DEFAULT_LABEL_SETTINGS: LabelSettings = DEFAULT_SETTINGS;

// Normalize barcode (shared helper — mirrors services/barcode_normalizer.py)
export function normalizeScannedCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

/**
 * Phase 8: Validate price encryption key
 * - exactly 10 characters
 * - all characters unique
 * - trim whitespace
 */
export function validatePriceCodeKey(key: string): { valid: boolean; error?: string } {
  const clean = key.trim();
  if (clean.length !== 10) {
    return { valid: false, error: 'Key must be exactly 10 characters' };
  }
  const seen = new Set<string>();
  for (const char of clean) {
    if (seen.has(char)) {
      return { valid: false, error: `Duplicate character: ${char}` };
    }
    seen.add(char);
  }
  return { valid: true };
}

export function encodePriceToCode(price: number, key: string): string {
  const cleanKey = key.trim();
  if (!validatePriceCodeKey(cleanKey).valid) {
    throw new Error('Invalid price code key');
  }
  const cleanPrice = Math.round(price).toString();
  return cleanPrice
    .split('')
    .map((digit) => cleanKey[Number(digit)])
    .join('');
}

// Build QR payload
export function buildQRPayload(barcode: string, payloadType: QRPayloadType): string {
  if (payloadType === 'json') {
    return JSON.stringify({ type: 'product', barcode });
  }
  return barcode;
}

// Lookup product by scanned barcode (billing compatibility)
export function findProductByScannedCode(products: Product[], raw: string): Product | undefined {
  const normalized = normalizeScannedCode(raw);
  return products.find(p => normalizeScannedCode(p.barcode) === normalized);
}

// Persistent settings key
const SETTINGS_KEY = 'gms_label_settings';
const HISTORY_KEY = 'gms_label_history';
const PRINTER_KEY = 'gms_selected_printer';
const AUTO_GENERATE_KEY = 'gms_auto_generate_barcode';
const GENERATED_BARCODES_KEY = 'gms_generated_barcode_history';

function loadSettings(): LabelSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LabelSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        label_template: {
          ...DEFAULT_SETTINGS.label_template,
          ...(parsed.label_template ?? {}),
        },
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function loadHistory(): GeneratedLabel[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as GeneratedLabel[];
      return arr.map(h => ({ ...h, timestamp: new Date(h.timestamp) }));
    }
  } catch {}
  return [];
}

function loadAutoGenerateBarcode(): boolean {
  try {
    return localStorage.getItem(AUTO_GENERATE_KEY) === 'true';
  } catch {}
  return false;
}

function loadGeneratedBarcodeHistory(): string[] {
  try {
    const stored = localStorage.getItem(GENERATED_BARCODES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    }
  } catch {}
  return [];
}

export const useBarcodeStore = create<BarcodeStore>((set, get) => ({
  products: [],
  searchQuery: '',
  searchResults: [],
  selectedProduct: null,
  barcodeType: 'CODE128',
  qrPayloadType: 'plain',
  manualBarcodeValue: '',
  autoGenerateBarcode: loadAutoGenerateBarcode(),
  generatedBarcodeHistory: loadGeneratedBarcodeHistory(),
  copies: 1,
  generatedLabel: null,
  printers: [],
  selectedPrinter: localStorage.getItem(PRINTER_KEY) ?? '',
  printersLoading: false,
  printerError: null,
  labelSettings: loadSettings(),
  settingsSaved: false,
  batchItems: [],
  activeTab: 'generator',
  printStatus: 'idle',
  printMessage: '',
  labelHistory: loadHistory(),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  setBarcodeType: (type) => set({ barcodeType: type }),
  setQrPayloadType: (type) => set({ qrPayloadType: type }),
  setManualBarcodeValue: (val) => set({ manualBarcodeValue: val }),
  setAutoGenerateBarcode: (enabled) => {
    localStorage.setItem(AUTO_GENERATE_KEY, String(enabled));
    set({ autoGenerateBarcode: enabled });
  },
  addGeneratedBarcodeToHistory: (barcode) => {
    const normalized = normalizeScannedCode(barcode);
    if (!normalized) return;
    set(state => {
      const deduped = [normalized, ...state.generatedBarcodeHistory.filter(b => b !== normalized)].slice(0, 5000);
      localStorage.setItem(GENERATED_BARCODES_KEY, JSON.stringify(deduped));
      return { generatedBarcodeHistory: deduped };
    });
  },
  barcodeExistsAnywhere: (barcode, excludeProductId) => {
    const normalized = normalizeScannedCode(barcode);
    if (!normalized) return false;
    const state = get();
    const existsInProducts = state.products.some(
      p => p.id !== excludeProductId && normalizeScannedCode(p.barcode) === normalized
    );
    const existsInBatch = state.batchItems.some(
      b => b.product.id !== excludeProductId && normalizeScannedCode(b.product.barcode) === normalized
    );
    const existsInGeneratedHistory = state.generatedBarcodeHistory.includes(normalized);
    return existsInProducts || existsInBatch || existsInGeneratedHistory;
  },
  setCopies: (n) => set({ copies: n }),
  setGeneratedLabel: (label) => set({ generatedLabel: label }),
  setPrinters: (printers) => set({ printers }),
  setSelectedPrinter: (name) => {
    localStorage.setItem(PRINTER_KEY, name);
    set({ selectedPrinter: name });
  },
  setPrintersLoading: (loading) => set({ printersLoading: loading }),
  setPrinterError: (err) => set({ printerError: err }),
  setLabelSettings: (settings) => {
    // Only block if price_code_key is explicitly being changed to an invalid value
    if (settings.price_code_key !== undefined) {
      const { valid } = validatePriceCodeKey(settings.price_code_key);
      if (!valid) return;
    }
    const current = get().labelSettings;
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    set({ labelSettings: updated });
  },
  setSettingsSaved: (saved) => set({ settingsSaved: saved }),
  addBatchItem: (item) => {
    const existing = get().batchItems.find(b => b.product.id === item.product.id);
    if (!existing) {
      set(state => ({ batchItems: [...state.batchItems, item] }));
    }
  },
  removeBatchItem: (productId) =>
    set(state => ({ batchItems: state.batchItems.filter(b => b.product.id !== productId) })),
  updateBatchItem: (productId, updates) =>
    set(state => ({
      batchItems: state.batchItems.map(b =>
        b.product.id === productId ? { ...b, ...updates } : b
      ),
    })),
  clearBatch: () => set({ batchItems: [] }),
  toggleBatchItemSelect: (productId) =>
    set(state => ({
      batchItems: state.batchItems.map(b =>
        b.product.id === productId ? { ...b, selected: !b.selected } : b
      ),
    })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPrintStatus: (status, message = '') => set({ printStatus: status, printMessage: message }),
  addToHistory: (label) => {
    set(state => {
      const updated = [label, ...state.labelHistory].slice(0, 100);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return { labelHistory: updated };
    });
  },
  clearHistory: () => {
    localStorage.removeItem(HISTORY_KEY);
    set({ labelHistory: [] });
  },
  updateProductBarcode: (productId, barcode, barcodeType) =>
    set(state => ({
      products: state.products.map(p =>
        p.id === productId ? { ...p, barcode, barcode_type: barcodeType } : p
      ),
      searchResults: state.searchResults.map(p =>
        p.id === productId ? { ...p, barcode, barcode_type: barcodeType } : p
      ),
      selectedProduct:
        state.selectedProduct?.id === productId
          ? { ...state.selectedProduct, barcode, barcode_type: barcodeType }
          : state.selectedProduct,
    })),
  updateProduct: (productId, updates) =>
    set(state => ({
      products: state.products.map(p =>
        p.id === productId ? { ...p, ...updates } : p
      ),
      searchResults: state.searchResults.map(p =>
        p.id === productId ? { ...p, ...updates } : p
      ),
      selectedProduct:
        state.selectedProduct?.id === productId
          ? { ...state.selectedProduct, ...updates }
          : state.selectedProduct,
    })),
  addProduct: (product) =>
    set(state => ({ products: [...state.products, product] })),
  deleteProduct: (productId) =>
    set(state => ({
      products: state.products.filter(p => p.id !== productId),
      searchResults: state.searchResults.filter(p => p.id !== productId),
      selectedProduct:
        state.selectedProduct?.id === productId ? null : state.selectedProduct,
    })),
}));
