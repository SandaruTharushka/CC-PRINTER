/**
 * Barcode & QR Generator Service
 * Mirrors: services/barcode_label/generator.py
 *          services/barcode_label/qr_generator.py
 */

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { BarcodeType, QRPayloadType, buildQRPayload, normalizeScannedCode } from '../store/barcodeStore';

// ─── Barcode Generation ───────────────────────────────────────────────────────

export interface BarcodeResult {
  dataUrl: string;
  value: string;
  type: BarcodeType;
  width: number;
  height: number;
}

export interface QRResult {
  dataUrl: string;
  value: string;
  payload: string;
  payloadType: QRPayloadType;
}

function createBarcodeSvg(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

function svgToDataUrl(svg: SVGSVGElement): string {
  const svgString = new XMLSerializer().serializeToString(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

/**
 * Generate CODE128 barcode image
 * Returns base64 data URL
 */
export async function generateCODE128(value: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}): Promise<BarcodeResult> {
  const normalized = normalizeScannedCode(value);
  if (!normalized) throw new Error('Barcode value cannot be empty');

  const w = options?.width ?? 300;
  const h = options?.height ?? 80;
  const svg = createBarcodeSvg();

  try {
    JsBarcode(svg, normalized, {
      format: 'CODE128',
      width: 2,
      height: h - (options?.displayValue !== false ? 20 : 0),
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize ?? 12,
      margin: 0,
      marginLeft: 2,
      marginRight: 2,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch (e) {
    throw new Error(`CODE128 generation failed: ${(e as Error).message}`);
  }

  return {
    dataUrl: svgToDataUrl(svg),
    value: normalized,
    type: 'CODE128',
    width: w,
    height: h,
  };
}

/**
 * Generate EAN13 barcode image
 * EAN13 requires exactly 12 or 13 digit numeric string
 */
export async function generateEAN13(value: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}): Promise<BarcodeResult> {
  const normalized = normalizeScannedCode(value).replace(/\D/g, '');
  // Validate EAN13 format (12 or 13 digits)
  if (!/^\d{12,13}$/.test(normalized)) {
    throw new Error('Invalid EAN13: Must be exactly 12 or 13 digits');
  }

  const w = options?.width ?? 300;
  const h = options?.height ?? 80;
  const svg = createBarcodeSvg();

  try {
    JsBarcode(svg, normalized, {
      format: 'EAN13',
      width: 2,
      height: h - (options?.displayValue !== false ? 20 : 0),
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize ?? 12,
      margin: 0,
      marginLeft: 2,
      marginRight: 2,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch (e) {
    throw new Error(`EAN13 generation failed: ${(e as Error).message}. Ensure checksum is correct if using 13 digits.`);
  }

  return {
    dataUrl: svgToDataUrl(svg),
    value: normalized,
    type: 'EAN13',
    width: w,
    height: h,
  };
}

/**
 * Generate barcode based on type
 * Primary entry point — mirrors POST /api/barcode-label/generate
 */
export async function generateBarcode(
  value: string,
  type: BarcodeType,
  options?: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
  }
): Promise<BarcodeResult> {
  switch (type) {
    case 'EAN13':
      return generateEAN13(value, options);
    case 'CODE128':
    default:
      return generateCODE128(value, options);
  }
}

/**
 * Auto-generate a barcode value for a product
 * Rule: Uses existing barcode if valid, otherwise generates new CODE128
 */
export function autoGenerateBarcodeValue(product: {
  id: string;
  sku?: string;
  barcode?: string;
}, type: BarcodeType): string {
  // Use existing barcode if present
  if (product.barcode && product.barcode.trim()) {
    const normalized = normalizeScannedCode(product.barcode);
    if (type === 'EAN13') {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length >= 12) return digits.slice(0, 13);
    }
    return normalized;
  }
  // Generate from SKU or ID
  const base = (product.sku || product.id || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (type === 'EAN13') {
    // Build 12-digit numeric code from base
    let numeric = '';
    for (const ch of base) {
      numeric += ch.charCodeAt(0).toString().slice(0, 2);
      if (numeric.length >= 12) break;
    }
    return numeric.slice(0, 12).padStart(12, '0');
  }
  return base || `GMS${Date.now()}`;
}

export function generateUniqueBarcode(existingBarcodes: string[]): string {
  const existing = new Set(existingBarcodes.map(v => normalizeScannedCode(v)).filter(Boolean));
  const maxRetry = 100;

  for (let i = 0; i < maxRetry; i++) {
    const randomTen = Math.floor(Math.random() * 10_000_000_000).toString().padStart(10, '0');
    const candidate = `20${randomTen}`;
    if (!existing.has(candidate)) return candidate;
  }

  throw new Error('Unable to generate a unique barcode after 100 attempts. Please try again.');
}

// ─── QR Code Generation ───────────────────────────────────────────────────────

/**
 * Generate QR code image
 * Mirrors: services/barcode_label/qr_generator.py
 * POST /api/barcode-label/generate-qr
 */
export async function generateQRCode(
  barcodeValue: string,
  payloadType: QRPayloadType,
  options?: {
    size?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
): Promise<QRResult> {
  const payload = buildQRPayload(normalizeScannedCode(barcodeValue), payloadType);
  const size = options?.size ?? 150;

  const dataUrl = await QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: options?.errorCorrectionLevel ?? 'M',
  });

  return {
    dataUrl,
    value: barcodeValue,
    payload,
    payloadType,
  };
}

// ─── Batch Generation ─────────────────────────────────────────────────────────

export interface BatchGenerateRequest {
  products: Array<{
    id: string;
    name: string;
    sku: string;
    barcode: string;
    price: number;
    barcodeTypeOverride?: BarcodeType;
  }>;
  barcodeType: BarcodeType;
  includeQR: boolean;
  qrPayloadType: QRPayloadType;
  overwriteExisting: boolean;
}

export interface BatchGenerateResult {
  productId: string;
  success: boolean;
  barcodeValue: string;
  barcodeDataUrl?: string;
  qrDataUrl?: string;
  error?: string;
  skipped?: boolean;
}

export async function batchGenerate(req: BatchGenerateRequest): Promise<BatchGenerateResult[]> {
  const results: BatchGenerateResult[] = [];

  for (const product of req.products) {
    const effectiveType = product.barcodeTypeOverride ?? req.barcodeType;
    try {
      // Skip if existing barcode and not overwriting
      if (product.barcode && !req.overwriteExisting) {
        const bcResult = await generateBarcode(product.barcode, effectiveType);
        results.push({
          productId: product.id,
          success: true,
          barcodeValue: product.barcode,
          barcodeDataUrl: bcResult.dataUrl,
          skipped: true,
        });
        continue;
      }

      const barcodeValue = autoGenerateBarcodeValue(product, effectiveType);
      const bcResult = await generateBarcode(barcodeValue, effectiveType);

      let qrDataUrl: string | undefined;
      if (req.includeQR) {
        const qrResult = await generateQRCode(barcodeValue, req.qrPayloadType);
        qrDataUrl = qrResult.dataUrl;
      }

      results.push({
        productId: product.id,
        success: true,
        barcodeValue,
        barcodeDataUrl: bcResult.dataUrl,
        qrDataUrl,
      });
    } catch (e) {
      results.push({
        productId: product.id,
        success: false,
        barcodeValue: product.barcode || '',
        error: (e as Error).message,
      });
    }
  }

  return results;
}
