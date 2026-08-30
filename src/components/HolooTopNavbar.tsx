import React from 'react';
import { 
  Coins, 
  ShoppingCart, 
  ShoppingBag, 
  Users, 
  Landmark, 
  FileText, 
  BarChart3, 
  Layers, 
  Receipt,
  PlusCircle,
  Cpu
} from 'lucide-react';
import { ActiveTab } from '../types';

interface HolooTopNavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalSalesCount?: number;
  totalProductsCount?: number;
  totalCustomersCount?: number;
}

export default function HolooTopNavbar({
  activeTab,
  setActiveTab,
  totalSalesCount = 0,
  totalProductsCount = 0,
  totalCustomersCount = 0
}: HolooTopNavbarProps) {
  const isAccountingTab = [
    'register_sale',
    'purchase_invoice',
    'products',
    'production',
    'customers',
    'bank_accounts',
    'sales_history',
    'purchase_history',
    'accounting_reports'
  ].includes(activeTab);

  if (!isAccountingTab) return null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs mb-4 text-right font-sans" dir="rtl">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        
        {/* Ribbon Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('register_sale')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'register_sale' || activeTab === 'purchase_invoice' || (activeTab as string) === 'invoices'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 font-black'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/70'
            }`}
          >
            <Coins className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="whitespace-nowrap">صدور فاکتورها (خرید، فروش، پیش‌فاکتور)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/70'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span className="whitespace-nowrap">مدیریت کالا</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('production')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'production'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/70'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0 text-blue-600" />
            <span className="whitespace-nowrap font-black">واحد تولید (BOM)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/70'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span className="whitespace-nowrap">طرف‌های حساب</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bank_accounts')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'bank_accounts'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/70'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 shrink-0 text-sky-500" />
            <span className="whitespace-nowrap">حساب‌های بانکی</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sales_history')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'sales_history' || activeTab === 'purchase_history'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/70'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-rose-500" />
            <span className="whitespace-nowrap">دفتر فاکتورها</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounting_reports')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              activeTab === 'accounting_reports'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 border-blue-200/70'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0 text-blue-600" />
            <span className="whitespace-nowrap font-black">گزارشات هلو</span>
          </button>
        </div>

        {/* System Badge */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 pr-2 border-r border-slate-100 text-[11px] text-slate-500 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>سامانه حسابداری فعال است</span>
        </div>
      </div>
    </div>
  );
}
