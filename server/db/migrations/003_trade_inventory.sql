CREATE TABLE inventory_balances (
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(20, 6) NOT NULL DEFAULT 0,
  average_cost_irr NUMERIC(24, 6) NOT NULL DEFAULT 0
    CHECK (average_cost_irr >= 0),
  reserved_quantity NUMERIC(20, 6) NOT NULL DEFAULT 0
    CHECK (reserved_quantity >= 0),
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_quantity <= GREATEST(quantity, 0)),
  PRIMARY KEY (warehouse_id, product_id)
);

CREATE INDEX inventory_balances_company_product_idx
ON inventory_balances (company_id, product_id);

CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  batch_number VARCHAR(120) NOT NULL,
  manufactured_on DATE,
  expires_on DATE,
  quantity NUMERIC(20, 6) NOT NULL DEFAULT 0,
  average_cost_irr NUMERIC(24, 6) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'quarantined', 'consumed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id, batch_number)
);

CREATE TRIGGER inventory_batches_updated_at
BEFORE UPDATE ON inventory_batches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  product_id UUID NOT NULL REFERENCES products(id),
  serial_number VARCHAR(160) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  batch_id UUID REFERENCES inventory_batches(id),
  status VARCHAR(30) NOT NULL DEFAULT 'in_stock'
    CHECK (
      status IN (
        'in_stock',
        'reserved',
        'sold',
        'in_production',
        'in_service',
        'returned',
        'supplier_return',
        'scrapped'
      )
    ),
  acquired_on DATE,
  manufactured_on DATE,
  sold_on DATE,
  source_type VARCHAR(60),
  source_id UUID,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, serial_number)
);

CREATE INDEX serial_product_status_idx
ON serial_numbers (company_id, product_id, status);

CREATE TRIGGER serial_numbers_updated_at
BEFORE UPDATE ON serial_numbers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  serial_id UUID REFERENCES serial_numbers(id),
  batch_id UUID REFERENCES inventory_batches(id),
  movement_type VARCHAR(40) NOT NULL
    CHECK (
      movement_type IN (
        'opening',
        'purchase',
        'purchase_return',
        'sale',
        'sale_return',
        'transfer_in',
        'transfer_out',
        'production_issue',
        'production_return',
        'production_receipt',
        'service_issue',
        'service_return',
        'adjustment',
        'waste',
        'reversal'
      )
    ),
  quantity_delta NUMERIC(20, 6) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_irr NUMERIC(24, 6) NOT NULL CHECK (unit_cost_irr >= 0),
  value_delta_irr NUMERIC(30, 6) NOT NULL,
  source_type VARCHAR(60) NOT NULL,
  source_id UUID NOT NULL,
  source_line_id UUID,
  reason TEXT,
  reversal_of_id UUID REFERENCES inventory_movements(id),
  created_by UUID NOT NULL REFERENCES users(id),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (movement_type <> 'adjustment' OR reason IS NOT NULL)
);

CREATE INDEX inventory_movements_ledger_idx
ON inventory_movements (
  company_id,
  warehouse_id,
  product_id,
  posted_at,
  id
);

CREATE UNIQUE INDEX inventory_movement_reversal_unique
ON inventory_movements (reversal_of_id)
WHERE reversal_of_id IS NOT NULL;

CREATE OR REPLACE FUNCTION block_inventory_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Inventory movements are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movements_append_only
BEFORE UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION block_inventory_movement_mutation();

CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  serial_id UUID REFERENCES serial_numbers(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  source_type VARCHAR(60) NOT NULL,
  source_id UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'fulfilled', 'released', 'expired')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stock_reservations_source_idx
ON stock_reservations (company_id, source_type, source_id);

CREATE TRIGGER stock_reservations_updated_at
BEFORE UPDATE ON stock_reservations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  transfer_number BIGINT NOT NULL,
  transfer_date DATE NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_transit', 'received', 'reversed')),
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  dispatched_by UUID REFERENCES users(id),
  dispatched_at TIMESTAMPTZ,
  received_by UUID REFERENCES users(id),
  received_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_warehouse_id <> to_warehouse_id),
  UNIQUE (company_id, transfer_number)
);

CREATE TRIGGER stock_transfers_updated_at
BEFORE UPDATE ON stock_transfers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL
    REFERENCES stock_transfers(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, line_number)
);

CREATE TABLE stock_transfer_serials (
  transfer_line_id UUID NOT NULL
    REFERENCES stock_transfer_lines(id) ON DELETE CASCADE,
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  PRIMARY KEY (transfer_line_id, serial_id)
);

CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  invoice_number BIGINT NOT NULL,
  supplier_invoice_number VARCHAR(120),
  invoice_type VARCHAR(20) NOT NULL DEFAULT 'purchase'
    CHECK (invoice_type IN ('purchase', 'return')),
  invoice_date DATE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES parties(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'reversed')),
  subtotal_irr BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_irr >= 0),
  discount_irr BIGINT NOT NULL DEFAULT 0 CHECK (discount_irr >= 0),
  tax_irr BIGINT NOT NULL DEFAULT 0 CHECK (tax_irr >= 0),
  other_costs_irr BIGINT NOT NULL DEFAULT 0 CHECK (other_costs_irr >= 0),
  total_irr BIGINT NOT NULL DEFAULT 0 CHECK (total_irr >= 0),
  paid_irr BIGINT NOT NULL DEFAULT 0 CHECK (paid_irr >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  description TEXT,
  return_of_id UUID REFERENCES purchase_invoices(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID NOT NULL REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_irr <= total_irr),
  UNIQUE (company_id, fiscal_year_id, invoice_number)
);

CREATE UNIQUE INDEX purchase_return_unique
ON purchase_invoices (return_of_id)
WHERE return_of_id IS NOT NULL;

CREATE TRIGGER purchase_invoices_updated_at
BEFORE UPDATE ON purchase_invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE purchase_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL
    REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_price_irr BIGINT NOT NULL CHECK (unit_price_irr >= 0),
  discount_irr BIGINT NOT NULL DEFAULT 0 CHECK (discount_irr >= 0),
  tax_irr BIGINT NOT NULL DEFAULT 0 CHECK (tax_irr >= 0),
  allocated_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (allocated_cost_irr >= 0),
  line_total_irr BIGINT NOT NULL CHECK (line_total_irr >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, line_number)
);

CREATE TABLE purchase_invoice_serials (
  invoice_line_id UUID NOT NULL
    REFERENCES purchase_invoice_lines(id) ON DELETE CASCADE,
  serial_number VARCHAR(160) NOT NULL,
  serial_id UUID REFERENCES serial_numbers(id),
  PRIMARY KEY (invoice_line_id, serial_number)
);

CREATE TABLE sale_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  invoice_number BIGINT NOT NULL,
  invoice_type VARCHAR(20) NOT NULL DEFAULT 'sale'
    CHECK (invoice_type IN ('sale', 'return')),
  invoice_date DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES parties(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'reversed')),
  subtotal_irr BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_irr >= 0),
  discount_irr BIGINT NOT NULL DEFAULT 0 CHECK (discount_irr >= 0),
  tax_irr BIGINT NOT NULL DEFAULT 0 CHECK (tax_irr >= 0),
  total_irr BIGINT NOT NULL DEFAULT 0 CHECK (total_irr >= 0),
  received_irr BIGINT NOT NULL DEFAULT 0 CHECK (received_irr >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  official_invoice BOOLEAN NOT NULL DEFAULT false,
  taxpayer_status VARCHAR(30) NOT NULL DEFAULT 'not_submitted'
    CHECK (
      taxpayer_status IN (
        'not_submitted',
        'queued',
        'submitted',
        'accepted',
        'rejected'
      )
    ),
  taxpayer_reference VARCHAR(160),
  buyer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  return_of_id UUID REFERENCES sale_invoices(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID NOT NULL REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (received_irr <= total_irr),
  UNIQUE (company_id, fiscal_year_id, invoice_number)
);

CREATE INDEX sale_customer_date_idx
ON sale_invoices (company_id, customer_id, invoice_date DESC);

CREATE TRIGGER sale_invoices_updated_at
BEFORE UPDATE ON sale_invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sale_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES sale_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_price_irr BIGINT NOT NULL CHECK (unit_price_irr >= 0),
  discount_irr BIGINT NOT NULL DEFAULT 0 CHECK (discount_irr >= 0),
  tax_irr BIGINT NOT NULL DEFAULT 0 CHECK (tax_irr >= 0),
  line_total_irr BIGINT NOT NULL CHECK (line_total_irr >= 0),
  cost_of_goods_irr BIGINT NOT NULL DEFAULT 0
    CHECK (cost_of_goods_irr >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, line_number)
);

CREATE TABLE sale_invoice_serials (
  invoice_line_id UUID NOT NULL
    REFERENCES sale_invoice_lines(id) ON DELETE CASCADE,
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  PRIMARY KEY (invoice_line_id, serial_id),
  UNIQUE (serial_id)
);

CREATE TABLE payment_allocations (
  treasury_transaction_id UUID NOT NULL
    REFERENCES treasury_transactions(id),
  document_type VARCHAR(30) NOT NULL
    CHECK (
      document_type IN ('purchase_invoice', 'sale_invoice', 'service_order')),
  document_id UUID NOT NULL,
  amount_irr BIGINT NOT NULL CHECK (amount_irr > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (treasury_transaction_id, document_type, document_id)
);

CREATE TABLE warranty_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  product_id UUID NOT NULL REFERENCES products(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  duration_months INTEGER NOT NULL CHECK (duration_months BETWEEN 0 AND 120),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from <= effective_to),
  UNIQUE (product_id, version_number)
);

CREATE INDEX warranty_policy_effective_idx
ON warranty_policy_versions (product_id, effective_from DESC);

CREATE TABLE warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  sale_invoice_id UUID NOT NULL REFERENCES sale_invoices(id),
  sale_line_id UUID NOT NULL REFERENCES sale_invoice_lines(id),
  customer_id UUID NOT NULL REFERENCES parties(id),
  policy_version_id UUID REFERENCES warranty_policy_versions(id),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  original_duration_months INTEGER NOT NULL
    CHECK (original_duration_months BETWEEN 0 AND 120),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'voided', 'transferred')),
  overridden_by UUID REFERENCES users(id),
  override_reason TEXT,
  transferred_from_id UUID REFERENCES warranties(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on),
  UNIQUE (serial_id, sale_invoice_id)
);

CREATE INDEX warranties_lookup_idx
ON warranties (company_id, serial_id, status);

CREATE TRIGGER warranties_updated_at
BEFORE UPDATE ON warranties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
