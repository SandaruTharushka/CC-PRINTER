import { useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Check, AlertTriangle, Package
} from 'lucide-react';
import { useBarcodeStore, Product, BarcodeType } from '../store/barcodeStore';
import {
  addProductToDB,
  deleteProductFromDB,
  updateProductInDB,
  generateProductId,
} from '../data/mockProducts';
import { formatCurrency, formatCurrencyShort } from '../utils/currency';

const BARCODE_TYPES: BarcodeType[] = ['CODE128', 'EAN13', 'QR'];

const CATEGORIES = [
  'Engine Parts', 'Brake System', 'Ignition', 'Air System',
  'Cooling System', 'Electrical', 'Fluids', 'Exterior',
  'Fuel System', 'Transmission', 'Suspension', 'Other',
];

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  barcode_type: BarcodeType;
  price: string;
  category: string;
  stock: string;
  description: string;
  rackNo: string;
  supplier: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  barcode: '',
  barcode_type: 'CODE128',
  price: '',
  category: 'Engine Parts',
  stock: '',
  description: '',
  rackNo: '',
  supplier: '',
};

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    barcode_type: p.barcode_type,
    price: String(p.price),
    category: p.category,
    stock: String(p.stock),
    description: p.description ?? '',
    rackNo: p.rackNo ?? '',
    supplier: p.supplier ?? '',
  };
}

function validate(form: FormState, products: Product[], editTargetId?: string): string | null {
  if (!form.name.trim()) return 'Product name is required';
  if (form.name.trim().length < 2) return 'Product name must be at least 2 characters';
  const normalised = form.barcode.trim();
  if (normalised && form.barcode_type === 'EAN13' && !/^\d{12,13}$/.test(normalised)) {
    return 'EAN13 barcode must be exactly 12 or 13 digits';
  }
  const price = parseFloat(form.price);
  if (!isNaN(price) && price < 0) return 'Price must be a valid number ≥ 0';
  if (price > 1_000_000) return 'Price value seems unrealistically large';
  const stock = parseInt(form.stock);
  if (!isNaN(stock) && stock < 0) return 'Stock must be a valid number ≥ 0';
  // Duplicate barcode check (excluding the product being edited)
  if (!normalised) return null;
  const duplicate = products.find(
    p => p.id !== editTargetId && p.barcode.trim() === normalised
  );
  if (duplicate) return `Barcode "${normalised}" is already used by "${duplicate.name}"`;
  return null;
}

type ModalMode = 'add' | 'edit' | null;

export default function ItemManagementPanel() {
  const { products, addProduct, updateProduct, deleteProduct, addGeneratedBarcodeToHistory, barcodeExistsAnywhere } = useBarcodeStore();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [generateRandomBarcode, setGenerateRandomBarcode] = useState(false);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setGenerateRandomBarcode(false);
    setFormError(null);
    setEditTarget(null);
    setModal('add');
  };

  const openEdit = (p: Product) => {
    setForm(productToForm(p));
    setGenerateRandomBarcode(false);
    setFormError(null);
    setEditTarget(p);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditTarget(null);
    setFormError(null);
  };

  const handleField = useCallback(
    (field: keyof FormState, value: string) =>
      setForm(f => ({ ...f, [field]: value })),
    []
  );

  const handleSave = () => {
    const parsedPrice = parseFloat(form.price);
    const parsedStock = parseInt(form.stock);
    const safePrice = isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;
    const safeStock = isNaN(parsedStock) || parsedStock < 0 ? 0 : parsedStock;
    let resolvedBarcode = form.barcode.trim();

    if (modal === 'add' && generateRandomBarcode) {
      let generated: string | null = null;
      for (let i = 0; i < 20; i += 1) {
        const candidate = `${Math.floor(Math.random() * 9) + 1}${Math.floor(Math.random() * 1_000_000_000_000).toString().padStart(12, '0')}`;
        if (!barcodeExistsAnywhere(candidate)) {
          generated = candidate;
          break;
        }
      }
      if (!generated) {
        setFormError('Could not generate a unique barcode after 20 attempts. Please try again.');
        return;
      }
      resolvedBarcode = generated;
    }

    const err = validate({ ...form, barcode: resolvedBarcode, price: String(safePrice), stock: String(safeStock) }, products, editTarget?.id);
    if (err) { setFormError(err); return; }

    if (modal === 'add') {
      const newProduct: Product = {
        id: generateProductId(products),
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: resolvedBarcode,
        barcode_type: form.barcode_type,
        price: safePrice,
        category: form.category,
        stock: safeStock,
        description: form.description.trim() || undefined,
        rackNo: form.rackNo.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
      };
      const updated = addProductToDB(newProduct);
      addProduct(newProduct);
      if (newProduct.barcode) addGeneratedBarcodeToHistory(newProduct.barcode);
      void updated;
      flash(`"${newProduct.name}" added successfully`);
    } else if (modal === 'edit' && editTarget) {
      const updates: Partial<Product> = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: resolvedBarcode,
        barcode_type: form.barcode_type,
        price: safePrice,
        category: form.category,
        stock: safeStock,
        description: form.description.trim() || undefined,
        rackNo: form.rackNo.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
      };
      updateProductInDB(editTarget.id, updates);
      updateProduct(editTarget.id, updates);
      flash(`"${updates.name}" updated`);
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    const p = products.find(x => x.id === id);
    deleteProductFromDB(id);
    deleteProduct(id);
    setDeleteConfirm(null);
    flash(`"${p?.name ?? id}" deleted`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, SKU, barcode, category…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Products', value: products.length },
          { label: 'Total Stock', value: products.reduce((s, p) => s + p.stock, 0).toLocaleString() },
          { label: 'Categories', value: new Set(products.map(p => p.category)).size },
          {
            label: 'Stock Value',
            value: formatCurrencyShort(products.reduce((s, p) => s + p.price * p.stock, 0)),
          },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-400 mb-0.5">{stat.label}</div>
            <div className="text-lg font-bold text-slate-800">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Barcode</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">
                      {search ? 'No products match your search' : 'No products yet — click Add Item to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 leading-tight">{p.name}</div>
                      <div className="text-[11px] text-slate-400">{p.id}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-500 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-medium">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${p.stock < 30 ? 'text-red-600' : p.stock < 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-slate-500 text-xs">{p.supplier || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-slate-400">{p.barcode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} of {products.length} products
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {modal === 'add' ? 'Add New Item' : `Edit: ${editTarget?.name}`}
              </h2>
              <button onClick={closeModal} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Product Name *</Label>
                  <Input value={form.name} onChange={v => handleField('name', v)} placeholder="e.g. Engine Oil Filter" />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={v => handleField('sku', v)} placeholder="e.g. OIL-FLT-001" />
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    value={form.category}
                    onChange={e => handleField('category', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Barcode</Label>
                  <Input
                    value={form.barcode}
                    onChange={v => handleField('barcode', v)}
                    placeholder={modal === 'add' && generateRandomBarcode ? 'Auto generated on save' : 'e.g. 8887191411001'}
                    disabled={modal === 'add' && generateRandomBarcode}
                  />
                  {modal === 'add' && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={generateRandomBarcode}
                        onChange={e => setGenerateRandomBarcode(e.target.checked)}
                      />
                      Generate random barcode
                    </label>
                  )}
                </div>
                <div>
                  <Label>Barcode Type</Label>
                  <select
                    value={form.barcode_type}
                    onChange={e => handleField('barcode_type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {BARCODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Price (LKR)</Label>
                  <Input type="number" value={form.price} onChange={v => handleField('price', v)} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div>
                  <Label>Stock Qty</Label>
                  <Input type="number" value={form.stock} onChange={v => handleField('stock', v)} placeholder="0" min="0" />
                </div>
                <div>
                  <Label>Rack No.</Label>
                  <Input value={form.rackNo} onChange={v => handleField('rackNo', v)} placeholder="e.g. A-12" />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input value={form.supplier} onChange={v => handleField('supplier', v)} placeholder="e.g. Auto Parts Co." />
                </div>
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <textarea
                    value={form.description}
                    onChange={e => handleField('description', e.target.value)}
                    placeholder="Optional product description…"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                {modal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-bold text-slate-800">Delete product?</div>
                <div className="text-sm text-slate-500">
                  "{products.find(p => p.id === deleteConfirm)?.name}" will be permanently removed.
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 mb-1">{children}</label>;
}

function Input({
  value, onChange, placeholder, type = 'text', min, step,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      step={step}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
    />
  );
}
