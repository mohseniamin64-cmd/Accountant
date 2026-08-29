export interface SaleItem {
  product: {
    name: string;
    model: string;
    warrantyDuration: string;
    suggestedPrice: string;
    category?: string;
  };
  serials: string[];
  unitPrice: number;
  unitPriceStr: string;
}

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  customer: {
    name: string;
    phone: string;
    type: string;
    address?: string;
    email?: string;
  };
  items: SaleItem[];
  discount: number;
  notes?: string;
  status?: string;
  cancelReason?: string;
  cancelDate?: string;
  cancelNotes?: string;
  paymentMethod?: string;
  returns?: {
    serial: string;
    returnDate: string;
    returnReason: string;
    notes?: string;
    refundAmount: number;
    refundStatus: 'paid' | 'unpaid';
  }[];
}

export interface WarrantyItem {
  serial: string;
  itemName: string;
  customerName: string;
  customerPhone: string;
  defectType: string;
  status: 'pending' | 'under_repair' | 'replaced' | 'rejected' | 'active' | 'waiting_parts';
  statusNotes?: string;
  expiryDate: string;
  registeredAt: string;
  photoUrl?: string;
  technicianName?: string;
  intakeNo?: string;
  priority?: 'عادی' | 'فوری' | 'خیلی فوری';
  model?: string;
  warrantyStatus?: string;
  waitingDaysCount?: number;
  defectDescription?: string;
  defectSubject?: string;
  accessories?: string[];
  conditions?: string[];
  isRealReception?: boolean;
}

export type WorkshopRole = 'admin' | 'technician' | 'reception' | 'delivery';

export interface SystemUser {
  id: string;
  fullName: string;
  username: string;
  role: string;
  isActive: boolean;
  lastLoginDate: string;
}

export type SystemModule = 'hub' | 'accounting' | 'services';

export type ActiveTab = 'hub' | 'dashboard' | 'search' | 'new_claim' | 'queue' | 'users' | 'config' | 'register_sale' | 'customers' | 'products' | 'bank_accounts' | 'handover' | 'reports' | 'dossier' | 'start_repair' | 'final_test' | 'device_delivery' | 'settlement' | 'sales_history' | 'purchase_invoice' | 'purchase_history' | 'project_backup' | 'accounting_dashboard' | 'accounting_reports';

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  cardNumber?: string;
  shebaNumber?: string;
  branchName?: string;
  accountType?: 'جاری' | 'قرض‌الحسنه' | 'کوتاه مدت' | 'بلند مدت' | 'پس‌انداز' | string;
  balance: number;
  currency?: string;
  isActive: boolean;
  posConnected?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company?: string;
  address?: string;
  email?: string;
  code?: string;
}

export interface PurchaseItem {
  product: {
    name: string;
    model: string;
    category?: string;
    warrantyDuration?: string;
    suggestedPrice?: string;
  };
  quantity: number;
  unitPurchasePrice: number;
  unitPurchasePriceStr: string;
  serials: string[];
}

export interface PurchaseRecord {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  supplier: Supplier;
  items: PurchaseItem[];
  paymentMethod: 'cash' | 'cheque' | 'credit' | 'card' | string;
  discount: number;
  tax: number;
  totalPayable: number;
  notes?: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
  cancelReason?: string;
  cancelDate?: string;
}

export interface InventoryItem {
  id: string;
  serial: string;
  productName: string;
  productModel: string;
  category?: string;
  purchaseInvoiceNumber: string;
  purchaseDate: string;
  unitPurchasePrice: number;
  supplierName: string;
  supplierPhone?: string;
  status: 'available' | 'sold' | 'under_repair' | 'reserved';
  saleInvoiceNumber?: string;
  saleDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type?: 'person' | 'representative' | string;
  nationalId?: string;
  economicCode?: string;
  address?: string;
  balance?: number;
  email?: string;
}

export interface Product {
  id: string;
  code?: string;
  name: string;
  price?: number;
  stock?: number;
  warrantyMonths?: number;
  category?: string;
  model?: string;
}

export interface FileItem {
  path: string;
  content?: string;
  name?: string;
  language?: string;
  isFolder?: boolean;
  isBinary?: boolean;
  binaryData?: any;
  size?: number;
}

export type LanguageMode = 'fa' | 'en';

export type IDETheme = 'dark' | 'light';

export interface OpenTab {
  path: string;
  title: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type?: 'file' | 'directory';
  isFolder?: boolean;
  item?: FileItem;
  children?: FileTreeNode[];
}
