import Decimal from 'decimal.js';
import type {PoolClient, QueryResultRow} from 'pg';
import {AppError} from '../../common/errors.js';

interface ProductionMaterialReservationRow extends QueryResultRow {
  id: string;
  product_id: string;
  warehouse_id: string;
  planned_quantity: string;
  product_code: string;
  product_name: string;
  warehouse_name: string;
}

export async function reserveProductionMaterials(
  client: PoolClient,
  companyId: string,
  orderId: string,
): Promise<void> {
  const materials = await client.query<ProductionMaterialReservationRow>(
    `
      SELECT
        material.id,
        material.product_id,
        material.warehouse_id,
        material.planned_quantity::text,
        product.code AS product_code,
        product.name AS product_name,
        warehouse.name AS warehouse_name
      FROM production_materials material
      JOIN production_orders production
        ON production.id = material.production_order_id
      JOIN products product ON product.id = material.product_id
      JOIN warehouses warehouse ON warehouse.id = material.warehouse_id
      WHERE material.production_order_id = $1
        AND production.company_id = $2
        AND product.company_id = $2
        AND warehouse.company_id = $2
        AND product.is_active = true
        AND warehouse.is_active = true
      ORDER BY material.id
      FOR UPDATE OF material
    `,
    [orderId, companyId],
  );
  if (!materials.rowCount) {
    throw new AppError(
      409,
      'PRODUCTION_MATERIALS_NOT_FOUND',
      'مواد موردنیاز این دستور تولید پیدا نشد.',
    );
  }

  for (const material of materials.rows) {
    await client.query(
      `
        INSERT INTO inventory_balances (
          company_id,
          warehouse_id,
          product_id
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (warehouse_id, product_id) DO NOTHING
      `,
      [companyId, material.warehouse_id, material.product_id],
    );

    const reserved = await client.query(
      `
        UPDATE inventory_balances
        SET
          reserved_quantity = reserved_quantity + $4::numeric,
          row_version = row_version + 1,
          updated_at = now()
        WHERE company_id = $1
          AND warehouse_id = $2
          AND product_id = $3
          AND quantity - reserved_quantity >= $4::numeric
        RETURNING reserved_quantity
      `,
      [
        companyId,
        material.warehouse_id,
        material.product_id,
        material.planned_quantity,
      ],
    );
    if (!reserved.rowCount) {
      const balance = await client.query<{
        quantity: string;
        reserved_quantity: string;
      }>(
        `
          SELECT quantity::text, reserved_quantity::text
          FROM inventory_balances
          WHERE company_id = $1
            AND warehouse_id = $2
            AND product_id = $3
        `,
        [companyId, material.warehouse_id, material.product_id],
      );
      const row = balance.rows[0];
      const available = row
        ? Decimal.max(
            new Decimal(row.quantity).minus(row.reserved_quantity),
            0,
          ).toString()
        : '0';
      throw new AppError(
        409,
        'INSUFFICIENT_PRODUCTION_MATERIAL',
        `موجودی قابل رزرو «${material.product_name}» در انبار «${material.warehouse_name}» کافی نیست.`,
        {
          productId: material.product_id,
          productCode: material.product_code,
          productName: material.product_name,
          warehouseId: material.warehouse_id,
          warehouseName: material.warehouse_name,
          required: material.planned_quantity,
          available,
        },
      );
    }
  }
}
