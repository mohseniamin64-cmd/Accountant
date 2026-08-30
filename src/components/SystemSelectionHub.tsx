import React from 'react';
import { motion } from 'motion/react';
import { 
  Calculator, 
  ShieldCheck, 
  Receipt, 
  ShoppingBag, 
  Landmark, 
  Search, 
  Wrench, 
  CheckCircle2, 
  ArrowLeft
} from 'lucide-react';
import { ActiveTab, Customer, Product, WarrantyItem, BankAccount } from '../types';

interface SystemSelectionHubProps {
  onSelectSystem: (system: 'accounting' | 'services', defaultTab?: ActiveTab) => void;
  customers?: Customer[];
  products?: Product[];
  warrantyDb?: WarrantyItem[];
  sales?: any[];
  purchases?: any[];
  inventory?: any[];
  bankAccounts?: BankAccount[];
}

export const SystemSelectionHub: React.FC<SystemSelectionHubProps> = ({
  onSelectSystem
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="max-w-4xl mx-auto py-3 sm:py-6 space-y-4 sm:space-y-6 text-right select-none"
      dir="rtl"
    >
      {/* Top System Selection Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs text-center relative overflow-hidden">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
          انتخاب سامانه
        </h2>
      </div>

      {/* Two Primary System Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        
        {/* CARD 1: ACCOUNTING & COMMERCIAL SYSTEM */}
        <motion.div 
          whileHover={{ y: -2, transition: { duration: 0.15 } }}
          className="bg-white border-2 border-slate-200/90 hover:border-blue-500/70 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md hover:shadow-blue-500/5 transition-all flex flex-col justify-between h-full relative overflow-hidden"
        >
          {/* Subtle Top Accent */}
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />

          <div className="space-y-4">
            {/* Header & Icon */}
            <div className="flex flex-col items-center justify-center text-center space-y-2 pt-1">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Calculator className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  سامانه حسابداری و بازرگانی
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  مدیریت خرید، فروش، انبار و امور مالی
                </p>
              </div>
            </div>

            {/* 3 Core Features */}
            <div className="bg-slate-50/90 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
              <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                <li className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <span>فاکتورهای خرید و فروش</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <span>کالا، انبار و طرف‌حساب‌ها</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Landmark className="w-3.5 h-3.5" />
                  </div>
                  <span>دریافت، پرداخت و گزارش‌های مالی</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 sm:pt-5 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectSystem('accounting', 'accounting_dashboard')}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <span>ورود به سامانه حسابداری</span>
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>
        </motion.div>

        {/* CARD 2: AFTER-SALES SERVICE & WARRANTY SYSTEM */}
        <motion.div 
          whileHover={{ y: -2, transition: { duration: 0.15 } }}
          className="bg-white border-2 border-slate-200/90 hover:border-emerald-500/70 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md hover:shadow-emerald-500/5 transition-all flex flex-col justify-between h-full relative overflow-hidden"
        >
          {/* Subtle Top Accent */}
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-600" />

          <div className="space-y-4">
            {/* Header & Icon */}
            <div className="flex flex-col items-center justify-center text-center space-y-2 pt-1">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  سامانه خدمات پس از فروش و گارانتی
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  مدیریت پذیرش، تعمیر و تحویل دستگاه‌ها
                </p>
              </div>
            </div>

            {/* 3 Core Features */}
            <div className="bg-slate-50/90 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
              <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                <li className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <span>استعلام و پذیرش گارانتی</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <span>مدیریت صف تعمیرات</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span>تست نهایی، تسویه و تحویل</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 sm:pt-5 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectSystem('services', 'dashboard')}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <span>ورود به سامانه خدمات</span>
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
