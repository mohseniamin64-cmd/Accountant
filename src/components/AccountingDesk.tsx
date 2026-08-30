import React from 'react';
import { motion } from 'motion/react';
import { 
  Receipt, 
  ShoppingCart, 
  Package, 
  Users, 
  Landmark, 
  BarChart3, 
  Boxes,
  Cpu
} from 'lucide-react';
import { ActiveTab, Customer, Product, SaleRecord, PurchaseRecord, BankAccount, BOMFormula } from '../types';

interface AccountingDeskProps {
  setActiveTab: (tab: ActiveTab) => void;
  customers?: Customer[];
  products?: Product[];
  sales?: SaleRecord[];
  purchases?: PurchaseRecord[];
  bankAccounts?: BankAccount[];
  boms?: BOMFormula[];
}

export const AccountingDesk: React.FC<AccountingDeskProps> = ({
  setActiveTab,
  customers = [],
  products = [],
  sales = [],
  purchases = [],
  bankAccounts = [],
  boms = []
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-5xl mx-auto space-y-5 sm:space-y-6 p-4 sm:p-6 rounded-3xl bg-[#E9EDF3] border border-slate-300 shadow-xs select-none" 
      dir="rtl"
    >
      {/* 1. Header (Centered, Clean, Professional) */}
      <div className="text-center space-y-1 pb-1">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          داشبورد حسابداری و بازرگانی
        </h1>
        <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-lg mx-auto">
          نمای کلی عملیات مالی، خرید، فروش و موجودی کالا
        </p>
      </div>

      {/* 2. Four Stat Cards (Level 100 Tints, Symmetrical, Top Accent Bars) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        
        {/* فاکتورهای فروش */}
        <div className="bg-blue-100 hover:bg-blue-100/90 border border-blue-300 hover:border-blue-400 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-600" />
          <div className="w-10 h-10 rounded-xl bg-blue-200 text-blue-800 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {sales.length}
            </div>
            <div className="text-xs font-bold text-slate-700">
              فاکتورهای فروش
            </div>
          </div>
        </div>

        {/* فاکتورهای خرید */}
        <div className="bg-indigo-100 hover:bg-indigo-100/90 border border-indigo-300 hover:border-indigo-400 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-600" />
          <div className="w-10 h-10 rounded-xl bg-indigo-200 text-indigo-800 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {purchases.length}
            </div>
            <div className="text-xs font-bold text-slate-700">
              فاکتورهای خرید
            </div>
          </div>
        </div>

        {/* کالاهای تعریف‌شده */}
        <div className="bg-emerald-100 hover:bg-emerald-100/90 border border-emerald-300 hover:border-emerald-400 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-600" />
          <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {products.length}
            </div>
            <div className="text-xs font-bold text-slate-700">
              کالاهای تعریف‌شده
            </div>
          </div>
        </div>

        {/* طرف‌های حساب */}
        <div className="bg-amber-100 hover:bg-amber-100/90 border border-amber-300 hover:border-amber-400 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-600" />
          <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {customers.length}
            </div>
            <div className="text-xs font-bold text-slate-700">
              طرف‌های حساب
            </div>
          </div>
        </div>

      </div>

      {/* 3. Section: Quick Actions (عملیات سریع) - Inside dedicated blue-gray container */}
      <div className="bg-[#DCE6F2] border border-blue-300 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          <h2 className="text-xs sm:text-sm font-black text-slate-900">
            عملیات سریع
          </h2>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          
          {/* صدور فاکتور فروش */}
          <button
            type="button"
            onClick={() => setActiveTab('register_sale')}
            className="w-full bg-blue-200 hover:bg-blue-200/90 border border-blue-400 hover:border-blue-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm sm:text-base font-black text-slate-900">
                صدور فاکتور فروش
              </div>
              <div className="text-xs text-slate-700 font-medium">
                ثبت فروش کالا و شماره سریال
              </div>
            </div>
          </button>

          {/* ثبت فاکتور خرید */}
          <button
            type="button"
            onClick={() => setActiveTab('purchase_invoice')}
            className="w-full bg-indigo-200 hover:bg-indigo-200/90 border border-indigo-400 hover:border-indigo-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 group"
          >
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm sm:text-base font-black text-slate-900">
                ثبت فاکتور خرید
              </div>
              <div className="text-xs text-slate-700 font-medium">
                ثبت خرید و ورود کالا به انبار
              </div>
            </div>
          </button>

        </div>
      </div>

      {/* 4. Section: Management & Reports (مدیریت و گزارش‌ها) - Inside dedicated neutral container */}
      <div className="bg-[#DDE2E9] border border-slate-300 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <h2 className="text-xs sm:text-sm font-black text-slate-900">
            مدیریت و گزارش‌ها
          </h2>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          
          {/* مدیریت کالا و انبار */}
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className="bg-emerald-100 hover:bg-emerald-100/90 border border-emerald-300 hover:border-emerald-400 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-emerald-500" />
            <div className="w-9 h-9 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                مدیریت کالا و انبار
              </div>
              <div className="text-[11px] text-slate-700 font-medium">
                {products.length} قلم تعریف‌شده
              </div>
            </div>
          </button>

          {/* واحد تولید و فرمول ساخت (BOM) */}
          <button
            type="button"
            onClick={() => setActiveTab('production')}
            className="bg-blue-100 hover:bg-blue-100/90 border border-blue-300 hover:border-blue-400 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-blue-600" />
            <div className="w-9 h-9 rounded-xl bg-blue-200 text-blue-800 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                واحد تولید و BOM
              </div>
              <div className="text-[11px] text-slate-700 font-medium">
                {boms.length} فرمول ساخت
              </div>
            </div>
          </button>

          {/* طرف‌های حساب */}
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className="bg-amber-100 hover:bg-amber-100/90 border border-amber-300 hover:border-amber-400 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-amber-500" />
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                طرف‌های حساب
              </div>
              <div className="text-[11px] text-slate-700 font-medium">
                {customers.length} شخص و شرکت
              </div>
            </div>
          </button>

          {/* حساب‌های بانکی و پوز */}
          <button
            type="button"
            onClick={() => setActiveTab('bank_accounts')}
            className="bg-sky-100 hover:bg-sky-100/90 border border-sky-300 hover:border-sky-400 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-sky-500" />
            <div className="w-9 h-9 rounded-xl bg-sky-200 text-sky-800 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                حساب‌های بانکی و پوز
              </div>
              <div className="text-[11px] text-slate-700 font-medium">
                {bankAccounts.length} حساب فعال
              </div>
            </div>
          </button>

          {/* گزارش‌های مالی و تراز */}
          <button
            type="button"
            onClick={() => setActiveTab('accounting_reports')}
            className="bg-purple-100 hover:bg-purple-100/90 border border-purple-300 hover:border-purple-400 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-purple-500" />
            <div className="w-9 h-9 rounded-xl bg-purple-200 text-purple-800 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                گزارش‌های مالی و تراز
              </div>
              <div className="text-[11px] text-slate-700 font-medium">
                دفاتر، معین و ترازنامه
              </div>
            </div>
          </button>

        </div>
      </div>
    </motion.div>
  );
};
