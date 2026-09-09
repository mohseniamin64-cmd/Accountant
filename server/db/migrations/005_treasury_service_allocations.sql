ALTER TABLE payment_allocations
DROP CONSTRAINT IF EXISTS payment_allocations_document_type_check;

ALTER TABLE payment_allocations
ADD CONSTRAINT payment_allocations_document_type_check
CHECK (
  document_type IN (
    'purchase_invoice',
    'sale_invoice',
    'service_order'
  )
);
