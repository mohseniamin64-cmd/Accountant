CREATE TABLE boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  product_id UUID NOT NULL REFERENCES products(id),
  code VARCHAR(60) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code),
  UNIQUE (company_id, product_id)
);

CREATE TRIGGER boms_updated_at
BEFORE UPDATE ON boms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bom_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES boms(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'retired')),
  output_quantity NUMERIC(20, 6) NOT NULL DEFAULT 1
    CHECK (output_quantity > 0),
  effective_from DATE,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bom_id, version_number)
);

CREATE UNIQUE INDEX one_active_bom_version
ON bom_versions (bom_id)
WHERE status = 'active';

CREATE TRIGGER bom_versions_updated_at
BEFORE UPDATE ON bom_versions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bom_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_version_id UUID NOT NULL
    REFERENCES bom_versions(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  waste_percent NUMERIC(7, 4) NOT NULL DEFAULT 0
    CHECK (waste_percent BETWEEN 0 AND 100),
  stage_code VARCHAR(60) NOT NULL DEFAULT 'assembly',
  issue_warehouse_id UUID REFERENCES warehouses(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bom_version_id, component_product_id)
);

CREATE OR REPLACE FUNCTION prevent_bom_self_reference()
RETURNS TRIGGER AS $$
DECLARE
  output_product UUID;
BEGIN
  SELECT bom.product_id
  INTO output_product
  FROM bom_versions version
  JOIN boms bom ON bom.id = version.bom_id
  WHERE version.id = NEW.bom_version_id;

  IF output_product = NEW.component_product_id THEN
    RAISE EXCEPTION 'A product cannot be a component of itself';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_component_self_reference
BEFORE INSERT OR UPDATE ON bom_components
FOR EACH ROW EXECUTE FUNCTION prevent_bom_self_reference();

CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  order_number BIGINT NOT NULL,
  bom_version_id UUID NOT NULL REFERENCES bom_versions(id),
  product_id UUID NOT NULL REFERENCES products(id),
  planned_quantity NUMERIC(20, 6) NOT NULL CHECK (planned_quantity > 0),
  actual_quantity NUMERIC(20, 6) CHECK (actual_quantity >= 0),
  planned_start_on DATE,
  planned_end_on DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  material_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  wip_warehouse_id UUID REFERENCES warehouses(id),
  output_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'planned',
        'released',
        'in_progress',
        'completed',
        'cancelled',
        'reversed'
      )
    ),
  direct_labor_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (direct_labor_cost_irr >= 0),
  subcontract_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (subcontract_cost_irr >= 0),
  overhead_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (overhead_cost_irr >= 0),
  packaging_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (packaging_cost_irr >= 0),
  total_cost_irr BIGINT NOT NULL DEFAULT 0 CHECK (total_cost_irr >= 0),
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  completed_by UUID REFERENCES users(id),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);

CREATE INDEX production_orders_status_idx
ON production_orders (company_id, status, planned_start_on);

CREATE TRIGGER production_orders_updated_at
BEFORE UPDATE ON production_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE production_order_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL
    REFERENCES production_orders(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  stage_code VARCHAR(60) NOT NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  assigned_to UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, sequence_number),
  UNIQUE (production_order_id, stage_code)
);

CREATE TRIGGER production_order_stages_updated_at
BEFORE UPDATE ON production_order_stages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE production_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  bom_component_id UUID REFERENCES bom_components(id),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  planned_quantity NUMERIC(20, 6) NOT NULL CHECK (planned_quantity >= 0),
  actual_quantity NUMERIC(20, 6) NOT NULL DEFAULT 0
    CHECK (actual_quantity >= 0),
  returned_quantity NUMERIC(20, 6) NOT NULL DEFAULT 0
    CHECK (returned_quantity >= 0),
  unit_cost_irr NUMERIC(24, 6) NOT NULL DEFAULT 0,
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, product_id)
);

CREATE TABLE production_material_serials (
  production_material_id UUID NOT NULL
    REFERENCES production_materials(id) ON DELETE CASCADE,
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  PRIMARY KEY (production_material_id, serial_id)
);

CREATE TABLE production_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_cost_irr NUMERIC(24, 6) NOT NULL CHECK (unit_cost_irr >= 0),
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE production_output_serials (
  production_output_id UUID NOT NULL
    REFERENCES production_outputs(id) ON DELETE CASCADE,
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  PRIMARY KEY (production_output_id, serial_id),
  UNIQUE (serial_id)
);

CREATE TABLE production_waste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  disposition VARCHAR(30) NOT NULL
    CHECK (disposition IN ('scrap', 'rework', 'return_to_stock')),
  reason TEXT NOT NULL,
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subcontract_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  production_order_id UUID REFERENCES production_orders(id),
  order_number BIGINT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES parties(id),
  order_date DATE NOT NULL,
  expected_return_on DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'sent',
        'partially_received',
        'received',
        'cancelled'
      )
    ),
  material_ownership VARCHAR(30) NOT NULL
    CHECK (material_ownership IN ('company', 'supplier', 'mixed')),
  service_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (service_cost_irr >= 0),
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);

CREATE TRIGGER subcontract_orders_updated_at
BEFORE UPDATE ON subcontract_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE subcontract_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontract_order_id UUID NOT NULL
    REFERENCES subcontract_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_sent NUMERIC(20, 6) NOT NULL DEFAULT 0,
  quantity_received NUMERIC(20, 6) NOT NULL DEFAULT 0,
  unit_service_cost_irr BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  CHECK (quantity_sent >= 0 AND quantity_received >= 0),
  UNIQUE (subcontract_order_id, product_id)
);

CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  order_number BIGINT NOT NULL,
  tracking_code VARCHAR(40) NOT NULL,
  tracking_token_hash CHAR(64) NOT NULL,
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  customer_id UUID NOT NULL REFERENCES parties(id),
  warranty_id UUID REFERENCES warranties(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID NOT NULL REFERENCES users(id),
  complaint TEXT NOT NULL,
  intake_condition TEXT,
  received_accessories TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'received'
    CHECK (
      status IN (
        'received',
        'diagnosis',
        'waiting_customer',
        'waiting_part',
        'repairing',
        'final_test',
        'ready_delivery',
        'delivered',
        'cancelled'
      )
    ),
  warranty_decision VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (
      warranty_decision IN (
        'pending',
        'in_warranty',
        'out_of_warranty',
        'rejected'
      )
    ),
  warranty_rejection_reason TEXT,
  warranty_rejection_evidence TEXT,
  estimated_cost_irr BIGINT NOT NULL DEFAULT 0
    CHECK (estimated_cost_irr >= 0),
  estimate_status VARCHAR(20) NOT NULL DEFAULT 'not_required'
    CHECK (
      estimate_status IN (
        'not_required',
        'pending',
        'approved',
        'rejected'
      )
    ),
  estimate_responded_at TIMESTAMPTZ,
  final_cost_irr BIGINT NOT NULL DEFAULT 0 CHECK (final_cost_irr >= 0),
  paid_irr BIGINT NOT NULL DEFAULT 0 CHECK (paid_irr >= 0),
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES users(id),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    warranty_decision <> 'rejected'
    OR (
      warranty_rejection_reason IS NOT NULL
      AND warranty_rejection_evidence IS NOT NULL
    )
  ),
  CHECK (paid_irr <= final_cost_irr),
  UNIQUE (company_id, order_number),
  UNIQUE (company_id, tracking_code)
);

CREATE UNIQUE INDEX one_active_service_order_per_serial
ON service_orders (serial_id)
WHERE status NOT IN ('delivered', 'cancelled');

CREATE INDEX service_orders_queue_idx
ON service_orders (company_id, status, received_at);

CREATE TRIGGER service_orders_updated_at
BEFORE UPDATE ON service_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE service_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  event_type VARCHAR(60) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX service_events_order_idx
ON service_events (service_order_id, created_at, id);

CREATE OR REPLACE FUNCTION block_service_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Service events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_events_append_only
BEFORE UPDATE OR DELETE ON service_events
FOR EACH ROW EXECUTE FUNCTION block_service_event_mutation();

CREATE TABLE service_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  usage_type VARCHAR(20) NOT NULL
    CHECK (usage_type IN ('installed', 'removed')),
  is_chargeable BOOLEAN NOT NULL DEFAULT false,
  unit_price_irr BIGINT NOT NULL DEFAULT 0 CHECK (unit_price_irr >= 0),
  removed_disposition VARCHAR(40)
    CHECK (
      removed_disposition IN (
        'returned_customer',
        'supplier_warranty',
        'repaired_reused',
        'scrapped'
      )
    ),
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    usage_type = 'installed'
    OR removed_disposition IS NOT NULL
  )
);

CREATE TABLE service_attachments (
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  uploaded_file_id UUID NOT NULL REFERENCES uploaded_files(id),
  attachment_type VARCHAR(30) NOT NULL
    CHECK (
      attachment_type IN (
        'intake',
        'diagnosis',
        'warranty_evidence',
        'repair',
        'delivery'
      )
    ),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_order_id, uploaded_file_id)
);

CREATE TABLE service_warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  serial_id UUID NOT NULL REFERENCES serial_numbers(id),
  duration_months INTEGER NOT NULL CHECK (duration_months IN (1, 3)),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on),
  UNIQUE (service_order_id)
);

CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  recipient VARCHAR(30) NOT NULL,
  message_text TEXT NOT NULL,
  message_type VARCHAR(40) NOT NULL,
  related_entity_type VARCHAR(60),
  related_entity_id UUID,
  provider VARCHAR(40) NOT NULL DEFAULT 'android_local',
  provider_message_id VARCHAR(180),
  status VARCHAR(30) NOT NULL DEFAULT 'queued'
    CHECK (
      status IN (
        'queued',
        'sending',
        'sent',
        'delivered',
        'failed',
        'cancelled'
      )
    ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sms_queue_idx
ON sms_messages (status, queued_at)
WHERE status IN ('queued', 'failed');

CREATE TRIGGER sms_messages_updated_at
BEFORE UPDATE ON sms_messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  backup_type VARCHAR(30) NOT NULL
    CHECK (
      backup_type IN (
        'local',
        'external_drive',
        'google_drive',
        'restore_verification'
      )
    ),
  trigger_type VARCHAR(30) NOT NULL
    CHECK (
      trigger_type IN (
        'manual',
        'scheduled',
        'end_of_day',
        'server_shutdown',
        'drive_connected'
      )
    ),
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  storage_path TEXT,
  byte_size BIGINT CHECK (byte_size >= 0),
  sha256 CHAR(64),
  encrypted BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  requested_by UUID REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX backup_runs_time_idx
ON backup_runs (company_id, started_at DESC);

CREATE TABLE connector_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  connector_type VARCHAR(40) NOT NULL
    CHECK (
      connector_type IN (
        'android_sms',
        'google_drive',
        'taxpayer_system'
      )
    ),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_configuration BYTEA,
  last_health_status VARCHAR(30),
  last_health_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, connector_type)
);

CREATE TRIGGER connector_states_updated_at
BEFORE UPDATE ON connector_states
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE idempotency_keys (
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  idempotency_key VARCHAR(120) NOT NULL,
  request_path VARCHAR(240) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (company_id, user_id, idempotency_key)
);

CREATE INDEX idempotency_expiry_idx
ON idempotency_keys (expires_at);
