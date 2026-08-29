import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Users, 
  Landmark, 
  BookOpen, 
  Search, 
  Printer, 
  Download, 
  Filter, 
  Calendar, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  ShoppingBag, 
  ShoppingCart, 
  FileSpreadsheet,
  FileText,
  DollarSign,
  ChevronRight,
  Info
} from 'lucide-react';
import { SaleRecord, PurchaseRecord, Customer, Supplier, Product, BankAccount, InventoryItem } from '../types';

interface HolooAccountingReportsProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  bankAccounts: BankAccount[];
  inventory: InventoryItem[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: any) => void;
}

// Convert string/English numbers to Persian numbers
const toPersianDigits = (str: string | number) => {
  if (str === undefined || str === null) return '';
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

// Utility to format price to Persian Toman
const formatToPersianPrice = (value: number | string) => {
  if (!value) return '۰ تومان';
  const num = typeof value === 'string' ? parseInt(value.replace(/[^\d]/g, '')) : value;
  if (isNaN(num)) return '۰ تومان';
  return num.toLocaleString('fa-IR') + ' تومان';
};

export default function HolooAccountingReports({
  sales = [],
  purchases = [],
  customers = [],
  suppliers = [],
  products = [],
  bankAccounts = [],
  inventory = [],
  showToast,
  onNavigateTab
}: HolooAccountingReportsProps) {
  // Report Tab: 'sales_profit' | 'inventory_cardex' | 'party_ledger' | 'cash_bank' | 'daily_journal'
  const [reportTab, setReportTab] = useState<'sales_profit' | 'inventory_cardex' | 'party_ledger' | 'cash_bank' | 'daily_journal'>('sales_profit');
  
  // Date filters
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected party for ledger report
  const [selectedPartyId, setSelectedPartyId] = useState<string>(customers[0]?.id || '');
  const [cardexCategoryFilter, setCardexCategoryFilter] = useState<string>('all');
  const [cardexStockFilter, setCardexStockFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'cancelled') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInv = s.invoiceNumber?.toLowerCase().includes(q);
        const matchCust = s.customer?.name?.toLowerCase().includes(q) || s.customer?.phone?.includes(q);
        const matchItem = s.items?.some(i => i.product.name.toLowerCase().includes(q) || i.product.model.toLowerCase().includes(q));
        if (!matchInv && !matchCust && !matchItem) return false;
      }
      return true;
    });
  }, [sales, searchQuery]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (p.status === 'cancelled') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInv = p.invoiceNumber?.toLowerCase().includes(q);
        const matchSupp = p.supplier?.name?.toLowerCase().includes(q) || p.supplier?.phone?.includes(q);
        const matchItem = p.items?.some(i => i.product.name.toLowerCase().includes(q) || i.product.model.toLowerCase().includes(q));
        if (!matchInv && !matchSupp && !matchItem) return false;
      }
      return true;
    });
  }, [purchases, searchQuery]);

  // Financial Metrics
  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const itemsTotal = s.items.reduce((sum, item) => sum + (item.unitPrice * (item.serials?.length || 1)), 0);
      return acc + (itemsTotal - (s.discount || 0));
    }, 0);
  }, [filteredSales]);

  const totalPurchasesCost = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => acc + (p.totalPayable || 0), 0);
  }, [filteredPurchases]);

  const totalDiscountsGiven = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (s.discount || 0), 0);
  }, [filteredSales]);

  // Estimated gross profit
  const estimatedGrossProfit = useMemo(() => {
    let profit = 0;
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const count = item.serials?.length || 1;
        const salePrice = item.unitPrice;
        // find purchase price in inventory or product
        const matchedInv = inventory.find(inv => item.serials?.some(ser => ser.toUpperCase() === inv.serial?.toUpperCase()));
        const purchaseCost = matchedInv?.unitPurchasePrice || (salePrice * 0.75);
        profit += (salePrice - purchaseCost) * count;
      });
      profit -= (s.discount || 0);
    });
    return Math.max(0, profit);
  }, [filteredSales, inventory]);

  // Cardex Data Calculation for each product
  const cardexList = useMemo(() => {
    return products.map(prod => {
      // Total bought
      let totalBought = 0;
      let totalPurchaseCost = 0;
      purchases.forEach(p => {
        if (p.status !== 'cancelled') {
          p.items.forEach(item => {
            if (item.product.name === prod.name && item.product.model === prod.model) {
              totalBought += item.quantity || item.serials?.length || 0;
              totalPurchaseCost += (item.unitPurchasePrice * (item.quantity || 1));
            }
          });
        }
      });

      // Total sold
      let totalSold = 0;
      let totalSalesAmount = 0;
      sales.forEach(s => {
        if (s.status !== 'cancelled') {
          s.items.forEach(item => {
            if (item.product.name === prod.name && item.product.model === prod.model) {
              const count = item.serials?.length || 1;
              totalSold += count;
              totalSalesAmount += (item.unitPrice * count);
            }
          });
        }
      });

      const currentStock = Math.max(0, (prod.stock || 0) + totalBought - totalSold);
      const avgPurchasePrice = totalBought > 0 ? Math.round(totalPurchaseCost / totalBought) : (prod.price ? prod.price * 0.8 : 0);
      const salePrice = prod.price || (totalSold > 0 ? Math.round(totalSalesAmount / totalSold) : 0);
      const stockValue = currentStock * avgPurchasePrice;

      return {
        id: prod.id,
        code: prod.code || `P-${prod.id.slice(-4)}`,
        name: prod.name,
        model: prod.model || 'استاندارد',
        category: prod.category || 'کالای عمومی',
        totalBought,
        totalSold,
        currentStock,
        avgPurchasePrice,
        salePrice,
        stockValue,
        warrantyMonths: prod.warrantyMonths || 12
      };
    });
  }, [products, purchases, sales]);

  const filteredCardexList = useMemo(() => {
    return cardexList.filter(item => {
      if (cardexCategoryFilter !== 'all' && item.category !== cardexCategoryFilter) return false;
      if (cardexStockFilter === 'in_stock' && item.currentStock <= 0) return false;
      if (cardexStockFilter === 'low_stock' && item.currentStock > 3) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.model.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cardexList, cardexCategoryFilter, cardexStockFilter, searchQuery]);

  const totalInventoryStockValue = useMemo(() => {
    return cardexList.reduce((acc, item) => acc + item.stockValue, 0);
  }, [cardexList]);

  // Selected party for account statement / ledger
  const currentParty = useMemo(() => {
    return customers.find(c => c.id === selectedPartyId) || customers[0] || null;
  }, [customers, selectedPartyId]);

  const partyTransactions = useMemo(() => {
    if (!currentParty) return [];
    const txs: any[] = [];

    // Sales to this customer
    sales.forEach(s => {
      if (s.customer?.name === currentParty.name || s.customer?.phone === currentParty.phone) {
        const total = s.items.reduce((sum, i) => sum + (i.unitPrice * (i.serials?.length || 1)), 0) - (s.discount || 0);
        txs.push({
          id: `sale-${s.id}`,
          date: s.saleDate,
          type: 'فاکتور فروش',
          invoiceNo: s.invoiceNumber,
          description: `فروش ${toPersianDigits(s.items.length)} ردیف کالا`,
          debit: total, // بدهکار
          credit: 0,
          paymentMethod: s.paymentMethod || 'نقدی'
        });
      }
    });

    return txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [currentParty, sales]);

  const partySummary = useMemo(() => {
    const totalDebit = partyTransactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = partyTransactions.reduce((sum, t) => sum + t.credit, 0);
    const balance = (currentParty?.balance || 0) + totalDebit - totalCredit;
    return { totalDebit, totalCredit, balance };
  }, [partyTransactions, currentParty]);

  // Bank & Cash Balances
  const totalCashBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0);
  }, [bankAccounts]);

  // Daily Journal Entries (دفتر روزنامه)
  const journalEntries = useMemo(() => {
    const entries: any[] = [];
    let docCounter = 1001;

    // Sales to journal
    sales.forEach(s => {
      if (s.status !== 'cancelled') {
        const total = s.items.reduce((sum, i) => sum + (i.unitPrice * (i.serials?.length || 1)), 0) - (s.discount || 0);
        entries.push({
          docNo: `SN-${docCounter++}`,
          date: s.saleDate,
          type: 'فروش کالا',
          accountDebit: s.paymentMethod === 'pos' ? 'بانک / پوز' : (s.paymentMethod === 'cheque' ? 'اسناد دریافتنی' : 'صندوق نقد'),
          accountCredit: `درآمد فروش (${s.customer?.name || 'مشتری'})`,
          amount: total,
          notes: `فاکتور شماره ${s.invoiceNumber}`
        });
      }
    });

    // Purchases to journal
    purchases.forEach(p => {
      if (p.status !== 'cancelled') {
        entries.push({
          docNo: `SN-${docCounter++}`,
          date: p.purchaseDate,
          type: 'خرید کالا و انبار',
          accountDebit: 'موجودی کالا و انبار',
          accountCredit: p.paymentMethod === 'bank' ? 'بانک' : (p.paymentMethod === 'cheque' ? 'اسناد پرداختنی' : 'صندوق نقد'),
          amount: p.totalPayable || 0,
          notes: `فاکتور خرید ${p.invoiceNumber} (${p.supplier?.name})`
        });
      }
    });

    return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [sales, purchases]);

  // Print Report Handler
  const handlePrint = () => {
    window.print();
    showToast?.('دستور چاپ گزارش صادر شد', 'info');
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    
    if (reportTab === 'sales_profit') {
      csvContent += 'شماره فاکتور,تاریخ,خریدار,تلفن,مبلغ کل (تومان),تخفیف,روش پرداخت\n';
      filteredSales.forEach(s => {
        const total = s.items.reduce((sum, i) => sum + (i.unitPrice * (i.serials?.length || 1)), 0) - (s.discount || 0);
        csvContent += `"${s.invoiceNumber}","${s.saleDate}","${s.customer?.name}","${s.customer?.phone}","${total}","${s.discount || 0}","${s.paymentMethod || 'نقدی'}"\n`;
      });
    } else if (reportTab === 'inventory_cardex') {
      csvContent += 'کد کالا,نام کالا,مدل,دسته بندی,موجودی انبار,بهای خرید,قیمت فروش,ارزش موجودی\n';
      filteredCardexList.forEach(c => {
        csvContent += `"${c.code}","${c.name}","${c.model}","${c.category}","${c.currentStock}","${c.avgPurchasePrice}","${c.salePrice}","${c.stockValue}"\n`;
      });
    } else if (reportTab === 'daily_journal') {
      csvContent += 'شماره سند,تاریخ,نوع عملیات,حساب بدهکار,حساب بستانکار,مبلغ (تومان),شرح\n';
      journalEntries.forEach(j => {
        csvContent += `"${j.docNo}","${j.date}","${j.type}","${j.accountDebit}","${j.accountCredit}","${j.amount}","${j.notes}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `holoo_report_${reportTab}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('فایل اکسل با موفقیت دانلود شد', 'success');
  };

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      
      {/* 1. TOP HEADER & REPORT CATEGORIES - HOLOO STYLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  مرکز گزارشات مالی و حسابداری
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">
                  سیستم استاندارد هلو
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                تحلیل جامع عملکرد فروش، سود ناویژه، کاردکس انبار، صورت‌حساب اشخاص و اسناد حسابداری
              </p>
            </div>
          </div>

          {/* Action Buttons: Print & Excel */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="خروجی فایل اکسل (CSV)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="چاپ گزارش"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>چاپ گزارش</span>
            </button>
          </div>
        </div>

        {/* HOLOO REPORT TABS NAVIGATOR */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-3">
          <button
            onClick={() => setReportTab('sales_profit')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              reportTab === 'sales_profit'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="truncate">۱. فروش و سود ناویژه</span>
          </button>

          <button
            onClick={() => setReportTab('inventory_cardex')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              reportTab === 'inventory_cardex'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span className="truncate">۲. کاردکس و گردش کالا</span>
          </button>

          <button
            onClick={() => setReportTab('party_ledger')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              reportTab === 'party_ledger'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">۳. معین طرف‌حساب‌ها</span>
          </button>

          <button
            onClick={() => setReportTab('cash_bank')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              reportTab === 'cash_bank'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
            }`}
          >
            <Landmark className="w-4 h-4 shrink-0" />
            <span className="truncate">۴. صندوق و حساب‌های بانکی</span>
          </button>

          <button
            onClick={() => setReportTab('daily_journal')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border col-span-2 sm:col-span-1 ${
              reportTab === 'daily_journal'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">۵. دفتر روزنامه و اسناد</span>
          </button>
        </div>
      </div>

      {/* 2. REPORT TAB 1: SALES & PROFIT (فروش و سود و زیان) */}
      {reportTab === 'sales_profit' && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">مجموع درآمد ناخالص فروش</span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1 block">
                  {formatToPersianPrice(totalSalesRevenue)}
                </span>
                <span className="text-[10px] text-blue-600 font-bold mt-0.5 block">
                  از {toPersianDigits(filteredSales.length)} فاکتور ثبت‌شده
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">سود ناویژه برآوردی</span>
                <span className="text-base sm:text-lg font-black text-emerald-600 font-mono mt-1 block">
                  {formatToPersianPrice(estimatedGrossProfit)}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                  اختلاف فروش و بهای خرید
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">کل تخفیفات اعطایی</span>
                <span className="text-base sm:text-lg font-black text-amber-600 font-mono mt-1 block">
                  {formatToPersianPrice(totalDiscountsGiven)}
                </span>
                <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">
                  اعمال‌شده روی فاکتورها
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">مجموع بهای خرید و ورود</span>
                <span className="text-base sm:text-lg font-black text-indigo-600 font-mono mt-1 block">
                  {formatToPersianPrice(totalPurchasesCost)}
                </span>
                <span className="text-[10px] text-indigo-700 font-bold mt-0.5 block">
                  فاکتورهای خرید ثبت‌شده
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Header for Sales */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="جستجو در فاکتور، خریدار، شماره تماس..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-none transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            <div className="text-xs text-slate-500 font-bold">
              تعداد ردیف‌های گزارش: <span className="font-black text-slate-800 font-mono">{toPersianDigits(filteredSales.length)}</span> فاکتور
            </div>
          </div>

          {/* Structured Table for Sales */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 text-[11px] font-black">
                    <th className="py-3 px-3">ردیف</th>
                    <th className="py-3 px-3">شماره فاکتور</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">خریدار / طرف‌حساب</th>
                    <th className="py-3 px-3">اقلام فاکتور</th>
                    <th className="py-3 px-3">جمع ناخالص</th>
                    <th className="py-3 px-3">تخفیف</th>
                    <th className="py-3 px-3">مبلغ خالص دریافتی</th>
                    <th className="py-3 px-3">روش پرداخت</th>
                    <th className="py-3 px-3">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        فاکتور فروشی متناسب با فیلتر یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale, idx) => {
                      const itemsTotal = sale.items.reduce((sum, item) => sum + (item.unitPrice * (item.serials?.length || 1)), 0);
                      const netPayable = itemsTotal - (sale.discount || 0);

                      return (
                        <tr key={sale.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-blue-700">
                            {sale.invoiceNumber}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                            {toPersianDigits(sale.saleDate)}
                          </td>
                          <td className="py-3 px-3 font-black text-slate-900">
                            <div>{sale.customer?.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-normal">{toPersianDigits(sale.customer?.phone)}</div>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-600">
                            {toPersianDigits(sale.items.length)} ردیف ({toPersianDigits(sale.items.reduce((c, i) => c + (i.serials?.length || 1), 0))} عدد)
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            {formatToPersianPrice(itemsTotal)}
                          </td>
                          <td className="py-3 px-3 font-mono text-amber-600 text-[11px]">
                            {sale.discount ? formatToPersianPrice(sale.discount) : '۰'}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-emerald-700">
                            {formatToPersianPrice(netPayable)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200">
                              {sale.paymentMethod === 'pos' ? 'کارتخوان / پوز' : (sale.paymentMethod === 'cheque' ? 'چک' : (sale.paymentMethod === 'credit' ? 'نسیه' : 'نقدی'))}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>تسویه کامل</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                    <td colSpan={5} className="py-3 px-3 text-right">
                      سرجمع کل فاکتورهای فروش:
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-800">
                      {formatToPersianPrice(filteredSales.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.unitPrice * (item.serials?.length || 1)), 0), 0))}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-700">
                      {formatToPersianPrice(totalDiscountsGiven)}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-800 text-sm">
                      {formatToPersianPrice(totalSalesRevenue)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. REPORT TAB 2: INVENTORY CARDEX & WAREHOUSE (کاردکس و گردش کالا) */}
      {reportTab === 'inventory_cardex' && (
        <div className="space-y-4">
          {/* Cardex Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">ارزش ریالی کل موجودی انبار</span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1 block">
                  {formatToPersianPrice(totalInventoryStockValue)}
                </span>
                <span className="text-[10px] text-blue-600 font-bold mt-0.5 block">
                  بر مبنای بهای تمام‌شده خرید
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">تنوع اقلام تعریف‌شده</span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1 block">
                  {toPersianDigits(products.length)} کالا
                </span>
                <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                  ثبت‌شده در دیتابیس کالاها
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold block">کل موجودی فیزیکی آماده فروش</span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1 block">
                  {toPersianDigits(cardexList.reduce((acc, i) => acc + i.currentStock, 0))} عدد
                </span>
                <span className="text-[10px] text-indigo-600 font-bold mt-0.5 block">
                  آماده صدور فاکتور
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filters for Cardex */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="جستجوی نام کالا، کد، مدل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-none transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>

              <select
                value={cardexStockFilter}
                onChange={(e: any) => setCardexStockFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">همه وضعیت‌های موجودی</option>
                <option value="in_stock">فقط کالاهای موجود</option>
                <option value="low_stock">کالاهای رو به اتمام (زیر ۳ عدد)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-bold">
              تعداد اقلام کاردکس: <span className="font-black text-slate-800 font-mono">{toPersianDigits(filteredCardexList.length)}</span>
            </div>
          </div>

          {/* Structured Cardex Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 text-[11px] font-black">
                    <th className="py-3 px-3">کد کالا</th>
                    <th className="py-3 px-3">عنوان و مدل کالا</th>
                    <th className="py-3 px-3">دسته‌بندی</th>
                    <th className="py-3 px-3">ورودی خرید</th>
                    <th className="py-3 px-3">خروجی فروش</th>
                    <th className="py-3 px-3">موجودی انبار</th>
                    <th className="py-3 px-3">میانگین بهای خرید</th>
                    <th className="py-3 px-3">قیمت فروش</th>
                    <th className="py-3 px-3">ارزش ریالی موجودی</th>
                    <th className="py-3 px-3">وضعیت کالا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                  {filteredCardexList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        کالایی با مشخصات مورد نظر یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredCardexList.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-black text-blue-700 text-[11px]">
                          {item.code}
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{item.model}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {item.category}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-700">
                          {toPersianDigits(item.totalBought)} عدد
                        </td>
                        <td className="py-3 px-3 font-mono text-rose-600">
                          {toPersianDigits(item.totalSold)} عدد
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900 text-sm">
                          {toPersianDigits(item.currentStock)} عدد
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                          {formatToPersianPrice(item.avgPurchasePrice)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">
                          {formatToPersianPrice(item.salePrice)}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900">
                          {formatToPersianPrice(item.stockValue)}
                        </td>
                        <td className="py-3 px-3">
                          {item.currentStock > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                              موجود در انبار
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
                              عدم موجودی
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                    <td colSpan={5} className="py-3 px-3 text-right">
                      ارزش مجموع کل موجودی انبار:
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-900">
                      {toPersianDigits(filteredCardexList.reduce((acc, i) => acc + i.currentStock, 0))} عدد
                    </td>
                    <td colSpan={2}></td>
                    <td className="py-3 px-3 font-mono text-blue-800 text-sm">
                      {formatToPersianPrice(filteredCardexList.reduce((acc, i) => acc + i.stockValue, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. REPORT TAB 3: PARTY ACCOUNT STATEMENT / LEDGER (معین طرف‌حساب‌ها) */}
      {reportTab === 'party_ledger' && (
        <div className="space-y-4">
          {/* Party Selector & Profile Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-xs font-black text-slate-800">انتخاب طرف‌حساب جهت مشاهده صورت‌حساب معین:</span>
              </div>

              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-blue-500"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {toPersianDigits(c.phone)} ({c.type === 'representative' ? 'نماینده / همکار' : 'مشتری عادی'})
                  </option>
                ))}
              </select>
            </div>

            {currentParty && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[11px]">نام طرف‌حساب:</span>
                  <span className="font-black text-slate-900 mt-0.5 block">{currentParty.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[11px]">شماره تماس:</span>
                  <span className="font-black text-slate-900 font-mono mt-0.5 block">{toPersianDigits(currentParty.phone)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[11px]">کل حجم خرید:</span>
                  <span className="font-black text-blue-700 font-mono mt-0.5 block">{formatToPersianPrice(partySummary.totalDebit)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[11px]">وضعیت مانده حساب:</span>
                  <span className={`font-black font-mono mt-0.5 block ${
                    partySummary.balance > 0 ? 'text-rose-600' : (partySummary.balance < 0 ? 'text-emerald-600' : 'text-slate-600')
                  }`}>
                    {partySummary.balance === 0 ? 'تسویه کامل (بی‌حساب)' : (partySummary.balance > 0 ? `${formatToPersianPrice(partySummary.balance)} (بدهکار)` : `${formatToPersianPrice(Math.abs(partySummary.balance))} (بستانکار)`)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">
                ریز گردش تراکنش‌های {currentParty?.name || 'طرف‌حساب'}
              </span>
              <span className="text-[11px] text-slate-500 font-bold">
                تعداد اسناد: <span className="font-mono font-black text-slate-800">{toPersianDigits(partyTransactions.length)}</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-700 text-[11px] font-black">
                    <th className="py-3 px-3">ردیف</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">نوع سند / عملیات</th>
                    <th className="py-3 px-3">شماره سند</th>
                    <th className="py-3 px-3">شرح عملیات</th>
                    <th className="py-3 px-3">بدهکار (تومان)</th>
                    <th className="py-3 px-3">بستانکار (تومان)</th>
                    <th className="py-3 px-3">روش پرداخت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                  {partyTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        هیچ تراکنش یا فاکتوری برای این شخص ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    partyTransactions.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                          {toPersianDigits(tx.date)}
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900">
                          {tx.type}
                        </td>
                        <td className="py-3 px-3 font-mono text-blue-700 text-[11px]">
                          {tx.invoiceNo}
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-[11px]">
                          {tx.description}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-rose-600">
                          {tx.debit ? formatToPersianPrice(tx.debit) : '۰'}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-emerald-600">
                          {tx.credit ? formatToPersianPrice(tx.credit) : '۰'}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600">
                          {tx.paymentMethod}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                    <td colSpan={5} className="py-3 px-3 text-right">
                      سرجمع کل گردش حساب:
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-700">
                      {formatToPersianPrice(partySummary.totalDebit)}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-700">
                      {formatToPersianPrice(partySummary.totalCredit)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. REPORT TAB 4: CASH & BANK ACCOUNTS (صندوق و بانک‌ها) */}
      {reportTab === 'cash_bank' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-bold block">مجموع کل نقدینگی و موجودی بانک‌ها</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1 block">
                {formatToPersianPrice(totalCashBankBalance)}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                در {toPersianDigits(bankAccounts.length)} حساب بانکی و پوز تعریف‌شده
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
          </div>

          {/* Banks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bankAccounts.map((bank) => (
              <div key={bank.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                      {bank.bankName.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{bank.bankName}</h4>
                      <span className="text-[10px] text-slate-400 font-bold">{bank.accountHolder}</span>
                    </div>
                  </div>
                  {bank.posConnected && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg border border-emerald-200">
                      پوز فعال
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span className="text-[11px]">شماره حساب:</span>
                    <span className="font-mono font-bold text-slate-800">{toPersianDigits(bank.accountNumber)}</span>
                  </div>
                  {bank.cardNumber && (
                    <div className="flex justify-between text-slate-500">
                      <span className="text-[11px]">شماره کارت:</span>
                      <span className="font-mono font-bold text-slate-800">{toPersianDigits(bank.cardNumber)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="font-black text-slate-700 text-xs">موجودی فعلی:</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">{formatToPersianPrice(bank.balance)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. REPORT TAB 5: DAILY JOURNAL & ACCOUNTING ENTRIES (دفتر روزنامه و اسناد) */}
      {reportTab === 'daily_journal' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="جستجو در شماره سند، تاریخ، شرح رویداد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-none transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            <div className="text-xs text-slate-500 font-bold">
              تعداد اسناد روزنامه: <span className="font-black text-slate-800 font-mono">{toPersianDigits(journalEntries.length)}</span> سند
            </div>
          </div>

          {/* Structured Journal Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 text-[11px] font-black">
                    <th className="py-3 px-3">شماره سند</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">نوع عملیات</th>
                    <th className="py-3 px-3">حساب بدهکار</th>
                    <th className="py-3 px-3">حساب بستانکار</th>
                    <th className="py-3 px-3">مبلغ سند (تومان)</th>
                    <th className="py-3 px-3">شرح رویداد مالی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                  {journalEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        هیچ سند مالی در این بازه ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    journalEntries.map((j) => (
                      <tr key={j.docNo} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-black text-blue-700 text-[11px]">
                          {j.docNo}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                          {toPersianDigits(j.date)}
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900">
                          {j.type}
                        </td>
                        <td className="py-3 px-3 font-bold text-rose-700 text-[11px]">
                          {j.accountDebit}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700 text-[11px]">
                          {j.accountCredit}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900">
                          {formatToPersianPrice(j.amount)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-[11px]">
                          {j.notes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
