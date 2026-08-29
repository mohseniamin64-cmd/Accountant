import React from 'react';
import { motion } from 'motion/react';
import { 
  Calculator, 
  Coins, 
  ShoppingCart, 
  ShoppingBag, 
  Users, 
  Landmark, 
  FileText, 
  FileSpreadsheet, 
  BarChart3, 
  Layers, 
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Cpu
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
    <div className="relative min-h-[72vh] flex flex-col items-center justify-center text-center p-4 select-none overflow-hidden" dir="rtl">
      
      {/* ================= FAINT WATERMARK LOGO BACKGROUND ================= */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
        {/* Large Decorative Watermark Graphic with very faint opacity */}
        <div className="opacity-[0.035] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center transform scale-110 sm:scale-125 transition-all">
          <svg 
            className="w-96 h-96 sm:w-[32rem] sm:h-[32rem]" 
            viewBox="0 0 200 200" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Ring & Shield Shape */}
            <circle cx="100" cy="100" r="92" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="100" cy="100" r="82" stroke="currentColor" strokeWidth="1.5" />
            
            {/* Hexagonal Tech Core */}
            <polygon 
              points="100,28 162,64 162,136 100,172 38,136 38,64" 
              stroke="currentColor" 
              strokeWidth="2.5" 
            />
            
            {/* Electronic Circuit Traces */}
            <path d="M 100 45 L 100 80 M 100 120 L 100 155" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 55 72 L 80 88 M 120 112 L 145 128" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M 145 72 L 120 88 M 80 112 L 55 128" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            
            {/* Central Node Points */}
            <circle cx="100" cy="100" r="16" stroke="currentColor" strokeWidth="2" />
            <circle cx="100" cy="100" r="7" fill="currentColor" />
            
            <circle cx="100" cy="45" r="3.5" fill="currentColor" />
            <circle cx="100" cy="155" r="3.5" fill="currentColor" />
            <circle cx="55" cy="72" r="3.5" fill="currentColor" />
            <circle cx="145" cy="72" r="3.5" fill="currentColor" />
            <circle cx="55" cy="128" r="3.5" fill="currentColor" />
            <circle cx="145" cy="128" r="3.5" fill="currentColor" />

            {/* Typography Watermark Arc */}
            <text x="100" y="188" textAnchor="middle" fontSize="9" fontWeight="900" fill="currentColor" letterSpacing="3">
              DIACO ELECTRONICS
            </text>
          </svg>
          <span className="text-xl sm:text-2xl font-black tracking-widest mt-2 font-mono uppercase">
            DIACO ACCOUNTING SYSTEM
          </span>
        </div>
      </div>

      {/* ================= FOREGROUND CLEAN WORKSPACE CARD ================= */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 max-w-2xl w-full mx-auto space-y-6"
      >
        {/* Subtle Brand Badge & Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100/90 text-slate-700 border border-slate-200/80 rounded-full text-xs font-bold shadow-2xs">
            <Calculator className="w-3.5 h-3.5 text-blue-600" />
            <span>سامانه جامع حسابداری و بازرگانی</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            میز کار سامانه حسابداری دیاکو
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            جهت شروع، از منوی دسترسی‌های سمت راست یا کلیدهای میانبر زیر بخش مورد نظر خود را انتخاب فرمایید.
          </p>
        </div>

        {/* Minimal Clean Action Shortcuts - 15% larger with clear contrast */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 text-right max-w-2xl mx-auto pt-3">
          
          {/* 1. فاکتور فروش */}
          <button
            type="button"
            onClick={() => setActiveTab('register_sale')}
            className="p-4 sm:p-4.5 bg-white hover:bg-blue-50/40 border border-slate-300 hover:border-blue-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex flex-col justify-between min-h-[110px] sm:min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
              <Coins className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                صدور فاکتور فروش
              </div>
              <div className="text-[11px] text-slate-500 font-medium">ثبت و گارانتی سریال</div>
            </div>
          </button>

          {/* 2. فاکتور خرید */}
          <button
            type="button"
            onClick={() => setActiveTab('purchase_invoice')}
            className="p-4 sm:p-4.5 bg-white hover:bg-indigo-50/40 border border-slate-300 hover:border-indigo-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex flex-col justify-between min-h-[110px] sm:min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                صدور فاکتور خرید
              </div>
              <div className="text-[11px] text-slate-500 font-medium">ورود کالا به انبار</div>
            </div>
          </button>

          {/* 3. مدیریت کالا */}
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className="p-4 sm:p-4.5 bg-white hover:bg-emerald-50/40 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex flex-col justify-between min-h-[110px] sm:min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                مدیریت کالا و انبار
              </div>
              <div className="text-[11px] text-slate-500 font-medium">{products.length} قلم تعریف شده</div>
            </div>
          </button>

          {/* 4. طرف‌های حساب */}
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className="p-4 sm:p-4.5 bg-white hover:bg-amber-50/40 border border-slate-300 hover:border-amber-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex flex-col justify-between min-h-[110px] sm:min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                طرف‌های حساب
              </div>
              <div className="text-[11px] text-slate-500 font-medium">{customers.length} شخص و شرکت</div>
            </div>
          </button>

          {/* 5. حساب‌های بانکی */}
          <button
            type="button"
            onClick={() => setActiveTab('bank_accounts')}
            className="p-4 sm:p-4.5 bg-white hover:bg-sky-50/40 border border-slate-300 hover:border-sky-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex flex-col justify-between min-h-[110px] sm:min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors shadow-2xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-sky-700 transition-colors">
                حساب‌های بانکی و پوز
              </div>
              <div className="text-[11px] text-slate-500 font-medium">{bankAccounts.length} حساب فعال</div>
            </div>
          </button>

          {/* 6. گزارشات و تراز */}
          <button
            type="button"
            onClick={() => setActiveTab('accounting_reports')}
            className="p-4 sm:p-4.5 bg-white hover:bg-purple-50/40 border border-slate-300 hover:border-purple-500 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex flex-col justify-between min-h-[110px] sm:min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-2xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-purple-700 transition-colors">
                گزارشات هلو و تراز
              </div>
              <div className="text-[11px] text-slate-500 font-medium">سود و زیان و معین</div>
            </div>
          </button>

        </div>

        {/* Bottom Status / Footer info */}
        <div className="pt-4 text-center">
          <p className="text-[11px] font-mono text-slate-400 tracking-wider">
            DIACO ELECTRONICS • VERSION 1.0.0
          </p>
        </div>
      </motion.div>

    </div>
  );
};
