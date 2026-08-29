import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
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
  HelpCircle
} from 'lucide-react';
import { Customer, Supplier, Product, WarrantyItem, InventoryItem } from '../types';
import { numberToPersianWords, amountToTomanWords } from '../utils/numberToPersianWords';

// Types
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
  company?: string;
  category: 'customer' | 'supplier' | 'colleague' | 'corporate';
}

export interface InvoiceItemRow {
  id: string;
  productModel: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  stock: number;
  serials: string[];
  warrantyMonths: number;
  notes?: string;
}

interface P018StandardInvoiceFormProps {
  customers?: Customer[];
  suppliers?: Supplier[];
  products?: Product[];
  setProducts?: React.Dispatch<React.SetStateAction<any[]>>;
  warrantyDb?: WarrantyItem[];
  setWarrantyDb?: React.Dispatch<React.SetStateAction<WarrantyItem[]>>;
  inventory?: InventoryItem[];
  setInventory?: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  sales?: any[];
  setSales?: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTab?: (tab: any) => void;
  onSaveInvoice?: (invoiceData: any) => void;
  onAddCustomer?: (customer: Customer) => void;
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
  if (!num || isNaN(num)) return '۰ تومان';
  return num.toLocaleString('fa-IR') + ' تومان';
};

// Calculate Persian Expiry Date
const calculateExpiry = (startDateStr: string, months: number): string => {
  const parts = startDateStr.split('/');
  if (parts.length !== 3) return '۱۴۰۶/۰۵/۰۸';
  let year = parseInt(parts[0], 10) || 1405;
  let month = parseInt(parts[1], 10) || 5;
  let day = parseInt(parts[2], 10) || 8;

  month += months;
  while (month > 12) {
    year += 1;
    month -= 12;
  }
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  return `${year}/${monthStr}/${dayStr}`;
};

export const P018StandardInvoiceForm: React.FC<P018StandardInvoiceFormProps> = ({
  customers = [],
  suppliers = [],
  products = [],
  setProducts,
  warrantyDb = [],
  setWarrantyDb,
  inventory = [],
  setInventory,
  sales = [],
  setSales,
  setActiveTab,
  onSaveInvoice,
  onAddCustomer,
  showToast
}) => {
  // 1. Invoice Type Mode
  const [activeInvoiceType, setActiveInvoiceType] = useState<'sale' | 'purchase' | 'proforma' | 'return'>('sale');

  // Fallback default sample parties if none passed
  const fallbackParties: PartyAccount[] = useMemo(() => [
    {
      id: 'cust-101',
      code: '10142',
      name: 'مهندس حسینی (پیمانکار برق صنعتی)',
      phone: '09121230152',
      address: 'تهران، خیابان لاله زار جنوبی، پاساژ ادیسون، پلاک ۲۴',
      balance: -4200000,
      type: 'مشتری اعتباری',
      nationalId: '0019283741',
      economicCode: '411239871',
      category: 'customer'
    },
    {
      id: 'cust-102',
      code: '10143',
      name: 'فروشگاه الکترو نوین البرز (آقای مرادی)',
      phone: '09355551234',
      address: 'کرج، میدان توحید، نبش بلوار بلال، پلاک ۸',
      balance: 15000000,
      type: 'همکار / نمایندگی',
      nationalId: '0321984712',
      economicCode: '411893245',
      category: 'colleague'
    },
    {
      id: 'cust-103',
      code: '10144',
      name: 'شرکت پترو تجهیز آریا',
      phone: '02188776655',
      address: 'تهران، خیابان ولیعصر، بالاتر از ظفر، برج سایه، طبقه ۵',
      balance: 0,
      type: 'شخص حقوقی',
      nationalId: '10103498172',
      economicCode: '411445566',
      category: 'corporate'
    }
  ], []);

  // Merge real customers & suppliers into active Party Directory
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

    // If still empty, use fallback
    return list.length > 0 ? list : fallbackParties;
  }, [customers, suppliers, fallbackParties]);

  // Selected party for this invoice
  const [selectedParty, setSelectedParty] = useState<PartyAccount | null>(() => allParties[0] || null);

  // Modals & Selectors
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [partyFilterTab, setPartyFilterTab] = useState<'all' | 'customer' | 'colleague' | 'supplier' | 'corporate'>('all');
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);

  // Quick Add Party Form fields
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyCode, setNewPartyCode] = useState('');
  const [newPartyType, setNewPartyType] = useState<'person' | 'representative' | 'corporate' | 'supplier'>('person');
  const [newPartyNationalId, setNewPartyNationalId] = useState('');
  const [newPartyEconomicCode, setNewPartyEconomicCode] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyBalance, setNewPartyBalance] = useState('');

  // 3. Invoice Header Metadata
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-1405-${Math.floor(100 + Math.random() * 900)}`);
  const [invoiceDate, setInvoiceDate] = useState('۱۴۰۵/۰۵/۰۸');
  const [remarks, setRemarks] = useState('فاکتور رسمی همراه با گارانتی طلایی دیاکو الکترونیک. تسویه طبق شرایط توافق شده.');

  // 4. Financial Adjustments & Settlement
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [includeVat, setIncludeVat] = useState<boolean>(false);
  const [vatRate] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'pos' | 'cash' | 'cheque' | 'credit'>('pos');
  const [selectedBank, setSelectedBank] = useState<string>('بانک ملت - حساب جاری دیاکو (شعبه لاله زار)');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeDueDate, setChequeDueDate] = useState<string>('۱۴۰۵/۰۷/۱۵');

  // Helper to extract stock number for a product
  const getProductStock = (p: any): number => {
    if (!p) return 0;
    if (typeof p.totalStock === 'number') return p.totalStock;
    if (p.productionStock) return parseNumeric(p.productionStock);
    return 25; // Default initial stock
  };

  // Helper to extract price
  const getProductSellingPrice = (p: any): number => {
    if (!p) return 1000000;
    if (p.sellingPrice) return parseNumeric(p.sellingPrice);
    if (p.suggestedPrice) return parseNumeric(p.suggestedPrice);
    return 1000000;
  };

  // 5. Initial Item Grid Rows using products if available
  const [rows, setRows] = useState<InvoiceItemRow[]>(() => {
    if (products && products.length >= 2) {
      const p1 = products[0];
      const p2 = products[1];
      const stock1 = getProductStock(p1);
      const stock2 = getProductStock(p2);
      return [
        {
          id: 'row-1',
          productModel: p1.model || 'DEC-1210-CH',
          itemCode: p1.code || 'PRD-801',
          itemName: p1.name || 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
          quantity: 2,
          unit: 'دستگاه',
          unitPrice: getProductSellingPrice(p1),
          stock: stock1,
          serials: ['SN-2026-9081', 'SN-2026-9082'],
          warrantyMonths: parseInt(p1.warrantyDuration) || 18,
          notes: 'تست شده در کارگاه - تحویل با لیبل پلمپ و هولوگرام گارانتی'
        },
        {
          id: 'row-2',
          productModel: p2.model || 'DEC-2420-CH',
          itemCode: p2.code || 'PRD-405',
          itemName: p2.name || 'شارژر باتری صنعتی ۲۰ آمپر دیاکو',
          quantity: 1,
          unit: 'دستگاه',
          unitPrice: getProductSellingPrice(p2),
          stock: stock2,
          serials: ['SN-PSU-441'],
          warrantyMonths: parseInt(p2.warrantyDuration) || 18,
          notes: 'گارانتی طلایی دیاکو'
        }
      ];
    }
    return [
      {
        id: 'row-1',
        productModel: 'DEC-1210-CH',
        itemCode: 'DEC-1210-CH',
        itemName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        quantity: 2,
        unit: 'دستگاه',
        unitPrice: 4200000,
        stock: 15,
        serials: ['SN-2026-9081', 'SN-2026-9082'],
        warrantyMonths: 18,
        notes: 'گارانتی طلایی دیاکو'
      }
    ];
  });

  // Serial input temp helper per row
  const [activeSerialRowId, setActiveSerialRowId] = useState<string | null>(null);
  const [tempSerialInput, setTempSerialInput] = useState('');

  // Stock Warning Dialog state
  const [stockWarningItem, setStockWarningItem] = useState<{ name: string; model: string; requested: number; available: number } | null>(null);

  // Print & Preview Modal
  const [printMode, setPrintMode] = useState<'a4' | 'thermal' | null>(null);

  // Synchronize row stocks when products prop changes
  useEffect(() => {
    if (products && products.length > 0) {
      setRows(prevRows => prevRows.map(row => {
        const matched = products.find(p => p.model === row.productModel || p.name === row.itemName);
        if (matched) {
          const currentStock = getProductStock(matched);
          return { ...row, stock: currentStock };
        }
        return row;
      }));
    }
  }, [products]);

  // Calculations
  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + (r.quantity * r.unitPrice), 0);
  }, [rows]);

  const vatAmount = useMemo(() => {
    if (!includeVat) return 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    return Math.round((taxable * vatRate) / 100);
  }, [subtotal, discountAmount, includeVat, vatRate]);

  const finalPayable = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + vatAmount);
  }, [subtotal, discountAmount, vatAmount]);

  // Projected new balance for the party (for accountants)
  const currentPartyBalance = selectedParty?.balance || 0;
  const projectedNewBalance = useMemo(() => {
    if (paymentMethod === 'credit') {
      // Added to debt
      return currentPartyBalance - finalPayable;
    }
    // Fully settled now
    return currentPartyBalance;
  }, [currentPartyBalance, finalPayable, paymentMethod]);

  // Toast Helper
  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (showToast) {
      showToast(msg, type);
    }
  };

  // Filtered party list for Modal and Autocomplete
  const filteredParties = useMemo(() => {
    const query = partySearch.trim().toLowerCase();
    return allParties.filter(p => {
      if (partyFilterTab !== 'all' && p.category !== partyFilterTab) {
        return false;
      }
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.phone.includes(query) ||
        p.code.toLowerCase().includes(query) ||
        (p.nationalId && p.nationalId.includes(query)) ||
        (p.company && p.company.toLowerCase().includes(query)) ||
        (p.address && p.address.toLowerCase().includes(query))
      );
    });
  }, [allParties, partySearch, partyFilterTab]);

  // Handle Select Party
  const handleSelectParty = (party: PartyAccount) => {
    setSelectedParty(party);
    setShowPartyModal(false);
    triggerToast(`طرف حساب «${party.name}» متصل شد.`, 'info');
  };

  // Handle Quick Add Party Submit
  const handleQuickAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim() || !newPartyPhone.trim()) {
      triggerToast('نام و شماره تماس طرف حساب الزامی است.', 'error');
      return;
    }

    const cleanBalance = parseInt(newPartyBalance.replace(/[^\d-]/g, ''), 10) || 0;
    const genCode = newPartyCode.trim() || `10${Math.floor(10 + Math.random() * 90)}`;
    const newCustObj: Customer = {
      id: `CUST-${Date.now().toString().slice(-4)}`,
      name: newPartyName.trim(),
      phone: newPartyPhone.trim(),
      type: newPartyType === 'representative' ? 'representative' : (newPartyType === 'corporate' ? 'corporate' : 'person'),
      nationalId: newPartyNationalId.trim() || undefined,
      economicCode: newPartyEconomicCode.trim() || undefined,
      address: newPartyAddress.trim() || undefined,
      balance: cleanBalance
    };

    const newPartyAcc: PartyAccount = {
      id: newCustObj.id,
      code: genCode,
      name: newCustObj.name,
      phone: newCustObj.phone,
      address: newCustObj.address || '',
      balance: cleanBalance,
      type: newPartyType === 'representative' ? 'همکار / نمایندگی' : (newPartyType === 'corporate' ? 'شخص حقوقی' : (newPartyType === 'supplier' ? 'تأمین‌کننده' : 'مشتری حقیقی')),
      nationalId: newCustObj.nationalId,
      economicCode: newCustObj.economicCode,
      category: newPartyType === 'supplier' ? 'supplier' : (newPartyType === 'representative' ? 'colleague' : (newPartyType === 'corporate' ? 'corporate' : 'customer'))
    };

    if (onAddCustomer) {
      onAddCustomer(newCustObj);
    }

    setSelectedParty(newPartyAcc);
    setShowAddPartyModal(false);
    setShowPartyModal(false);
    
    // Reset Form
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyCode('');
    setNewPartyNationalId('');
    setNewPartyEconomicCode('');
    setNewPartyAddress('');
    setNewPartyBalance('');

    triggerToast(`طرف حساب جدید «${newPartyAcc.name}» با موفقیت افزوده و متصل شد.`);
  };

  // Add Item Row
  const handleAddRow = () => {
    let defaultProduct = products[0];
    const existingModels = new Set(rows.map(r => r.productModel));
    const availableUnused = products.find(p => !existingModels.has(p.model));
    if (availableUnused) {
      defaultProduct = availableUnused;
    }

    const newRow: InvoiceItemRow = defaultProduct ? {
      id: `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productModel: defaultProduct.model || 'PRD-NEW',
      itemCode: defaultProduct.code || defaultProduct.model || 'PRD-NEW',
      itemName: defaultProduct.name || 'کالای جدید دیاکو',
      quantity: 1,
      unit: 'دستگاه',
      unitPrice: getProductSellingPrice(defaultProduct),
      stock: getProductStock(defaultProduct),
      serials: [],
      warrantyMonths: parseInt(defaultProduct.warrantyDuration) || 18,
      notes: 'گارانتی طلایی دیاکو'
    } : {
      id: `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productModel: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      itemCode: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      itemName: 'کالای جدید',
      quantity: 1,
      unit: 'دستگاه',
      unitPrice: 1000000,
      stock: 10,
      serials: [],
      warrantyMonths: 18,
      notes: ''
    };

    setRows(prev => [...prev, newRow]);
  };

  // Handle Product Selection Change in Row
  const handleSelectProductForRow = (rowId: string, productModel: string) => {
    const prod = products.find(p => p.model === productModel);
    if (!prod) return;

    const stock = getProductStock(prod);
    const price = activeInvoiceType === 'purchase'
      ? (prod.productionPrice ? parseNumeric(prod.productionPrice) : 2000000)
      : getProductSellingPrice(prod);

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          productModel: prod.model,
          itemCode: prod.code || prod.model,
          itemName: prod.name,
          unitPrice: price,
          stock: stock,
          warrantyMonths: parseInt(prod.warrantyDuration) || 18
        };
      }
      return r;
    }));
  };

  // Row Change
  const handleRowChange = (id: string, field: keyof InvoiceItemRow, value: any) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Remove Row
  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      triggerToast('فاکتور باید حداقل شامل یک سطر کالا باشد.', 'error');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Serial Management Handlers
  const handleAddSerial = (rowId: string, manualSerial?: string) => {
    const serialToAdd = (manualSerial || tempSerialInput).trim().toUpperCase();
    if (!serialToAdd) return;

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        if (r.serials.includes(serialToAdd)) {
          triggerToast('این شماره سریال قبلاً در همین بند ثبت شده است.', 'error');
          return r;
        }
        return {
          ...r,
          serials: [...r.serials, serialToAdd]
        };
      }
      return r;
    }));

    if (!manualSerial) {
      setTempSerialInput('');
    }
  };

  const handleRemoveSerial = (rowId: string, serial: string) => {
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          serials: r.serials.filter(s => s !== serial)
        };
      }
      return r;
    }));
  };

  // Auto-generate serials for a row
  const handleAutoGenerateSerials = (rowId: string) => {
    const targetRow = rows.find(r => r.id === rowId);
    if (!targetRow) return;

    const neededCount = Math.max(0, targetRow.quantity - targetRow.serials.length);
    if (neededCount === 0) {
      triggerToast(`تعداد سریال‌های وارد شده (${targetRow.serials.length}) قبلاً با تعداد کالا (${targetRow.quantity}) تکمیل شده است.`, 'info');
      return;
    }

    const generated: string[] = [];
    const prefix = targetRow.productModel.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'DEC';
    for (let i = 0; i < neededCount; i++) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      generated.push(`${prefix}-1405-${randomNum}`);
    }

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          serials: [...r.serials, ...generated]
        };
      }
      return r;
    }));

    triggerToast(`${toPersianDigits(neededCount)} شماره سریال استاندارد خودکار برای «${targetRow.itemName}» تولید گردید.`);
  };

  // Submit and Save Invoice
  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedParty) {
      triggerToast('لطفاً ابتدا طرف حساب فاکتور را مشخص فرمایید.', 'error');
      return;
    }

    if (rows.length === 0) {
      triggerToast('فاکتور خالی است! حداقل یک سطر کالا اضافه نمایید.', 'error');
      return;
    }

    // 1. INVENTORY STOCK VALIDATION
    if (activeInvoiceType === 'sale') {
      for (const row of rows) {
        const matchingProduct = products.find(p => p.model === row.productModel || p.name === row.itemName);
        const currentStock = matchingProduct ? getProductStock(matchingProduct) : row.stock;

        if (currentStock <= 0 || row.quantity > currentStock) {
          setStockWarningItem({
            name: row.itemName,
            model: row.productModel,
            requested: row.quantity,
            available: currentStock
          });
          triggerToast(`عدم موجودی کافی در انبار برای «${row.itemName}». موجودی فعلی: ${toPersianDigits(currentStock)} عدد است.`, 'error');
          return;
        }
      }

      // 2. SERIAL NUMBERS VALIDATION FOR WARRANTY
      for (const row of rows) {
        if (row.serials.length < row.quantity) {
          triggerToast(
            `برای کالای «${row.itemName}» تعداد ${toPersianDigits(row.quantity)} دستگاه ثبت شده اما فقط ${toPersianDigits(row.serials.length)} شماره سریال وارد شده است. ثبت دقیق تمامی سریال‌ها برای صدور و فعال‌سازی گارانتی الزامی است.`,
            'error'
          );
          return;
        }
      }
    }

    // 3. DEDUCT FROM INVENTORY STOCK
    if (activeInvoiceType === 'sale' && setProducts) {
      setProducts(prevProducts => prevProducts.map(prod => {
        const saleRow = rows.find(r => r.productModel === prod.model || r.itemName === prod.name);
        if (saleRow) {
          const currentTotal = typeof prod.totalStock === 'number' ? prod.totalStock : parseNumeric(prod.productionStock || 25);
          return {
            ...prod,
            totalStock: Math.max(0, currentTotal - saleRow.quantity)
          };
        }
        return prod;
      }));
    } else if (activeInvoiceType === 'purchase' && setProducts) {
      setProducts(prevProducts => prevProducts.map(prod => {
        const purRow = rows.find(r => r.productModel === prod.model || r.itemName === prod.name);
        if (purRow) {
          const currentTotal = typeof prod.totalStock === 'number' ? prod.totalStock : parseNumeric(prod.productionStock || 25);
          return {
            ...prod,
            totalStock: currentTotal + purRow.quantity
          };
        }
        return prod;
      }));
    }

    // 4. REGISTER WARRANTIES FOR EACH SERIAL
    if (activeInvoiceType === 'sale' && setWarrantyDb) {
      const newWarrantyEntries: WarrantyItem[] = [];
      rows.forEach(row => {
        const expiry = calculateExpiry(invoiceDate, row.warrantyMonths || 18);
        row.serials.forEach(serialNum => {
          newWarrantyEntries.push({
            serial: serialNum,
            itemName: `${row.itemName} (${row.productModel})`,
            model: row.productModel,
            customerName: selectedParty.name,
            customerPhone: selectedParty.phone,
            defectType: '',
            status: 'active',
            expiryDate: expiry,
            registeredAt: invoiceDate,
            warrantyStatus: `گارانتی فعال ${toPersianDigits(row.warrantyMonths)} ماهه`,
            statusNotes: `صادره طی فاکتور فروش شماره ${invoiceNumber} به نام ${selectedParty.name} (${selectedParty.phone})`
          });
        });
      });

      setWarrantyDb(prev => [...newWarrantyEntries, ...prev]);
    }

    // 5. RECORD SALE IN HISTORY
    const newInvoiceRecord = {
      id: invoiceNumber,
      invoiceNumber: invoiceNumber,
      saleDate: invoiceDate,
      invoiceType: activeInvoiceType,
      customer: {
        name: selectedParty.name,
        phone: selectedParty.phone,
        type: selectedParty.type,
        address: selectedParty.address,
        code: selectedParty.code,
        nationalId: selectedParty.nationalId
      },
      items: rows.map(r => ({
        product: {
          name: r.itemName,
          model: r.productModel,
          code: r.itemCode,
          warrantyDuration: r.warrantyMonths.toString()
        },
        serials: [...r.serials],
        quantity: r.quantity,
        unit: r.unit,
        unitPrice: r.unitPrice,
        unitPriceStr: `${r.unitPrice.toLocaleString('fa-IR')} تومان`,
        totalPrice: r.quantity * r.unitPrice
      })),
      subtotal: subtotal,
      discount: discountAmount,
      tax: vatAmount,
      totalPayable: finalPayable,
      paymentMethod: paymentMethod,
      notes: remarks.trim() || undefined,
      createdAt: `${invoiceDate} - ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`
    };

    if (setSales) {
      setSales(prev => [newInvoiceRecord, ...prev]);
    }

    if (onSaveInvoice) {
      onSaveInvoice(newInvoiceRecord);
    }

    triggerToast(
      activeInvoiceType === 'sale'
        ? `فاکتور فروش شماره ${invoiceNumber} با موفقیت صادر شد، موجودی کالاها در انبار کسر گردید و گارانتی سریال‌ها در سامانه فعال شد.`
        : `فاکتور با موفقیت در سیستم ثبت گردید.`
    );
  };

  return (
    <div className="space-y-6 text-right font-sans w-full" dir="rtl">
      {/* 1. TOP HEADER & INVOICE TYPE SELECTOR */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-700/60">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-2xl text-blue-300 shadow-inner">
                <FileCheck className="w-7 h-7" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  <span>صدور فاکتور رسمی و سند فروش</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-0.5 rounded-full border border-emerald-400/30 font-mono font-bold">
                    سیستم حسابداری دیاکو
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium leading-relaxed">
                  تنظیم سند مالی، کسر خودکار موجودی انبار، ثبت سریال و فعال‌سازی بلادرنگ گارانتی معتبر در کارگاه
                </p>
              </div>
            </div>
          </div>

          {/* Quick Invoice Type Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl backdrop-blur-md border border-slate-700/80 self-stretch lg:self-auto justify-between lg:justify-start">
            {[
              { id: 'sale', label: 'فاکتور فروش (با سریال و گارانتی)' },
              { id: 'purchase', label: 'فاکتور خرید (ورود به انبار)' },
              { id: 'proforma', label: 'پیش‌فاکتور' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveInvoiceType(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  activeInvoiceType === t.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Warning Banner if Out-of-Stock */}
      {stockWarningItem && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 shadow-sm text-slate-800 space-y-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-black text-rose-900">
                عدم موجودی کافی در انبار! کالای «{stockWarningItem.name}»
              </h4>
              <p className="text-xs sm:text-sm text-rose-700 leading-relaxed">
                موجودی فعلی این کالا در انبار برابر با <strong>{toPersianDigits(stockWarningItem.available)} عدد</strong> است، اما تعداد درخواستی در فاکتور فروش <strong>{toPersianDigits(stockWarningItem.requested)} عدد</strong> می‌باشد. طبق قوانین سامانه، امکان فروش کالای ناموجود یا بیش از موجودی وجود ندارد.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-rose-200 justify-end">
            <button
              type="button"
              onClick={() => setStockWarningItem(null)}
              className="px-4 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              اصلاح تعداد در فاکتور
            </button>
            {setActiveTab && (
              <button
                type="button"
                onClick={() => {
                  setStockWarningItem(null);
                  setActiveTab('purchase_invoice');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>ثبت فاکتور خرید جدید جهت شارژ موجودی انبار</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Invoice Form */}
      <form onSubmit={handleFinalSubmit} className="space-y-6">
        {/* 2. SECTION 1: PARTY SELECTION & INVOICE METADATA */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>۱. مشخصات طرف حساب (خریدار) و اطلاعات سربرگ فاکتور</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200">
                شماره فاکتور: {toPersianDigits(invoiceNumber)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Party Selector & Details Card */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs sm:text-sm font-black text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>طرف حساب / خریدار فاکتور</span>
                  <span className="text-rose-500 font-black">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPartyModal(true)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ طرف حساب جدید</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartySearch('');
                      setShowPartyModal(true);
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-all"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>بانک طرف‌حساب‌ها</span>
                  </button>
                </div>
              </div>

              {/* Selected Party Summary Card with Accounting Balance */}
              {selectedParty ? (
                <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 border-2 border-blue-200/90 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                      {selectedParty.name.charAt(0)}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h4 className="font-black text-sm sm:text-base text-slate-900">{selectedParty.name}</h4>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-lg font-black border border-blue-200">
                          {selectedParty.type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
                        <span>شماره تماس: <strong className="text-slate-900 font-bold">{selectedParty.phone}</strong></span>
                        <span>•</span>
                        <span>کد حسابداری: <strong className="text-slate-900 font-bold">{selectedParty.code}</strong></span>
                        {selectedParty.nationalId && (
                          <>
                            <span>•</span>
                            <span>کد ملی/شناسه: <strong className="text-slate-900 font-bold">{selectedParty.nationalId}</strong></span>
                          </>
                        )}
                      </div>
                      {selectedParty.address && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{selectedParty.address}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Accounting Balance Badge */}
                  <div className="flex flex-row md:flex-col items-end gap-2 shrink-0 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-2 md:pt-0 border-blue-200/60">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block font-bold">وضعیت مانده دفتری:</span>
                      <span className={`text-xs sm:text-sm font-black font-mono px-2.5 py-1 rounded-xl inline-block mt-0.5 ${
                        selectedParty.balance < 0 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : selectedParty.balance > 0 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {selectedParty.balance < 0 
                          ? `${Math.abs(selectedParty.balance).toLocaleString('fa-IR')} ت (بدهکار)` 
                          : selectedParty.balance > 0 
                          ? `${selectedParty.balance.toLocaleString('fa-IR')} ت (بستانکار)` 
                          : 'بی‌حساب / تسویه کامل'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPartySearch('');
                        setShowPartyModal(true);
                      }}
                      className="text-xs font-black text-blue-700 hover:text-blue-900 bg-white px-3.5 py-1.5 rounded-xl border border-blue-200 shadow-xs transition-all cursor-pointer"
                    >
                      تغییر خریدار
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  className="w-full p-6 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl text-sm font-black text-slate-600 hover:text-blue-600 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <Search className="w-5 h-5" />
                  <span>انتخاب طرف حساب از لیست مشتریان و شرکت‌ها</span>
                </button>
              )}
            </div>

            {/* Date & Invoice No Meta */}
            <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>تاریخ ثبت و صدور سند</span>
                </label>
                <input
                  type="text"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  placeholder="۱۴۰۵/۰۵/۰۸"
                  className="w-full bg-white focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-black outline-none font-mono text-center shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>شماره سریال سند مالی</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-white focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-black outline-none font-mono text-center shadow-xs text-blue-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. SECTION 2: THE 5-COLUMN HIGH-QUALITY ITEMS TABLE */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>۲. جدول اقلام و ردیف‌های فاکتور فروش ({toPersianDigits(rows.length)} قلم کالا)</span>
              </span>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                تکمیل دقیق ستون‌های: نام محصول، تعداد، قیمت واحد، شماره سریال الزامی (پشتوانه گارانتی) و قیمت کل
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>+ افزودن ردیف کالا</span>
            </button>
          </div>

          {/* TABLE CONTAINER - Wide, legible and spacious */}
          <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 shadow-xs">
            <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 border-b-2 border-slate-200 font-black text-xs">
                  <th className="py-3.5 px-3 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 min-w-[260px]">۱. نام و مدل محصول</th>
                  <th className="py-3.5 px-3 w-36 text-center">۲. تعداد</th>
                  <th className="py-3.5 px-4 w-44 text-center">۳. قیمت واحد (تومان)</th>
                  <th className="py-3.5 px-4 min-w-[320px]">۴. شماره سریال‌های گارانتی (الزامی)</th>
                  <th className="py-3.5 px-4 w-44 text-center">۵. جمع کل ردیف (تومان)</th>
                  <th className="py-3.5 px-3 w-14 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => {
                  const lineTotal = row.quantity * row.unitPrice;
                  const matchingProd = products.find(p => p.model === row.productModel || p.name === row.itemName);
                  const currentStock = matchingProd ? getProductStock(matchingProd) : row.stock;
                  const isOutOfStock = currentStock <= 0;
                  const isStockExceeded = row.quantity > currentStock;
                  const serialsCount = row.serials.length;
                  const isSerialsComplete = serialsCount >= row.quantity;

                  return (
                    <tr 
                      key={row.id} 
                      className={`transition-colors ${
                        isOutOfStock || isStockExceeded 
                          ? 'bg-rose-50/50 hover:bg-rose-50/80' 
                          : idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      {/* # Number */}
                      <td className="py-4 px-3 text-center font-mono font-black text-slate-400 bg-slate-50/50">
                        {toPersianDigits(idx + 1)}
                      </td>

                      {/* 1. PRODUCT NAME & SELECTION */}
                      <td className="py-4 px-4">
                        <div className="space-y-2">
                          {products && products.length > 0 ? (
                            <select
                              value={row.productModel}
                              onChange={(e) => handleSelectProductForRow(row.id, e.target.value)}
                              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 font-black text-xs sm:text-sm outline-none text-slate-900 cursor-pointer shadow-xs"
                            >
                              {products.map(p => (
                                <option key={p.model} value={p.model}>
                                  {p.name} — مدل: {p.model}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.itemName}
                              onChange={(e) => handleRowChange(row.id, 'itemName', e.target.value)}
                              className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 font-black text-xs sm:text-sm outline-none text-slate-900 shadow-xs"
                            />
                          )}

                          {/* Live Stock & Warranty Indicators */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {isOutOfStock ? (
                              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 font-black rounded-lg flex items-center gap-1 border border-rose-200">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>ناموجود در انبار</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-lg flex items-center gap-1 font-mono">
                                <Package className="w-3.5 h-3.5 text-emerald-600" />
                                <span>موجودی انبار: {toPersianDigits(currentStock)} دستگاه</span>
                              </span>
                            )}
                            <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-bold rounded-lg font-mono flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>گارانتی: {toPersianDigits(row.warrantyMonths)} ماهه</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. QUANTITY */}
                      <td className="py-4 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRowChange(row.id, 'quantity', Math.max(1, row.quantity - 1))}
                              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl flex items-center justify-center font-black text-sm cursor-pointer border border-slate-300 shadow-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => handleRowChange(row.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className={`w-16 bg-white border rounded-xl py-1.5 text-center font-mono font-black text-sm sm:text-base outline-none shadow-xs ${
                                isStockExceeded ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'border-slate-300 focus:border-blue-600'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleRowChange(row.id, 'quantity', row.quantity + 1)}
                              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl flex items-center justify-center font-black text-sm cursor-pointer border border-slate-300 shadow-xs"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[10.5px] text-slate-400 block text-center font-bold">دستگاه</span>
                          {isStockExceeded && (
                            <p className="text-[10px] text-rose-600 font-black text-center">
                              بیش از موجودی ({toPersianDigits(currentStock)})
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 3. UNIT PRICE */}
                      <td className="py-4 px-4 text-center">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={row.unitPrice ? row.unitPrice.toLocaleString('fa-IR') : '۰'}
                            onChange={(e) => {
                              const val = parseNumeric(e.target.value);
                              handleRowChange(row.id, 'unitPrice', val);
                            }}
                            className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 font-mono font-black text-center text-sm sm:text-base outline-none shadow-xs text-slate-900"
                          />
                          <span className="text-[10.5px] text-slate-400 block font-mono">تومان به ازای هر واحد</span>
                        </div>
                      </td>

                      {/* 4. SERIAL NUMBERS & WARRANTY REQUIREMENT */}
                      <td className="py-4 px-4">
                        <div className="space-y-2">
                          {/* Serials Counter & Status Badge */}
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <Barcode className="w-4 h-4 text-blue-600" />
                              <span>سریال‌ها:</span>
                            </span>
                            <span className={`px-2.5 py-1 rounded-xl font-black font-mono text-xs border ${
                              isSerialsComplete
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                : 'bg-amber-100 border-amber-300 text-amber-900'
                            }`}>
                              {isSerialsComplete ? (
                                `✓ ${toPersianDigits(serialsCount)} از ${toPersianDigits(row.quantity)} سریال ثبت شد`
                              ) : (
                                `⚠️ ${toPersianDigits(serialsCount)} از ${toPersianDigits(row.quantity)} (${toPersianDigits(row.quantity - serialsCount)} سریال مانده)`
                              )}
                            </span>
                          </div>

                          {/* Existing Serials Tags */}
                          {row.serials.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                              {row.serials.map((s) => (
                                <span
                                  key={s}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-black text-slate-800 shadow-xs"
                                >
                                  <span>{s}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSerial(row.id, s)}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Serial Input Controls */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {activeSerialRowId === row.id ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <input
                                  type="text"
                                  autoFocus
                                  value={tempSerialInput}
                                  onChange={(e) => setTempSerialInput(e.target.value)}
                                  placeholder="اسکن بارکد / درج سریال..."
                                  className="flex-1 bg-white border-2 border-blue-600 rounded-xl px-3 py-1.5 text-xs font-mono font-bold outline-none shadow-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSerial(row.id);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSerial(row.id)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                                >
                                  ثبت
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSerialRowId(null);
                                    setTempSerialInput('');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSerialRowId(row.id);
                                    setTempSerialInput('');
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all border border-blue-200 shadow-2xs"
                                >
                                  <Barcode className="w-3.5 h-3.5 text-blue-600" />
                                  <span>+ افزودن سریال دستی</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAutoGenerateSerials(row.id)}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all border border-indigo-200 shadow-2xs"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>تولید خودکار</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. TOTAL PRICE */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                          <span className="font-mono font-black text-sm sm:text-base text-emerald-800 block">
                            {lineTotal.toLocaleString('fa-IR')}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold block">تومان</span>
                        </div>
                      </td>

                      {/* ACTION / DELETE ROW */}
                      <td className="py-4 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="حذف سطر"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. SECTION 3: FOOTER FINANCIALS & SETTLEMENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Remarks & Payment Settings (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <h4 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>نحوه تسویه حساب و اسناد پرداخت</span>
            </h4>

            <div className="space-y-3">
              <label className="text-xs sm:text-sm font-black text-slate-700 block">
                روش تسویه مبلغ فاکتور:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm font-bold">
                {[
                  { id: 'pos', label: 'کارتخوان / پوز' },
                  { id: 'cash', label: 'نقدی / واریز' },
                  { id: 'cheque', label: 'چک صیادی' },
                  { id: 'credit', label: 'اعتباری / دفتری' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-3 px-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                      paymentMethod === m.id
                        ? 'bg-blue-50 border-blue-600 text-blue-900 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-options based on payment method */}
            {paymentMethod === 'pos' || paymentMethod === 'cash' ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  <span>حساب بانکی واریز وجه:</span>
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold outline-none text-slate-800"
                >
                  <option value="بانک ملت - حساب جاری دیاکو (شعبه لاله زار)">بانک ملت - حساب جاری دیاکو الکترونیک (شعبه لاله زار)</option>
                  <option value="بانک سامان - حساب شرکتی (کد ۲۴۱۰)">بانک سامان - حساب شرکتی (کد ۲۴۱۰)</option>
                  <option value="بانک ملی ایران - حساب پس‌انداز کارگاه">بانک ملی ایران - حساب پس‌انداز کارگاه</option>
                </select>
              </div>
            ) : paymentMethod === 'cheque' ? (
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-amber-900">شناسه صیادی ۱۶ رقمی چک:</label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="1234567890123456"
                    className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-center font-bold outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-amber-900">تاریخ سررسید چک:</label>
                  <input
                    type="text"
                    value={chequeDueDate}
                    onChange={(e) => setChequeDueDate(e.target.value)}
                    placeholder="۱۴۰۵/۰۷/۱۵"
                    className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-center font-bold outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 flex justify-between items-center">
                <div>
                  <span className="text-xs font-black text-purple-900 block">فروش اعتباری (نسیه دفتری):</span>
                  <span className="text-[11px] text-purple-700">مبلغ فاکتور به بدهی طرف‌حساب اضافه خواهد شد.</span>
                </div>
                <span className="text-xs font-mono font-black bg-white px-3 py-1.5 rounded-xl text-purple-900 border border-purple-200">
                  مانده جدید: {Math.abs(projectedNewBalance).toLocaleString('fa-IR')} ت
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">شرح و شرایط گارانتی در فاکتور:</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 focus:border-blue-500 rounded-2xl text-xs sm:text-sm outline-none font-medium leading-relaxed"
              />
            </div>
          </div>

          {/* Financial Calculation Summary (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <h4 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <Calculator className="w-5 h-5 text-emerald-600" />
              <span>خلاصه محاسبات مالی سند</span>
            </h4>

            <div className="space-y-3 text-xs sm:text-sm divide-y divide-slate-100">
              {/* Subtotal */}
              <div className="flex justify-between items-center py-1.5">
                <span className="font-bold text-slate-600">جمع کل اقلام فاکتور:</span>
                <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                  {subtotal.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              {/* Discount Input */}
              <div className="flex justify-between items-center py-2">
                <span className="font-bold text-slate-600">تخفیف ویژه:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={discountAmount ? discountAmount.toLocaleString('fa-IR') : '۰'}
                    onChange={(e) => {
                      const val = parseNumeric(e.target.value);
                      setDiscountAmount(val);
                    }}
                    className="w-32 bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-1.5 text-center font-mono font-black text-xs sm:text-sm outline-none shadow-2xs"
                  />
                  <span className="text-xs text-slate-400 font-bold">تومان</span>
                </div>
              </div>

              {/* VAT Checkbox */}
              <div className="flex justify-between items-center py-2">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeVat}
                    onChange={(e) => setIncludeVat(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <span>مالیات ارزش افزوده ({toPersianDigits(vatRate)}٪):</span>
                </label>
                <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                  {vatAmount.toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>

            {/* Final Payable Box with Persian Words */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-5 shadow-lg border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-300 block">مبلغ نهایی قابل پرداخت:</span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    خالص فاکتور رسمی
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
                  {finalPayable.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              {/* Amount in Words Badge */}
              <div className="bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                <span className="text-[10.5px] text-slate-300 block font-bold">مبلغ به حروف:</span>
                <p className="text-xs sm:text-sm font-black text-amber-300 leading-relaxed mt-0.5">
                  {amountToTomanWords(finalPayable)}
                </p>
              </div>
            </div>

            {/* Submit & Print Actions */}
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>ثبت نهایی، کسر انبار و فعالسازی گارانتی</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('a4')}
                className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer border border-slate-200 shadow-2xs"
              >
                <Printer className="w-4.5 h-4.5 text-blue-600" />
                <span>چاپ رسمی A4</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('thermal')}
                className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer border border-slate-200 shadow-2xs"
              >
                <Receipt className="w-4.5 h-4.5 text-slate-600" />
                <span>فیش پرینتر</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 5. PARTY SEARCH & SELECTION MODAL */}
      {showPartyModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl relative animate-fade-in text-right font-sans" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">بانک جامع طرف‌حساب‌ها و مشتریان دیاکو الکترونیک</h3>
                  <p className="text-xs text-slate-500">انتخاب سریع خریدار جهت انتساب به فاکتور و صدور گواهی گارانتی</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ طرف حساب جدید</span>
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

            {/* Search Bar & Filter Tabs */}
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  placeholder="جستجوی نام خریدار، شماره همراه، کد حساب، شناسه ملی، نام شرکت یا آدرس..."
                  className="w-full pr-11 pl-10 py-3.5 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-blue-600 rounded-2xl text-xs sm:text-sm font-bold outline-none transition-all shadow-xs"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                {[
                  { id: 'all', label: 'همه طرف حساب‌ها', count: allParties.length },
                  { id: 'customer', label: 'مشتریان و خریداران', count: allParties.filter(p => p.category === 'customer').length },
                  { id: 'colleague', label: 'همکاران و نمایندگان', count: allParties.filter(p => p.category === 'colleague').length },
                  { id: 'supplier', label: 'تأمین‌کنندگان و فروشندگان', count: allParties.filter(p => p.category === 'supplier').length },
                  { id: 'corporate', label: 'اشخاص حقوقی و شرکت‌ها', count: allParties.filter(p => p.category === 'corporate').length }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPartyFilterTab(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                      partyFilterTab === tab.id
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-md font-mono font-bold ${
                      partyFilterTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {toPersianDigits(tab.count)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Parties List Grid */}
            <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
              {filteredParties.map((p) => {
                const isSelected = selectedParty?.id === p.id || selectedParty?.phone === p.phone;
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-xs ${
                        p.category === 'supplier'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.category === 'colleague'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {p.name.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-black text-xs sm:text-sm text-slate-900">{p.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg font-bold">
                            {p.type}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>انتخاب فعلی</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
                          <span>کد حساب: <strong className="text-slate-800">{p.code}</strong></span>
                          <span>•</span>
                          <span>شماره تماس: <strong className="text-slate-800">{p.phone}</strong></span>
                          <span>•</span>
                          <span>مانده: <strong className={p.balance < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                            {p.balance.toLocaleString('fa-IR')} تومان
                          </strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectParty(p)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs shrink-0 self-end sm:self-auto"
                    >
                      انتخاب این خریدار
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. QUICK ADD PARTY MODAL */}
      {showAddPartyModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-fade-in text-right font-sans" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تعریف سریع طرف حساب جدید</h3>
                  <p className="text-[11px] text-slate-500">ثبت در بانک مشتریان و انتخاب خودکار در فاکتور</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddParty} className="space-y-3 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-700">نام و نام خانوادگی / نام شرکت <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="مثال: مهندس حسینی یا شرکت آریا الکترونیک"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700">شماره موبایل <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    required
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    placeholder="09121234567"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl outline-none font-mono text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-700">نوع طرف حساب</label>
                  <select
                    value={newPartyType}
                    onChange={(e) => setNewPartyType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="person">مشتری حقیقی</option>
                    <option value="representative">همکار / بنکدار</option>
                    <option value="corporate">شخص حقوقی / شرکت</option>
                    <option value="supplier">تأمین‌کننده قطعات</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-700">آدرس</label>
                <input
                  type="text"
                  value={newPartyAddress}
                  onChange={(e) => setNewPartyAddress(e.target.value)}
                  placeholder="تهران، خیابان جمهوری..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md cursor-pointer"
                >
                  ذخیره و اتصال به فاکتور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. OFFICIAL A4 PRINT PREVIEW MODAL (Standard Iranian Accounting Tax Invoice) */}
      {printMode && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-fade-in text-right font-sans my-auto" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-3">
                <Printer className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-base font-black">پیش‌نمایش چاپ فاکتور استاندارد ({printMode === 'a4' ? 'فرم رسمی A4 حسابداری و مالیاتی' : 'رسید فیش‌پرینتر حرارتی ۸۰ میلی‌متری'})</h3>
                  <p className="text-xs text-slate-500">طراحی شده مطابق استانداردهای حسابداری و صدور گواهی گارانتی</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintMode(null)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Paper Box - Official Iranian Accounting Layout */}
            <div className="border-2 border-slate-900 rounded-2xl p-6 sm:p-8 bg-white space-y-5 text-xs font-sans shadow-sm">
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row justify-between items-center border-b-2 border-slate-900 pb-4 gap-4">
                <div className="text-right space-y-1">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">صنایع الکترونیک دیاکو (DIACO ELECTRONIC)</h2>
                  <p className="text-xs text-slate-600 font-bold">مرکز تخصصی مهندسی، تولید و خدمات پس از فروش سیستم‌های تغذیه و شارژر صنعتی</p>
                  <p className="text-[11px] text-slate-500 font-mono">شناسه ملی: ۱۴۰۱۲۹۸۴۵۱۱ | کد اقتصادی: ۴۱۱۸۹۳۴۵۲۱۸ | شماره ثبت: ۵۸۴۲۱</p>
                </div>

                <div className="text-left sm:text-right bg-slate-50 p-3 rounded-xl border border-slate-300 font-mono text-xs space-y-1 shrink-0">
                  <div><strong>شماره فاکتور:</strong> {toPersianDigits(invoiceNumber)}</div>
                  <div><strong>تاریخ صدور:</strong> {invoiceDate}</div>
                  <div><strong>پیوست:</strong> گواهی گارانتی</div>
                </div>
              </div>

              {/* Counterparties 2-Column Box (Seller & Buyer) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Seller Box */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                  <span className="font-black text-slate-900 block border-b border-slate-200 pb-1">مشخصات فروشنده:</span>
                  <p><strong>نام شرکت:</strong> صنایع الکترونیک دیاکو</p>
                  <p><strong>شماره تماس:</strong> ۰۲۱-۶۶۷۸۹۰۱۲</p>
                  <p><strong>نشانی:</strong> تهران، خیابان جمهوری، پاساژ امجد، طبقه سوم، واحد ۳۲</p>
                </div>

                {/* Buyer Box */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                  <span className="font-black text-blue-950 block border-b border-blue-200 pb-1">مشخصات خریدار / مشتری:</span>
                  <p><strong>نام شخص/شرکت:</strong> {selectedParty?.name || 'مشتری آزاد'}</p>
                  <p><strong>شماره تماس:</strong> {selectedParty?.phone || '-'}</p>
                  <p><strong>کد حسابداری / کد ملی:</strong> {selectedParty?.nationalId || selectedParty?.code || '-'}</p>
                  {selectedParty?.address && <p><strong>نشانی:</strong> {selectedParty.address}</p>}
                </div>
              </div>

              {/* Items Table - High Density & Bordered */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse border border-slate-900">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-900 text-center">
                      <th className="p-2 border-l border-slate-900 w-10">ردیف</th>
                      <th className="p-2 border-l border-slate-900 text-right">کد و شرح کالا / خدمات</th>
                      <th className="p-2 border-l border-slate-900 w-16">تعداد</th>
                      <th className="p-2 border-l border-slate-900 w-16">واحد</th>
                      <th className="p-2 border-l border-slate-900 w-32">قیمت واحد (تومان)</th>
                      <th className="p-2 border-l border-slate-900 min-w-[180px]">شماره سریال‌ها (پشتوانه گارانتی)</th>
                      <th className="p-2 w-32">مبلغ کل (تومان)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {rows.map((r, i) => (
                      <tr key={r.id} className="text-center font-bold">
                        <td className="p-2 border-l border-slate-400 font-mono">{toPersianDigits(i + 1)}</td>
                        <td className="p-2 border-l border-slate-400 text-right">
                          <p className="font-black text-slate-900">{r.itemName}</p>
                          <span className="text-[10px] text-slate-500 font-mono">مدل: {r.productModel}</span>
                        </td>
                        <td className="p-2 border-l border-slate-400 font-mono font-black">{toPersianDigits(r.quantity)}</td>
                        <td className="p-2 border-l border-slate-400 text-slate-600">{r.unit}</td>
                        <td className="p-2 border-l border-slate-400 font-mono">{r.unitPrice.toLocaleString('fa-IR')}</td>
                        <td className="p-2 border-l border-slate-400 font-mono text-[10.5px] text-right">
                          {r.serials.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.serials.map((s, si) => (
                                <span key={si} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">ثبت نشده</span>
                          )}
                        </td>
                        <td className="p-2 font-mono font-black text-slate-900">{(r.quantity * r.unitPrice).toLocaleString('fa-IR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Breakdown Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t-2 border-slate-900 pt-3">
                {/* Remarks & Conditions */}
                <div className="space-y-1.5 text-xs">
                  <span className="font-black text-slate-900 block">شروط گارانتی و توضیحات تسویه:</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {remarks}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    * قطعات شامل گارانتی طلایی دیاکو مطابق شماره سریال‌های فوق در دیتابیس ثبت شده و به مدت ۱۸ ماه از تاریخ فاکتور معتبر می‌باشد.
                  </p>
                </div>

                {/* Totals Table */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>جمع کل ناخالص:</span>
                    <span className="font-mono font-bold">{subtotal.toLocaleString('fa-IR')} تومان</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-200 text-rose-700">
                      <span>تخفیف ویژه:</span>
                      <span className="font-mono font-bold">-{discountAmount.toLocaleString('fa-IR')} تومان</span>
                    </div>
                  )}
                  {includeVat && (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>مالیات بر ارزش افزوده (۱۰٪):</span>
                      <span className="font-mono font-bold">+{vatAmount.toLocaleString('fa-IR')} تومان</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 bg-slate-900 text-white p-3 rounded-xl font-black text-sm">
                    <span>مبلغ نهایی قابل پرداخت:</span>
                    <span className="font-mono text-emerald-400 text-base">{finalPayable.toLocaleString('fa-IR')} تومان</span>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 font-bold">
                    <strong>مبلغ به حروف:</strong> {amountToTomanWords(finalPayable)}
                  </div>
                </div>
              </div>

              {/* 4 Official Signature Boxes */}
              <div className="grid grid-cols-4 gap-2 pt-6 text-center text-xs font-bold border-t border-slate-300">
                <div className="border-t border-slate-400 pt-2 space-y-8">
                  <span>مهر و امضای فروشنده</span>
                  <div className="h-10" />
                </div>
                <div className="border-t border-slate-400 pt-2 space-y-8">
                  <span>امضای حسابداری و امور مالی</span>
                  <div className="h-10" />
                </div>
                <div className="border-t border-slate-400 pt-2 space-y-8">
                  <span>امضای تحویل‌دهنده (انبار)</span>
                  <div className="h-10" />
                </div>
                <div className="border-t border-slate-400 pt-2 space-y-8">
                  <span>امضا و اثر انگشت خریدار</span>
                  <div className="h-10" />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setPrintMode(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all"
              >
                بستن پنجره
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  triggerToast('دستور چاپ رسمی به پرینتر ارسال شد.');
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md cursor-pointer flex items-center gap-2 transition-all"
              >
                <Printer className="w-4.5 h-4.5" />
                <span>ارسال مستقیم به پرینتر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
