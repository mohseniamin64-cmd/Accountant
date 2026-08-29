import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Coins, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  X, 
  ShoppingBag, 
  Printer,
  ChevronDown
} from 'lucide-react';
import { WarrantyItem, SaleRecord, SaleItem } from '../types';
import { P016SalesActions } from './P016SalesActions';

interface P016SalesHistoryProps {
  sales: SaleRecord[];
  warrantyDb: WarrantyItem[];
  setSales: React.Dispatch<React.SetStateAction<any[]>>;
  setWarrantyDb: React.Dispatch<React.SetStateAction<WarrantyItem[]>>;
  onReturn?: () => void;
  onSearchSerial?: (serial: string) => void;
}

// Utility to format price to Persian Toman
const formatToPersianPrice = (value: number | string) => {
  if (!value) return '۰ تومان';
  const num = typeof value === 'string' ? parseInt(value.replace(/[^\d]/g, '')) : value;
  if (isNaN(num)) return '۰ تومان';
  return num.toLocaleString('fa-IR') + ' تومان';
};

// Convert string/English numbers to Persian numbers
const toPersianDigits = (str: string | number) => {
  if (str === undefined || str === null) return '';
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

export default function P016SalesHistory({ 
  sales = [], 
  warrantyDb = [], 
  setSales,
  setWarrantyDb,
  onReturn,
  onSearchSerial 
}: P016SalesHistoryProps) {
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Filter states
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterProductCategory, setFilterProductCategory] = useState<string>('all');
  const [filterCustomerType, setFilterCustomerType] = useState<string>('all');
  const [filterSaleStatus, setFilterSaleStatus] = useState<string>('all');

  // Selected Sale Details Modal
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [modalView, setModalView] = useState<'details' | 'edit' | 'cancel' | 'return'>('details');

  // Derive unique categories for the filter
  const categories = Array.from(
    new Set(
      sales.flatMap(s => s.items.map(i => i.product.category || 'سایر'))
    )
  );

  // Helper to check the general warranty/history status of a specific serial in db
  const getSerialWarrantyInfo = (serial: string) => {
    const found = warrantyDb.find(w => w.serial.toUpperCase() === serial.toUpperCase());
    return found || { status: 'active', expiryDate: 'نامشخص', registeredAt: 'نامشخص' };
  };

  // Helper to determine the comprehensive invoice-level status
  const getInvoiceStatus = (sale: SaleRecord): 'active' | 'cancelled' | 'partially_returned' | 'fully_returned' => {
    if (sale.status === 'cancelled') {
      return 'cancelled';
    }
    const returns = sale.returns || [];
    if (returns.length === 0) {
      return 'active';
    }
    
    const allSerials = sale.items.flatMap(item => item.serials);
    const returnedSerials = returns.map(r => r.serial.toUpperCase());
    
    const allReturned = allSerials.every(s => returnedSerials.includes(s.toUpperCase()));
    if (allReturned) {
      return 'fully_returned';
    }
    return 'partially_returned';
  };

  // Calculates financial active items and actual net sales amount
  const getSaleMetrics = (sale: SaleRecord) => {
    const status = getInvoiceStatus(sale);
    if (status === 'cancelled') {
      return { activeItemsCount: 0, saleAmount: 0 };
    }
    
    const returns = sale.returns || [];
    const returnedSerials = returns.map(r => r.serial.toUpperCase());
    
    let activeItemsCount = 0;
    let subTotal = 0;
    
    sale.items.forEach(item => {
      const activeSerials = item.serials.filter(s => !returnedSerials.includes(s.toUpperCase()));
      activeItemsCount += activeSerials.length;
      subTotal += activeSerials.length * item.unitPrice;
    });
    
    const finalAmount = activeItemsCount === 0 ? 0 : Math.max(0, subTotal - (sale.discount || 0));
    return {
      activeItemsCount,
      saleAmount: finalAmount
    };
  };

  // Build the list of rows (flat map invoices to item levels)
  const saleRows = sales.flatMap(sale => {
    const invoiceStatus = getInvoiceStatus(sale);
    return sale.items.map((item, itemIdx) => {
      const returns = sale.returns || [];
      const returnedSerials = returns.map(r => r.serial.toUpperCase());
      const activeSerials = item.serials.filter(s => !returnedSerials.includes(s.toUpperCase()));
      
      const quantity = item.serials.length;
      const activeQuantity = activeSerials.length;
      const returnedQuantity = quantity - activeQuantity;

      // Pricing is based on non-returned items
      const totalAmount = invoiceStatus === 'cancelled' ? 0 : activeQuantity * item.unitPrice;

      return {
        key: `${sale.id}-${item.product.model}-${itemIdx}`,
        sale,
        item,
        quantity,
        activeQuantity,
        returnedQuantity,
        totalAmount,
        invoiceStatus
      };
    });
  });

  // Apply Search and Filters
  const filteredRows = saleRows.filter(row => {
    // 1. Search filter
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query ? true : (
      row.sale.customer.name.toLowerCase().includes(query) ||
      row.sale.customer.phone.includes(query) ||
      row.sale.invoiceNumber.toLowerCase().includes(query) ||
      row.item.product.name.toLowerCase().includes(query) ||
      row.item.product.model.toLowerCase().includes(query) ||
      row.item.serials.some(s => s.toLowerCase().includes(query))
    );

    // 2. Customer Type filter
    const matchesCustomerType = filterCustomerType === 'all' ? true : (
      row.sale.customer.type === filterCustomerType
    );

    // 3. Product Category filter
    const matchesCategory = filterProductCategory === 'all' ? true : (
      (row.item.product.category || 'سایر') === filterProductCategory
    );

    // 4. Invoice Status filter
    const matchesStatus = filterSaleStatus === 'all' ? true : (
      row.invoiceStatus === filterSaleStatus
    );

    // 5. Date Range filters
    const matchesStartDate = !filterStartDate ? true : row.sale.saleDate >= filterStartDate;
    const matchesEndDate = !filterEndDate ? true : row.sale.saleDate <= filterEndDate;

    return matchesSearch && matchesCustomerType && matchesCategory && matchesStatus && matchesStartDate && matchesEndDate;
  });

  // --- STATS CALCULATIONS ---
  // Exclude cancelled and fully returned invoices from stats
  const allInvoicesCount = sales.length;
  const metricsList = sales.map(s => getSaleMetrics(s));
  const totalNetSalesRevenue = metricsList.reduce((sum, m) => sum + m.saleAmount, 0);
  const totalActiveWarrantyDevices = metricsList.reduce((sum, m) => sum + m.activeItemsCount, 0);

  // Helper render for invoice status badge
  const renderInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>لغوشده</span>
          </span>
        );
      case 'partially_returned':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>برگشت جزئی</span>
          </span>
        );
      case 'fully_returned':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>برگشت کامل</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>فروش قطعی</span>
          </span>
        );
    }
  };

  // Helper render for general serial status in repairs
  const renderWarrantyStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200/50 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
            <Clock className="w-2.5 h-2.5" />
            <span>پذیرش تعمیر</span>
          </span>
        );
      case 'under_repair':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200/50 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
            <Clock className="w-2.5 h-2.5 animate-pulse" />
            <span>تحت تعمیر</span>
          </span>
        );
      case 'replaced':
        return (
          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-600 border border-teal-200/50 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
            <CheckCircle className="w-2.5 h-2.5" />
            <span>تعویض گارانتی</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200/50 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
            <CheckCircle className="w-2.5 h-2.5" />
            <span>گارانتی معتبر</span>
          </span>
        );
    }
  };

  // --- ACTIONS HANDLERS ---
  const handleOpenSaleDetails = (sale: SaleRecord) => {
    setSelectedSale(sale);
    setModalView('details');
  };

  const handleSaveEdit = (updatedSale: SaleRecord) => {
    // 1. Update sales
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));

    // 2. Synchronize warrantyDb for modified/added/removed serials
    setWarrantyDb(prevDb => {
      // Collect new serial keys
      const newSerialsMap = new Map<string, { itemName: string; expiry: string; date: string }>();
      updatedSale.items.forEach(item => {
        const duration = parseInt(item.product.warrantyDuration) || 12;
        // Replicate expiry date calculation
        const calculatePersianExpiry = (startDate: string, durationMonths: number): string => {
          const persianToEnglish = (str: string) => str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
          const englishToPersian = (str: string) => str.replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
          const normalized = persianToEnglish(startDate);
          const parts = normalized.split('/');
          if (parts.length !== 3) return englishToPersian('۱۴۰۷/۰۴/۰۷');
          let year = parseInt(parts[0]);
          let month = parseInt(parts[1]);
          let day = parseInt(parts[2]);
          if (isNaN(year) || isNaN(month) || isNaN(day)) return englishToPersian('۱۴۰۷/۰۴/۰۷');
          month += durationMonths;
          while (month > 12) {
            month -= 12;
            year += 1;
          }
          const monthStr = month < 10 ? `0${month}` : `${month}`;
          const dayStr = day < 10 ? `0${day}` : `${day}`;
          return englishToPersian(`${year}/${monthStr}/${dayStr}`);
        };

        const calculatedExpiry = calculatePersianExpiry(updatedSale.saleDate, duration);
        item.serials.forEach(s => {
          newSerialsMap.set(s.toUpperCase(), {
            itemName: `${item.product.name} (${item.product.model})`,
            expiry: calculatedExpiry,
            date: updatedSale.saleDate
          });
        });
      });

      // Find deleted serials (present in old but not in new)
      const oldSerials = selectedSale!.items.flatMap(i => i.serials.map(s => s.toUpperCase()));
      const newSerials = Array.from(newSerialsMap.keys());
      const deletedSerials = oldSerials.filter(s => !newSerials.includes(s));

      // Remove deleted serials from database
      let filteredDb = prevDb.filter(w => !deletedSerials.includes(w.serial.toUpperCase()));

      // Update remaining serials with modified customer and product details
      filteredDb = filteredDb.map(w => {
        const props = newSerialsMap.get(w.serial.toUpperCase());
        if (props) {
          return {
            ...w,
            itemName: props.itemName,
            customerName: updatedSale.customer.name,
            customerPhone: updatedSale.customer.phone,
            registeredAt: props.date,
            expiryDate: props.expiry
          };
        }
        return w;
      });

      // Insert completely new serials
      newSerials.forEach(serial => {
        const exists = prevDb.some(w => w.serial.toUpperCase() === serial);
        if (!exists) {
          const props = newSerialsMap.get(serial)!;
          filteredDb.unshift({
            serial,
            itemName: props.itemName,
            customerName: updatedSale.customer.name,
            customerPhone: updatedSale.customer.phone,
            defectType: '',
            status: 'active',
            expiryDate: props.expiry,
            registeredAt: props.date,
            statusNotes: `فعالسازی خودکار به دنبال ویرایش فاکتور ${updatedSale.invoiceNumber}`
          });
        }
      });

      return filteredDb;
    });

    // Refresh modal states
    setSelectedSale(updatedSale);
    setModalView('details');
    alert('فاکتور با موفقیت اصلاح شد و اطلاعات گارانتی همگام‌سازی گردید.');
  };

  const handleConfirmCancel = (cancelInfo: { reason: string; date: string; notes: string }) => {
    // 1. Update sales list
    const updatedSale: SaleRecord = {
      ...selectedSale!,
      status: 'cancelled',
      cancelReason: cancelInfo.reason,
      cancelDate: cancelInfo.date,
      cancelNotes: cancelInfo.notes
    };
    setSales(prev => prev.map(s => s.id === selectedSale!.id ? updatedSale : s));

    // 2. Void all warranties associated with this sale
    setWarrantyDb(prevDb => {
      const invoiceSerials = selectedSale!.items.flatMap(i => i.serials.map(s => s.toUpperCase()));
      return prevDb.map(w => {
        if (invoiceSerials.includes(w.serial.toUpperCase())) {
          return {
            ...w,
            status: 'rejected',
            warrantyStatus: 'باطل‌شده به علت لغو فروش',
            statusNotes: `ابطال گارانتی به دلیل لغو کامل فاکتور فروش در تاریخ ${cancelInfo.date}. علت: ${cancelInfo.reason}. ${cancelInfo.notes}`
          };
        }
        return w;
      });
    });

    setSelectedSale(updatedSale);
  };

  const handleConfirmReturn = (returnInfo: {
    serials: string[];
    date: string;
    reason: string;
    notes: string;
    refundAmount: number;
    refundStatus: 'paid' | 'unpaid';
  }) => {
    // 1. Create return items logs
    const newReturns = returnInfo.serials.map(s => ({
      serial: s,
      returnDate: returnInfo.date,
      returnReason: returnInfo.reason,
      notes: returnInfo.notes,
      refundAmount: returnInfo.refundAmount / returnInfo.serials.length,
      refundStatus: returnInfo.refundStatus
    }));

    const existingReturns = selectedSale!.returns || [];
    const updatedSale: SaleRecord = {
      ...selectedSale!,
      returns: [...existingReturns, ...newReturns]
    };

    // 2. Update sales
    setSales(prev => prev.map(s => s.id === selectedSale!.id ? updatedSale : s));

    // 3. Void warranty of returned serials
    setWarrantyDb(prevDb => {
      const returnedKeys = returnInfo.serials.map(s => s.toUpperCase());
      return prevDb.map(w => {
        if (returnedKeys.includes(w.serial.toUpperCase())) {
          return {
            ...w,
            status: 'rejected',
            warrantyStatus: 'باطل‌شده به علت برگشت از فروش',
            statusNotes: `برگشت از فروش کالا در تاریخ ${returnInfo.date}. دلیل مرجوعی: ${returnInfo.reason}. ${returnInfo.notes}`
          };
        }
        return w;
      });
    });

    setSelectedSale(updatedSale);
  };

  return (
    <div className="space-y-4 text-right relative" dir="rtl">
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-slate-200/50 pb-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
            <FileText className="text-blue-600 w-5 h-5" />
            <span>سوابق و بایگانی فروش دیاکو (P016)</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold">بایگانی فاکتورها، ویرایش طرف حساب، لغو فاکتور و ثبت مرجوعی کالاها</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1 text-center">
            <span className="text-[9px] text-slate-400 font-black block">کل فاکتورهای صادره</span>
            <span className="text-sm font-black font-mono text-slate-800">{toPersianDigits(allInvoicesCount)}</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-1 text-center">
            <span className="text-[9px] text-blue-600 font-black block">جمع فروش قطعی</span>
            <span className="text-sm font-black font-mono text-blue-800">{formatToPersianPrice(totalNetSalesRevenue)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1 text-center">
            <span className="text-[9px] text-emerald-600 font-black block">دستگاه‌های معتبر گارانتی</span>
            <span className="text-sm font-black font-mono text-emerald-800">{toPersianDigits(totalActiveWarrantyDevices)}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Controls */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در نام خریدار، شماره تماس، شماره فاکتور، مدل کالا، شماره سریال..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 bg-white border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showFilters ? 'border-blue-500 text-blue-600 bg-blue-50/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>فیلترهای پیشرفته</span>
          </button>

          {onReturn && (
            <button
              type="button"
              onClick={onReturn}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shrink-0"
            >
              فاکتور فروش جدید
            </button>
          )}
        </div>

        {/* Extended Filters Panel */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3"
          >
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 block">نوع طرف حساب</label>
              <select
                value={filterCustomerType}
                onChange={(e) => setFilterCustomerType(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold cursor-pointer"
              >
                <option value="all">همه (طرف حساب)</option>
                <option value="person">حقیقی / مصرف‌کننده</option>
                <option value="representative">نمایندگی / همکار</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 block">دسته‌بندی کالا</label>
              <select
                value={filterProductCategory}
                onChange={(e) => setFilterProductCategory(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold cursor-pointer"
              >
                <option value="all">همه گروه‌ها</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 block">وضعیت فاکتور</label>
              <select
                value={filterSaleStatus}
                onChange={(e) => setFilterSaleStatus(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold cursor-pointer"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="active">فروش قطعی</option>
                <option value="cancelled">لغوشده</option>
                <option value="partially_returned">برگشت جزئی</option>
                <option value="fully_returned">برگشت کامل</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 block">از تاریخ فروش</label>
              <input
                type="text"
                placeholder="۱۴۰۵/۰۱/۰۱"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold text-center font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 block">تا تاریخ فروش</label>
              <input
                type="text"
                placeholder="۱۴۰۵/۱۲/۲۹"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-[11px] font-bold text-center font-mono"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Records Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200/50">
                <th className="p-3">شماره فاکتور</th>
                <th className="p-3">تاریخ فروش</th>
                <th className="p-3">خریدار</th>
                <th className="p-3">شماره تماس</th>
                <th className="p-3">کالا و مدل</th>
                <th className="p-3 text-center">تعداد</th>
                <th className="p-3">قیمت واحد</th>
                <th className="p-3">مبلغ نهایی ردیف</th>
                <th className="p-3 text-center">شماره سریال‌ها</th>
                <th className="p-3 text-center">وضعیت فاکتور</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center p-8 text-slate-400 font-bold">
                    هیچ سابقه فروش منطبق با جستجو یا فیلترها یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr 
                    key={row.key} 
                    className={`hover:bg-slate-50/70 transition-colors ${
                      row.invoiceStatus === 'cancelled' 
                        ? 'opacity-60 bg-rose-50/10' 
                        : row.invoiceStatus === 'fully_returned'
                          ? 'opacity-65 bg-slate-50/40'
                          : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-black text-slate-900">{row.sale.invoiceNumber}</td>
                    <td className="p-3 font-mono text-slate-500">{toPersianDigits(row.sale.saleDate)}</td>
                    <td className="p-3 text-slate-800 font-black">{row.sale.customer.name}</td>
                    <td className="p-3 font-mono text-slate-600">{toPersianDigits(row.sale.customer.phone)}</td>
                    <td className="p-3">
                      <div className="font-black text-slate-800">{row.item.product.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-bold">مدل: {row.item.product.model}</div>
                    </td>
                    <td className="p-3 text-center font-mono">
                      {row.returnedQuantity > 0 ? (
                        <div>
                          <span className="text-indigo-700 font-black">{toPersianDigits(row.activeQuantity)}</span>
                          <span className="text-slate-400"> از {toPersianDigits(row.quantity)}</span>
                          <span className="text-[9px] block text-rose-500 font-bold">(مرجوعی: {toPersianDigits(row.returnedQuantity)})</span>
                        </div>
                      ) : (
                        <span className="text-slate-700 font-bold">{toPersianDigits(row.quantity)}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-500">{formatToPersianPrice(row.item.unitPrice)}</td>
                    <td className="p-3 font-mono font-black">
                      {row.invoiceStatus === 'cancelled' ? (
                        <div>
                          <span className="line-through text-slate-400">{formatToPersianPrice(row.quantity * row.item.unitPrice)}</span>
                          <span className="text-rose-600 text-[9px] font-black block mt-0.5">لغو شده</span>
                        </div>
                      ) : row.returnedQuantity > 0 ? (
                        <div>
                          <span className="line-through text-slate-400 text-[10px] block">{formatToPersianPrice(row.quantity * row.item.unitPrice)}</span>
                          <span className="text-emerald-700">{formatToPersianPrice(row.totalAmount)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-900">{formatToPersianPrice(row.totalAmount)}</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap justify-center gap-1 max-w-[150px] mx-auto">
                        {row.item.serials.map(s => {
                          const isRet = (row.sale.returns || []).some((r: any) => r.serial.toUpperCase() === s.toUpperCase());
                          return (
                            <span 
                              key={s} 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSearchSerial) onSearchSerial(s);
                              }}
                              className={`font-mono text-[9px] px-1 rounded-md cursor-pointer block transition-colors border ${
                                row.invoiceStatus === 'cancelled' 
                                  ? 'bg-rose-50 border-rose-200 text-rose-600 line-through' 
                                  : isRet 
                                    ? 'bg-amber-50 border-amber-200/60 text-amber-700 line-through' 
                                    : 'bg-slate-100 hover:bg-blue-100 hover:text-blue-700 border-slate-200/50 text-slate-600'
                              }`}
                              title={row.invoiceStatus === 'cancelled' ? 'باطل‌شده به دلیل لغو فاکتور' : isRet ? 'مرجوع شده' : 'کلیک برای رهگیری گارانتی'}
                            >
                              {s}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {renderInvoiceStatusBadge(row.invoiceStatus)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSaleDetails(row.sale)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                      >
                        جزئیات و عملیات
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED DIALOG FOR SALES ACTIONS */}
      <AnimatePresence>
        {selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
            <div 
              className="fixed inset-0 bg-black/40 cursor-pointer transition-opacity" 
              onClick={() => setSelectedSale(null)} 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl relative z-10 text-right flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {modalView === 'details' && 'مشخصات و جزئیات فاکتور فروش'}
                      {modalView === 'edit' && 'اصلاح اطلاعات و مشخصات فاکتور'}
                      {modalView === 'cancel' && 'لغو فاکتور فروش و ابطال گارانتی'}
                      {modalView === 'return' && 'ثبت برگشت از فروش کالا (مرجوعی)'}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">شماره فاکتور: {selectedSale.invoiceNumber}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="p-1.5 bg-slate-200/50 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
                {modalView === 'details' ? (
                  <>
                    {/* Status Banners inside Details View */}
                    {getInvoiceStatus(selectedSale) === 'cancelled' && (
                      <div className="bg-rose-50 border border-rose-200/60 rounded-2xl p-3 flex items-start gap-2.5 text-rose-800">
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black text-xs block text-rose-950">فاکتور صادرشده لغو گردیده است</span>
                          <p className="text-[10px] text-rose-700 leading-relaxed mt-0.5">
                            این فاکتور در تاریخ {toPersianDigits(selectedSale.cancelDate || '')} به دلیل «{selectedSale.cancelReason}» لغو شده و تمامی دستگاه‌های آن از تعهد گارانتی خارج شده‌اند.
                            {selectedSale.cancelNotes && <span className="block mt-1 font-bold text-rose-900">توضیحات ابطال: {selectedSale.cancelNotes}</span>}
                          </p>
                        </div>
                      </div>
                    )}
                    {getInvoiceStatus(selectedSale) === 'fully_returned' && (
                      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 flex items-start gap-2.5 text-slate-800">
                        <Clock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black text-xs block text-slate-900">مرجوعی کامل فاکتور فروش</span>
                          <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">
                            تمامی کالاهای مندرج در این فاکتور با موفقیت مرجوع شده و مبالغ آن‌ها تسویه گردیده است. گارانتی کلیه سریال‌ها باطل می‌باشد.
                          </p>
                        </div>
                      </div>
                    )}
                    {getInvoiceStatus(selectedSale) === 'partially_returned' && (
                      <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-3 flex items-start gap-2.5 text-amber-800">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black text-xs block text-amber-950">برگشت جزئی قطعه / کالا</span>
                          <p className="text-[10px] text-amber-700 leading-relaxed mt-0.5">
                            برخی از دستگاه‌های این فاکتور مرجوع شده و ارزش ریالی آن‌ها با موفقیت کسر و حساب طرف حساب بستانکار گردیده است.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Customer Profile info */}
                    <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
                        <div className="flex items-center gap-1.5 text-blue-700 font-black">
                          <User className="w-4 h-4 text-blue-600" />
                          <span>اطلاعات پروفایل خریدار</span>
                        </div>
                        <span className="font-mono text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          روش تسویه: {selectedSale.paymentMethod || 'نقدی'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px]">نام طرف حساب:</span>
                          <span className="text-slate-800 font-black text-sm">{selectedSale.customer.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px]">شماره همراه خریدار:</span>
                          <span className="text-slate-800 font-black font-mono">{toPersianDigits(selectedSale.customer.phone)}</span>
                        </div>
                        {selectedSale.customer.email && (
                          <div className="col-span-2">
                            <span className="text-slate-400 font-bold block text-[10px]">ایمیل:</span>
                            <span className="text-slate-800 font-bold font-mono">{selectedSale.customer.email}</span>
                          </div>
                        )}
                        {selectedSale.customer.address && (
                          <div className="col-span-2 border-t border-slate-100 pt-1.5">
                            <span className="text-slate-400 font-bold block text-[10px]">نشانی تحویل:</span>
                            <span className="text-slate-700 font-bold">{selectedSale.customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoice detail blocks */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-slate-200/60 rounded-xl p-3 bg-white text-center">
                        <span className="text-[10px] text-slate-400 font-black block">تاریخ صدور فاکتور</span>
                        <span className="text-xs font-black text-slate-800 font-mono mt-0.5 block">{toPersianDigits(selectedSale.saleDate)}</span>
                      </div>
                      <div className="border border-slate-200/60 rounded-xl p-3 bg-white text-center">
                        <span className="text-[10px] text-slate-400 font-black block">صنف و گروه خریدار</span>
                        <span className="text-xs font-black text-slate-800 mt-0.5 block">
                          {selectedSale.customer.type === 'representative' ? 'همکار / نمایندگی مجاز' : 'مصرف‌کننده حقیقی'}
                        </span>
                      </div>
                    </div>

                    {/* Items List in Details view */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-blue-700 font-black pb-1">
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        <span>اقلام درج شده در سند فاکتور</span>
                      </div>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        {selectedSale.items.map((item, idx) => {
                          const totalRow = item.serials.length * item.unitPrice;
                          return (
                            <div key={idx} className="p-3 bg-white space-y-2.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-black text-slate-900 text-xs block">{item.product.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono font-bold block">مدل: {item.product.model}</span>
                                </div>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[10px] font-mono">
                                  تعداد: {toPersianDigits(item.serials.length)} عدد
                                </span>
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-1.5">
                                <div>قیمت واحد: <span className="font-mono text-slate-800">{formatToPersianPrice(item.unitPrice)}</span></div>
                                <div>جمع ردیف: <span className="font-mono font-black text-slate-900 text-xs">{formatToPersianPrice(totalRow)}</span></div>
                              </div>

                              {/* Serials detail list */}
                              <div className="bg-slate-50/85 rounded-xl p-2.5 space-y-2 border border-slate-150">
                                <span className="text-[9px] font-black text-slate-400 block border-b border-slate-200 pb-1">مشخصات گارانتی شماره سریال‌ها:</span>
                                <div className="space-y-2">
                                  {item.serials.map(serial => {
                                    const wInfo = getSerialWarrantyInfo(serial);
                                    const isRet = (selectedSale.returns || []).some((r: any) => r.serial.toUpperCase() === serial.toUpperCase());
                                    const isCancelled = selectedSale.status === 'cancelled';
                                    
                                    return (
                                      <div key={serial} className="bg-white border border-slate-150 p-2 rounded-xl flex flex-col gap-1 text-[10px]">
                                        <div className="flex justify-between items-center border-b border-slate-50 pb-1">
                                          <span 
                                            onClick={() => {
                                              setSelectedSale(null);
                                              if (onSearchSerial) onSearchSerial(serial);
                                            }}
                                            className="font-mono font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                                            title="پیگیری گارانتی"
                                          >
                                            سریال: {serial}
                                          </span>
                                          {isCancelled ? (
                                            <span className="bg-rose-50 border border-rose-200/50 text-rose-700 px-1.5 py-0.5 rounded-md text-[9px] font-bold">باطل‌شده (لغو فروش)</span>
                                          ) : isRet ? (
                                            <span className="bg-slate-100 border border-slate-300 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold">باطل‌شده (مرجوعی)</span>
                                          ) : (
                                            renderWarrantyStatusBadge(wInfo.status)
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400 font-bold">
                                          <div>
                                            <span>شروع گارانتی: </span>
                                            <span className="text-slate-700 font-mono">{(wInfo.registeredAt && wInfo.registeredAt !== 'نامشخص') ? toPersianDigits(wInfo.registeredAt) : toPersianDigits(selectedSale.saleDate)}</span>
                                          </div>
                                          <div>
                                            <span>پایان گارانتی: </span>
                                            <span className="text-slate-700 font-mono">{toPersianDigits(wInfo.expiryDate)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* pricing summary */}
                    {(() => {
                      const subTotal = selectedSale.items.reduce((sum, item) => sum + (item.serials.length * item.unitPrice), 0);
                      const discount = selectedSale.discount || 0;
                      const finalTotal = Math.max(0, subTotal - discount);
                      return (
                        <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">جمع کل اقلام صادره:</span>
                            <span className="font-black text-slate-800 font-mono text-sm">{formatToPersianPrice(subTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-600">
                            <span className="font-bold">تخفیف فاکتور:</span>
                            <span className="font-black font-mono text-sm">{formatToPersianPrice(discount)}</span>
                          </div>
                          <div className="border-t border-slate-200/80 my-1 pt-2.5 flex justify-between items-center text-slate-900">
                            <span className="font-black text-xs flex items-center gap-1.5">
                              <Coins className="w-4 h-4 text-emerald-600" />
                              <span>مبلغ نهایی فاکتور:</span>
                            </span>
                            <span className="font-black font-mono text-base text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-3 py-1 rounded-xl">
                              {formatToPersianPrice(finalTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Return logs details list if registered */}
                    {selectedSale.returns && selectedSale.returns.length > 0 && (
                      <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/15 space-y-3">
                        <div className="flex items-center gap-1.5 text-amber-800 font-black border-b border-amber-100 pb-1.5">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>سوابق کالاهای برگشت‌داده شده (مرجوعی)</span>
                        </div>
                        <div className="space-y-2 text-[10px]">
                          {selectedSale.returns.map((ret: any, rIdx: number) => (
                            <div key={rIdx} className="bg-white border border-amber-100/80 p-2.5 rounded-xl flex justify-between items-center">
                              <div>
                                <span className="font-mono font-black text-slate-800">شماره سریال: {ret.serial}</span>
                                <div className="text-slate-500 text-[9px] mt-0.5">
                                  <span>تاریخ مرجوعی: {toPersianDigits(ret.returnDate)} | علت: {ret.returnReason}</span>
                                  {ret.notes && <p className="text-slate-400 mt-0.5">توضیح: {ret.notes}</p>}
                                </div>
                              </div>
                              <div className="text-left font-mono">
                                <span className="font-black text-amber-700 block text-xs">{formatToPersianPrice(ret.refundAmount)}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${ret.refundStatus === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/40' : 'bg-rose-50 text-rose-600 border border-rose-200/40'}`}>
                                  {ret.refundStatus === 'paid' ? 'پرداخت شده' : 'پرداخت نشده'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invoice Notes */}
                    {selectedSale.notes && (
                      <div className="bg-amber-50/40 border border-amber-200/40 rounded-xl p-3">
                        <span className="text-[10px] font-black text-amber-800 block mb-0.5">توضیحات فاکتور:</span>
                        <p className="text-slate-700 leading-relaxed font-bold text-[11px]">{selectedSale.notes}</p>
                      </div>
                    )}

                    {/* Operational Actions Footer inside Details view */}
                    <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => alert(`ارسال فاکتور ${selectedSale.invoiceNumber} به چاپگر حرارتی رسیدساز دیاکو.`)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                      >
                        <Printer className="w-4 h-4 text-slate-600" />
                        <span>چاپ فیش</span>
                      </button>

                      {getInvoiceStatus(selectedSale) !== 'cancelled' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setModalView('edit')}
                            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>اصلاح اطلاعات</span>
                          </button>

                          {getInvoiceStatus(selectedSale) !== 'fully_returned' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setModalView('return')}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                              >
                                <Clock className="w-4 h-4 text-indigo-600" />
                                <span>برگشت از فروش</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setModalView('cancel')}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                              >
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                <span>لغو فاکتور</span>
                              </button>
                            </>
                          )}
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedSale(null)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs"
                      >
                        بستن جزئیات
                      </button>
                    </div>
                  </>
                ) : (
                  /* Render subcomponent views edit, cancel, return */
                  <P016SalesActions
                    selectedSale={selectedSale}
                    warrantyDb={warrantyDb}
                    modalView={modalView}
                    setModalView={setModalView}
                    onSaveEdit={handleSaveEdit}
                    onConfirmCancel={handleConfirmCancel}
                    onConfirmReturn={handleConfirmReturn}
                    onClose={() => setSelectedSale(null)}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
