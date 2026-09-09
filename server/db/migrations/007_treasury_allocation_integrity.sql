CREATE UNIQUE INDEX payment_allocations_document_unique
ON payment_allocations (
  treasury_transaction_id,
  document_type,
  document_id
);
