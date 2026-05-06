import { useEffect } from 'react';
import {
  Layers, History, Settings,
  Barcode, Printer, ChevronRight, Package,
  Zap, Shield, BarChart2, ListChecks,
} from 'lucide-react';
import { useBarcodeStore } from './store/barcodeStore';
import { loadProducts } from './data/mockProducts';
import GeneratorPanel from './components/GeneratorPanel';
import BatchPanel from './components/BatchPanel';
import HistoryPanel from './components/HistoryPanel';
import LabelSettingsPanel from './components/LabelSettingsPanel';
import PrinterSettingsPanel from './components/PrinterSettingsPanel';
import ItemManagementPanel from './components/ItemManagementPanel';
import ProductChartPanel from './components/ProductChartPanel';


const TABS = [
  {
    id: 'generator' as const,
    label: 'Generator',
    icon: Barcode,
    desc: 'Single label',
    color: 'indigo',
  },
  {
    id: 'batch' as const,
    label: 'Batch Print',
    icon: Layers,
    desc: 'Multiple products',
    color: 'violet',
  },
  {
    id: 'history' as const,
    label: 'History',
    icon: History,
    desc: 'Reprint labels',
    color: 'emerald',
  },
  {
    id: 'products' as const,
    label: 'Products',
    icon: ListChecks,
    desc: 'Add · edit · delete',
    color: 'cyan',
  },
  {
    id: 'chart' as const,
    label: 'Charts',
    icon: BarChart2,
    desc: 'Inventory analytics',
    color: 'amber',
  },
  {
    id: 'settings' as const,
    label: 'Settings',
    icon: Settings,
    desc: 'Label & printer',
    color: 'slate',
  },
] as const;

const PAGE_SUBTITLES: Record<string, string> = {
  generator: 'Generate barcodes & QR codes, preview and print labels',
  batch: 'Add multiple products and print all labels at once',
  history: 'View and reprint previously generated labels',
  products: 'Add, edit, and delete products in your inventory',
  chart: 'Visualise stock levels, pricing, and category distribution',
  settings: 'Configure label size, content, and printer settings',
};

export default function App() {
  const { activeTab, setActiveTab, labelHistory, batchItems, products, selectedPrinter } = useBarcodeStore();

  // Seed products on first load
  useEffect(() => {
    const allProducts = loadProducts();
    useBarcodeStore.setState({ products: allProducts });
  }, []);

  const tabBadge = (id: string) => {
    if (id === 'history') return labelHistory.length || null;
    if (id === 'batch') return batchItems.length || null;
    if (id === 'products') return products.length || null;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top Nav Bar ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-4 px-4 sm:px-6 h-14">
          {/* Logo / Module Name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Barcode className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 leading-tight truncate">
                Barcode & Label Generator
              </div>
              <div className="text-[10px] text-slate-400 leading-tight hidden sm:block">
                Garage Management System
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 ml-2">
            <span>GMS</span>
            <ChevronRight className="w-3 h-3" />
            <span>Inventory</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-indigo-600 font-medium">Barcode & Labels</span>
          </div>

          <div className="flex-1" />

          {/* Status indicators */}
          <div className="hidden sm:flex items-center gap-3">
            <StatusPill icon={<Package className="w-3 h-3" />} label={`${products.length} Products`} color="slate" />
            <StatusPill
              icon={<Printer className="w-3 h-3" />}
              label={selectedPrinter || 'No printer'}
              color={selectedPrinter ? 'emerald' : 'amber'}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* ── Sidebar Navigation ── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-slate-200 py-5 px-3 gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const badge = tabBadge(tab.id);
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group
                  ${active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors
                  ${active ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold leading-tight">{tab.label}</div>
                  <div className={`text-[11px] leading-tight ${active ? 'text-white/70' : 'text-slate-400'}`}>
                    {tab.desc}
                  </div>
                </div>
                {badge !== null && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                    ${active ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Sidebar footer */}
          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="px-3 py-2 flex flex-col gap-1.5">
              <FeatureTag icon={<Zap className="w-3 h-3" />} label="CODE128 / EAN13 / QR" />
              <FeatureTag icon={<Shield className="w-3 h-3" />} label="Billing compatible" />
              <FeatureTag icon={<Printer className="w-3 h-3" />} label="Native print support" />
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Mobile tab bar */}
          <div className="lg:hidden flex bg-white border-b border-slate-200 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const badge = tabBadge(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-[72px] flex flex-col items-center gap-0.5 py-2.5 px-2 border-b-2 transition-all
                    ${active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4" />
                    {badge !== null && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Page header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {TABS.find(t => t.id === activeTab)?.label}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {PAGE_SUBTITLES[activeTab]}
              </p>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 px-5 pb-8">
            {activeTab === 'generator' && <GeneratorPanel />}
            {activeTab === 'batch' && <BatchPanel />}
            {activeTab === 'history' && <HistoryPanel />}
            {activeTab === 'products' && <ItemManagementPanel />}
            {activeTab === 'chart' && <ProductChartPanel />}
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-600 mb-3">Label Configuration</h2>
                    <LabelSettingsPanel />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-600 mb-3">Printer Configuration</h2>
                    <PrinterSettingsPanel />
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-600 mb-3">System Utilities</h2>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>Garage Management System — Barcode & Label Generator Module</span>
            <span className="hidden sm:inline">v1.0.0</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>APIs: <code className="bg-slate-100 px-1 rounded">/api/barcode-label/*</code></span>
            <span>DB: Products table + label_settings</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatusPill({ icon, label, color }: {
  icon: React.ReactNode;
  label: string;
  color: 'slate' | 'emerald' | 'amber' | 'indigo';
}) {
  const colors = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors[color]} text-[11px] font-medium`}>
      {icon}
      <span className="max-w-[120px] truncate">{label}</span>
    </div>
  );
}

function FeatureTag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
      {icon}
      <span>{label}</span>
    </div>
  );
}
