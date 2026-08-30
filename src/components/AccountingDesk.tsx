import React from 'react';
import { motion } from 'motion/react';
import { 
  Receipt, 
  ShoppingCart, 
  Package, 
  Users, 
  Landmark, 
  BarChart3, 
  Boxes
} from 'lucide-react';
import { ActiveTab, Customer, Product, SaleRecord, PurchaseRecord, BankAccount } from '../types';

interface AccountingDeskProps {
  setActiveTab: (tab: ActiveTab) => void;
  customers?: Customer[];
  products?: Product[];
  sales?: SaleRecord[];
  purchases?: PurchaseRecord[];
  bankAccounts?: BankAccount[];
}

export const AccountingDesk: React.FC<AccountingDeskProps> = ({
  setActiveTab,
  customers = [],
  products = [],
  sales = [],
  purchases = [],
  bankAccounts = []
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-5xl mx-auto space-y-5 sm:space-y-6 p-4 sm:p-6 rounded-3xl bg-[#F5F7FA] border border-slate-200/80 shadow-xs select-none" 
      dir="rtl"
    >
      {/* 1. Header (Centered, Clean, Professional) */}
      <div className="text-center space-y-1 pb-1">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          داشبورد حسابداری و بازرگانی
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-lg mx-auto">
          نمای کلی عملیات مالی، خرید، فروش و موجودی کالا
        </p>
      </div>

      {/* 2. Four Small Stat Cards (Centered, Symmetrical, Top Accent Bars) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        
        {/* فاکتورهای فروش */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-500" />
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {sales.length}
            </div>
            <div className="text-xs font-bold text-slate-600">
              فاکتورهای فروش
            </div>
          </div>
        </div>

        {/* فاکتورهای خرید */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-500" />
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {purchases.length}
            </div>
            <div className="text-xs font-bold text-slate-600">
              فاکتورهای خرید
            </div>
          </div>
        </div>

        {/* کالاهای تعریف‌شده */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {products.length}
            </div>
            <div className="text-xs font-bold text-slate-600">
              کالاهای تعریف‌شده
            </div>
          </div>
        </div>

        {/* طرف‌های حساب */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all space-y-2.5 min-h-[120px] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {customers.length}
            </div>
            <div className="text-xs font-bold text-slate-600">
              طرف‌های حساب
            </div>
          </div>
        </div>

      </div>

      {/* 3. Section: Quick Actions (عملیات سریع) - Inside dedicated blue-tinted container */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <h2 className="text-xs sm:text-sm font-black text-slate-900">
            عملیات سریع
          </h2>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          
          {/* صدور فاکتور فروش */}
          <button
            type="button"
            onClick={() => setActiveTab('register_sale')}
            className="w-full bg-blue-50/90 hover:bg-blue-100/70 border border-blue-200 hover:border-blue-300 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm sm:text-base font-black text-slate-900">
                صدور فاکتور فروش
              </div>
              <div className="text-xs text-slate-600 font-medium">
                ثبت فروش کالا و شماره سریال
              </div>
            </div>
          </button>

          {/* ثبت فاکتور خرید */}
          <button
            type="button"
            onClick={() => setActiveTab('purchase_invoice')}
            className="w-full bg-indigo-50/90 hover:bg-indigo-100/70 border border-indigo-200 hover:border-indigo-300 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 group"
          >
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm sm:text-base font-black text-slate-900">
                ثبت فاکتور خرید
              </div>
              <div className="text-xs text-slate-600 font-medium">
                ثبت خرید و ورود کالا به انبار
              </div>
            </div>
          </button>

        </div>
      </div>

      {/* 4. Section: Management & Reports (مدیریت و گزارش‌ها) - Inside dedicated neutral container */}
      <div className="bg-slate-100/60 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          <h2 className="text-xs sm:text-sm font-black text-slate-900">
            مدیریت و گزارش‌ها
          </h2>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          
          {/* مدیریت کالا و انبار */}
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-emerald-500" />
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                مدیریت کالا و انبار
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                {products.length} قلم تعریف‌شده
              </div>
            </div>
          </button>

          {/* طرف‌های حساب */}
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-amber-500" />
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                طرف‌های حساب
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                {customers.length} شخص و شرکت
              </div>
            </div>
          </button>

          {/* حساب‌های بانکی و پوز */}
          <button
            type="button"
            onClick={() => setActiveTab('bank_accounts')}
            className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-sky-500" />
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                حساب‌های بانکی و پوز
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                {bankAccounts.length} حساب فعال
              </div>
            </div>
          </button>

          {/* گزارش‌های مالی و تراز */}
          <button
            type="button"
            onClick={() => setActiveTab('accounting_reports')}
            className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[118px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-purple-500" />
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                گزارش‌های مالی و تراز
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                دفاتر، معین و ترازنامه
              </div>
            </div>
          </button>

        </div>
      </div>
    </motion.div>
  );
};
