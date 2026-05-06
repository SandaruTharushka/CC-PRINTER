/**
 * Label Renderer Service
 * Mirrors: services/barcode_label/label_builder.py
 *          services/barcode_label/label_renderer.py
 * POST /api/barcode-label/preview
 */

import { LabelSettings, Product } from '../store/barcodeStore';
import { encodePriceToCode, validatePriceCodeKey } from '../store/barcodeStore';
import { formatCurrency } from '../utils/currency';

export interface LabelRenderOptions {
  product: Product;
  barcodeDataUrl: string;
  barcodeValue: string; // The actual value used to generate the barcode
  qrDataUrl?: string;
  settings: LabelSettings;
  copies?: number;
  previewScale?: number; // For screen preview (e.g. 3 = 3x zoom)
  mode?: 'preview' | 'print';
  previewOptions?: {
    showGrid?: boolean;
    showElementBounds?: boolean;
    showSafeArea?: boolean;
    selectedElement?: 'productName' | 'encryptedPrice' | 'barcode' | 'barcodeNumber' | 'normalPrice' | null;
  };
}

export interface RenderedLabel {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
}

// 96 DPI → mm conversion: 1mm = 3.7795 px at 96dpi
// For labels use 203 DPI (thermal printer standard)
const PRINT_DPI = 203;
const MM_TO_PX = PRINT_DPI / 25.4;

function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}


/**
 * Render a label canvas
 * Returns RenderedLabel with canvas and dataUrl
 */
export async function renderLabel(opts: LabelRenderOptions): Promise<RenderedLabel> {
  const { product, barcodeDataUrl, qrDataUrl, settings } = opts;
  const scale = opts.previewScale ?? 1;

  const widthMm = settings.label_width_mm;
  const heightMm = settings.label_height_mm;
  const template = settings.label_template;

  const widthPx = Math.round(mmToPx(widthMm) * scale);
  const heightPx = Math.round(mmToPx(heightMm) * scale);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const mode = opts.mode ?? 'print';
  const previewOpts = opts.previewOptions;

  if (mode === 'preview') {
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = scale;
    ctx.strokeRect(0.5, 0.5, widthPx - 1, heightPx - 1);
    if (previewOpts?.showGrid) {
      const mmPx = mmToPx(1) * scale;
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= widthPx; x += mmPx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, heightPx); ctx.stroke(); }
      for (let y = 0; y <= heightPx; y += mmPx) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(widthPx, y); ctx.stroke(); }
    }
  }

  const toPxScaled = (mm: number) => mmToPx(mm) * scale;

  const fitText = (text: string, maxWidth: number) => {
    if (!text) return '';
    if (!Number.isFinite(maxWidth) || maxWidth <= 4) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;

    const ellipsis = '…';
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (ellipsisWidth > maxWidth) return '';

    let candidate = text.trimEnd();
    let guard = 0;
    while (candidate.length > 0 && guard < 500) {
      const next = candidate.slice(0, -1).trimEnd();
      if (next.length === candidate.length) return '';
      candidate = next;
      if (!candidate) return '';
      if (ctx.measureText(candidate + ellipsis).width <= maxWidth) return candidate + ellipsis;
      guard += 1;
    }
    return '';
  };

  const drawTextElement = (
    el: { visible: boolean; xMm: number; yMm: number; widthMm: number; heightMm: number; fontSizePx?: number; bold?: boolean; align?: string },
    text: string,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${el.bold ? 'bold' : 'normal'} ${el.fontSizePx ?? 8}px Arial, sans-serif`;
    ctx.textAlign = (el.align ?? 'center') as CanvasTextAlign;
    ctx.textBaseline = 'middle';
    const x = toPxScaled(el.xMm);
    const y = toPxScaled(el.yMm);
    const w = toPxScaled(el.widthMm);
    const h = toPxScaled(el.heightMm);
    const tx = el.align === 'left' ? x : el.align === 'right' ? x + w : x + w / 2;
    ctx.fillText(fitText(text, w), tx, y + h / 2);
  };

  // Company name (top strip, if enabled)
  if (settings.label_show_company && settings.label_company_name) {
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(0, 0, widthPx, toPxScaled(3.5));
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(5, toPxScaled(0.35))}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      fitText(settings.label_company_name, widthPx - toPxScaled(2)),
      widthPx / 2,
      toPxScaled(1.75)
    );
  }

  // Product name (single line + ellipsis)
  if (template.productName.visible && settings.label_show_product_name) {
    drawTextElement(template.productName, product.name || '', '#0f172a');
  }

  const effectivePrice = product.price ?? 0;

  // Encrypted price code
  if (template.encryptedPrice.visible && settings.price_code_enabled && settings.show_encrypted_price_code && validatePriceCodeKey(settings.price_code_key).valid) {
    drawTextElement(template.encryptedPrice, encodePriceToCode(effectivePrice, settings.price_code_key), '#111827');
  }

  // Barcode image — supports rotation via settings.barcodeRotate
  const barcodeImg = await loadImage(barcodeDataUrl);
  const hasQR = settings.label_show_qr && qrDataUrl;
  const barcodeAreaWidth = toPxScaled(template.barcode.widthMm);
  const barcodeAreaHeight = toPxScaled(template.barcode.heightMm);
  const barcodeX = toPxScaled(template.barcode.xMm);
  const barcodeY = toPxScaled(template.barcode.yMm);
  const rotate = settings.barcodeRotate ?? 0;

  if (barcodeImg) {
    if (rotate === 0) {
      ctx.drawImage(barcodeImg, barcodeX, barcodeY, barcodeAreaWidth, barcodeAreaHeight);
    } else {
      // Rotate around barcode centre
      const cx = barcodeX + barcodeAreaWidth / 2;
      const cy = barcodeY + barcodeAreaHeight / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rotate * Math.PI) / 180);
      // For 90/270 swap width/height when drawing
      const dw = rotate === 90 || rotate === 270 ? barcodeAreaHeight : barcodeAreaWidth;
      const dh = rotate === 90 || rotate === 270 ? barcodeAreaWidth : barcodeAreaHeight;
      ctx.drawImage(barcodeImg, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  // QR code (right side, or centred when no barcode)
  if (hasQR && qrDataUrl) {
    const qrImg = await loadImage(qrDataUrl);
    if (qrImg) {
      const qrSize = Math.min(barcodeAreaHeight, Math.round(widthPx * 0.28));
      const qrX = widthPx - toPxScaled(1) - qrSize;
      const qrY = barcodeY + (barcodeAreaHeight - qrSize) / 2;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    }
  }

  // Barcode number text
  if (template.barcodeNumber.visible && settings.label_show_barcode_text && template.barcode.showText) {
    drawTextElement(
      { ...template.barcodeNumber, bold: false },
      opts.barcodeValue || product.barcode,
      '#374151'
    );
  }

  // Normal price (optional)
  if (template.normalPrice.visible && settings.show_normal_price && settings.label_show_price) {
    drawTextElement(template.normalPrice, formatCurrency(effectivePrice), '#065f46');
  }

  if (mode === 'preview' && previewOpts?.showSafeArea) {
    const inset = toPxScaled(1);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = Math.max(1, scale * 0.5);
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(inset, inset, widthPx - inset * 2, heightPx - inset * 2);
    ctx.setLineDash([]);
  }

  if (mode === 'preview' && previewOpts?.showElementBounds) {
    const drawBound = (key: string, x: number, y: number, w: number, h: number) => {
      const selected = previewOpts.selectedElement === key;
      ctx.strokeStyle = selected ? '#007bff' : '#f59e0b';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.setLineDash(selected ? [4, 3] : [2, 2]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    };
    drawBound('productName', toPxScaled(template.productName.xMm), toPxScaled(template.productName.yMm), toPxScaled(template.productName.widthMm), toPxScaled(template.productName.heightMm));
    drawBound('encryptedPrice', toPxScaled(template.encryptedPrice.xMm), toPxScaled(template.encryptedPrice.yMm), toPxScaled(template.encryptedPrice.widthMm), toPxScaled(template.encryptedPrice.heightMm));
    drawBound('barcode', toPxScaled(template.barcode.xMm), toPxScaled(template.barcode.yMm), toPxScaled(template.barcode.widthMm), toPxScaled(template.barcode.heightMm));
    drawBound('barcodeNumber', toPxScaled(template.barcodeNumber.xMm), toPxScaled(template.barcodeNumber.yMm), toPxScaled(template.barcodeNumber.widthMm), toPxScaled(template.barcodeNumber.heightMm));
    drawBound('normalPrice', toPxScaled(template.normalPrice.xMm), toPxScaled(template.normalPrice.yMm), toPxScaled(template.normalPrice.widthMm), toPxScaled(template.normalPrice.heightMm));
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    widthPx,
    heightPx,
    widthMm,
    heightMm,
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Render a batch of label canvases for print
 * Returns array of data URLs
 */
export async function renderBatchLabels(
  items: Array<{
    product: Product;
    barcodeDataUrl: string;
    qrDataUrl?: string;
    copies: number;
  }>,
  settings: LabelSettings
): Promise<string[]> {
  const dataUrls: string[] = [];
  for (const item of items) {
    const rendered = await renderLabel({
      product: item.product,
      barcodeDataUrl: item.barcodeDataUrl,
      barcodeValue: item.product.barcode, // Batch mode assumes existing or already updated barcode
      qrDataUrl: item.qrDataUrl,
      settings,
    });
    for (let i = 0; i < item.copies; i++) {
      dataUrls.push(rendered.dataUrl);
    }
  }
  return dataUrls;
}

/**
 * Print labels using browser print window
 * Native Windows print when invoked from Electron/desktop packaged app
 */

export async function printLabels(
  labelDataUrls: string[],
  settings: LabelSettings,
  printerName?: string
): Promise<{ success: boolean; failureReason?: string }> {
  if (labelDataUrls.length === 0) {
    return { success: false, failureReason: 'No labels to print' };
  }

  const orientationWidth = settings.orientation === 'landscape' ? settings.label_height_mm : settings.label_width_mm;
  const orientationHeight = settings.orientation === 'landscape' ? settings.label_width_mm : settings.label_height_mm;

  // Each labelDataUrl is a full rendered label PNG — display at exact label dimensions
  const labelsHtml = labelDataUrls
    .map(
      url =>
        `<div class="label"><img src="${url}" /></div>`
    )
    .join('\n');

  const sheetColumns = Math.max(1, settings.columns);
  const sheetRows = Math.max(1, settings.rows);
  const gapMm = settings.label_gap_mm ?? 0;
  const sheetWidth = orientationWidth * sheetColumns + gapMm * (sheetColumns - 1);
  const sheetHeight = orientationHeight * sheetRows + gapMm * (sheetRows - 1);
  const marginTop = (settings.marginTopMm ?? 0) + (settings.yOffsetMm ?? 0);
  const marginLeft = (settings.marginLeftMm ?? 0) + (settings.xOffsetMm ?? 0);

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Label Print — Garage Management System</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: ${sheetWidth}mm ${sheetHeight}mm;
      margin: 0;
    }
    html, body {
      width: ${sheetWidth}mm;
      background: white;
      margin: 0;
      padding: 0;
    }
    .sheet {
      display: grid;
      grid-template-columns: repeat(${sheetColumns}, ${orientationWidth}mm);
      column-gap: ${gapMm}mm;
      row-gap: ${gapMm}mm;
      width: ${sheetWidth}mm;
      margin-top: ${marginTop}mm;
      margin-left: ${marginLeft}mm;
      padding: 0;
    }
    .label {
      width: ${orientationWidth}mm;
      height: ${orientationHeight}mm;
      overflow: hidden;
      margin: 0;
      padding: 0;
      page-break-inside: avoid;
    }
    .label img {
      width: ${orientationWidth}mm;
      height: ${orientationHeight}mm;
      display: block;
      object-fit: fill;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
${labelsHtml}
  </div>
</body>
</html>`;

  // Electron native silent print — returns real success/failure
  if (window.electronAPI && typeof window.electronAPI.printLabel === 'function') {
    try {
      const result = await window.electronAPI.printLabel(fullHtml, printerName || '', {
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        scaleFactor: 100,
        pageSize: {
          width: Math.round(sheetWidth * 1000),
          height: Math.round(sheetHeight * 1000),
        },
      });
      if (!result.success) {
        return { success: false, failureReason: result.failureReason ?? 'Printer returned failure' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, failureReason: (err as Error).message };
    }
  }

  // Browser fallback (dev / non-Electron)
  openBrowserPrint(fullHtml);
  return { success: true }; // browser print dialog opened — user controls outcome
}

function openBrowserPrint(html: string) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Could not open print window. Please allow popups for this page.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.write('<script>window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };</script>');
  printWindow.document.close();
}

export async function renderLabelTemplate(templateSettings: LabelSettings, data: Omit<LabelRenderOptions, 'settings'>, mode: 'preview' | 'print'): Promise<RenderedLabel> {
  return renderLabel({ ...data, settings: templateSettings, mode });
}
