import { Product, BarcodeType } from '../store/barcodeStore';

// Simulated product database — mirrors the backend Product model
// Fields: id, name, sku, barcode, barcode_type, price, category, stock
const PRODUCTS_KEY = 'gms_products_db';

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'PRD-001',
    name: 'Engine Oil Filter',
    sku: 'OIL-FLT-001',
    barcode: '8887191411001',
    barcode_type: 'CODE128',
    price: 12.99,
    category: 'Engine Parts',
    stock: 150,
    description: 'High performance engine oil filter for standard vehicles',
    rackNo: 'A-12',
  },
  {
    id: 'PRD-002',
    name: 'Brake Pad Set (Front)',
    sku: 'BRK-PAD-F01',
    barcode: '8887191411002',
    barcode_type: 'CODE128',
    price: 45.50,
    category: 'Brake System',
    stock: 80,
    description: 'Front brake pad set compatible with most sedans',
    rackNo: 'B-04',
  },
  {
    id: 'PRD-003',
    name: 'Spark Plug NGK',
    sku: 'SPK-NGK-001',
    barcode: '5901234567893',
    barcode_type: 'EAN13',
    price: 8.75,
    category: 'Ignition',
    stock: 320,
    description: 'NGK standard spark plug for petrol engines',
  },
  {
    id: 'PRD-004',
    name: 'Air Filter K&N',
    sku: 'AIR-KN-001',
    barcode: '8887191411004',
    barcode_type: 'CODE128',
    price: 28.00,
    category: 'Air System',
    stock: 65,
    description: 'K&N performance air filter — washable and reusable',
  },
  {
    id: 'PRD-005',
    name: 'Coolant Radiator Hose',
    sku: 'CLT-HOS-001',
    barcode: '8887191411005',
    barcode_type: 'CODE128',
    price: 22.30,
    category: 'Cooling System',
    stock: 40,
    description: 'Radiator coolant hose — upper section',
  },
  {
    id: 'PRD-006',
    name: 'Alternator Belt',
    sku: 'ALT-BLT-001',
    barcode: '8887191411006',
    barcode_type: 'CODE128',
    price: 15.00,
    category: 'Electrical',
    stock: 95,
    description: 'Standard alternator drive belt',
  },
  {
    id: 'PRD-007',
    name: 'Power Steering Fluid',
    sku: 'PSF-500ML-001',
    barcode: '4006381333627',
    barcode_type: 'EAN13',
    price: 9.99,
    category: 'Fluids',
    stock: 200,
    description: 'Power steering fluid 500ml',
  },
  {
    id: 'PRD-008',
    name: 'Windshield Wiper Blade',
    sku: 'WPR-BLD-24',
    barcode: '8887191411008',
    barcode_type: 'CODE128',
    price: 18.50,
    category: 'Exterior',
    stock: 110,
    description: '24-inch windshield wiper blade universal fit',
  },
  {
    id: 'PRD-009',
    name: 'Timing Belt Kit',
    sku: 'TIM-BLT-KIT',
    barcode: '8887191411009',
    barcode_type: 'CODE128',
    price: 89.95,
    category: 'Engine Parts',
    stock: 25,
    description: 'Complete timing belt kit with water pump',
  },
  {
    id: 'PRD-010',
    name: 'Battery Terminal Clamp',
    sku: 'BAT-TRM-001',
    barcode: '8887191411010',
    barcode_type: 'CODE128',
    price: 4.50,
    category: 'Electrical',
    stock: 500,
    description: 'Universal battery terminal clamp set',
  },
  {
    id: 'PRD-011',
    name: 'Transmission Fluid ATF',
    sku: 'ATF-1L-001',
    barcode: '8887191411011',
    barcode_type: 'CODE128',
    price: 14.75,
    category: 'Fluids',
    stock: 180,
    description: 'Automatic transmission fluid 1 litre',
  },
  {
    id: 'PRD-012',
    name: 'Fuel Injector Cleaner',
    sku: 'FUL-INJ-CLN',
    barcode: '4902505101052',
    barcode_type: 'EAN13',
    price: 11.25,
    category: 'Fuel System',
    stock: 75,
    description: 'Fuel system injector cleaner concentrate',
  },
];

export function loadProducts(): Product[] {
  try {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // Seed defaults
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
  return DEFAULT_PRODUCTS;
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function updateProductBarcodeInDB(
  productId: string,
  barcode: string,
  barcodeType: BarcodeType
): Product[] {
  const products = loadProducts();
  const updated = products.map(p =>
    p.id === productId ? { ...p, barcode, barcode_type: barcodeType } : p
  );
  saveProducts(updated);
  return updated;
}

export function updateProductRackNoInDB(productId: string, rackNo: string): Product[] {
  const products = loadProducts();
  const updated = products.map(p =>
    p.id === productId ? { ...p, rackNo } : p
  );
  saveProducts(updated);
  return updated;
}

// Billing scan lookup — mirrors route /api/billing/scan
export function billingLookup(scannedRaw: string): Product | null {
  const products = loadProducts();
  const normalized = scannedRaw.trim().replace(/\s+/g, '');
  // Try plain barcode match
  let found = products.find(p => p.barcode.trim() === normalized) ?? null;
  if (found) return found;
  // Try JSON QR payload
  try {
    const payload = JSON.parse(normalized) as { type?: string; barcode?: string };
    if (payload.type === 'product' && payload.barcode) {
      found = products.find(p => p.barcode.trim() === payload.barcode!.trim()) ?? null;
    }
  } catch {}
  return found;
}

// Search products by name/barcode/sku
export function searchProducts(query: string): Product[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const products = loadProducts();
  return products.filter(
    p =>
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
  );
}

export function addProductToDB(product: Product): Product[] {
  const products = loadProducts();
  const updated = [...products, product];
  saveProducts(updated);
  return updated;
}

export function deleteProductFromDB(productId: string): Product[] {
  const products = loadProducts();
  const updated = products.filter(p => p.id !== productId);
  saveProducts(updated);
  return updated;
}

export function updateProductInDB(productId: string, updates: Partial<Product>): Product[] {
  const products = loadProducts();
  const updated = products.map(p => p.id === productId ? { ...p, ...updates } : p);
  saveProducts(updated);
  return updated;
}

export function generateProductId(products: Product[]): string {
  const nums = products
    .map(p => parseInt(p.id.replace('PRD-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `PRD-${String(next).padStart(3, '0')}`;
}
