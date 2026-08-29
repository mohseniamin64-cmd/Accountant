import React from 'react';
import { motion } from 'motion/react';
import { 
  Calculator, 
  ShieldCheck, 
  Coins, 
  ShoppingCart, 
  ShoppingBag, 
  Users, 
  FileText, 
  Landmark, 
  Wrench, 
  Search, 
  PlusCircle, 
  Activity, 
  ArrowLeft, 
  CheckCircle2, 
  Database, 
  Sparkles, 
  Layers, 
  Cpu,
  PackageCheck,
  TrendingUp,
  Clock,
  BarChart3
} from 'lucide-react';
import { ActiveTab, SystemModule, Customer, Product, WarrantyItem, SaleRecord, PurchaseRecord, InventoryItem, BankAccount } from '../types';

interface SystemSelectionHubProps {
  onSelectSystem: (system: 'accounting' | 'services', defaultTab?: ActiveTab) => void;
  customers: Customer[];
  products: Product[];
  warrantyDb: WarrantyItem[];
  sales: any[];
  purchases: any[];
  inventory: any[];
  bankAccounts?: BankAccount[];
}

export const SystemSelectionHub: React.FC<SystemSelectionHubProps> = ({
  onSelectSystem,
  customers,
  products,
  warrantyDb,
  sales,
  purchases,
  inventory,
  bankAccounts = []
}) => {
  // Compute summary metrics from unified shared database
  const totalCustomers = customers.length;
  const totalProducts = products.length;
  const totalInStock = inventory.filter(i => i.status === 'available').length;
  const totalSales = sales.length;
  const totalPurchases = purchases.length;
  const activeRepairs = warrantyDb.filter(w => w.status === 'under_repair' || w.status === 'pending').length;
  const completedRepairs = warrantyDb.filter(w => w.status === 'replaced' || w.status === 'active').length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="relative max-w-5xl mx-auto py-4 sm:py-8 space-y-6 sm:space-y-8 text-right select-none"
      dir="rtl"
    >
      {/* Faint Background Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden opacity-[0.03]">
        <svg 
          className="w-[28rem] h-[28rem] sm:w-[36rem] sm:h-[36rem] text-slate-900" 
          viewBox="0 0 200 200" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="100" cy="100" r="92" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="100" cy="100" r="82" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="100,28 162,64 162,136 100,172 38,136 38,64" stroke="currentColor" strokeWidth="2.5" />
          <path d="M 100 45 L 100 80 M 100 120 L 100 155" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M 55 72 L 80 88 M 120 112 L 145 128" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M 145 72 L 120 88 M 80 112 L 55 128" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="100" cy="100" r="16" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="7" fill="currentColor" />
        </svg>
      </div>

      {/* Top Welcome & System Identification Banner */}
      <div className="relative z-10 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden text-center">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight text-center">
            سامانه حسابداری و خدمات پس از فروش
          </h2>
        </div>
      </div>

      {/* TWO PRIMARY INTERACTIVE SYSTEM CARDS */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
        
        {/* CARD 1: ACCOUNTING & COMMERCIAL SYSTEM */}
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-white border-2 border-slate-200/90 hover:border-blue-500/80 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-xl hover:shadow-blue-500/10 transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden"
          onClick={() => onSelectSystem('accounting', 'accounting_dashboard')}
        >
          {/* Subtle top decoration */}
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 opacity-80" />

          <div className="space-y-5">
            {/* Header & Big Icon - Centered */}
            <div className="flex flex-col items-center justify-center gap-3 pt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Calculator className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors text-center">
                سامانه حسابداری و بازرگانی
              </h3>
            </div>

            {/* Feature Sub-list */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <span>صدور فاکتورها (خرید، فروش، پیش‌فاکتور)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span>مدیریت کالا و انبار</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>طرف‌های حساب و اشخاص</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <span>حساب‌های بانکی و چک</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span>دفتر سوابق فاکتورها</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span>گزارشات هلو و سود</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">طرف‌حساب‌ها</span>
                <span className="text-xs font-black text-slate-800 font-mono">{totalCustomers}</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">کالاهای انبار</span>
                <span className="text-xs font-black text-slate-800 font-mono">{totalInStock}</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">فاکتورهای فروش</span>
                <span className="text-xs font-black text-slate-800 font-mono">{totalSales}</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-6 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSystem('accounting', 'accounting_dashboard');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:shadow-lg"
            >
              <span>ورود به سامانه حسابداری</span>
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>
        </motion.div>

        {/* CARD 2: AFTER-SALES SERVICE & WARRANTY SYSTEM */}
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-white border-2 border-slate-200/90 hover:border-emerald-500/80 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-xl hover:shadow-emerald-500/10 transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden"
          onClick={() => onSelectSystem('services', 'dashboard')}
        >
          {/* Subtle top decoration */}
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 opacity-80" />

          <div className="space-y-5">
            {/* Header & Big Icon - Centered */}
            <div className="flex flex-col items-center justify-center gap-3 pt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors text-center">
                سامانه خدمات پس از فروش و گارانتی
              </h3>
            </div>

            {/* Feature Sub-list */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span>میز کار اصلی کارگاه</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <span>استعلام سریع گارانتی</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <span>پذیرش دستگاه و ثبت عیب</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <span>صف تعمیرات و تکنسین‌ها</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <span>تست نهایی کیفیت (QC)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>تحویل و پرونده فنی دستگاه</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">کل پرونده‌ها</span>
                <span className="text-xs font-black text-slate-800 font-mono">{warrantyDb.length}</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">در صف تعمیر</span>
                <span className="text-xs font-black text-amber-600 font-mono">{activeRepairs}</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">تعمیر و تحویل شده</span>
                <span className="text-xs font-black text-emerald-600 font-mono">{completedRepairs}</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-6 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSystem('services', 'dashboard');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:shadow-lg"
            >
              <span>ورود به سامانه خدمات و گارانتی</span>
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
