ALTER TABLE service_orders
  ADD COLUMN source_service_order_id UUID REFERENCES service_orders(id),
  ADD COLUMN coverage_source VARCHAR(30) NOT NULL DEFAULT 'none'
    CHECK (coverage_source IN ('sale_warranty', 'service_warranty', 'none')),
  ADD COLUMN service_warranty_id UUID REFERENCES service_warranties(id),
  ADD COLUMN coverage_starts_on DATE,
  ADD COLUMN coverage_ends_on DATE,
  ADD COLUMN coverage_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN assigned_to UUID REFERENCES users(id),
  ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN delivered_to_name VARCHAR(180),
  ADD COLUMN delivered_to_mobile VARCHAR(30),
  ADD COLUMN delivery_confirmation TEXT;

ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_coverage_dates_check
  CHECK (
    coverage_starts_on IS NULL
    OR coverage_ends_on IS NULL
    OR coverage_starts_on <= coverage_ends_on
  );

UPDATE service_orders service
SET
  coverage_source = 'sale_warranty',
  coverage_starts_on = warranty.starts_on,
  coverage_ends_on = warranty.ends_on,
  coverage_checked_at = service.received_at
FROM warranties warranty
WHERE warranty.id = service.warranty_id
  AND service.received_at::date BETWEEN warranty.starts_on AND warranty.ends_on
  AND service.warranty_decision = 'in_warranty';

ALTER TABLE service_warranties
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'transferred', 'voided'));

CREATE INDEX service_warranties_active_lookup_idx
ON service_warranties (company_id, serial_id, ends_on DESC)
WHERE status = 'active';

CREATE INDEX service_orders_assignee_queue_idx
ON service_orders (company_id, assigned_to, status, priority, due_at);

CREATE TABLE service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  previous_assigned_to UUID REFERENCES users(id),
  assigned_to UUID NOT NULL REFERENCES users(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  priority VARCHAR(20) NOT NULL
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES users(id),
  CHECK (
    (released_at IS NULL AND released_by IS NULL)
    OR (released_at IS NOT NULL AND released_by IS NOT NULL)
  )
);

CREATE INDEX service_assignments_order_idx
ON service_assignments (service_order_id, created_at, id);

CREATE UNIQUE INDEX service_assignments_one_active_per_order
ON service_assignments (service_order_id)
WHERE released_at IS NULL;

CREATE TABLE service_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  inspection_type VARCHAR(20) NOT NULL
    CHECK (inspection_type IN ('diagnosis', 'final_test')),
  result_status VARCHAR(20) NOT NULL
    CHECK (result_status IN ('passed', 'failed', 'conditional')),
  observed_fault TEXT NOT NULL,
  fault_cause TEXT,
  action_taken TEXT,
  test_result TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(checklist) = 'object'),
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX service_inspections_order_idx
ON service_inspections (service_order_id, created_at, id);

ALTER TABLE service_parts
  ADD COLUMN unit_cost_irr BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost_irr >= 0),
  ADD COLUMN is_reversed BOOLEAN NOT NULL DEFAULT false;

DROP INDEX service_parts_installed_serial_unique;

CREATE UNIQUE INDEX service_parts_installed_serial_unique
ON service_parts (serial_id)
WHERE serial_id IS NOT NULL
  AND usage_type = 'installed'
  AND is_reversed = false;

CREATE TABLE service_part_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  service_part_id UUID NOT NULL UNIQUE REFERENCES service_parts(id),
  return_warehouse_id UUID REFERENCES warehouses(id),
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  reason TEXT NOT NULL,
  reversed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  cost_type VARCHAR(30) NOT NULL
    CHECK (cost_type IN ('labor', 'outsourcing', 'transport', 'other')),
  amount_irr BIGINT NOT NULL CHECK (amount_irr > 0),
  description TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX service_costs_order_idx
ON service_costs (service_order_id, created_at, id);

CREATE TABLE service_replacements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  service_order_id UUID NOT NULL UNIQUE REFERENCES service_orders(id),
  old_serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  new_serial_id UUID NOT NULL UNIQUE REFERENCES serial_numbers(id),
  source_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  inventory_movement_id UUID NOT NULL REFERENCES inventory_movements(id),
  unit_cost_irr BIGINT NOT NULL CHECK (unit_cost_irr >= 0),
  old_warranty_id UUID REFERENCES warranties(id),
  new_warranty_id UUID REFERENCES warranties(id),
  coverage_ends_on DATE,
  old_serial_disposition VARCHAR(20) NOT NULL
    CHECK (old_serial_disposition IN ('returned', 'scrapped')),
  reason TEXT NOT NULL,
  replaced_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (old_serial_id <> new_serial_id)
);

CREATE INDEX service_assignments_company_assignee_idx
ON service_assignments (company_id, assigned_to, created_at DESC);

CREATE INDEX service_inspections_company_order_idx
ON service_inspections (company_id, service_order_id, created_at, id);

CREATE INDEX service_costs_company_order_idx
ON service_costs (company_id, service_order_id, created_at, id);

CREATE INDEX service_replacements_company_idx
ON service_replacements (company_id, created_at DESC);

-- Resolve ownership through replacement chains without rewriting the original invoice.
CREATE VIEW service_serial_sales AS
WITH RECURSIVE ownership(serial_id, invoice_line_id) AS (
  SELECT serial_id, invoice_line_id FROM sale_invoice_serials
  UNION
  SELECT replacement.new_serial_id, ownership.invoice_line_id
  FROM ownership
  JOIN service_replacements replacement ON replacement.old_serial_id = ownership.serial_id
)
SELECT serial_id, invoice_line_id FROM ownership;

-- Historical inventory cost must not silently become zero for pre-existing repairs.
UPDATE service_parts part
SET unit_cost_irr = movement.unit_cost_irr
FROM inventory_movements movement
WHERE movement.id = part.inventory_movement_id AND part.usage_type = 'installed';
