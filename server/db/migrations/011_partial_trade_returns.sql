-- Partial purchase and sale returns need a durable link to the original line,
-- multiple return invoices per original invoice, and a settlement amount that
-- remains separate from actual cash receipts/payments.
ALTER TABLE purchase_invoice_lines
ADD COLUMN original_line_id UUID REFERENCES purchase_invoice_lines(id);

ALTER TABLE sale_invoice_lines
ADD COLUMN original_line_id UUID REFERENCES sale_invoice_lines(id);

UPDATE purchase_invoice_lines return_line
SET original_line_id = original_line.id
FROM purchase_invoices return_invoice,
     purchase_invoice_lines original_line
WHERE return_line.invoice_id = return_invoice.id
  AND original_line.invoice_id = return_invoice.return_of_id
  AND original_line.line_number = return_line.line_number
  AND return_invoice.invoice_type = 'return'
  AND return_line.original_line_id IS NULL;

UPDATE sale_invoice_lines return_line
SET original_line_id = original_line.id
FROM sale_invoices return_invoice,
     sale_invoice_lines original_line
WHERE return_line.invoice_id = return_invoice.id
  AND original_line.invoice_id = return_invoice.return_of_id
  AND original_line.line_number = return_line.line_number
  AND return_invoice.invoice_type = 'return'
  AND return_line.original_line_id IS NULL;

DROP INDEX IF EXISTS purchase_return_unique;
DROP INDEX IF EXISTS sale_return_unique;

CREATE INDEX purchase_returns_original_idx
ON purchase_invoices (return_of_id)
WHERE return_of_id IS NOT NULL;

CREATE INDEX sale_returns_original_idx
ON sale_invoices (return_of_id)
WHERE return_of_id IS NOT NULL;

CREATE INDEX purchase_return_lines_original_idx
ON purchase_invoice_lines (original_line_id)
WHERE original_line_id IS NOT NULL;

CREATE INDEX sale_return_lines_original_idx
ON sale_invoice_lines (original_line_id)
WHERE original_line_id IS NOT NULL;

ALTER TABLE purchase_invoices
ADD COLUMN returned_irr BIGINT NOT NULL DEFAULT 0 CHECK (returned_irr >= 0);

ALTER TABLE sale_invoices
ADD COLUMN returned_irr BIGINT NOT NULL DEFAULT 0 CHECK (returned_irr >= 0);

UPDATE purchase_invoices original
SET returned_irr = LEAST(
  original.total_irr,
  COALESCE((
    SELECT sum(return_invoice.total_irr)
    FROM purchase_invoices return_invoice
    WHERE return_invoice.return_of_id = original.id
      AND return_invoice.invoice_type = 'return'
      AND return_invoice.status = 'posted'
  ), 0)
)
WHERE original.invoice_type = 'purchase';

UPDATE sale_invoices original
SET returned_irr = LEAST(
  original.total_irr,
  COALESCE((
    SELECT sum(return_invoice.total_irr)
    FROM sale_invoices return_invoice
    WHERE return_invoice.return_of_id = original.id
      AND return_invoice.invoice_type = 'return'
      AND return_invoice.status = 'posted'
  ), 0)
)
WHERE original.invoice_type = 'sale';

ALTER TABLE purchase_invoices
ADD CONSTRAINT purchase_returned_not_over_total
CHECK (returned_irr <= total_irr);

ALTER TABLE sale_invoices
ADD CONSTRAINT sale_returned_not_over_total
CHECK (returned_irr <= total_irr);
