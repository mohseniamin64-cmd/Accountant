import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Building2, 
  FileText, 
  Box, 
  CheckCircle, 
  X, 
  Printer, 
  Barcode, 
  Trash2, 
  Edit2, 
  Plus, 
  ArrowLeft, 
  Tag, 
  Filter, 
  Layers, 
  AlertTriangle,
  Eye,
  Phone,
  Coins,
  ChevronRight,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import { Supplier, PurchaseRecord, InventoryItem } from '../types';

interface P017PurchaseHistoryProps {
  purchases: PurchaseRecord[];
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseRecord[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setActiveTab: (tab: any) => void;
  onGoToNewPurchase: () => void;
  onGoToNewSaleWithSerial?: (serial: string) => void;
}

// Persian Digits Converter
const toPersianDigits = (str: string | number) => {
  if (str === undefined || str === null) return '';
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

// Format Price
const formatPrice = (value: number | string) => {
  const num = typeof value === 'string' ? parseInt(value.replace(/[^\d]/g, ''), 10) : value;
  if (!num || isNaN(num)) return '۰ تومان';
  return num.toLocaleString('fa-IR') + ' تومان';
};

export function P017PurchaseHistory({
  purchases,
  setPurchases,
  inventory,
  setInventory,
  suppliers,
  setSuppliers,
  setActiveTab,
  onGoToNewPurchase,
  onGoToNewSaleWithSerial
}: P017PurchaseHistoryProps) {
  // Main view switcher
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'inventory' | 'suppliers'>('invoices');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'available' | 'sold' | 'under_repair'>('all');

  // Selected Invoice Modal
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Edit Supplier Modal State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [supFormName, setSupFormName] = useState<string>('');
  const [supFormPhone, setSupFormPhone] = useState<string>('');
  const [supFormCompany, setSupFormCompany] = useState<string>('');
  const [supFormAddress, setSupFormAddress] = useState<string>('');

  // Void Purchase Invoice State
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState<PurchaseRecord | null>(null);

  // Computed Stats
  const totalPurchasesCount = purchases.length;
  const totalPurchasesAmount = purchases.reduce((sum, p) => p.status === 'completed' ? sum + p.totalPayable : sum, 0);
  const totalStockItemsCount = inventory.length;
  const totalAvailableStockCount = inventory.filter(i => i.status === 'available').length;
  const totalSoldStockCount = inventory.filter(i => i.status === 'sold').length;

  // Filtered Purchases
  const filteredPurchases = purchases.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchQuery = !q || 
      p.invoiceNumber.toLowerCase().includes(q) ||
      p.supplier.name.toLowerCase().includes(q) ||
      (p.supplier.company && p.supplier.company.toLowerCase().includes(q));
    const matchSupplier = supplierFilter === 'all' || p.supplier.id === supplierFilter;
    return matchQuery && matchSupplier;
  });

  // Filtered Inventory Stock Items
  const filteredInventory = inventory.filter(i => {
    const q = searchQuery.toLowerCase();
    const matchQuery = !q || 
      i.serial.toLowerCase().includes(q) ||
      i.productName.toLowerCase().includes(q) ||
      i.productModel.toLowerCase().includes(q) ||
      i.purchaseInvoiceNumber.toLowerCase().includes(q) ||
      i.supplierName.toLowerCase().includes(q);
    const matchStatus = stockStatusFilter === 'all' || i.status === stockStatusFilter;
    return matchQuery && matchStatus;
  });

  // Group inventory by Product Model to see stock counts per product
  const productStockSummary = inventory.reduce((acc: any, item) => {
    const key = `${item.productName} (${item.productModel})`;
    if (!acc[key]) {
      acc[key] = {
        name: item.productName,
        model: item.productModel,
        total: 0,
        available: 0,
        sold: 0,
        lastPurchasePrice: item.unitPurchasePrice
      };
    }
    acc[key].total += 1;
    if (item.status === 'available') acc[key].available += 1;
    if (item.status === 'sold') acc[key].sold += 1;
    return acc;
  }, {});

  // Void/Cancel Purchase Invoice Handler
  const handleConfirmVoidInvoice = () => {
    if (!voidInvoiceTarget) return;

    // Check if any items from this invoice have already been sold
    const itemsSoldFromThisInvoice = inventory.some(i => i.purchaseInvoiceNumber === voidInvoiceTarget.invoiceNumber && i.status === 'sold');
    if (itemsSoldFromThisInvoice) {
      alert('امکان ابطال این فاکتور خرید وجود ندارد، زیرا بعضی از سریال‌های این فاکتور قبلاً به طرف حساب فروخته شده‌اند!');
      setShowVoidModal(false);
      return;
    }

    // Mark purchase invoice as cancelled
    setPurchases(prev => prev.map(p => p.id === voidInvoiceTarget.id ? { ...p, status: 'cancelled' } : p));
    // Remove serials of this purchase invoice from active inventory
    setInventory(prev => prev.filter(i => i.purchaseInvoiceNumber !== voidInvoiceTarget.invoiceNumber));

    setShowVoidModal(false);
    setVoidInvoiceTarget(null);
    alert('فاکتور خرید با موفقیت ابطال شد و اقلام آن از انبار کالا کسر گردید.');
  };

  // Supplier Edit/Add Handler
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupFormName('');
    setSupFormPhone('');
    setSupFormCompany('');
    setSupFormAddress('');
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupFormName(sup.name);
    setSupFormPhone(sup.phone);
    setSupFormCompany(sup.company || '');
    setSupFormAddress(sup.address || '');
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supFormName.trim() || !supFormPhone.trim()) {
      alert('نام و تلفن تأمین‌کننده الزامی است.');
      return;
    }

    if (editingSupplier) {
      setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? {
        ...s,
        name: supFormName.trim(),
        phone: supFormPhone.trim(),
        company: supFormCompany.trim() || undefined,
        address: supFormAddress.trim() || undefined
      } : s));
    } else {
      const newSup: Supplier = {
        id: `SUP-${Date.now().toString().slice(-4)}`,
        name: supFormName.trim(),
        phone: supFormPhone.trim(),
        company: supFormCompany.trim() || undefined,
        address: supFormAddress.trim() || undefined
      };
      setSuppliers(prev => [...prev, newSup]);
    }
    setShowSupplierModal(false);
  };

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-300">
              <Box className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-black tracking-tight">سوابق خریدها و مدیریت انبار کالا</h2>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            مشاهده فاکتورهای خرید، موجودی آماده فروش سریال‌ها و لیست تأمین‌کنندگان
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToNewPurchase}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/50 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت فاکتور خرید جدید</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-black text-slate-400 block">کل فاکتورهای خرید</span>
          <span className="text-lg font-black text-slate-900 font-mono">{toPersianDigits(totalPurchasesCount)}</span>
          <span className="text-[10px] text-slate-500 block font-bold">فاکتور ورود کالا</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-black text-slate-400 block">کل مبلغ خریدهای فعال</span>
          <span className="text-base font-black text-emerald-700 font-mono">{formatPrice(totalPurchasesAmount)}</span>
          <span className="text-[10px] text-emerald-600 block font-bold">ارزش پرداختی به تأمین‌کنندگان</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-black text-slate-400 block">موجودی آماده برای فروش</span>
          <span className="text-lg font-black text-blue-700 font-mono">{toPersianDigits(totalAvailableStockCount)}</span>
          <span className="text-[10px] text-blue-600 block font-bold">دستگاه در انبار موجود است</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-black text-slate-400 block">دستگاه‌های فروخته شده</span>
          <span className="text-lg font-black text-purple-700 font-mono">{toPersianDigits(totalSoldStockCount)}</span>
          <span className="text-[10px] text-purple-600 block font-bold">ردیابی در فاکتورهای فروش</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('invoices')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'invoices'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>فاکتورهای خرید ({toPersianDigits(purchases.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('inventory')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'inventory'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>موجودی واقعی انبار و سریال‌ها ({toPersianDigits(inventory.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('suppliers')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'suppliers'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>مدیریت تأمین‌کنندگان ({toPersianDigits(suppliers.length)})</span>
        </button>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeSubTab === 'invoices' ? "جستجوی شماره فاکتور، تأمین‌کننده..." :
              activeSubTab === 'inventory' ? "جستجوی شماره سریال، مدل کالا، فاکتور..." :
              "جستجوی نام تأمین‌کننده یا شماره تماس..."
            }
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-600 rounded-2xl text-xs font-bold outline-none shadow-xs"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {activeSubTab === 'inventory' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0">وضعیت کالا:</span>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="available">🟢 موجود آماده فروش</option>
              <option value="sold">🟣 فروخته شده</option>
              <option value="under_repair">🟡 زیر تعمیر</option>
            </select>
          </div>
        )}
      </div>

      {/* ================= VIEW 1: PURCHASE INVOICES LIST ================= */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {filteredPurchases.length > 0 ? (
            <div className="space-y-3">
              {filteredPurchases.map((purchase) => {
                const totalItemsCount = purchase.items.reduce((acc, item) => acc + item.quantity, 0);
                const isVoided = purchase.status === 'cancelled';

                return (
                  <div
                    key={purchase.id}
                    className={`bg-white border rounded-3xl p-5 shadow-xs transition-all space-y-4 text-right ${
                      isVoided ? 'border-rose-200 bg-rose-50/30 opacity-75' : 'border-slate-200/80 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <ShoppingBag className="w-5 h-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 font-mono">{purchase.invoiceNumber}</span>
                            {isVoided && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded-lg">
                                ابطال شده
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-bold">تاریخ: {purchase.purchaseDate}</p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-black text-slate-400 block">مبلغ کل فاکتور:</span>
                        <span className="text-base font-black text-emerald-700 font-mono">{formatPrice(purchase.totalPayable)}</span>
                      </div>
                    </div>

                    {/* Supplier details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 text-[10px] font-black block">تأمین‌کننده:</span>
                        <span className="font-black text-slate-800">{purchase.supplier.name}</span>
                        {purchase.supplier.company && (
                          <span className="text-slate-500 text-[10px] block">({purchase.supplier.company})</span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] font-black block">شماره تماس:</span>
                        <span className="font-mono font-bold text-slate-800">{purchase.supplier.phone}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] font-black block">روش پرداخت:</span>
                        <span className="font-bold text-slate-800">
                          {purchase.paymentMethod === 'cash' ? 'نقدی' :
                           purchase.paymentMethod === 'card' ? 'کارت به کارت' :
                           purchase.paymentMethod === 'cheque' ? 'چک صیادی' : 'حساب دفتری / نسیه'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Items Summary */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[10px] font-black text-slate-400 block">
                        اقلام خریداری شده ({toPersianDigits(totalItemsCount)} دستگاه):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {purchase.items.map((item, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-[11px]">
                            {item.product.name} ({toPersianDigits(item.quantity)} عدد)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPurchase(purchase);
                          setShowDetailModal(true);
                        }}
                        className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>مشاهده جزئیات فاکتور و سریال‌ها</span>
                      </button>

                      {!isVoided && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidInvoiceTarget(purchase);
                            setShowVoidModal(true);
                          }}
                          className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>ابطال فاکتور</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center text-slate-400 space-y-3 shadow-xs">
              <ShoppingBag className="w-12 h-12 mx-auto text-slate-300" />
              <h3 className="text-sm font-black text-slate-800">هیچ فاکتور خریدی یافت نشد</h3>
              <p className="text-xs font-medium max-w-sm mx-auto text-slate-500">
                شما می‌توانید نخستین فاکتور خرید خود را ثبت کرده و کالاهای خریداری شده را مستقیماً به انبار اضافه نمایید.
              </p>
              <button
                type="button"
                onClick={onGoToNewPurchase}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت نخستین فاکتور خرید</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= VIEW 2: WAREHOUSE STOCK & SERIALS TRACKING ================= */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-6">
          {/* Summary Stock Per Product Model */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <PackageCheck className="w-4.5 h-4.5 text-emerald-600" />
              <span>خلاصه موجودی کالاها بر اساس مدل</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.keys(productStockSummary).map((key, idx) => {
                const item = productStockSummary[key];
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">مدل: {item.model}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg">
                        {toPersianDigits(item.available)} موجود
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] border-t border-slate-200/60 pt-2 text-slate-600 font-bold">
                      <span>کل ورودی: {toPersianDigits(item.total)} دستگاه</span>
                      <span>فروخته شده: {toPersianDigits(item.sold)}</span>
                    </div>
                  </div>
                );
              })}
              {Object.keys(productStockSummary).length === 0 && (
                <p className="text-xs text-slate-400 py-4 font-bold col-span-3 text-center">انبار کالا هنوز خالی است.</p>
              )}
            </div>
          </div>

          {/* Serials Table */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Barcode className="w-4.5 h-4.5 text-emerald-600" />
              <span>جدول تمام شماره سریال‌های خریداری شده و موجود در انبار</span>
            </h3>

            {filteredInventory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                      <th className="p-3">#</th>
                      <th className="p-3">شماره سریال</th>
                      <th className="p-3">نام و مدل کالا</th>
                      <th className="p-3">فاکتور خرید</th>
                      <th className="p-3">تأمین‌کننده</th>
                      <th className="p-3">وضعیت</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                    {filteredInventory.map((item, idx) => {
                      const isAvailable = item.status === 'available';
                      const isSold = item.status === 'sold';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                          <td className="p-3 font-mono font-black text-slate-900 tracking-wider">
                            {item.serial}
                          </td>
                          <td className="p-3">
                            <p className="font-black text-slate-900">{item.productName}</p>
                            <span className="text-[10px] text-slate-500 font-mono">{item.productModel}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-700">
                            {item.purchaseInvoiceNumber} ({item.purchaseDate})
                          </td>
                          <td className="p-3 text-slate-700">{item.supplierName}</td>
                          <td className="p-3">
                            {isAvailable ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black">
                                🟢 موجود آماده فروش
                              </span>
                            ) : isSold ? (
                              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-[10px] font-black">
                                🟣 فروخته شده ({item.saleInvoiceNumber || 'فاکتور فروش'})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black">
                                🟡 زیر تعمیر
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isAvailable && onGoToNewSaleWithSerial && (
                              <button
                                type="button"
                                onClick={() => onGoToNewSaleWithSerial(item.serial)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-xl transition-all cursor-pointer"
                              >
                                فاکتور فروش
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 font-bold">
                هیچ شماره سریالی با این مشخصات یافت نشد.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= VIEW 3: SUPPLIERS DIRECTORY ================= */}
      {activeSubTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-800">فهرست شرکت‌ها و تأمین‌کنندگان طرف قرارداد</h3>
            <button
              type="button"
              onClick={handleOpenAddSupplier}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن تأمین‌کننده جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map((sup) => {
              const supPurchasesCount = purchases.filter(p => p.supplier.id === sup.id).length;
              const supTotalAmount = purchases.filter(p => p.supplier.id === sup.id && p.status === 'completed')
                .reduce((a, b) => a + b.totalPayable, 0);

              return (
                <div key={sup.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{sup.name}</h4>
                        {sup.company && <p className="text-xs text-slate-500 font-bold">{sup.company}</p>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditSupplier(sup)}
                      className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="flex justify-between">
                      <span className="font-bold text-slate-400">شماره تماس:</span>
                      <span className="font-mono font-black text-slate-800">{sup.phone}</span>
                    </p>
                    {sup.address && (
                      <p className="text-[11px]">
                        <span className="font-bold text-slate-400 block">آدرس:</span>
                        <span className="font-medium text-slate-700">{sup.address}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 font-bold">
                    <span className="text-slate-500">تعداد خریدهای ثبت شده: {toPersianDigits(supPurchasesCount)}</span>
                    <span className="text-emerald-700 font-mono font-black">{formatPrice(supTotalAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Invoice Details */}
      {showDetailModal && selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 border border-slate-200 shadow-2xl space-y-5 text-right my-8" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  جزئیات کامل فاکتور خرید {selectedPurchase.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">تاریخ ثبت: {selectedPurchase.createdAt}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Supplier card */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-1 text-xs">
                <span className="text-[10px] font-black text-emerald-800 block">تأمین‌کننده فاکتور:</span>
                <p className="font-black text-slate-900">{selectedPurchase.supplier.name} ({selectedPurchase.supplier.company || 'شخصی'})</p>
                <p className="text-slate-600">تلفن: {selectedPurchase.supplier.phone}</p>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-800 block">اقلام فاکتور خرید:</span>
                {selectedPurchase.items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between font-black text-slate-900">
                      <span>{item.product.name} ({item.product.model})</span>
                      <span className="font-mono text-emerald-700">{formatPrice(item.quantity * item.unitPurchasePrice)}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      تعداد: {toPersianDigits(item.quantity)} عدد | قیمت واحد: {formatPrice(item.unitPurchasePrice)}
                    </div>
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-black text-slate-400 block mb-1">سریال‌های اختصاص داده شده:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.serials.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-slate-100 p-4 rounded-2xl space-y-2 text-xs font-black text-slate-900">
                <div className="flex justify-between">
                  <span>تخفیف خرید:</span>
                  <span className="font-mono">{formatPrice(selectedPurchase.discount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 text-sm border-t border-slate-200 pt-2">
                  <span>مبلغ پرداختی کل:</span>
                  <span className="font-mono">{formatPrice(selectedPurchase.totalPayable)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="w-full py-3 bg-slate-900 text-white font-black text-xs rounded-xl cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Void Purchase Invoice */}
      {showVoidModal && voidInvoiceTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4 text-right" dir="rtl">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">آیا از ابطال این فاکتور خرید اطمینان دارید؟</h3>
              <p className="text-xs text-slate-500 font-bold">
                فاکتور شماره {voidInvoiceTarget.invoiceNumber} ابطال خواهد شد و تمام سریال‌های ثبت شده آن از انبار کسر می‌گردند.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmVoidInvoice}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl cursor-pointer"
              >
                تأیید ابطال فاکتور
              </button>
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="px-5 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Supplier Edit/Add */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4 text-right" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                {editingSupplier ? 'ویرایش اطلاعات تأمین‌کننده' : 'تعریف تأمین‌کننده جدید'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">نام مسؤول / تأمین‌کننده <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={supFormName}
                  onChange={(e) => setSupFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">شماره تماس <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={supFormPhone}
                  onChange={(e) => setSupFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">نام شرکت / فروشگاه</label>
                <input
                  type="text"
                  value={supFormCompany}
                  onChange={(e) => setSupFormCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">آدرس</label>
                <input
                  type="text"
                  value={supFormAddress}
                  onChange={(e) => setSupFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer"
                >
                  ذخیره
                </button>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
