-- Allow a returned serial to be linked to a later sale while serial status
-- and row locks remain the authority for whether it is currently sellable.
ALTER TABLE sale_invoice_serials
DROP CONSTRAINT IF EXISTS sale_invoice_serials_serial_id_key;

CREATE INDEX IF NOT EXISTS sale_invoice_serials_serial_idx
ON sale_invoice_serials (serial_id);

CREATE UNIQUE INDEX IF NOT EXISTS sale_return_unique
ON sale_invoices (return_of_id)
WHERE return_of_id IS NOT NULL;
