export type PurchaseStatus = 'draft' | 'posted' | 'reversed';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type ProductTrackingType = 'none' | 'serial' | 'batch';

export interface PurchaseSummary {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string | null;
  invoiceDate: string;
  invoiceType: string;
  status: PurchaseStatus;
  totalIrr: string;
  returnedIrr: string;
  paidIrr: string;
  paymentStatus: PaymentStatus;
  rowVersion: number;
  supplierId: string;
  supplierName: string;
}

export interface PurchaseSupplierOption {
  id: string;
  code: string;
  displayName: string;
  isCustomer: boolean;
  isSupplier: boolean;
}

export interface PurchaseProductOption {
  id: string;
  code: string;
  name: string;
  productType: string;
  trackingType: ProductTrackingType;
  unitName: string;
  defaultPurchasePriceIrr: string;
  taxRate: string;
}

export interface PurchaseBranchOption {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}

export interface PurchaseWarehouseOption {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
}

export interface PurchaseOptions {
  suppliers: PurchaseSupplierOption[];
  products: PurchaseProductOption[];
  branches: PurchaseBranchOption[];
  warehouses: PurchaseWarehouseOption[];
}

export interface PurchaseDraftLine {
  key: string;
  productId: string;
  warehouseId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  description: string;
  serialText: string;
}

export interface PurchaseDraft {
  branchId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  otherCosts: string;
  description: string;
  lines: PurchaseDraftLine[];
}

export interface PurchaseDetailLine {
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
  trackingType: ProductTrackingType;
  serialNumbers: string[];
  returnableSerialNumbers: string[];
  serialCount: number;
}

export interface PurchaseDetail {
  lines: PurchaseDetailLine[];
}

export interface PurchaseCreated {
  id: string;
  invoiceNumber: string;
}
