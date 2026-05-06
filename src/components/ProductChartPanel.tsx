import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useBarcodeStore } from '../store/barcodeStore';
import { BarChart2, PieChart as PieIcon, TrendingUp, Package } from 'lucide-react';

type ChartView = 'stock' | 'value' | 'price' | 'category';

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16', '#3b82f6', '#a855f7',
];

export default function ProductChartPanel() {
  const { products } = useBarcodeStore();
  const [view, setView] = useState<ChartView>('stock');

  const stockByProduct = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 15)
        .map(p => ({ name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name, stock: p.stock, id: p.id })),
    [products]
  );

  const valueByProduct = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.price * b.stock - a.price * a.stock)
        .slice(0, 15)
        .map(p => ({
          name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
          value: parseFloat((p.price * p.stock).toFixed(2)),
          id: p.id,
        })),
    [products]
  );

  const priceByProduct = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.price - a.price)
        .slice(0, 15)
        .map(p => ({
          name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
          price: p.price,
          id: p.id,
        })),
    [products]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; stock: number; value: number }>();
    for (const p of products) {
      const cur = map.get(p.category) ?? { count: 0, stock: 0, value: 0 };
      map.set(p.category, {
        count: cur.count + 1,
        stock: cur.stock + p.stock,
        value: parseFloat((cur.value + p.price * p.stock).toFixed(2)),
      });
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.stock - a.stock);
  }, [products]);

  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + p.price, 0) / products.length : 0;
  const lowStock = products.filter(p => p.stock < 30).length;

  const VIEWS: { id: ChartView; label: string; icon: React.ReactNode }[] = [
    { id: 'stock', label: 'Stock by Product', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'value', label: 'Stock Value', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'price', label: 'Price by Product', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'category', label: 'By Category', icon: <PieIcon className="w-4 h-4" /> },
  ];

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <Package className="w-12 h-12" />
        <p className="text-sm">No products yet. Add some items first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Products" value={String(products.length)} sub="in inventory" color="indigo" />
        <SummaryCard label="Total Stock" value={totalStock.toLocaleString()} sub="units across all items" color="emerald" />
        <SummaryCard
          label="Stock Value"
          value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="total inventory value"
          color="violet"
        />
        <SummaryCard
          label="Low Stock"
          value={String(lowStock)}
          sub="items below 30 units"
          color={lowStock > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
              ${view === v.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {view === 'category' ? `${byCategory.length} categories` : `Top ${Math.min(15, products.length)} products`}
        </span>
      </div>

      {/* Charts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        {view === 'stock' && (
          <>
            <h3 className="text-sm font-bold text-slate-700 mb-4">Stock Quantity by Product</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={stockByProduct} margin={{ left: 0, right: 10, top: 5, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v) => [Number(v).toLocaleString(), 'Stock']}
                />
                <Bar dataKey="stock" radius={[4, 4, 0, 0]}>
                  {stockByProduct.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {view === 'value' && (
          <>
            <h3 className="text-sm font-bold text-slate-700 mb-4">Stock Value by Product (Price × Qty)</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={valueByProduct} margin={{ left: 10, right: 10, top: 5, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Value']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {valueByProduct.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {view === 'price' && (
          <>
            <h3 className="text-sm font-bold text-slate-700 mb-4">Unit Price by Product</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={priceByProduct} margin={{ left: 10, right: 10, top: 5, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
                />
                <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                  {priceByProduct.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {view === 'category' && (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            <div className="w-full lg:w-1/2">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Stock Distribution by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="stock"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={55}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(v) => [Number(v).toLocaleString(), 'Stock units']}
                  />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full lg:w-1/2">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Category Breakdown</h3>
              <div className="flex flex-col gap-2">
                {byCategory.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{cat.name}</div>
                      <div className="text-xs text-slate-400">{cat.count} products · {cat.stock} units</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-600 shrink-0">
                      ${cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Average price callout */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <TrendingUp className="w-5 h-5 text-indigo-500 shrink-0" />
        <span className="text-sm text-indigo-700">
          Average unit price across all products: <strong>${avgPrice.toFixed(2)}</strong>
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: 'indigo' | 'emerald' | 'violet' | 'amber';
}) {
  const bg = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    violet: 'from-violet-500 to-violet-600',
    amber: 'from-amber-500 to-amber-600',
  }[color];
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${bg} text-white shadow-sm`}>
      <div className="text-[11px] font-medium opacity-80 mb-1">{label}</div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}
