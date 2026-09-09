export type ServiceStatus =
  | 'received'
  | 'diagnosis'
  | 'waiting_customer'
  | 'waiting_part'
  | 'repairing'
  | 'final_test'
  | 'ready_delivery'
  | 'delivered'
  | 'cancelled';

export type WarrantyDecision =
  | 'pending'
  | 'in_warranty'
  | 'out_of_warranty'
  | 'rejected';

export type EstimateStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected';

export type RemovedDisposition =
  | 'returned_customer'
  | 'supplier_warranty'
  | 'repaired_reused'
  | 'scrapped';

export type TrackingType = 'none' | 'serial' | 'batch';

export interface ServiceBranchOption {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}

export interface ServiceWarehouseOption {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
  warehouseType: string;
}

export interface ServiceProductOption {
  id: string;
  code: string;
  name: string;
  trackingType: TrackingType;
  unitName: string;
}

export interface ServiceInventoryBalance {
  warehouseId: string;
  productId: string;
  quantity: string;
  reservedQuantity: string;
  availableQuantity: string;
}

export interface ServiceOptions {
  branches: ServiceBranchOption[];
  warehouses: ServiceWarehouseOption[];
  products: ServiceProductOption[];
  balances: ServiceInventoryBalance[];
}

export interface ServiceSerialHistory {
  id: string;
  orderNumber: string;
  status: ServiceStatus;
  receivedAt: string;
  deliveredAt: string | null;
}

export interface ServiceSerialLookup {
  serialId: string;
  serialNumber: string;
  serialStatus: string;
  productId: string;
  productCode: string;
  productName: string;
  saleInvoiceId: string;
  saleInvoiceNumber: string;
  saleDate: string;
  customerId: string;
  customerName: string;
  customerMobile: string | null;
  warrantyId: string | null;
  warrantyStartsOn: string | null;
  warrantyEndsOn: string | null;
  warrantyRemainingDays: number;
  serviceHistory: ServiceSerialHistory[];
  isInWarranty: boolean;
}

export interface ServiceOrderSummary {
  id: string;
  orderNumber: string;
  trackingCode: string;
  receivedAt: string;
  status: ServiceStatus;
  warrantyDecision: WarrantyDecision;
  estimateStatus: EstimateStatus;
  finalCostIrr: string;
  paidIrr: string;
  rowVersion: number;
  serialNumber: string;
  productName: string;
  customerName: string;
  customerMobile: string | null;
}

export interface ServiceEvent {
  eventType: string;
  fromStatus: ServiceStatus | null;
  toStatus: ServiceStatus | null;
  description: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface ServicePart {
  id: string;
  quantity: string;
  usageType: 'installed' | 'removed';
  isChargeable: boolean;
  unitPriceIrr: string;
  removedDisposition: RemovedDisposition | null;
  createdAt: string;
  productCode: string;
  productName: string;
  warehouseName: string | null;
  serialNumber: string | null;
}

export interface ServiceWarranty {
  durationMonths: 1 | 3;
  startsOn: string;
  endsOn: string;
  description: string | null;
}

export interface ServiceAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: string;
  attachmentType:
    | 'intake'
    | 'diagnosis'
    | 'warranty_evidence'
    | 'repair'
    | 'delivery';
  caption: string | null;
  createdAt: string;
}

export interface ServiceOrderDetail {
  id: string;
  branchId: string;
  branchName: string;
  orderNumber: string;
  trackingCode: string;
  receivedAt: string;
  complaint: string;
  intakeCondition: string | null;
  receivedAccessories: string | null;
  status: ServiceStatus;
  warrantyDecision: WarrantyDecision;
  warrantyRejectionReason: string | null;
  warrantyRejectionEvidence: string | null;
  estimatedCostIrr: string;
  estimateStatus: EstimateStatus;
  finalCostIrr: string;
  paidIrr: string;
  deliveredAt: string | null;
  rowVersion: number;
  serialNumber: string;
  productCode: string;
  productName: string;
  customerId: string;
  customerName: string;
  customerMobile: string | null;
  warrantyStartsOn: string | null;
  warrantyEndsOn: string | null;
  warrantyRemainingDays: number;
  events: ServiceEvent[];
  parts: ServicePart[];
  serviceWarranty: ServiceWarranty | null;
  attachments: ServiceAttachment[];
}

export interface AvailableServicePartSerial {
  id: string;
  serialNumber: string;
}

export interface PublicServiceEvent {
  eventType: string;
  toStatus: ServiceStatus | null;
  createdAt: string;
}

export interface PublicServiceOrder {
  id: string;
  trackingCode: string;
  receivedAt: string;
  status: ServiceStatus;
  warrantyDecision: WarrantyDecision;
  estimatedCostIrr: string;
  estimateStatus: EstimateStatus;
  finalCostIrr: string;
  paidIrr: string;
  deliveredAt: string | null;
  productName: string;
  serialNumber: string;
  events: PublicServiceEvent[];
}
