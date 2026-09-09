ALTER TABLE service_parts
ADD COLUMN serial_id UUID REFERENCES serial_numbers(id);

CREATE UNIQUE INDEX service_parts_installed_serial_unique
ON service_parts (serial_id)
WHERE serial_id IS NOT NULL AND usage_type = 'installed';
