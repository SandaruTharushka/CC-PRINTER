import { Product, BarcodeType } from '../store/barcodeStore';
import * as mockDB from '../data/mockProducts';

const API_BASE_URL = (import.meta as any).env?.VITE_GMS_API_BASE_URL;

/**
 * Phase 9: Product Service
 * Handles fetching and updating products.
 * Supports API mode if VITE_GMS_API_BASE_URL exists, otherwise falls back to local mock.
 */

export async function searchProducts(query: string): Promise<Product[]> {
  if (!API_BASE_URL) {
    return mockDB.searchProducts(query);
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/products/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal
    });
    clearTimeout(id);
    if (!response.ok) throw new Error('Search failed');
    return await response.json();
  } catch (e) {
    console.error('API search failed, falling back to mock:', e);
    return mockDB.searchProducts(query);
  }
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  if (!API_BASE_URL) {
    return mockDB.billingLookup(barcode);
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/products/barcode/${barcode}`, {
      signal: controller.signal
    });
    clearTimeout(id);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Fetch failed');
    return await response.json();
  } catch (e) {
    console.error('API fetch failed, falling back to mock:', e);
    return mockDB.billingLookup(barcode);
  }
}

export async function updateProductRackNo(productId: string, rackNo: string): Promise<boolean> {
  mockDB.updateProductRackNoInDB(productId, rackNo);
  if (!API_BASE_URL) return true;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/products/${productId}/rack`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rack_no: rackNo }),
      signal: controller.signal as AbortSignal,
    });
    clearTimeout(id);
    return response.ok;
  } catch (e) {
    console.error('API rack update failed:', e);
    return false;
  }
}

export async function updateProductBarcode(productId: string, barcode: string, type: BarcodeType): Promise<boolean> {
  // Always update local mock for consistency
  mockDB.updateProductBarcodeInDB(productId, barcode, type);

  if (!API_BASE_URL) return true;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/products/${productId}/barcode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, barcode_type: type }),
      signal: controller.signal as AbortSignal
    });
    clearTimeout(id);
    return response.ok;
  } catch (e) {
    console.error('API update failed:', e);
    return false;
  }
}
