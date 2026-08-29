import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Search, 
  Building2, 
  Users, 
  UserPlus, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  X, 
  Check, 
  Percent, 
  Info,
  Calendar,
  Sparkles,
  Package,
  ShieldCheck,
  ShoppingBag,
  Barcode,
  Layers,
  AlertTriangle,
  Landmark,
  Coins,
  Receipt,
  FileCheck,
  Calculator,
  Phone,
  MapPin,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  LogOut,
  RotateCcw,
  ArrowRight,
  Send,
  FileText,
  SlidersHorizontal,
  Settings2,
  Maximize2
} from 'lucide-react';
import { Customer, Supplier, Product, WarrantyItem, InventoryItem, SaleRecord, PurchaseRecord, BankAccount } from '../types';
import { numberToPersianWords, amountToTomanWords } from '../utils/numberToPersianWords';

// Invoice Type Definition matching Holoo Tabs in VVVV.jpg
export type HolooInvoiceType = 
  | 'sale'              // فروش
  | 'purchase'          // خرید
  | 'proforma'          // پیش فاکتور
  | 'consignment'       // امانی
  | 'purchase_return'   // برگشت از خرید
  | 'sale_return'       // برگشت از فروش
  | 'waste';            // ضایعات

export interface PartyAccount {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
  type: string;
  nationalId?: string;
  economicCode?: string;
  category: 'customer' | 'supplier' | 'colleague' | 'corporate';
}

export interface HolooInvoiceRow {
  id: string;
  productCode: string;
  productName: string;
  productModel: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  stock: number;
  purchasePrice?: number;
  serials: string[];
  warrantyMonths: number;
  notes?: string;
}

interface HolooInvoiceFormProps {
  initialType?: HolooInvoiceType;
  customers?: Customer[];
  setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>;
  suppliers?: Supplier[];
  setSuppliers?: React.Dispatch<React.SetStateAction<Supplier[]>>;
  products?: Product[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  warrantyDb?: WarrantyItem[];
  setWarrantyDb?: React.Dispatch<React.SetStateAction<WarrantyItem[]>>;
  inventory?: InventoryItem[];
  setInventory?: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  sales?: SaleRecord[];
  setSales?: React.Dispatch<React.SetStateAction<SaleRecord[]>>;
  purchases?: PurchaseRecord[];
  setPurchases?: React.Dispatch<React.SetStateAction<PurchaseRecord[]>>;
  bankAccounts?: BankAccount[];
  setActiveTab?: (tab: any) => void;
  onSaveSuccess?: (invoiceData: any) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Convert string/English numbers to Persian numbers
const toPersianDigits = (str: string | number) => {
  if (str === undefined || str === null) return '';
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

// Utility to parse Persian or formatted numeric strings
const parseNumeric = (val: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const englishStr = val
    .toString()
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[^\d-]/g, '');
  const parsed = parseInt(englishStr, 10);
  return isNaN(parsed) ? 0 : parsed;
};

// Format Currency
const formatToman = (val: number | string) => {
  const num = typeof val === 'string' ? parseNumeric(val) : val;
  if (!num || isNaN(num)) return '۰';
  return num.toLocaleString('fa-IR');
};

// Play short scanner beep sound
const playScannerBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // AudioContext blocked or not supported
  }
};

export const HolooInvoiceForm: React.FC<HolooInvoiceFormProps> = ({
  initialType = 'sale',
  customers = [],
  setCustomers,
  suppliers = [],
  setSuppliers,
  products = [],
  setProducts,
  warrantyDb = [],
  setWarrantyDb,
  inventory = [],
  setInventory,
  sales = [],
  setSales,
  purchases = [],
  setPurchases,
  bankAccounts = [],
  setActiveTab,
  onSaveSuccess,
  showToast
}) => {
  // 1. Active Invoice Type Tab (Default: فروش)
  const [activeInvoiceType, setActiveInvoiceType] = useState<HolooInvoiceType>(initialType);

  // 2. Party accounts combined directory
  const allParties: PartyAccount[] = useMemo(() => {
    const list: PartyAccount[] = [];

    // Map Customers
    if (customers && customers.length > 0) {
      customers.forEach(c => {
        list.push({
          id: c.id,
          code: c.nationalId ? c.nationalId.slice(-5) : `10${Math.floor(100 + Math.random() * 900)}`,
          name: c.name,
          phone: c.phone,
          address: c.address || '',
          balance: c.balance || 0,
          type: c.type === 'representative' ? 'همکار / نمایندگی' : (c.type === 'corporate' ? 'شخص حقوقی' : 'مشتری حقیقی'),
          nationalId: c.nationalId,
          economicCode: c.economicCode,
          category: c.type === 'representative' ? 'colleague' : (c.type === 'corporate' ? 'corporate' : 'customer')
        });
      });
    }

    // Map Suppliers
    if (suppliers && suppliers.length > 0) {
      suppliers.forEach(s => {
        list.push({
          id: s.id,
          code: s.code || `SUP-${Math.floor(100 + Math.random() * 900)}`,
          name: s.name,
          phone: s.phone,
          address: s.address || '',
          balance: s.balance || 0,
          type: 'تأمین‌کننده قطعات',
          nationalId: s.nationalId,
          economicCode: s.economicCode,
          category: 'supplier'
        });
      });
    }

    // Fallback sample if empty
    if (list.length === 0) {
      list.push(
        {
          id: 'cust-ali-bmi',
          code: '۰۰۱۵۲',
          name: 'ALI BMI',
          phone: '۰۹۱۲۱۲۳۰۱۵۲',
          address: 'تهران، خیابان لاله زار جنوبی، پاساژ ادیسون، پلاک ۲۴',
          balance: 19200000,
          type: 'مشتری اعتباری',
          category: 'customer'
        },
        {
          id: 'cust-102',
          code: '۰۰۱۵۳',
          name: 'فروشگاه الکترو نوین البرز (مرادی)',
          phone: '۰۹۳۵۵۵۵۱۲۳۴',
          address: 'کرج، میدان توحید، نبش بلوار بلال، پلاک ۸',
          balance: -4500000,
          type: 'همکار / نمایندگی',
          category: 'colleague'
        },
        {
          id: 'sup-101',
          code: '۰۰۵۰۱',
          name: 'بازرگانی قطعات ترانس و مس خاورمیانه',
          phone: '۰۲۱۸۸۷۷۶۶۵۵',
          address: 'تهران، شادآباد، بازار آهن، بلوک ۴',
          balance: 85000000,
          type: 'تأمین‌کننده اصلی',
          category: 'supplier'
        }
      );
    }

    return list;
  }, [customers, suppliers]);

  // Selected party for this invoice
  const [selectedParty, setSelectedParty] = useState<PartyAccount | null>(() => {
    return allParties.find(p => p.name === 'ALI BMI') || allParties[0] || null;
  });

  // Invoice Number & Date
  const [invoiceNumber, setInvoiceNumber] = useState<string>('۲۴۰');
  const [dateYear, setDateYear] = useState<string>('۱۴۰۵');
  const [dateMonth, setDateMonth] = useState<string>('۰۶');
  const [dateDay, setDateDay] = useState<string>('۰۴');
  const formattedInvoiceDate = `${dateYear}/${dateMonth}/${dateDay}`;
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [showPrintSettingsModal, setShowPrintSettingsModal] = useState<boolean>(false);

  // Column widths configuration (in centimeters) for A4 and A5
  const [a4ColumnWidths, setA4ColumnWidths] = useState({
    rowNumber: 1.2,
    productName: 5.4,
    serialsColumn: 5.8,
    quantity: 1.6,
    unitPrice: 2.4,
    totalPrice: 2.6
  });

  const [a5ColumnWidths, setA5ColumnWidths] = useState({
    rowNumber: 0.9,
    productName: 3.8,
    serialsColumn: 4.4,
    quantity: 1.2,
    unitPrice: 1.6,
    totalPrice: 1.6
  });

  // Serial rendering settings
  const [serialFontSizePt, setSerialFontSizePt] = useState<number>(8.5);
  const [autoCalculateSerials, setAutoCalculateSerials] = useState<boolean>(true);
  const [manualSerialsPerRow, setManualSerialsPerRow] = useState<number>(3);

  // Active column widths based on current paper size
  const activeColWidths = paperSize === 'A4' ? a4ColumnWidths : a5ColumnWidths;

  // Smart Serial Calculation function
  const calculateSerialRows = (serials: string[]) => {
    if (!serials || serials.length === 0) {
      return { itemsPerRow: 1, chunks: [], singleBoxWidthMm: 0, colWidthMm: activeColWidths.serialsColumn * 10 };
    }

    if (!autoCalculateSerials) {
      const itemsPerRow = Math.max(1, manualSerialsPerRow);
      const chunks: string[][] = [];
      for (let i = 0; i < serials.length; i += itemsPerRow) {
        chunks.push(serials.slice(i, i + itemsPerRow));
      }
      return { itemsPerRow, chunks, singleBoxWidthMm: 0, colWidthMm: activeColWidths.serialsColumn * 10 };
    }

    // Measure maximum character length of serials in this row (e.g., 'DEC-1001' has length 8)
    const lengths = serials.map(s => (s || '').trim().length);
    const maxLen = Math.max(...lengths, 4);
    
    // Accurate character width in mm for monospace font:
    // 1pt = 0.3528mm. In monospace font (Courier/Consolas/monospace), aspect ratio width/height is ~0.60.
    // So 8.5pt font -> height = 3.0mm -> char width = ~1.8mm.
    const charWidthMm = (serialFontSizePt * 0.3528) * 0.60;
    
    // Internal box padding (px-1.5 = ~1.5mm on each side = 3mm) + border (0.5mm)
    const chipPaddingAndBorderMm = 3.5;
    const singleBoxWidthMm = (maxLen * charWidthMm) + chipPaddingAndBorderMm;
    
    // Total available column width in mm (accounting for cell padding ~4mm)
    const colWidthMm = (activeColWidths.serialsColumn * 10);
    const usableColWidthMm = Math.max(20, colWidthMm - 4);
    
    // Calculate how many chips fit in a single line with gap (gap-1 = 4px = ~1.1mm)
    const gapMm = 1.2;
    let itemsPerRow = Math.floor((usableColWidthMm + gapMm) / (singleBoxWidthMm + gapMm));
    
    // Realistic bounds check based on paper width
    if (paperSize === 'A5') {
      itemsPerRow = Math.max(1, Math.min(itemsPerRow, 4));
    } else {
      itemsPerRow = Math.max(1, Math.min(itemsPerRow, 6));
    }

    const chunks: string[][] = [];
    for (let i = 0; i < serials.length; i += itemsPerRow) {
      chunks.push(serials.slice(i, i + itemsPerRow));
    }

    return {
      itemsPerRow,
      chunks,
      singleBoxWidthMm: Math.round(singleBoxWidthMm),
      colWidthMm: Math.round(colWidthMm),
      maxLen
    };
  };

  // Description / Notes & SMS link
  const [description, setDescription] = useState<string>('');
  const [sendSmsLink, setSendSmsLink] = useState<boolean>(false);
  const [smsPhone, setSmsPhone] = useState<string>('');

  // Update smsPhone when selected party changes
  useEffect(() => {
    if (selectedParty && selectedParty.phone) {
      setSmsPhone(selectedParty.phone);
    }
  }, [selectedParty]);

  // Helper to extract stock
  const getProductStock = (p: any): number => {
    if (!p) return 0;
    if (typeof p.totalStock === 'number') return p.totalStock;
    if (p.stock !== undefined) return p.stock;
    if (p.productionStock) return parseNumeric(p.productionStock);
    return 20;
  };

  // Helper to extract selling price
  const getProductSellingPrice = (p: any): number => {
    if (!p) return 4200000;
    if (p.price) return p.price;
    if (p.sellingPrice) return parseNumeric(p.sellingPrice);
    if (p.suggestedPrice) return parseNumeric(p.suggestedPrice);
    return 4200000;
  };

  // Initial Rows matching Holoo table style
  const [rows, setRows] = useState<HolooInvoiceRow[]>(() => {
    if (products && products.length > 0) {
      const p1 = products[0];
      return [
        {
          id: 'row-1',
          productCode: p1.code || 'PRD-101',
          productName: p1.name || 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
          productModel: p1.model || 'DEC-1210-CH',
          quantity: 2,
          unitPrice: getProductSellingPrice(p1),
          unit: 'دستگاه',
          stock: getProductStock(p1),
          purchasePrice: 3100000,
          serials: ['DEC-1001', 'DEC-1002'],
          warrantyMonths: parseInt(p1.warrantyDuration || '18') || 18,
          notes: ''
        }
      ];
    }
    return [
      {
        id: 'row-1',
        productCode: 'PRD-101',
        productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        productModel: 'DEC-1210-CH',
        quantity: 2,
        unitPrice: 4200000,
        unit: 'دستگاه',
        stock: 18,
        purchasePrice: 3100000,
        serials: ['DEC-1001', 'DEC-1002'],
        warrantyMonths: 18,
        notes: ''
      }
    ];
  });

  // Active highlighted row index for cursor selector (*)
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  // Financial Discounts & Taxes
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [vatAmount, setVatAmount] = useState<number>(0);

  // Modals
  const [showPartySearchModal, setShowPartySearchModal] = useState<boolean>(false);
  const [partySearchQuery, setPartySearchQuery] = useState<string>('');
  const [showPartyBalanceLedgerModal, setShowPartyBalanceLedgerModal] = useState<boolean>(false);
  const [showProductSearchModal, setShowProductSearchModal] = useState<boolean>(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [targetRowForProduct, setTargetRowForProduct] = useState<string | null>(null);

  // Dedicated Serial Numbers Manager Modal (as requested by user)
  const [showSerialModal, setShowSerialModal] = useState<boolean>(false);
  const [serialModalRowId, setSerialModalRowId] = useState<string | null>(null);
  const [quickSerialInput, setQuickSerialInput] = useState<string>('');
  const [serialRangePrefix, setSerialRangePrefix] = useState<string>('DEC-');
  const [serialRangeFrom, setSerialRangeFrom] = useState<string>('1001');
  const [serialRangeTo, setSerialRangeTo] = useState<string>('1005');
  const [bulkSerialPaste, setBulkSerialPaste] = useState<string>('');

  // Print Preview Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Active Row for Serial Modal
  const activeSerialRow = useMemo(() => {
    return rows.find(r => r.id === serialModalRowId) || null;
  }, [rows, serialModalRowId]);

  // Calculations
  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + ((r.quantity || 0) * (r.unitPrice || 0)), 0);
  }, [rows]);

  const totalProfit = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pPrice = r.purchasePrice || (r.unitPrice * 0.75);
      return sum + (r.quantity * (r.unitPrice - pPrice));
    }, 0);
  }, [rows]);

  const finalNetPayable = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + vatAmount);
  }, [subtotal, discountAmount, vatAmount]);

  // Amount in words
  const amountInWords = useMemo(() => {
    return amountToTomanWords(finalNetPayable);
  }, [finalNetPayable]);

  // Toast trigger
  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (showToast) {
      showToast(msg, type);
    }
  };

  // Add new empty row
  const handleAddNewRow = () => {
    const newId = `row-${Date.now()}`;
    const defaultProduct = products && products.length > 0 ? products[0] : null;
    const newRow: HolooInvoiceRow = {
      id: newId,
      productCode: defaultProduct?.code || `PRD-${Math.floor(100 + Math.random() * 900)}`,
      productName: defaultProduct?.name || '',
      productModel: defaultProduct?.model || '',
      quantity: 1,
      unitPrice: defaultProduct ? getProductSellingPrice(defaultProduct) : 0,
      unit: 'دستگاه',
      stock: defaultProduct ? getProductStock(defaultProduct) : 0,
      purchasePrice: 0,
      serials: [],
      warrantyMonths: 18,
      notes: ''
    };
    setRows(prev => [...prev, newRow]);
    setActiveRowIndex(rows.length);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    if (rows.length === 1) {
      // Keep at least 1 empty row
      setRows([{
        id: `row-${Date.now()}`,
        productCode: '',
        productName: '',
        productModel: '',
        quantity: 1,
        unitPrice: 0,
        unit: 'دستگاه',
        stock: 0,
        purchasePrice: 0,
        serials: [],
        warrantyMonths: 18,
        notes: ''
      }]);
      setActiveRowIndex(0);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
    if (activeRowIndex >= rows.length - 1) {
      setActiveRowIndex(Math.max(0, rows.length - 2));
    }
  };

  // Update row field
  const handleUpdateRow = (id: string, field: keyof HolooInvoiceRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row;

      const updated = { ...row, [field]: value };

      // If user changed quantity, warn or adjust if serials count mismatch
      if (field === 'quantity') {
        const qty = parseNumeric(value) || 0;
        updated.quantity = qty;
      }

      // If user changed unit price
      if (field === 'unitPrice') {
        updated.unitPrice = parseNumeric(value);
      }

      return updated;
    }));
  };

  // Select Product for row
  const handleSelectProductForRow = (rowId: string, prod: Product) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const isPurchase = activeInvoiceType === 'purchase' || activeInvoiceType === 'purchase_return';
      const price = isPurchase 
        ? (parseNumeric((prod as any).purchasePrice) || parseNumeric(prod.price) * 0.75 || 2500000)
        : getProductSellingPrice(prod);

      return {
        ...row,
        productCode: prod.code || prod.model || 'PRD-000',
        productName: prod.name,
        productModel: prod.model || prod.name,
        unitPrice: price,
        stock: getProductStock(prod),
        warrantyMonths: parseInt((prod as any).warrantyDuration || '18') || 18,
        unit: 'دستگاه'
      };
    }));
    setShowProductSearchModal(false);
    setTargetRowForProduct(null);
  };

  // Open Serial Manager for a row
  const handleOpenSerialModal = (rowId: string) => {
    setSerialModalRowId(rowId);
    setQuickSerialInput('');
    setBulkSerialPaste('');
    
    // Auto-detect prefix based on product model if available
    const currentRow = rows.find(r => r.id === rowId);
    if (currentRow && currentRow.productModel) {
      const match = currentRow.productModel.match(/^([A-Za-z]+)-/);
      if (match) {
        setSerialRangePrefix(`${match[1]}-`);
      } else {
        setSerialRangePrefix('DEC-');
      }
    } else {
      setSerialRangePrefix('DEC-');
    }
    
    setShowSerialModal(true);
  };

  // Add single serial from scanner / input
  const handleAddSingleSerial = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const serialClean = quickSerialInput.trim().toUpperCase();
    if (!serialClean) return;

    if (!serialModalRowId) return;

    const row = rows.find(r => r.id === serialModalRowId);
    if (!row) return;

    if (row.serials.includes(serialClean)) {
      triggerToast(`شماره سریال ${serialClean} قبلاً برای این ردیف ثبت شده است.`, 'error');
      return;
    }

    playScannerBeep();

    setRows(prev => prev.map(r => {
      if (r.id !== serialModalRowId) return r;
      const newSerials = [...r.serials, serialClean];
      return {
        ...r,
        serials: newSerials,
        // Auto update quantity if serials count exceeds current quantity
        quantity: Math.max(r.quantity, newSerials.length)
      };
    }));

    setQuickSerialInput('');
    triggerToast(`سریال ${serialClean} با موفقیت ثبت شد.`, 'success');
  };

  // Remove serial from row
  const handleRemoveSerial = (rowId: string, serialToRemove: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        serials: r.serials.filter(s => s !== serialToRemove)
      };
    }));
  };

  // Generate range of serials
  const handleGenerateSerialRange = () => {
    if (!serialModalRowId) return;
    const fromNum = parseInt(serialRangeFrom, 10);
    const toNum = parseInt(serialRangeTo, 10);

    if (isNaN(fromNum) || isNaN(toNum) || fromNum > toNum) {
      triggerToast('بازه عددی سریال‌ها معتبر نمی‌باشد.', 'error');
      return;
    }

    if (toNum - fromNum > 100) {
      triggerToast('حداکثر ۱۰۰ سریال در هر بار تولید مجاز است.', 'error');
      return;
    }

    const generated: string[] = [];
    for (let i = fromNum; i <= toNum; i++) {
      generated.push(`${serialRangePrefix}${i}`);
    }

    setRows(prev => prev.map(r => {
      if (r.id !== serialModalRowId) return r;
      const combined = Array.from(new Set([...r.serials, ...generated]));
      return {
        ...r,
        serials: combined,
        quantity: Math.max(r.quantity, combined.length)
      };
    }));

    triggerToast(`${generated.length} شماره سریال به ردیف کالا اضافه شد.`, 'success');
  };

  // Process bulk serials paste
  const handleProcessBulkPaste = () => {
    if (!serialModalRowId || !bulkSerialPaste.trim()) return;

    const extracted = bulkSerialPaste
      .split(/[\n,;\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 2);

    if (extracted.length === 0) {
      triggerToast('هیچ شماره سریالی در متن ورودی یافت نشد.', 'error');
      return;
    }

    setRows(prev => prev.map(r => {
      if (r.id !== serialModalRowId) return r;
      const combined = Array.from(new Set([...r.serials, ...extracted]));
      return {
        ...r,
        serials: combined,
        quantity: Math.max(r.quantity, combined.length)
      };
    }));

    setBulkSerialPaste('');
    triggerToast(`${extracted.length} شماره سریال از متن استخراج و ثبت شد.`, 'success');
  };

  // Main Submit / Confirm Invoice (F2)
  const handleConfirmInvoice = () => {
    // 1. Validation
    if (!selectedParty) {
      triggerToast('لطفاً ابتدا طرف حساب فاکتور را مشخص فرمایید.', 'error');
      return;
    }

    const validRows = rows.filter(r => r.productName.trim().length > 0 && r.quantity > 0);
    if (validRows.length === 0) {
      triggerToast('فاکتور فاقد اقلام معتبر می‌باشد. لطفاً حداقل یک کالا ثبت کنید.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const invoiceId = `INV-${Date.now()}`;
    const invoiceLabel = 
      activeInvoiceType === 'sale' ? 'فروش' :
      activeInvoiceType === 'purchase' ? 'خرید' :
      activeInvoiceType === 'proforma' ? 'پیش فاکتور' :
      activeInvoiceType === 'consignment' ? 'امانی' :
      activeInvoiceType === 'purchase_return' ? 'برگشت از خرید' :
      activeInvoiceType === 'sale_return' ? 'برگشت از فروش' : 'ضایعات';

    // A. IF SALES INVOICE (فروش)
    if (activeInvoiceType === 'sale' || activeInvoiceType === 'sale_return') {
      const saleRecord: SaleRecord = {
        id: invoiceId,
        invoiceNumber: invoiceNumber,
        saleDate: formattedInvoiceDate,
        customer: {
          name: selectedParty.name,
          phone: selectedParty.phone,
          type: selectedParty.type,
          address: selectedParty.address
        },
        items: validRows.map(r => ({
          product: {
            name: r.productName,
            model: r.productModel,
            warrantyDuration: `${r.warrantyMonths} ماه`,
            suggestedPrice: r.unitPrice.toString(),
            category: 'شارژر صنعتی'
          },
          serials: r.serials,
          unitPrice: r.unitPrice,
          unitPriceStr: `${formatToman(r.unitPrice)} تومان`
        })),
        discount: discountAmount,
        notes: description || 'ثبت شده از طریق سیستم صدور فاکتور هلو',
        status: 'active'
      };

      // Add to sales state
      if (setSales) {
        setSales(prev => [saleRecord, ...prev]);
      }

      // Register Warranty for sold serials
      if (setWarrantyDb && activeInvoiceType === 'sale') {
        const newWarranties: WarrantyItem[] = [];
        validRows.forEach(r => {
          r.serials.forEach(serial => {
            const expYear = parseInt(dateYear, 10) + Math.floor(r.warrantyMonths / 12);
            const expMonth = dateMonth;
            const expDay = dateDay;
            newWarranties.push({
              serial: serial,
              itemName: r.productName,
              customerName: selectedParty.name,
              customerPhone: selectedParty.phone,
              defectType: 'سالم - فعال‌سازی اولیه',
              status: 'active',
              registeredAt: formattedInvoiceDate,
              expiryDate: `${expYear}/${expMonth}/${expDay}`,
              model: r.productModel,
              warrantyStatus: 'معتبر',
              defectDescription: 'فروش اولیه دستگاه با گارانتی طلایی دیاکو'
            });
          });
        });

        if (newWarranties.length > 0) {
          setWarrantyDb(prev => [...newWarranties, ...prev]);
        }
      }

      // Deduct stock from products & update inventory
      if (setProducts && activeInvoiceType === 'sale') {
        setProducts(prev => prev.map(p => {
          const matchingRow = validRows.find(r => r.productModel === p.model || r.productName === p.name);
          if (matchingRow) {
            const current = p.stock !== undefined ? p.stock : 20;
            return { ...p, stock: Math.max(0, current - matchingRow.quantity) };
          }
          return p;
        }));
      }

      // Update customer balance if setCustomers provided
      if (setCustomers) {
        setCustomers(prev => prev.map(c => {
          if (c.id === selectedParty.id || c.name === selectedParty.name) {
            const currentBal = c.balance || 0;
            return { ...c, balance: currentBal + (activeInvoiceType === 'sale' ? finalNetPayable : -finalNetPayable) };
          }
          return c;
        }));
      }
    }

    // B. IF PURCHASE INVOICE (خرید)
    if (activeInvoiceType === 'purchase' || activeInvoiceType === 'purchase_return') {
      const purchaseRecord: PurchaseRecord = {
        id: invoiceId,
        invoiceNumber: invoiceNumber,
        purchaseDate: formattedInvoiceDate,
        supplier: {
          id: selectedParty.id,
          name: selectedParty.name,
          phone: selectedParty.phone,
          address: selectedParty.address,
          code: selectedParty.code
        },
        items: validRows.map(r => ({
          product: {
            name: r.productName,
            model: r.productModel,
            suggestedPrice: r.unitPrice.toString()
          },
          quantity: r.quantity,
          unitPurchasePrice: r.unitPrice,
          unitPurchasePriceStr: `${formatToman(r.unitPrice)} تومان`,
          serials: r.serials
        })),
        paymentMethod: 'credit',
        discount: discountAmount,
        tax: vatAmount,
        totalPayable: finalNetPayable,
        notes: description || 'فاکتور خرید ثبت شده در سامانه هلو',
        status: 'completed',
        createdAt: nowIso
      };

      if (setPurchases) {
        setPurchases(prev => [purchaseRecord, ...prev]);
      }

      // Add to inventory
      if (setInventory && activeInvoiceType === 'purchase') {
        const newInventoryItems: InventoryItem[] = [];
        validRows.forEach(r => {
          r.serials.forEach(serial => {
            newInventoryItems.push({
              id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              serial: serial,
              productName: r.productName,
              productModel: r.productModel,
              purchaseInvoiceNumber: invoiceNumber,
              purchaseDate: formattedInvoiceDate,
              unitPurchasePrice: r.unitPrice,
              supplierName: selectedParty.name,
              supplierPhone: selectedParty.phone,
              status: 'available'
            });
          });
        });

        if (newInventoryItems.length > 0) {
          setInventory(prev => [...newInventoryItems, ...prev]);
        }
      }

      // Increase stock in products
      if (setProducts && activeInvoiceType === 'purchase') {
        setProducts(prev => prev.map(p => {
          const matchingRow = validRows.find(r => r.productModel === p.model || r.productName === p.name);
          if (matchingRow) {
            const current = p.stock !== undefined ? p.stock : 20;
            return { ...p, stock: current + matchingRow.quantity };
          }
          return p;
        }));
      }
    }

    // Success Notification & Reset
    triggerToast(`فاکتور ${invoiceLabel} با شماره «${invoiceNumber}» با موفقیت در سیستم ثبت گردید.`, 'success');

    if (onSaveSuccess) {
      onSaveSuccess({ invoiceNumber, type: activeInvoiceType, total: finalNetPayable });
    }

    // Generate next invoice number
    const nextNum = (parseInt(invoiceNumber, 10) || 240) + 1;
    setInvoiceNumber(nextNum.toString());
  };

  // Top Tabs Configuration matching Holoo in VVVV.jpg (from right to left)
  const holooTabs: { id: HolooInvoiceType; label: string }[] = [
    { id: 'purchase', label: 'خرید' },
    { id: 'proforma', label: 'پیش فاکتور' },
    { id: 'sale', label: 'فروش' },
    { id: 'consignment', label: 'امانی' },
    { id: 'purchase_return', label: 'برگشت از خرید' },
    { id: 'sale_return', label: 'برگشت از فروش' },
    { id: 'waste', label: 'ضایعات' }
  ];

  return (
    <div className="w-full text-right font-sans select-none" dir="rtl">
      
      {/* WINDOW CONTAINER IN HARMONIOUS MODERN APP PALETTE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-slate-800 text-xs">
        
        {/* ================= 1. TOP TABS RIBBON (نوار برگه‌ها / انواع فاکتور هلو) ================= */}
        <div className="bg-slate-50/90 border-b border-slate-200 px-3 pt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {holooTabs.map(tab => {
              const isActive = activeInvoiceType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInvoiceType(tab.id)}
                  className={`px-4 py-2 text-xs font-black transition-all cursor-pointer rounded-t-xl relative shrink-0 border-t border-x ${
                    isActive
                      ? 'bg-white text-blue-700 border-slate-200 border-b-transparent shadow-xs font-black -mb-[1px] z-10'
                      : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 border-transparent'
                  }`}
                >
                  {/* Top line accent */}
                  {isActive && (
                    <span className="absolute top-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-t-xl" />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Left Arrow Button [ > ] */}
          <button
            type="button"
            className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold cursor-pointer shrink-0 shadow-2xs"
            title="منوی سریع"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* ================= 2. TOP FORM HEADER (طرف حساب، شماره فاکتور، تاریخ) ================= */}
        <div className="p-3.5 sm:p-4 bg-slate-100/60 border-b border-slate-300 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* RIGHT SIDE: COUNTERPARTY (طرف حساب، کد، تلفن، مانده) */}
            <div className="md:col-span-8 lg:col-span-9 space-y-2.5">
              
              {/* Row 1: طرف حساب + کد + تلفن + مانده */}
              <div className="flex flex-wrap items-center gap-2.5">
                
                {/* طرف حساب Label & Select Box */}
                <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                  <span className="font-black text-slate-800 shrink-0 text-xs">طرف حساب:</span>
                  
                  {/* Combobox */}
                  <div 
                    onClick={() => setShowPartySearchModal(true)}
                    className="flex-1 bg-white hover:border-blue-500 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 flex items-center justify-between cursor-pointer shadow-2xs min-h-[34px] transition-colors"
                  >
                    <span className="font-black tracking-wide truncate text-xs text-slate-900">
                      {selectedParty ? selectedParty.name : 'انتخاب طرف حساب از لیست...'}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 mr-1 shadow-2xs">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* کد طرف حساب */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-slate-700 text-xs">کد:</span>
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2 py-1 min-w-[65px] justify-between shadow-2xs">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {selectedParty ? selectedParty.code : '۰۰۱۵۲'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setShowPartySearchModal(true)} />
                  </div>
                </div>

                {/* شماره تلفن طرف حساب (جعبه خوانا و واضح) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-slate-700 text-xs">تلفن:</span>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={selectedParty?.phone || ''}
                      onChange={(e) => {
                        if (selectedParty) {
                          setSelectedParty({ ...selectedParty, phone: e.target.value });
                        }
                      }}
                      placeholder="۰۹۱۲..."
                      className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-mono font-black text-slate-900 w-32 sm:w-36 focus:outline-none focus:border-blue-600 shadow-2xs text-center"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                  </div>
                </div>

                {/* مانده حساب (Red Number with Ledger Button) */}
                <div className="flex items-center gap-1.5 shrink-0 mr-auto">
                  <span className="font-bold text-slate-700 text-xs">مانده:</span>
                  <div className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 font-mono font-black text-rose-600 text-xs min-w-[90px] text-center shadow-2xs">
                    {formatToman(selectedParty ? selectedParty.balance : 19200000)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPartyBalanceLedgerModal(true)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-black text-slate-800 cursor-pointer shadow-2xs transition-colors"
                    title="گردش حساب و معین"
                  >
                    معین
                  </button>
                </div>
              </div>

              {/* Row 2: آدرس */}
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-800 shrink-0 text-xs">آدرس:</span>
                <input
                  type="text"
                  value={selectedParty?.address || ''}
                  onChange={(e) => {
                    if (selectedParty) {
                      setSelectedParty({ ...selectedParty, address: e.target.value });
                    }
                  }}
                  placeholder="آدرس کامل طرف حساب، شهر، خیابان، پلاک..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 shadow-2xs"
                />
              </div>
            </div>

            {/* LEFT SIDE: INVOICE NUMBER & DATE (شماره فاکتور و تاریخ - ابعاد استاندارد و چینش صحیح) */}
            <div className="md:col-span-4 lg:col-span-3 bg-white p-2.5 rounded-xl border border-slate-300/90 shadow-2xs space-y-2">
              
              {/* شماره فاکتور */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-700 text-xs">شماره فاکتور:</span>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-24 sm:w-28 bg-slate-100/70 border border-slate-300 rounded-lg px-2 py-0.5 font-mono font-black text-slate-900 text-center text-xs focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              {/* تاریخ (روز در راست، ماه در وسط، سال در چپ در ساختار راست‌به‌چپ) */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-700 text-xs">تاریخ:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-xs" dir="rtl">
                  {/* روز (سمت راست) */}
                  <input
                    type="text"
                    title="روز"
                    placeholder="روز"
                    value={dateDay}
                    onChange={(e) => setDateDay(e.target.value)}
                    className="w-8 sm:w-9 bg-slate-100/70 border border-slate-300 rounded-lg px-1 py-0.5 text-center text-xs focus:outline-none focus:bg-white focus:border-blue-600 font-bold"
                  />
                  <span className="text-slate-400">/</span>
                  {/* ماه (وسط) */}
                  <input
                    type="text"
                    title="ماه"
                    placeholder="ماه"
                    value={dateMonth}
                    onChange={(e) => setDateMonth(e.target.value)}
                    className="w-8 sm:w-9 bg-slate-100/70 border border-slate-300 rounded-lg px-1 py-0.5 text-center text-xs focus:outline-none focus:bg-white focus:border-blue-600 font-bold"
                  />
                  <span className="text-slate-400">/</span>
                  {/* سال (سمت چپ مانند ۱۴۰۵) */}
                  <input
                    type="text"
                    title="سال"
                    placeholder="سال"
                    value={dateYear}
                    onChange={(e) => setDateYear(e.target.value)}
                    className="w-12 sm:w-14 bg-slate-100/70 border border-slate-300 rounded-lg px-1 py-0.5 text-center text-xs focus:outline-none focus:bg-white focus:border-blue-600 font-bold"
                  />
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* ================= 3. CENTRAL DATA GRID (جدول ستون‌های فاکتور هلو + جایگاه شماره سریال) ================= */}
        <div className="bg-white overflow-x-auto min-h-[260px] max-h-[460px] border-b border-slate-200">
          <table className="w-full text-right border-collapse text-xs">
            
            {/* TABLE HEADERS */}
            <thead className="bg-slate-100/90 border-b border-slate-200 sticky top-0 z-10 text-slate-800 font-black">
              <tr className="divide-x divide-x-reverse divide-slate-200">
                <th className="py-2 px-2 w-10 text-center font-bold text-slate-700">ردیف</th>
                <th className="py-2 px-2 w-24 text-center">کد کالا</th>
                <th className="py-2 px-3 min-w-[200px]">نام کالا</th>
                <th className="py-2 px-2 w-16 text-center">تعداد</th>
                <th className="py-2 px-2.5 w-28 text-center">فی (تومان)</th>
                <th className="py-2 px-2 w-20 text-center">واحد</th>
                <th className="py-2 px-3 w-32 text-center">جمع</th>
                <th className="py-2 px-2 w-16 text-center text-slate-700">موجودی</th>
                <th className="py-2 px-2 w-20 text-center text-emerald-800">سود</th>
                
                {/* DEDICATED SERIAL NUMBERS & DESCRIPTION SLOT (تعبیه جایگاه اختصاصی شماره سریال) */}
                <th className="py-2 px-3 min-w-[240px] bg-blue-50/70 text-blue-950 font-black">
                  <div className="flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>شماره سریال‌ها و شرح کالا</span>
                  </div>
                </th>

                <th className="py-2 px-1.5 w-6 text-center text-slate-400">*</th>
              </tr>
            </thead>

            {/* TABLE BODY ROWS */}
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const lineTotal = (row.quantity || 0) * (row.unitPrice || 0);
                const lineProfit = lineTotal - ((row.purchasePrice || (row.unitPrice * 0.75)) * row.quantity);
                const isSelected = activeRowIndex === idx;

                return (
                  <tr 
                    key={row.id}
                    onClick={() => setActiveRowIndex(idx)}
                    className={`divide-x divide-x-reverse divide-slate-100 transition-colors ${
                      isSelected ? 'bg-blue-50/40' : (idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white')
                    }`}
                  >
                    
                    {/* ردیف + دکمه حذف */}
                    <td className="py-1.5 px-1.5 text-center font-mono font-bold text-slate-700">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRow(row.id);
                          }}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md cursor-pointer transition-colors"
                          title="حذف سطر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span>{toPersianDigits(idx + 1)}</span>
                      </div>
                    </td>

                    {/* کد کالا */}
                    <td className="py-1.5 px-1 text-center font-mono">
                      <input
                        type="text"
                        value={row.productCode}
                        onChange={(e) => handleUpdateRow(row.id, 'productCode', e.target.value)}
                        className="w-full bg-transparent text-center font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border focus:border-blue-400 rounded-md px-1 py-0.5"
                        placeholder="کد..."
                      />
                    </td>

                    {/* نام کالا + دکمه جستجو */}
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetRowForProduct(row.id);
                            setShowProductSearchModal(true);
                          }}
                          className="p-1 rounded-md bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 cursor-pointer shrink-0 transition-colors"
                          title="انتخاب کالا از لیست (F4)"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="text"
                          value={row.productName}
                          onChange={(e) => handleUpdateRow(row.id, 'productName', e.target.value)}
                          placeholder="نام کالا را وارد یا انتخاب فرمایید..."
                          className="w-full bg-transparent font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border focus:border-blue-400 rounded-md px-1.5 py-0.5"
                        />
                      </div>
                    </td>

                    {/* تعداد */}
                    <td className="py-1.5 px-1 text-center">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleUpdateRow(row.id, 'quantity', e.target.value)}
                        className="w-full bg-transparent text-center font-mono font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border focus:border-blue-400 rounded-md px-1 py-0.5"
                      />
                    </td>

                    {/* فی (قیمت واحد) */}
                    <td className="py-1.5 px-1.5 text-center font-mono font-black text-slate-900">
                      <input
                        type="text"
                        value={formatToman(row.unitPrice)}
                        onChange={(e) => handleUpdateRow(row.id, 'unitPrice', e.target.value)}
                        className="w-full bg-transparent text-center font-mono font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border focus:border-blue-400 rounded-md px-1 py-0.5"
                      />
                    </td>

                    {/* واحد */}
                    <td className="py-1.5 px-1 text-center">
                      <select
                        value={row.unit}
                        onChange={(e) => handleUpdateRow(row.id, 'unit', e.target.value)}
                        className="bg-transparent text-center text-slate-700 font-bold focus:bg-white focus:outline-none rounded-md px-1 py-0.5 cursor-pointer text-xs"
                      >
                        <option value="دستگاه">دستگاه</option>
                        <option value="عدد">عدد</option>
                        <option value="قطعه">قطعه</option>
                        <option value="پک">پک</option>
                        <option value="متر">متر</option>
                      </select>
                    </td>

                    {/* جمع سطر */}
                    <td className="py-1.5 px-2 text-center font-mono font-black text-slate-950 bg-slate-50/40">
                      {formatToman(lineTotal)}
                    </td>

                    {/* موجودي انبار */}
                    <td className="py-1.5 px-1 text-center font-mono font-bold text-slate-700">
                      <span className={`px-1.5 py-0.5 rounded-md text-[11px] ${row.stock <= 2 ? 'bg-rose-50 text-rose-700 font-black' : 'bg-slate-100 text-slate-700'}`}>
                        {toPersianDigits(row.stock)}
                      </span>
                    </td>

                    {/* سود سطر */}
                    <td className="py-1.5 px-1 text-center font-mono font-bold text-emerald-700">
                      {formatToman(Math.max(0, lineProfit))}
                    </td>

                    {/* جایگاه اختصاصی شماره سریال‌ها (DEDICATED SERIAL SLOT) */}
                    <td className="py-1.5 px-2 bg-blue-50/30">
                      <div className="flex items-center gap-1.5 justify-between">
                        
                        {/* Serials Preview / Badge */}
                        <div className="flex items-center gap-1 overflow-x-auto max-w-[180px] scrollbar-none">
                          {row.serials && row.serials.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-black shrink-0">
                                {toPersianDigits(row.serials.length)} سریال
                              </span>
                              <span className="text-[10px] font-mono text-slate-700 truncate" title={row.serials.join(' ، ')}>
                                {row.serials.slice(0, 2).join(', ')} {row.serials.length > 2 ? '...' : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">بدون سریال</span>
                          )}
                        </div>

                        {/* Button to Open Serial Manager */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSerialModal(row.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 shrink-0 transition-colors cursor-pointer border shadow-2xs ${
                            row.serials.length === row.quantity
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                          }`}
                        >
                          <Barcode className="w-3.5 h-3.5" />
                          <span>{row.serials.length === row.quantity ? '✓ تکمیل' : 'ثبت/اسکن'}</span>
                        </button>
                      </div>
                    </td>

                    {/* * Cursor Indicator */}
                    <td className="py-1.5 px-1 text-center font-black text-blue-600">
                      {isSelected ? '★' : ''}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ================= 4. ADD ROW & QUICK SHORTCUTS BAR ================= */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddNewRow}
              className="px-3.5 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>افزودن سطر جدید (F5)</span>
            </button>

            <span className="text-xs text-slate-600 font-bold mr-2">
              تعداد اقلام: <span className="font-mono font-black text-slate-900">{toPersianDigits(rows.length)}</span> سطر
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
            <span>سود تقریبی فاکتور:</span>
            <span className="font-mono font-black text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
              {formatToman(totalProfit)} تومان
            </span>
          </div>
        </div>

        {/* ================= 5. BOTTOM SUMMARY (پاورقی فاکتور: کادرها، توضیحات، ارسال پیامک) ================= */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3.5">
          
          {/* Top Row: 4 Calculation Boxes (جمع کل، تخفیف، مالیات، خالص قابل پرداخت) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* ۱. جمع کل اقلام */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
              <span className="text-[11px] font-black text-slate-500 block">جمع کل اقلام:</span>
              <span className="font-mono font-black text-slate-900 text-sm block">
                {formatToman(subtotal)} <span className="text-[10px] font-sans font-normal text-slate-500">تومان</span>
              </span>
            </div>

            {/* ۲. تخفیف */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
              <span className="text-[11px] font-black text-slate-500 block">تخفیف فاکتور:</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={formatToman(discountAmount)}
                  onChange={(e) => setDiscountAmount(parseNumeric(e.target.value))}
                  className="w-full font-mono font-black text-rose-600 text-sm focus:outline-none"
                  placeholder="۰"
                />
                <span className="text-[10px] font-sans text-slate-500">تومان</span>
              </div>
            </div>

            {/* ۳. مالیات بر ارزش افزوده */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-500">مالیات و عوارض:</span>
                <button
                  type="button"
                  onClick={() => setVatAmount(vatAmount > 0 ? 0 : Math.round((subtotal - discountAmount) * 0.1))}
                  className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                >
                  {vatAmount > 0 ? 'حذف' : 'محاسبه ۱۰٪'}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={formatToman(vatAmount)}
                  onChange={(e) => setVatAmount(parseNumeric(e.target.value))}
                  className="w-full font-mono font-black text-slate-800 text-sm focus:outline-none"
                  placeholder="۰"
                />
                <span className="text-[10px] font-sans text-slate-500">تومان</span>
              </div>
            </div>

            {/* ۴. مبلغ خالص پرداختی */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-xl space-y-1 shadow-md shadow-blue-500/10">
              <span className="text-[11px] font-bold text-blue-100 block">مبلغ قابل پرداخت:</span>
              <span className="font-mono font-black text-white text-sm sm:text-base block tracking-tight">
                {formatToman(finalNetPayable)} <span className="text-[10px] font-sans font-normal text-blue-100">تومان</span>
              </span>
            </div>

          </div>

          {/* Amount In Words Spelled Out (مبلغ به حروف فارسی) */}
          <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-xs shadow-2xs">
            <span className="font-black text-slate-500 shrink-0">مبلغ به حروف:</span>
            <span className="font-bold text-slate-900 truncate">
              {amountInWords}
            </span>
          </div>

          {/* Description Line with [+] and SMS Link Checkbox */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* توضیحات */}
            <div className="flex-1 flex items-center gap-2">
              <span className="font-black text-slate-800 shrink-0 text-xs">توضیحات:</span>
              <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-xl shadow-2xs overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-50">
                <button
                  type="button"
                  onClick={() => setDescription('فاکتور رسمی همراه با گارانتی طلایی دیاکو الکترونیک. تحویل و تسویه طبق شرایط توافق شده.')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border-l border-slate-300 cursor-pointer transition-colors"
                  title="درج متن پیش‌فرض"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات فاکتور، هماهنگی‌های حمل و ارسال، شرایط تسویه..."
                  className="flex-1 px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                />
                <ChevronDown className="w-4 h-4 text-slate-400 mr-2" />
              </div>
            </div>

            {/* ارسال لینک فاکتور به شماره */}
            <div className="flex items-center gap-2 shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendSmsLink}
                  onChange={(e) => setSendSmsLink(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-bold text-slate-800 text-xs">ارسال پیامک لینک فاکتور</span>
              </label>
              <input
                type="text"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="۰۹..."
                className="w-28 font-mono text-xs px-2 py-1 border border-slate-200 rounded-lg text-center focus:outline-none focus:border-blue-600"
              />
            </div>

          </div>

        </div>

        {/* ================= 6. BOTTOM ACTION BUTTONS (دکمه‌های پایینی استاندارد نرم‌افزار هلو) ================= */}
        <div className="p-3 bg-slate-100/70 border-t border-slate-200 flex items-center justify-between gap-3">
          
          {/* RIGHT BUTTONS: MAIN ACTIONS (تایید، اصلاح/چاپ، انصراف) */}
          <div className="flex items-center gap-2.5">
            
            {/* تایید و ثبت فاکتور (F2) - Green Button */}
            <button
              type="button"
              onClick={handleConfirmInvoice}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/20 border border-emerald-700 transition-all"
              title="تایید و ثبت نهایی فاکتور در سیستم (F2)"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span className="text-xs">تایید فاکتور (F2)</span>
            </button>

            {/* اصلاح و پیش‌نمایش چاپ (F3) - Pen Edit Button */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-200 transition-all"
              title="پیش‌نمایش چاپ و فرمت فاکتور (F3)"
            >
              <Edit3 className="w-4 h-4 text-amber-600" />
              <span className="text-xs">پیش‌نمایش چاپ</span>
            </button>

            {/* انصراف و پاک‌سازی (Esc) - Red X Button */}
            <button
              type="button"
              onClick={() => {
                if (confirm('آیا از پاک کردن اطلاعات این فاکتور و ایجاد فاکتور جدید اطمینان دارید؟')) {
                  handleAddNewRow();
                  triggerToast('فرم فاکتور بازنشانی گردید.', 'info');
                }
              }}
              className="p-2.5 bg-white hover:bg-rose-50 active:scale-95 text-rose-600 rounded-xl font-bold flex items-center justify-center cursor-pointer shadow-2xs border border-slate-200 transition-all"
              title="انصراف و پاک‌سازی فرم"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>

          </div>

          {/* LEFT BUTTONS: SECONDARY TOOLS (چاپ، ذخیره موقت، خروج) */}
          <div className="flex items-center gap-2">
            
            {/* چاپ مستقیم */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs cursor-pointer transition-colors"
              title="چاپ مستقیم فاکتور"
            >
              <Printer className="w-4 h-4 text-blue-600" />
            </button>

            {/* ذخیره موقت با ساعت (Floppy Disk with Clock) */}
            <button
              type="button"
              onClick={() => triggerToast('فاکتور به صورت پیش‌نویس موقت ذخیره گردید.', 'info')}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
              title="ذخیره موقت پیش‌نویس فاکتور"
            >
              <Save className="w-4 h-4 text-slate-700" />
              <Clock className="w-2.5 h-2.5 text-blue-600 -mr-1.5 -mt-1.5" />
            </button>

            {/* خروج به صفحه قبل */}
            <button
              type="button"
              onClick={() => {
                if (setActiveTab) setActiveTab('accounting_dashboard');
              }}
              className="p-2.5 bg-white hover:bg-rose-50 text-rose-700 rounded-xl border border-slate-200 shadow-2xs cursor-pointer transition-colors"
              title="خروج از فاکتور به میز کار"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>

      </div>

      {/* ================= MODAL 1: DEDICATED SERIAL NUMBERS MANAGER ================= */}
      {showSerialModal && activeSerialRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Barcode className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm">مدیریت و اسکن شماره سریال‌های کالا</h3>
                  <p className="text-[11px] text-blue-100">
                    کالا: <span className="font-black">{activeSerialRow.productName}</span> ({activeSerialRow.productModel})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSerialModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Status Header & Expected Serials */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-blue-900">تعداد درخواستی فاکتور:</span>
                  <span className="font-mono font-black text-blue-950 text-sm block">
                    {toPersianDigits(activeSerialRow.quantity)} {activeSerialRow.unit}
                  </span>
                </div>

                <div className="space-y-0.5 text-left">
                  <span className="font-bold text-blue-900">سریال‌های ثبت شده:</span>
                  <span className={`font-mono font-black text-sm block ${activeSerialRow.serials.length === activeSerialRow.quantity ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {toPersianDigits(activeSerialRow.serials.length)} از {toPersianDigits(activeSerialRow.quantity)}
                  </span>
                </div>
              </div>

              {/* METHOD 1: QUICK BARCODE SCANNER / SINGLE ENTRY */}
              <form onSubmit={handleAddSingleSerial} className="space-y-2">
                <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>اسکن بارکد یا ورود تکی سریال:</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={quickSerialInput}
                      onChange={(e) => setQuickSerialInput(e.target.value)}
                      placeholder="سریال را اسکن یا تایپ کنید و اینتر بزنید..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 uppercase"
                      autoFocus
                    />
                    <Barcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shrink-0 cursor-pointer shadow-xs"
                  >
                    ثبت سریال
                  </button>
                </div>
              </form>

              {/* METHOD 2: RANGE SERIALS GENERATOR */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <span className="font-black text-xs text-slate-800 block">تولید خودکار بازه سریال (سریال‌های متوالی):</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">پیشوند (Prefix):</label>
                    <input
                      type="text"
                      value={serialRangePrefix}
                      onChange={(e) => setSerialRangePrefix(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">از شماره:</label>
                    <input
                      type="text"
                      value={serialRangeFrom}
                      onChange={(e) => setSerialRangeFrom(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">تا شماره:</label>
                    <input
                      type="text"
                      value={serialRangeTo}
                      onChange={(e) => setSerialRangeTo(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSerialRange}
                  className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black border border-indigo-200 cursor-pointer"
                >
                  تولید و افزودن بازه به این ردیف
                </button>
              </div>

              {/* METHOD 3: BULK PASTE FROM EXCEL */}
              <div className="space-y-1.5">
                <span className="font-black text-xs text-slate-800 block">چسباندن دسته‌ای سریال‌ها (از اکسل یا فایل متنی):</span>
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    value={bulkSerialPaste}
                    onChange={(e) => setBulkSerialPaste(e.target.value)}
                    placeholder="سریال‌ها را در این کادر Paste کنید..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleProcessBulkPaste}
                    className="px-3 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black cursor-pointer shrink-0"
                  >
                    استخراج
                  </button>
                </div>
              </div>

              {/* LIST OF REGISTERED SERIALS FOR THIS ROW */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-slate-800">
                    لیست سریال‌های ثبت شده برای این کالا ({toPersianDigits(activeSerialRow.serials.length)} عدد):
                  </span>
                  {activeSerialRow.serials.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleUpdateRow(activeSerialRow.id, 'serials', [])}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      پاک کردن همه
                    </button>
                  )}
                </div>

                {activeSerialRow.serials.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                    هنوز شماره سریالی برای این کالا ثبت نشده است. از گزینه‌های بالا برای اسکن یا افزودن استفاده فرمایید.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                    {activeSerialRow.serials.map((sn, snIdx) => (
                      <div 
                        key={sn} 
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold shadow-2xs"
                      >
                        <span className="text-slate-900 truncate">{sn}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSerial(activeSerialRow.id, sn)}
                          className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSerialModal(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                تایید و بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL 2: PARTY SELECTION & SEARCH ================= */}
      {showPartySearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>جستجو و انتخاب طرف حساب</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPartySearchModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={partySearchQuery}
                  onChange={(e) => setPartySearchQuery(e.target.value)}
                  placeholder="جستجو با نام، کد طرف حساب، یا شماره همراه..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {allParties
                  .filter(p => !partySearchQuery || p.name.toLowerCase().includes(partySearchQuery.toLowerCase()) || p.code.includes(partySearchQuery) || p.phone.includes(partySearchQuery))
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedParty(p);
                        setShowPartySearchModal(false);
                      }}
                      className="p-2.5 hover:bg-blue-50 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-xs">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                            کد: {p.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">{p.phone} • {p.type}</span>
                      </div>

                      <div className="text-left font-mono font-black text-xs text-rose-600">
                        {formatToman(p.balance)} تومان
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: PRODUCT SELECTION ================= */}
      {showProductSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-black text-sm flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>انتخاب کالا از انبار مرکزی دیاکو</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProductSearchModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="نام کالا، مدل، یا کد محصول را جستجو کنید..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {products
                  .filter(p => !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || (p.model && p.model.toLowerCase().includes(productSearchQuery.toLowerCase())) || (p.code && p.code.includes(productSearchQuery)))
                  .map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => {
                        if (targetRowForProduct) {
                          handleSelectProductForRow(targetRowForProduct, prod);
                        }
                      }}
                      className="p-2.5 hover:bg-indigo-50 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-xs">{prod.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                            {prod.model || prod.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          موجودی انبار: {toPersianDigits(getProductStock(prod))} عدد
                        </span>
                      </div>

                      <div className="text-left font-mono font-black text-xs text-indigo-900">
                        {formatToman(getProductSellingPrice(prod))} تومان
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: PRINTABLE INVOICE PREVIEW ================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            
            {/* Action buttons at top of print preview */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ فاکتور رسمی</span>
                </button>

                {/* سایز کاغذ (A4 / A5) */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                  <span className="text-[11px] font-black text-slate-700 px-1.5">قطع کاغذ:</span>
                  <button
                    type="button"
                    onClick={() => setPaperSize('A4')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      paperSize === 'A4'
                        ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('A5')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      paperSize === 'A5'
                        ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A5
                  </button>
                </div>

                {/* دکمه تنظیمات فاکتور و ابعاد ستون‌ها */}
                <button
                  type="button"
                  onClick={() => setShowPrintSettingsModal(!showPrintSettingsModal)}
                  className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                    showPrintSettingsModal
                      ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>تنظیمات فاکتور و ابعاد</span>
                  {showPrintSettingsModal && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ================= PANEL: INVOICE PRINT SETTINGS ================= */}
            {showPrintSettingsModal && (
              <div className="bg-slate-50 border border-blue-200 rounded-2xl p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span className="font-black text-slate-900 text-sm">
                      تنظیمات ابعاد فاکتور و محاسبه هوشمند چیدمان سریال‌ها ({paperSize})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (paperSize === 'A4') {
                        setA4ColumnWidths({
                          rowNumber: 1.2,
                          productName: 5.4,
                          serialsColumn: 5.8,
                          quantity: 1.6,
                          unitPrice: 2.4,
                          totalPrice: 2.6
                        });
                      } else {
                        setA5ColumnWidths({
                          rowNumber: 0.9,
                          productName: 3.8,
                          serialsColumn: 4.4,
                          quantity: 1.2,
                          unitPrice: 1.6,
                          totalPrice: 1.6
                        });
                      }
                      setSerialFontSizePt(paperSize === 'A4' ? 9 : 8.5);
                      setAutoCalculateSerials(true);
                      triggerToast('ابعاد ستون‌ها به مقادیر پیش‌فرض بازنشانی شد.', 'info');
                    }}
                    className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>بازنشانی به ابعاد استاندارد {paperSize}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Part 1: Smart Serial Layout Calculation */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        محاسبه هوشمند چیدمان سریال‌ها
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={autoCalculateSerials}
                          onChange={(e) => setAutoCalculateSerials(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>محاسبه خودکار بر اساس طول رشته</span>
                      </label>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      در این حالت، طول کاراکترهای هر سریال و عرض ستون ({activeColWidths.serialsColumn} سانتی‌متر) اندازه‌گیری شده و تعداد بهینه باکس در هر سطر تعیین می‌شود تا هیچ سریالی قطع یا دچار تداخل نشود.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">اندازه قلم سریال‌ها:</label>
                        <select
                          value={serialFontSizePt}
                          onChange={(e) => setSerialFontSizePt(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold"
                        >
                          <option value={7.5}>۷.۵ پوینت (خیلی فشرده)</option>
                          <option value={8.5}>۸.۵ پوینت (فشرده - عالی برای A5)</option>
                          <option value={9}>۹.۰ پوینت (استاندارد)</option>
                          <option value={10}>۱۰.۰ پوینت (بزرگ)</option>
                        </select>
                      </div>

                      {!autoCalculateSerials && (
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">تعداد ثابت در هر سطر:</label>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={manualSerialsPerRow}
                            onChange={(e) => setManualSerialsPerRow(Math.max(1, Math.min(6, Number(e.target.value))))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-center"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Part 2: Column Widths Settings (cm) */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <span className="font-black text-slate-800 block">
                      عرض ستون‌های جدول فاکتور (سانتی‌متر):
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-600 block">۱. ردیف:</label>
                        <input
                          type="number"
                          step={0.1}
                          min={0.5}
                          max={3}
                          value={activeColWidths.rowNumber}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (paperSize === 'A4') setA4ColumnWidths({ ...a4ColumnWidths, rowNumber: val });
                            else setA5ColumnWidths({ ...a5ColumnWidths, rowNumber: val });
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs font-mono text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-600 block">۲. شرح کالا:</label>
                        <input
                          type="number"
                          step={0.1}
                          min={2}
                          max={10}
                          value={activeColWidths.productName}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (paperSize === 'A4') setA4ColumnWidths({ ...a4ColumnWidths, productName: val });
                            else setA5ColumnWidths({ ...a5ColumnWidths, productName: val });
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs font-mono text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-blue-700 font-bold block">۳. سریال‌ها (کلیدی):</label>
                        <input
                          type="number"
                          step={0.1}
                          min={2}
                          max={12}
                          value={activeColWidths.serialsColumn}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (paperSize === 'A4') setA4ColumnWidths({ ...a4ColumnWidths, serialsColumn: val });
                            else setA5ColumnWidths({ ...a5ColumnWidths, serialsColumn: val });
                          }}
                          className="w-full bg-blue-50 border border-blue-300 rounded-lg p-1 text-xs font-mono text-center font-black text-blue-800"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-600 block">۴. تعداد:</label>
                        <input
                          type="number"
                          step={0.1}
                          min={0.8}
                          max={4}
                          value={activeColWidths.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (paperSize === 'A4') setA4ColumnWidths({ ...a4ColumnWidths, quantity: val });
                            else setA5ColumnWidths({ ...a5ColumnWidths, quantity: val });
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs font-mono text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-600 block">۵. فی (تومان):</label>
                        <input
                          type="number"
                          step={0.1}
                          min={1}
                          max={5}
                          value={activeColWidths.unitPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (paperSize === 'A4') setA4ColumnWidths({ ...a4ColumnWidths, unitPrice: val });
                            else setA5ColumnWidths({ ...a5ColumnWidths, unitPrice: val });
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs font-mono text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-600 block">۶. جمع کل:</label>
                        <input
                          type="number"
                          step={0.1}
                          min={1}
                          max={6}
                          value={activeColWidths.totalPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (paperSize === 'A4') setA4ColumnWidths({ ...a4ColumnWidths, totalPrice: val });
                            else setA5ColumnWidths({ ...a5ColumnWidths, totalPrice: val });
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs font-mono text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PRINTABLE OFFICIAL SHEET */}
            <div className={`bg-white border border-slate-300 rounded-xl p-6 text-slate-900 space-y-6 ${paperSize === 'A5' ? 'max-w-2xl mx-auto' : ''}`}>
              
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-black text-slate-950">دیاکو الکترونیک - فاکتور رسمی</h1>
                  <p className="text-xs text-slate-600">مرکز تخصصی تولید و گارانتی شارژرها و منابع تغذیه صنعتی</p>
                </div>

                <div className="text-left space-y-1 text-xs font-bold font-mono">
                  <div>شماره فاکتور: <span className="font-black text-slate-950">{invoiceNumber}</span></div>
                  <div>تاریخ: <span className="font-black text-slate-950">{formattedInvoiceDate}</span></div>
                  <div>نوع سند: <span className="font-black text-blue-700">{activeInvoiceType === 'sale' ? 'فروش رسمی' : 'فاکتور هلو'}</span></div>
                </div>
              </div>

              {/* Customer / Party details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>طرف حساب: <span className="font-black text-slate-900">{selectedParty?.name}</span></div>
                <div>کد حساب: <span className="font-black font-mono">{selectedParty?.code}</span></div>
                <div>شماره تماس: <span className="font-black font-mono">{selectedParty?.phone}</span></div>
                <div className="col-span-2 sm:col-span-3">نشانی: <span className="font-black">{selectedParty?.address || '-'}</span></div>
              </div>

              {/* Table with configured column widths and smart serial rows */}
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 font-black">
                  <tr>
                    <th style={{ width: `${activeColWidths.rowNumber}cm` }} className="p-2 border-l border-slate-300 text-center">ردیف</th>
                    <th style={{ width: `${activeColWidths.productName}cm` }} className="p-2 border-l border-slate-300">شرح کالا و مشخصات فنی</th>
                    <th style={{ width: `${activeColWidths.serialsColumn}cm` }} className="p-2 border-l border-slate-300">شماره سریال‌های گارانتی</th>
                    <th style={{ width: `${activeColWidths.quantity}cm` }} className="p-2 border-l border-slate-300 text-center">تعداد</th>
                    <th style={{ width: `${activeColWidths.unitPrice}cm` }} className="p-2 border-l border-slate-300 text-center">فی (تومان)</th>
                    <th style={{ width: `${activeColWidths.totalPrice}cm` }} className="p-2 text-center">جمع کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="p-2 border-l border-slate-200 text-center font-mono font-bold">{toPersianDigits(i + 1)}</td>
                      <td className="p-2 border-l border-slate-200 font-bold">{r.productName} ({r.productModel})</td>
                      <td className="p-2 border-l border-slate-200">
                        {r.serials && r.serials.length > 0 ? (() => {
                          const layout = calculateSerialRows(r.serials);
                          return (
                            <div className="space-y-1" dir="ltr">
                              {layout.chunks.map((chunk, chunkIdx) => (
                                <div 
                                  key={chunkIdx} 
                                  className="flex items-center justify-center gap-1 flex-wrap"
                                >
                                  {chunk.map((sn, snIdx) => (
                                    <span 
                                      key={snIdx} 
                                      style={{ fontSize: `${serialFontSizePt}pt` }}
                                      className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-center font-bold text-slate-900 tracking-tight whitespace-nowrap inline-block shadow-2xs"
                                    >
                                      {sn}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        })() : (
                          <span className="text-slate-400 text-center block">-</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono font-bold">{toPersianDigits(r.quantity)}</td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">{formatToman(r.unitPrice)}</td>
                      <td className="p-2 text-center font-mono font-black">{formatToman(r.quantity * r.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs font-bold">
                  <div className="flex justify-between">
                    <span>جمع اقلام:</span>
                    <span className="font-mono font-black">{formatToman(subtotal)} تومان</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>تخفیف:</span>
                      <span className="font-mono font-black">{formatToman(discountAmount)} تومان</span>
                    </div>
                  )}
                  {vatAmount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>مالیات و عوارض:</span>
                      <span className="font-mono font-black">{formatToman(vatAmount)} تومان</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-black text-slate-950">
                    <span>مبلغ نهایی:</span>
                    <span className="font-mono text-blue-700">{formatToman(finalNetPayable)} تومان</span>
                  </div>
                </div>
              </div>

              {/* Footer sign */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center text-xs font-bold text-slate-600">
                <div className="space-y-10">
                  <span>امضاء و مهر فروشنده (دیاکو الکترونیک)</span>
                  <div className="h-10" />
                </div>
                <div className="space-y-10">
                  <span>امضاء و تایید خریدار / تحویل‌گیرنده</span>
                  <div className="h-10" />
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default HolooInvoiceForm;
