import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Search, 
  Building2, 
  Calendar, 
  Coins, 
  FileText, 
  CheckCircle, 
  Sparkles, 
  X, 
  Printer, 
  Barcode, 
  Check, 
  AlertCircle,
  Users,
  ChevronDown,
  ArrowLeft,
  CreditCard,
  Layers,
  Box,
  Landmark,
  FileCheck,
  Calculator,
  UserPlus,
  Package,
  Receipt
} from 'lucide-react';
import { Supplier, Customer, PurchaseItem, PurchaseRecord, InventoryItem } from '../types';
import { numberToPersianWords, amountToTomanWords } from '../utils/numberToPersianWords';

interface P017PurchaseInvoiceProps {
  products: any[];
  setProducts: React.Dispatch<React.SetStateAction<any[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  customers?: Customer[];
  purchases: PurchaseRecord[];
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseRecord[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  setActiveTab: (tab: any) => void;
  onSuccessReturn?: () => void;
}

// Convert string/English numbers to Persian numbers
const toPersianDigits = (str: string | number) => {
  if (str === undefined || str === null) return '';
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

// Utility to parse Persian or formatted numeric strings
const parseNumericValue = (val: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const englishStr = val
    .toString()
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[^\d-]/g, '');
  const parsed = parseInt(englishStr, 10);
  return isNaN(parsed) ? 0 : parsed;
};

// Utility to format price to Persian Toman
const formatPrice = (value: number | string) => {
  const num = typeof value === 'string' ? parseNumericValue(value) : value;
  if (!num || isNaN(num)) return '۰ تومان';
  return num.toLocaleString('fa-IR') + ' تومان';
};

export function P017PurchaseInvoice({
  products,
  setProducts,
  suppliers,
  setSuppliers,
  customers = [],
  purchases,
  setPurchases,
  inventory,
  setInventory,
  setActiveTab,
  onSuccessReturn
}: P017PurchaseInvoiceProps) {
  // --- INVOICE HEADER STATES ---
  const [invoiceNumber, setInvoiceNumber] = useState<string>(`PUR-1405-${Math.floor(100 + Math.random() * 900)}`);
  const [purchaseDate, setPurchaseDate] = useState<string>('۱۴۰۵/۰۵/۰۸');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque' | 'credit' | 'card'>('card');
  const [notes, setNotes] = useState<string>('ورود به انبار با تایید مدیریت فنی و کنترل کیفی دیاکو الکترونیک');

  // --- COUNTERPARTY / SUPPLIER SELECTION STATES ---
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(() => suppliers[0] || null);
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [showPartyModal, setShowPartyModal] = useState<boolean>(false);
  const [partyModalFilter, setPartyModalFilter] = useState<'all' | 'suppliers' | 'customers'>('all');
  
  // Quick Add Supplier / Counterparty Modal
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [newSupName, setNewSupName] = useState<string>('');
  const [newSupPhone, setNewSupPhone] = useState<string>('');
  const [newSupCompany, setNewSupCompany] = useState<string>('');
  const [newSupAddress, setNewSupAddress] = useState<string>('');
  const [newSupType, setNewSupType] = useState<'supplier' | 'customer' | 'colleague'>('supplier');

  // Unified Counterparties list
  const unifiedParties = React.useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      phone: string;
      company?: string;
      address?: string;
      code?: string;
      type: 'supplier' | 'customer' | 'colleague';
      typeLabel: string;
      raw: any;
    }> = [];

    // Add suppliers
    suppliers.forEach((s) => {
      list.push({
        id: s.id,
        name: s.name,
        phone: s.phone || '',
        company: s.company,
        address: s.address,
        code: s.code || `SUP-${s.id.slice(-4)}`,
        type: 'supplier',
        typeLabel: 'تأمین‌کننده قطعات',
        raw: s
      });
    });

    // Add customers (if they also sell goods or return)
    customers.forEach((c) => {
      list.push({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        code: c.nationalId || `CUST-${c.id.slice(-4)}`,
        type: c.type === 'representative' ? 'colleague' : 'customer',
        typeLabel: c.type === 'representative' ? 'همکار / بنکدار' : 'مشتری / طرف حساب',
        raw: c
      });
    });

    return list;
  }, [suppliers, customers]);

  // Filtered counterparties
  const filteredParties = React.useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    return unifiedParties.filter(p => {
      if (partyModalFilter === 'suppliers' && p.type !== 'supplier') return false;
      if (partyModalFilter === 'customers' && p.type !== 'customer') return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.company && p.company.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q))
      );
    });
  }, [unifiedParties, supplierSearch, partyModalFilter]);

  // --- ITEM SELECTION & CREATION STATES ---
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [prodSearch, setProdSearch] = useState<string>('');
  const [unitPurchasePrice, setUnitPurchasePrice] = useState<string>('');
  const [currentSerial, setCurrentSerial] = useState<string>('');
  const [serialsList, setSerialsList] = useState<string[]>([]);
  
  // Bulk Serials Generator
  const [bulkPrefix, setBulkPrefix] = useState<string>('DEC');
  const [bulkCount, setBulkCount] = useState<string>('5');
  const [bulkStart, setBulkStart] = useState<string>('1001');

  // --- INVOICE ITEMS TABLE ---
  const [items, setItems] = useState<PurchaseItem[]>(() => {
    if (products && products.length > 0) {
      const p = products[0];
      const purPrice = p.productionPrice ? parseNumericValue(p.productionPrice) : 2500000;
      return [
        {
          product: {
            name: p.name,
            model: p.model,
            category: p.category || 'تجهیزات صنعتی',
            warrantyDuration: p.warrantyDuration || '18',
            suggestedPrice: p.suggestedPrice || '4200000'
          },
          quantity: 3,
          unitPurchasePrice: purPrice,
          unitPurchasePriceStr: purPrice.toLocaleString('fa-IR'),
          serials: ['DEC-1405-8801', 'DEC-1405-8802', 'DEC-1405-8803']
        }
      ];
    }
    return [];
  });

  // Financial Discount & Tax
  const [discount, setDiscount] = useState<string>('0');
  const [includeTax, setIncludeTax] = useState<boolean>(false);
  const [taxPercent, setTaxPercent] = useState<string>('10');

  // Confirmation & Feedback
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [savedPurchaseRecord, setSavedPurchaseRecord] = useState<PurchaseRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Print Mode Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Set default price when product is selected
  useEffect(() => {
    if (selectedProduct) {
      const suggested = selectedProduct.productionPrice 
        ? parseNumericValue(selectedProduct.productionPrice)
        : (parseNumericValue(selectedProduct.suggestedPrice) * 0.75 || 2500000);
      setUnitPurchasePrice(suggested.toString());
      setBulkPrefix(selectedProduct.model.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'DEC');
    }
  }, [selectedProduct]);

  // Handle Adding Single Serial
  const handleAddSingleSerial = () => {
    const s = currentSerial.trim().toUpperCase();
    if (!s) return;
    
    if (serialsList.includes(s)) {
      alert('این شماره سریال قبلاً به لیست اضافه شده است.');
      return;
    }

    setSerialsList(prev => [...prev, s]);
    setCurrentSerial('');
  };

  // Handle Bulk Generate Serials
  const handleGenerateBulkSerials = () => {
    const count = parseInt(bulkCount) || 0;
    const startNum = parseInt(bulkStart) || 1000;
    const prefix = bulkPrefix.trim().toUpperCase() || 'DEC';

    if (count <= 0) {
      alert('لطفاً تعداد سریال را مشخص کنید.');
      return;
    }

    const generated: string[] = [];
    for (let i = 0; i < count; i++) {
      const serialNum = startNum + i;
      const fullSerial = `${prefix}-1405-${serialNum}`;
      if (!serialsList.includes(fullSerial)) {
        generated.push(fullSerial);
      }
    }

    setSerialsList(prev => [...prev, ...generated]);
  };

  // Add Item to Purchase Invoice Table
  const handleAddItemToInvoice = () => {
    if (!selectedProduct) {
      alert('لطفاً ابتدا یک کالا را انتخاب نمایید.');
      return;
    }

    const priceNum = parseNumericValue(unitPurchasePrice);
    if (priceNum <= 0) {
      alert('لطفاً قیمت خرید معتبر را وارد کنید.');
      return;
    }

    if (serialsList.length === 0) {
      alert('لطفاً حداقل یک شماره سریال برای کالای خریداری شده وارد یا تولید کنید.');
      return;
    }

    const newItem: PurchaseItem = {
      product: {
        name: selectedProduct.name,
        model: selectedProduct.model,
        category: selectedProduct.category,
        warrantyDuration: selectedProduct.warrantyDuration,
        suggestedPrice: selectedProduct.suggestedPrice
      },
      quantity: serialsList.length,
      unitPurchasePrice: priceNum,
      unitPurchasePriceStr: priceNum.toLocaleString('fa-IR'),
      serials: [...serialsList]
    };

    setItems(prev => [...prev, newItem]);

    // Reset item entry form
    setSelectedProduct(null);
    setProdSearch('');
    setUnitPurchasePrice('');
    setSerialsList([]);
    setCurrentSerial('');
  };

  // Remove Line Item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Quick Add Supplier
  const handleSaveNewSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim() || !newSupPhone.trim()) {
      alert('نام و تلفن تأمین‌کننده الزامی است.');
      return;
    }

    const newSup: Supplier = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      name: newSupName.trim(),
      phone: newSupPhone.trim(),
      company: newSupCompany.trim() || undefined,
      address: newSupAddress.trim() || undefined,
      code: `SUP-${Math.floor(100 + Math.random() * 900)}`
    };

    setSuppliers(prev => [...prev, newSup]);
    setSelectedSupplier(newSup);
    setShowAddSupplierModal(false);
    setShowPartyModal(false);
    setNewSupName('');
    setNewSupPhone('');
    setNewSupCompany('');
    setNewSupAddress('');
  };

  // Financial Calculations
  const subtotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPurchasePrice), 0);
  const discountAmount = parseNumericValue(discount);
  const taxPercentNum = includeTax ? (parseFloat(taxPercent) || 0) : 0;
  const taxAmount = Math.round(((subtotalAmount - discountAmount) * taxPercentNum) / 100);
  const totalPayable = Math.max(0, subtotalAmount - discountAmount + taxAmount);

  // Submit Purchase Invoice
  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedSupplier) {
      setErrorMessage('لطفاً فروشنده/تأمین‌کننده فاکتور خرید را انتخاب کنید.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('فاکتور خرید خالی است. لطفاً حداقل یک کالا به فاکتور بیافزایید.');
      return;
    }

    // Prepare Purchase Record
    const newPurchase: PurchaseRecord = {
      id: invoiceNumber,
      invoiceNumber: invoiceNumber,
      purchaseDate: purchaseDate,
      supplier: selectedSupplier,
      items: items,
      paymentMethod: paymentMethod,
      discount: discountAmount,
      tax: taxAmount,
      totalPayable: totalPayable,
      notes: notes.trim(),
      status: 'completed',
      createdAt: `${purchaseDate} - ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`
    };

    // 1. UPDATE PRODUCTS INVENTORY QUANTITY
    setProducts(prevProducts => prevProducts.map(prod => {
      const matchingItems = items.filter(it => it.product.model === prod.model || it.product.name === prod.name);
      if (matchingItems.length > 0) {
        const addedCount = matchingItems.reduce((s, it) => s + it.quantity, 0);
        const currentStock = typeof prod.totalStock === 'number' ? prod.totalStock : parseNumericValue(prod.productionStock || 25);
        return {
          ...prod,
          totalStock: currentStock + addedCount
        };
      }
      return prod;
    }));

    // 2. ADD SERIALS TO INVENTORY
    const newInventoryEntries: InventoryItem[] = [];
    items.forEach(it => {
      it.serials.forEach(serialStr => {
        newInventoryEntries.push({
          id: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          serial: serialStr,
          productModel: it.product.model,
          productName: it.product.name,
          category: it.product.category,
          status: 'available',
          purchaseDate: purchaseDate,
          unitPurchasePrice: it.unitPurchasePrice,
          supplierName: selectedSupplier.name,
          supplierPhone: selectedSupplier.phone,
          purchaseInvoiceNumber: invoiceNumber
        });
      });
    });

    setInventory(prev => [...newInventoryEntries, ...prev]);
    setPurchases(prev => [newPurchase, ...prev]);
    setSavedPurchaseRecord(newPurchase);
    setIsSuccessModalOpen(true);
  };

  return (
    <div className="space-y-6 text-right font-sans w-full" dir="rtl">
      {/* 1. HEADER HERO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-700/60">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-300 shadow-inner">
              <ShoppingBag className="w-7 h-7" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <span>ثبت فاکتور خرید و ورود به انبار</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-0.5 rounded-full border border-emerald-400/30 font-mono font-bold">
                  تغذیه موجودی انبار
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium leading-relaxed">
                ثبت ورود کالاهای نو و قطعات به انبار با صدور سریال معتبر و افزایش موجودی کالاها در کارگاه دیاکو
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer border border-white/20 flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              <span>مدیریت کاتالوگ کالاها</span>
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. SECTION 1: SUPPLIER & INVOICE DETAILS */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
          <span className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>۱. مشخصات فروشنده/تأمین‌کننده و شماره سند خرید</span>
          </span>
          <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200">
            شماره فاکتور خرید: {toPersianDigits(invoiceNumber)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier Selector Card */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs sm:text-sm font-black text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>فروشنده / تأمین‌کننده کالا</span>
                <span className="text-rose-500 font-black">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ تأمین‌کننده جدید</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupplierSearch('');
                    setShowPartyModal(true);
                  }}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-all"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بانک تأمین‌کنندگان</span>
                </button>
              </div>
            </div>

            {selectedSupplier ? (
              <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-slate-50 border-2 border-emerald-200/90 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                    {selectedSupplier.name.charAt(0)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="font-black text-sm sm:text-base text-slate-900">{selectedSupplier.name}</h4>
                      {selectedSupplier.company && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg font-black border border-emerald-200">
                          {selectedSupplier.company}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
                      <span>تماس: <strong className="text-slate-900 font-bold">{selectedSupplier.phone || '-'}</strong></span>
                      <span>•</span>
                      <span>کد تأمین‌کننده: <strong className="text-slate-900 font-bold">{selectedSupplier.code || selectedSupplier.id}</strong></span>
                    </div>
                    {selectedSupplier.address && (
                      <p className="text-xs text-slate-500">{selectedSupplier.address}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  className="text-xs font-black text-emerald-800 hover:text-emerald-950 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 shadow-xs transition-all cursor-pointer shrink-0"
                >
                  تغییر تأمین‌کننده
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPartyModal(true)}
                className="w-full p-6 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl text-sm font-black text-slate-600 hover:text-emerald-600 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                <Search className="w-5 h-5" />
                <span>انتخاب تأمین‌کننده از بانک طرف حساب‌ها</span>
              </button>
            )}
          </div>

          {/* Date & Meta Box */}
          <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>تاریخ فاکتور خرید</span>
              </label>
              <input
                type="text"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-black outline-none font-mono text-center shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>شماره فاکتور تأمین‌کننده</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-black outline-none font-mono text-center shadow-xs text-indigo-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION 2: ADD PRODUCT TO INVOICE BUILDER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <span className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Package className="w-5 h-5 text-indigo-600" />
          <span>۲. افزودن کالای جدید به لیست فاکتور خرید</span>
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Select Product */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">انتخاب کالا از کاتالوگ دیاکو:</label>
            <select
              value={selectedProduct?.model || ''}
              onChange={(e) => {
                const prod = products.find(p => p.model === e.target.value);
                setSelectedProduct(prod || null);
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-black outline-none text-slate-900 cursor-pointer shadow-xs"
            >
              <option value="">-- انتخاب کالا --</option>
              {products.map(p => (
                <option key={p.model} value={p.model}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
          </div>

          {/* Unit Purchase Price */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">قیمت خرید هر واحد (تومان):</label>
            <input
              type="text"
              value={unitPurchasePrice ? parseInt(unitPurchasePrice).toLocaleString('fa-IR') : ''}
              onChange={(e) => setUnitPurchasePrice(parseNumericValue(e.target.value).toString())}
              placeholder="مثال: ۲,۵۰۰,۰۰۰"
              className="w-full p-2.5 bg-white border border-slate-300 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-mono font-black text-center outline-none shadow-xs"
            />
          </div>

          {/* Manual Serial Add */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">ثبت تک‌سریال دستی:</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={currentSerial}
                onChange={(e) => setCurrentSerial(e.target.value)}
                placeholder="مثال: DEC-1405-901"
                className="flex-1 p-2.5 bg-white border border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-mono font-bold outline-none shadow-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSingleSerial();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSingleSerial}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                افزودن
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Serial Generator Bar */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="text-xs font-black text-indigo-900">تولید خودکار شماره سریال‌های متوالی در تیراژ:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold w-full md:w-auto">
            <input
              type="text"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="پیشوند (DEC)"
              className="w-20 p-2 bg-white border border-indigo-300 rounded-xl text-center font-mono font-bold outline-none"
            />
            <input
              type="number"
              value={bulkCount}
              onChange={(e) => setBulkCount(e.target.value)}
              placeholder="تعداد (۵)"
              className="w-16 p-2 bg-white border border-indigo-300 rounded-xl text-center font-mono font-bold outline-none"
            />
            <input
              type="number"
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
              placeholder="شروع (۱۰۰۱)"
              className="w-24 p-2 bg-white border border-indigo-300 rounded-xl text-center font-mono font-bold outline-none"
            />
            <button
              type="button"
              onClick={handleGenerateBulkSerials}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-black cursor-pointer transition-all shadow-xs"
            >
              تولید و درج در صف
            </button>
          </div>
        </div>

        {/* Current Serials Buffer & Add Button */}
        {serialsList.length > 0 && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-800">
                سریال‌های آماده درج ({toPersianDigits(serialsList.length)} دستگاه):
              </span>
              <button
                type="button"
                onClick={() => setSerialsList([])}
                className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
              >
                پاک کردن همه سریال‌ها
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {serialsList.map((s, idx) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-black text-slate-800 shadow-2xs"
                >
                  <span>{s}</span>
                  <button
                    type="button"
                    onClick={() => setSerialsList(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItemToInvoice}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>افزودن این {toPersianDigits(serialsList.length)} کالا به جدول فاکتور خرید</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. SECTION 3: PURCHASE ITEMS TABLE */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <span className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Layers className="w-5 h-5 text-indigo-600" />
          <span>۳. اقلام نهایی فاکتور خرید ({toPersianDigits(items.length)} ردیف کالا)</span>
        </span>

        <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 shadow-xs">
          <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-800 border-b-2 border-slate-200 font-black text-xs">
                <th className="py-3.5 px-3 w-12 text-center">#</th>
                <th className="py-3.5 px-4 min-w-[260px]">نام و مدل کالا</th>
                <th className="py-3.5 px-3 w-28 text-center">تعداد</th>
                <th className="py-3.5 px-4 w-44 text-center">قیمت واحد خرید (تومان)</th>
                <th className="py-3.5 px-4 min-w-[280px]">شماره سریال‌ها</th>
                <th className="py-3.5 px-4 w-44 text-center">قیمت کل ردیف (تومان)</th>
                <th className="py-3.5 px-3 w-14 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                    هنوز کالایی به فاکتور خرید افزوده نشده است. از بخش فوق کالای مورد نظر را اضافه نمایید.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const lineTotal = item.quantity * item.unitPurchasePrice;
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50'}>
                      <td className="py-4 px-3 text-center font-mono font-black text-slate-400 bg-slate-50/50">
                        {toPersianDigits(idx + 1)}
                      </td>

                      <td className="py-4 px-4 font-black text-slate-900">
                        <div>{item.product.name}</div>
                        <span className="text-[10px] text-slate-500 font-mono">مدل: {item.product.model}</span>
                      </td>

                      <td className="py-4 px-3 text-center font-mono font-black text-sm">
                        {toPersianDigits(item.quantity)} دستگاه
                      </td>

                      <td className="py-4 px-4 text-center font-mono font-black text-sm">
                        {item.unitPurchasePrice.toLocaleString('fa-IR')} تومان
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {item.serials.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono font-bold text-slate-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                          <span className="font-mono font-black text-sm sm:text-base text-emerald-800 block">
                            {lineTotal.toLocaleString('fa-IR')}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold block">تومان</span>
                        </div>
                      </td>

                      <td className="py-4 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. SECTION 4: FINANCIAL SUMMARY & SUBMISSION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Notes & Settlement Method (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <h4 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <span>شیوه تسویه و شرایط خرید</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm font-bold">
            {[
              { id: 'card', label: 'کارت به کارت / پوز' },
              { id: 'cash', label: 'نقد / واریز' },
              { id: 'cheque', label: 'چک تجاری' },
              { id: 'credit', label: 'حساب دفتری' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id as any)}
                className={`py-3 px-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                  paymentMethod === m.id
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-black shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 block">یادداشت و مشخصات فاکتور خرید:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-2xl text-xs sm:text-sm outline-none font-medium leading-relaxed"
            />
          </div>
        </div>

        {/* Calculation & Submit Box (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <h4 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <span>خلاصه ارقام و تسویه فاکتور خرید</span>
          </h4>

          <div className="space-y-3 text-xs sm:text-sm divide-y divide-slate-100">
            <div className="flex justify-between items-center py-1.5">
              <span className="font-bold text-slate-600">جمع ناخالص اقلام:</span>
              <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                {subtotalAmount.toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-slate-600">تخفیف دریافتی:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={discount ? parseInt(discount).toLocaleString('fa-IR') : '۰'}
                  onChange={(e) => setDiscount(parseNumericValue(e.target.value).toString())}
                  className="w-32 bg-slate-50 border border-slate-300 focus:border-indigo-600 rounded-xl px-3 py-1.5 text-center font-mono font-black text-xs sm:text-sm outline-none shadow-2xs"
                />
                <span className="text-xs text-slate-400 font-bold">تومان</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-2">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTax}
                  onChange={(e) => setIncludeTax(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <span>مالیات بر ارزش افزوده (۱۰٪):</span>
              </label>
              <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                {taxAmount.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-5 shadow-lg border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-slate-300 block">مبلغ نهایی پرداختی:</span>
                <span className="text-[11px] text-emerald-400 font-mono">سند خرید انبار</span>
              </div>
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
                {totalPayable.toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div className="bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
              <span className="text-[10.5px] text-slate-300 block font-bold">مبلغ به حروف:</span>
              <p className="text-xs sm:text-sm font-black text-amber-300 leading-relaxed mt-0.5">
                {amountToTomanWords(totalPayable)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSubmitInvoice}
              className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              <span>ثبت فاکتور و افزایش موجودی انبار</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer border border-slate-200 shadow-2xs"
            >
              <Printer className="w-4.5 h-4.5 text-indigo-600" />
              <span>چاپ A4</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. MODAL: SEARCH COUNTERPARTIES */}
      {showPartyModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl relative animate-fade-in text-right font-sans" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black">بانک تأمین‌کنندگان و طرف‌حساب‌ها</h3>
                  <p className="text-xs text-slate-500">انتخاب فروشنده جهت انتساب به سند ورود به انبار</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ تأمین‌کننده جدید</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPartyModal(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="جستجوی نام تأمین‌کننده، نام شرکت، تلفن یا کد اقتصادی..."
                className="w-full pr-11 pl-10 py-3.5 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-indigo-600 rounded-2xl text-xs sm:text-sm font-bold outline-none transition-all shadow-xs"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
              {filteredParties.map(p => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{p.name}</span>
                        {p.company && (
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                            {p.company}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">تلفن: {p.phone || '-'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplier(p.raw);
                      setShowPartyModal(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                  >
                    انتخاب
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: QUICK ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-fade-in text-right font-sans" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black">ثبت مشخصات تأمین‌کننده جدید</h3>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSupplier} className="space-y-3 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-700">نام و نام خانوادگی / مسئول فروش <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  placeholder="مثال: مهندس رضوانی"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-700">نام شرکت / بازرگانی</label>
                <input
                  type="text"
                  value={newSupCompany}
                  onChange={(e) => setNewSupCompany(e.target.value)}
                  placeholder="مثال: بازرگانی قطعات الکترونیک پارس"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-700">شماره تماس <span className="text-rose-500">*</span></label>
                <input
                  type="tel"
                  required
                  value={newSupPhone}
                  onChange={(e) => setNewSupPhone(e.target.value)}
                  placeholder="09121234567"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-center"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md cursor-pointer"
                >
                  ذخیره و انتخاب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: SUCCESS CONFIRMATION */}
      {isSuccessModalOpen && savedPurchaseRecord && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl animate-fade-in font-sans" dir="rtl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle className="w-10 h-10" />
            </div>

            <h3 className="text-lg font-black text-slate-900">فاکتور خرید با موفقیت ثبت گردید!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              شماره فاکتور <strong>{savedPurchaseRecord.invoiceNumber}</strong> ثبت شد، تعداد <strong>{savedPurchaseRecord.items.reduce((s, it) => s + it.quantity, 0)} دستگاه</strong> با شماره سریال‌های معتبر به موجودی انبار آماده فروش کارگاه افزوده شد.
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs font-mono font-bold text-slate-700">
              مبلغ کل: {savedPurchaseRecord.totalPayable.toLocaleString('fa-IR')} تومان ({amountToTomanWords(savedPurchaseRecord.totalPayable)})
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  if (onSuccessReturn) onSuccessReturn();
                  else setActiveTab('register_sale');
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-md"
              >
                ورود به بخش فاکتور فروش
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setShowPrintModal(true);
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black cursor-pointer"
              >
                چاپ فاکتور خرید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: PRINT PREVIEW */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-fade-in text-right font-sans my-auto" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 print:hidden">
              <h3 className="text-base font-black">پیش‌نمایش چاپ فاکتور خرید و رسید ورود به انبار (A4)</h3>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-slate-900 rounded-2xl p-6 sm:p-8 bg-white space-y-5 text-xs font-sans">
              <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-black">صنایع الکترونیک دیاکو — رسید ورود کالا و قطعات به انبار</h2>
                  <p className="text-slate-600 font-bold">فاکتور ثبت خرید رسمی و رسید تحویل انبار مرکزی</p>
                </div>
                <div className="text-right font-mono text-xs space-y-1">
                  <div><strong>شماره سند:</strong> {toPersianDigits(invoiceNumber)}</div>
                  <div><strong>تاریخ:</strong> {purchaseDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                  <span className="font-black block">مشخصات خریدار / انبار مقصد:</span>
                  <p>صنایع الکترونیک دیاکو — انبار مرکزی تهران</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                  <span className="font-black block">مشخصات فروشنده / تأمین‌کننده:</span>
                  <p>{selectedSupplier?.name} ({selectedSupplier?.company || 'شخص حقیقی'})</p>
                  <p>تلفن: {selectedSupplier?.phone || '-'}</p>
                </div>
              </div>

              <table className="w-full text-right text-xs border border-slate-900">
                <thead>
                  <tr className="bg-slate-200 font-black border-b border-slate-900 text-center">
                    <th className="p-2 border-l border-slate-900 w-10">ردیف</th>
                    <th className="p-2 border-l border-slate-900 text-right">شرح کالا</th>
                    <th className="p-2 border-l border-slate-900 w-16">تعداد</th>
                    <th className="p-2 border-l border-slate-900 w-32">قیمت واحد (تومان)</th>
                    <th className="p-2 border-l border-slate-900">سریال‌ها</th>
                    <th className="p-2 w-32">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="text-center font-bold border-b border-slate-300">
                      <td className="p-2 border-l border-slate-400 font-mono">{toPersianDigits(i + 1)}</td>
                      <td className="p-2 border-l border-slate-400 text-right">{it.product.name} ({it.product.model})</td>
                      <td className="p-2 border-l border-slate-400 font-mono font-black">{toPersianDigits(it.quantity)}</td>
                      <td className="p-2 border-l border-slate-400 font-mono">{it.unitPurchasePrice.toLocaleString('fa-IR')}</td>
                      <td className="p-2 border-l border-slate-400 font-mono text-[10px] text-right">{it.serials.join(', ')}</td>
                      <td className="p-2 font-mono font-black">{(it.quantity * it.unitPurchasePrice).toLocaleString('fa-IR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center py-2 bg-slate-900 text-white p-3 rounded-xl font-black text-sm">
                <span>مبلغ کل سند خرید:</span>
                <span className="font-mono text-emerald-400 text-base">{totalPayable.toLocaleString('fa-IR')} تومان ({amountToTomanWords(totalPayable)})</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4.5 h-4.5" />
                <span>ارسال به پرینتر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
