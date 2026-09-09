export type TrackingType = 'none' | 'serial' | 'batch';
export type BomVersionStatus = 'draft' | 'active' | 'retired';
export type ProductionOrderStatus =
  | 'draft'
  | 'planned'
  | 'released'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'reversed';
export type ProductionStageStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface ProductionProductOption {
  id: string;
  code: string;
  name: string;
  productType: string;
  trackingType: TrackingType;
  isProducible: boolean;
  unitName: string;
}

export interface ProductionBranchOption {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}

export interface ProductionWarehouseOption {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
}

export interface ProductionBomOption {
  id: string;
  code: string;
  name: string;
  productId: string;
  productCode: string;
  productName: string;
  trackingType: TrackingType;
  activeVersionId: string;
  activeVersionNumber: number;
  outputQuantity: string;
}

export interface ProductionOptions {
  products: ProductionProductOption[];
  branches: ProductionBranchOption[];
  warehouses: ProductionWarehouseOption[];
  boms: ProductionBomOption[];
}

export interface BomSummary {
  id: string;
  code: string;
  name: string;
  productId: string;
  productCode: string;
  productName: string;
  isActive: boolean;
  rowVersion: number;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  outputQuantity: string | null;
}

export interface BomVersion {
  id: string;
  versionNumber: number;
  status: BomVersionStatus;
  outputQuantity: string;
  effectiveFrom: string | null;
  notes: string | null;
  rowVersion: number;
}

export interface BomComponent {
  id: string;
  bomVersionId: string;
  productId: string;
  productCode: string;
  productName: string;
  unitName: string;
  quantity: string;
  wastePercent: string;
  stageCode: string;
  issueWarehouseId: string | null;
  notes: string | null;
}

export interface BomDetail {
  id: string;
  code: string;
  name: string;
  productId: string;
  productName: string;
  isActive: boolean;
  rowVersion: number;
  versions: BomVersion[];
  components: BomComponent[];
}

export interface BomComponentDraft {
  key: string;
  productId: string;
  quantity: string;
  wastePercent: string;
  stageCode: string;
  issueWarehouseId: string;
  notes: string;
}

export interface ProductionAvailabilityComponent {
  productId: string;
  productCode: string;
  productName: string;
  requiredPerOutput: string;
  availableQuantity: string;
  maximumOutput: string;
}

export interface ProductionAvailability {
  maximumQuantity: string;
  components: ProductionAvailabilityComponent[];
}

export interface ProductionOrderSummary {
  id: string;
  orderNumber: string;
  status: ProductionOrderStatus;
  plannedQuantity: string;
  actualQuantity: string | null;
  plannedStartOn: string | null;
  plannedEndOn: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalCostIrr: string;
  rowVersion: number;
  branchId: string;
  branchName: string;
  materialWarehouseId: string;
  materialWarehouseName: string;
  outputWarehouseId: string;
  outputWarehouseName: string;
  productCode: string;
  productName: string;
}

export interface ProductionStage {
  id: string;
  sequenceNumber: number;
  stageCode: string;
  title: string;
  status: ProductionStageStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  rowVersion: number;
}

export interface ProductionMaterial {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  trackingType: TrackingType;
  unitName: string;
  warehouseId: string;
  warehouseName: string;
  plannedQuantity: string;
  actualQuantity: string;
  returnedQuantity: string;
  unitCostIrr: string;
  serialNumbers: string[];
}

export interface ProductionOutput {
  id: string;
  quantity: string;
  unitCostIrr: string;
  warehouseId: string;
  warehouseName: string;
  serialNumbers: string[];
}

export interface ProductionOrderDetail extends ProductionOrderSummary {
  description: string | null;
  directLaborCostIrr: string;
  subcontractCostIrr: string;
  overheadCostIrr: string;
  packagingCostIrr: string;
  productId: string;
  trackingType: TrackingType;
  bomVersionId: string;
  bomCode: string;
  bomName: string;
  bomVersionNumber: number;
  stages: ProductionStage[];
  materials: ProductionMaterial[];
  outputs: ProductionOutput[];
}

export interface AvailableProductionSerial {
  id: string;
  serialNumber: string;
  acquiredOn: string | null;
}
