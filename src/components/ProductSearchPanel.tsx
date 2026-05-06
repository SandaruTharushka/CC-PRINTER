import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Plus, X, Tag, Hash, DollarSign, Layers } from 'lucide-react';
import { useBarcodeStore, Product } from '../store/barcodeStore';
import * as productService from '../services/productService';

interface ProductSearchPanelProps {
  onAddToBatch?: (product: Product) => void;
  compact?: boolean;
}

export default function ProductSearchPanel({ onAddToBatch, compact }: ProductSearchPanelProps) {
  const {
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    selectedProduct, setSelectedProduct,
    batchItems,
  } = useBarcodeStore();

  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await productService.searchProducts(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, setSearchResults]);

  const handleSelect = (product: Product) => {
    if (onAddToBatch) {
      onAddToBatch(product);
    } else {
      setSelectedProduct(product);
    }
    setSearchQuery('');
    setSearchResults([]);
    setFocused(false);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedProduct(null);
    inputRef.current?.focus();
  };

  const isInBatch = (product: Product) => batchItems.some(b => b.product.id === product.id);

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by name, barcode, or SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
          />
          {searchQuery && (
            <button onClick={handleClear} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {focused && searchResults.length > 0 && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {searchResults.map(product => (
                <button
                  key={product.id}
                  onMouseDown={() => handleSelect(product)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-100 last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{product.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{product.sku}</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs font-mono text-slate-500">{product.barcode}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-emerald-600">${product.price.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">{product.stock} in stock</div>
                  </div>
                </button>
              ))}
            </div>
            {searchResults.length === 10 && (
              <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center">
                Showing top results. Refine your search.
              </div>
            )}
          </div>
        )}

        {focused && searchQuery && searchResults.length === 0 && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No products found</p>
          </div>
        )}
      </div>

      {/* Selected Product Card */}
      {selectedProduct && (
        <div className={`bg-white border-2 border-indigo-200 rounded-xl p-4 relative ${compact ? 'p-3' : ''}`}>
          <button
            onClick={() => setSelectedProduct(null)}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <h3 className="font-semibold text-slate-800 text-sm leading-tight">{selectedProduct.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedProduct.category}</p>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-2 mt-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <InfoCell icon={<Hash className="w-3.5 h-3.5" />} label="SKU" value={selectedProduct.sku} />
            <InfoCell icon={<Tag className="w-3.5 h-3.5" />} label="Barcode" value={selectedProduct.barcode || '—'} mono />
            <InfoCell icon={<DollarSign className="w-3.5 h-3.5" />} label="Price" value={`$${selectedProduct.price.toFixed(2)}`} highlight />
            <InfoCell icon={<Layers className="w-3.5 h-3.5" />} label="Stock" value={`${selectedProduct.stock} units`} />
          </div>

          {selectedProduct.description && !compact && (
            <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">{selectedProduct.description}</p>
          )}

          {onAddToBatch && (
            <button
              onClick={() => onAddToBatch(selectedProduct)}
              disabled={isInBatch(selectedProduct)}
              className={`mt-3 w-full flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg transition-all
                ${isInBatch(selectedProduct)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              <Plus className="w-3.5 h-3.5" />
              {isInBatch(selectedProduct) ? 'Already in batch' : 'Add to batch'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCell({ icon, label, value, mono, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-2">
      <div className="flex items-center gap-1 text-slate-400 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className={`text-xs font-semibold truncate ${mono ? 'font-mono' : ''} ${highlight ? 'text-emerald-600' : 'text-slate-700'}`}>
        {value}
      </div>
    </div>
  );
}
