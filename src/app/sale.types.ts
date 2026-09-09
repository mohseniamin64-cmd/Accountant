export type SaleStatus = 'draft' | 'posted' | 'reversed';
export type SalePaymentStatus = 'unpaid' | 'partial' | 'paid';
export type SaleTrackingType = 'none' | 'serial' | 'batch';

export interface SaleSummary {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: string;
  status: SaleStatus;
  totalIrr: string;
  returnedIrr: string;
  receivedIrr: string;
  paymentStatus: SalePaymentStatus;
  officialInvoice: boolean;
  taxpayerStatus: string;
  rowVersion: number;
  customerId: string;
  customerName: string;
}

export interface SaleCustomerOption {
  id: string;
  code: string;
  displayName: string;
  isCustomer: boolean;
  isSupplier: boolean;
}

export interface SaleProductOption {
  id: string;
  code: string;
  name: string;
  productType: string;
  trackingType: SaleTrackingType;
  unitName: string;
  defaultSalePriceIrr: string;
  taxRate: string;
}

export interface SaleBranchOption {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}

export interface SaleWarehouseOption {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
}

export interface SaleInventoryBalance {
  productId: string;
  warehouseId: string;
  quantity: string;
  reservedQuantity: string;
  availableQuantity: string;
}

export interface SaleOptions {
  customers: SaleCustomerOption[];
  products: SaleProductOption[];
  branches: SaleBranchOption[];
  warehouses: SaleWarehouseOption[];
  balances: SaleInventoryBalance[];
}

export interface AvailableSaleSerial {
  id: string;
  serialNumber: string;
  acquiredOn: string | null;
}

export interface SaleDraftLine {
  key: string;
  productId: string;
  warehouseId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  description: string;
  selectedSerials: string[];
}

export interface SaleDraft {
  branchId: string;
  customerId: string;
  officialInvoice: boolean;
  description: string;
  lines: SaleDraftLine[];
}

export interface SaleDetailLine {
  id: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: string;
  returnedQuantity: string;
  remainingQuantity: string;
  unitPriceIrr: string;
  discountIrr: string;
  taxIrr: string;
  lineTotalIrr: string;
  description: string | null;
  trackingType: SaleTrackingType;
  serialNumbers: string[];
  returnableSerialNumbers: string[];
  serialCount: number;
}

export interface SaleDetail {
  lines: SaleDetailLine[];
}

export interface SaleCreated {
  id: string;
  invoiceNumber: string;
}

