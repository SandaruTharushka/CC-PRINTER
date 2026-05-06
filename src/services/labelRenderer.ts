/**
 * Label Renderer Service
 * Mirrors: services/barcode_label/label_builder.py
 *          services/barcode_label/label_renderer.py
 * POST /api/barcode-label/preview
 */

import { LabelSettings, Product } from '../store/barcodeStore';
import { encodePriceToCode, validatePriceCodeKey } from '../store/barcodeStore';

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

function rotationCss(deg: 0 | 90 | 180 | 270): string {
  return deg === 0 ? 'none' : `rotate(${deg}deg)`;
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
  const padding = toPxScaled(1);
  const fitText = (text: string, maxWidth: number) => {
    let t = text;
    while (t.length > 0 && ctx.measureText(t).width > maxWidth) t = `${t.slice(0, -1).trimEnd()}…`;
    return t;
  };

  // Product name (single line + ellipsis)
  if (template.productName.visible && settings.label_show_product_name) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `${template.productName.bold ? 'bold' : 'normal'} ${template.productName.fontSizePx ?? 8}px Arial, sans-serif`;
    ctx.textAlign = (template.productName.align ?? 'center') as CanvasTextAlign;
    ctx.textBaseline = 'middle';
    const x = toPxScaled(template.productName.xMm);
    const y = toPxScaled(template.productName.yMm);
    const w = toPxScaled(template.productName.widthMm);
    const h = toPxScaled(template.productName.heightMm);
    const tx = template.productName.align === 'left' ? x : template.productName.align === 'right' ? x + w : x + (w / 2);
    ctx.fillText(fitText(product.name || '', w), tx, y + (h / 2));
  }

  const effectivePrice = product.price ?? 0;
  if (template.encryptedPrice.visible && settings.price_code_enabled && settings.show_encrypted_price_code && validatePriceCodeKey(settings.price_code_key).valid) {
    ctx.fillStyle = '#111827';
    ctx.font = `${template.encryptedPrice.bold ? 'bold' : 'normal'} ${template.encryptedPrice.fontSizePx ?? 7}px Arial, sans-serif`;
    ctx.textAlign = (template.encryptedPrice.align ?? 'center') as CanvasTextAlign;
    ctx.textBaseline = 'middle';
    const x = toPxScaled(template.encryptedPrice.xMm); const y = toPxScaled(template.encryptedPrice.yMm);
    const w = toPxScaled(template.encryptedPrice.widthMm); const h = toPxScaled(template.encryptedPrice.heightMm);
    const tx = template.encryptedPrice.align === 'left' ? x : template.encryptedPrice.align === 'right' ? x + w : x + (w / 2);
    ctx.fillText(encodePriceToCode(effectivePrice, settings.price_code_key), tx, y + (h / 2));
  }

  // Barcode image
  const barcodeImg = await loadImage(barcodeDataUrl);
  const hasQR = settings.label_show_qr && qrDataUrl;
  const barcodeAreaWidth = toPxScaled(template.barcode.widthMm);
  const barcodeHeight = toPxScaled(template.barcode.heightMm);
  const barcodeX = toPxScaled(template.barcode.xMm);
  const barcodeY = toPxScaled(template.barcode.yMm);

  if (barcodeImg) {
    ctx.drawImage(barcodeImg, barcodeX, barcodeY, barcodeAreaWidth, barcodeHeight);
  }

  // QR code (right side)
  if (hasQR && qrDataUrl) {
    const qrImg = await loadImage(qrDataUrl);
    if (qrImg) {
      const qrSize = Math.min(barcodeHeight, Math.round(widthPx * 0.28));
      const qrX = widthPx - padding - qrSize;
      const qrY = barcodeY + (barcodeHeight - qrSize) / 2;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    }
  }

  // Barcode text value
  if (template.barcodeNumber.visible && settings.label_show_barcode_text && template.barcode.showText) {
    ctx.fillStyle = '#374151';
    ctx.font = `${template.barcodeNumber.fontSizePx ?? 7}px monospace`;
    ctx.textAlign = (template.barcodeNumber.align ?? 'center') as CanvasTextAlign;
    ctx.textBaseline = 'middle';
    const x = toPxScaled(template.barcodeNumber.xMm); const y = toPxScaled(template.barcodeNumber.yMm);
    const w = toPxScaled(template.barcodeNumber.widthMm); const h = toPxScaled(template.barcodeNumber.heightMm);
    const tx = template.barcodeNumber.align === 'left' ? x : template.barcodeNumber.align === 'right' ? x + w : x + (w / 2);
    ctx.fillText(opts.barcodeValue || product.barcode, tx, y + (h / 2));
  }

  // Normal Price (optional)
  if (template.normalPrice.visible && settings.show_normal_price && settings.label_show_price) {
    ctx.fillStyle = '#065f46';
    ctx.font = `${template.normalPrice.bold ? 'bold' : 'normal'} ${template.normalPrice.fontSizePx ?? 7}px Arial, sans-serif`;
    ctx.textAlign = (template.normalPrice.align ?? 'center') as CanvasTextAlign;
    ctx.textBaseline = 'middle';
    const x = toPxScaled(template.normalPrice.xMm); const y = toPxScaled(template.normalPrice.yMm);
    const w = toPxScaled(template.normalPrice.widthMm); const h = toPxScaled(template.normalPrice.heightMm);
    const tx = template.normalPrice.align === 'left' ? x : template.normalPrice.align === 'right' ? x + w : x + (w / 2);
    ctx.fillText(`$${effectivePrice.toFixed(2)}`, tx, y + (h / 2));
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
    for (let i = 0; i < item.copies; i++) {
      const rendered = await renderLabel({
        product: item.product,
        barcodeDataUrl: item.barcodeDataUrl,
        barcodeValue: item.product.barcode, // Batch mode assumes existing or already updated barcode
        qrDataUrl: item.qrDataUrl,
        settings,
      });
      dataUrls.push(rendered.dataUrl);
    }
  }
  return dataUrls;
}

/**
 * Print labels using browser print window
 * Native Windows print when invoked from Electron/desktop packaged app
 */

function barcodeMarkup(url: string): string {
  if (url.startsWith('data:image/svg+xml')) {
    const encoded = url.split(',', 2)[1] ?? '';
    return decodeURIComponent(encoded);
  }
  return `<img class="barcode-fallback" src="${url}" />`;
}

export function printLabels(
  labelDataUrls: string[],
  settings: LabelSettings,
  printerName?: string
): void {
  if (labelDataUrls.length === 0) return;

  const orientationWidth = settings.orientation === 'landscape' ? settings.label_height_mm : settings.label_width_mm;
  const orientationHeight = settings.orientation === 'landscape' ? settings.label_width_mm : settings.label_height_mm;
  const labelsHtml = labelDataUrls
    .map(
      (url, i) =>
        `<div class="label">
          ${barcodeMarkup(url)}
        </div>`
    )
    .join('\n');

  const sheetColumns = Math.max(1, settings.columns);
  const sheetRows = Math.max(1, settings.rows);
  const sheetWidth = (orientationWidth * sheetColumns) + (settings.label_gap_mm * (sheetColumns - 1));
  const sheetHeight = (orientationHeight * sheetRows) + (settings.label_gap_mm * (sheetRows - 1));

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
      height: ${sheetHeight}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: white;
    }

    .sheet {
      display: grid;
      grid-template-columns: repeat(${sheetColumns}, ${orientationWidth}mm);
      column-gap: ${settings.label_gap_mm}mm;
      grid-template-rows: repeat(${sheetRows}, ${orientationHeight}mm);
      row-gap: ${settings.label_gap_mm}mm;
      width: ${sheetWidth}mm;
      height: ${sheetHeight}mm;
      margin: ${settings.marginTopMm + settings.yOffsetMm}mm 0 0 ${settings.marginLeftMm + settings.xOffsetMm}mm;
      padding: 0;
    }

    .label {
      width: ${orientationWidth}mm;
      height: ${orientationHeight}mm;
      box-sizing: border-box;
      overflow: hidden;
      margin: 0;
      padding: 1mm;
      page-break-after: always;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .label:last-child { page-break-after: auto; }

    svg {
      width: 44mm;
      height: 12mm;
      display: block;
    }

    .barcode-fallback {
      width: 44mm;
      height: 12mm;
      display: block;
    }

    * {
      image-rendering: auto;
      filter: none !important;
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

  // If running in Electron with the bridge available
  if (window.electronAPI && typeof window.electronAPI.printLabel === 'function') {
    window.electronAPI.printLabel(fullHtml, printerName || '', {
      silent: true,
      printBackground: true,
      margins: { marginType: 'none' },
      scaleFactor: 100,
      pageSize: {
        width: sheetWidth * 1000,
        height: sheetHeight * 1000,
      }
    }).catch((err: any) => {
      console.error('Direct print failed:', err);
      alert('Direct printing failed. Falling back to browser print.');
      openBrowserPrint(fullHtml);
    });
  } else {
    openBrowserPrint(fullHtml);
  }
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
