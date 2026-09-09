export interface TradeReturnSelection {
  originalLineId: string;
  quantity: string;
  serialNumbers: string[];
}

export interface TradeReturnableLine {
  id: string;
  productCode: string;
  productName: string;
  quantity: string;
  returnedQuantity: string;
  remainingQuantity: string;
  trackingType: 'none' | 'serial' | 'batch';
  returnableSerialNumbers: string[];
}

export interface TradeReturnCreated {
  id: string;
  invoiceNumber: string;
  journalEntryId: string | null;
  originalStatus: 'posted' | 'reversed';
  returnedIrr: string;
}
