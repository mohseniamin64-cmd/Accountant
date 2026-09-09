import Decimal from 'decimal.js';
import type {PoolClient, QueryResultRow} from 'pg';
import {AppError} from '../../common/errors.js';

interface BalanceRow extends QueryResultRow {
  quantity: string;
  reserved_quantity: string;
  average_cost_irr: string;
  allow_negative: boolean;
}

interface MovementRow extends QueryResultRow {
  id: string;
}

export interface MovingAverageResult {
  newQuantity: Decimal;
  newAverageCost: Decimal;
  movementUnitCost: Decimal;
  movementValue: Decimal;
}

export function calculateMovingAverage(
  oldQuantity: Decimal.Value,
  oldAverageCost: Decimal.Value,
  quantityDelta: Decimal.Value,
  incomingUnitCost: Decimal.Value,
): MovingAverageResult {
  const oldQty = new Decimal(oldQuantity);
  const oldAverage = new Decimal(oldAverageCost);
  const delta = new Decimal(quantityDelta);
  const incomingCost = new Decimal(incomingUnitCost);
  const newQuantity = oldQty.plus(delta);

  if (delta.isZero()) {
    throw new AppError(
      422,
      'ZERO_INVENTORY_MOVEMENT',
      'مقدار گردش موجودی نمی‌تواند صفر باشد.',
    );
  }
  if (incomingCost.isNegative()) {
    throw new AppError(
      422,
      'NEGATIVE_INVENTORY_COST',
      'بهای واحد موجودی نمی‌تواند منفی باشد.',
    );
  }

  if (delta.isPositive()) {
    const existingValue = oldQty.isPositive()
      ? oldQty.times(oldAverage)
      : new Decimal(0);
    const incomingValue = delta.times(incomingCost);
    const newAverageCost = newQuantity.isPositive()
      ? existingValue.plus(incomingValue).div(newQuantity)
      : incomingCost;
    return {
      newQuantity,
      newAverageCost,
      movementUnitCost: incomingCost,
      movementValue: incomingValue,
    };
  }

  return {
    newQuantity,
    newAverageCost: newQuantity.isZero() ? new Decimal(0) : oldAverage,
    movementUnitCost: oldAverage,
    movementValue: delta.times(oldAverage),
  };
}

export interface InventoryMovementInput {
  companyId: string;
  warehouseId: string;
  productId: string;
  serialId?: string | null;
  batchId?: string | null;
  movementType:
    | 'opening'
    | 'purchase'
    | 'purchase_return'
    | 'sale'
    | 'sale_return'
    | 'transfer_in'
    | 'transfer_out'
    | 'production_issue'
    | 'production_return'
    | 'production_receipt'
    | 'service_issue'
    | 'service_return'
    | 'adjustment'
    | 'waste'
    | 'reversal';
  quantityDelta: Decimal.Value;
  incomingUnitCost: Decimal.Value;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string | null;
  reason?: string | null;
  reversalOfId?: string | null;
  releaseReservedQuantity?: Decimal.Value;
  userId: string;
}

export interface AppliedMovement {
  id: string;
  quantity: string;
  averageCostIrr: string;
  unitCostIrr: string;
  valueDeltaIrr: string;
}

function databaseDecimal(value: Decimal): string {
  return value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
}

export async function applyInventoryMovement(
  client: PoolClient,
  input: InventoryMovementInput,
): Promise<AppliedMovement> {
  const ownership = await client.query(
    `
      SELECT 1
      FROM products product
      JOIN warehouses warehouse ON warehouse.company_id = product.company_id
      WHERE product.id = $1
        AND warehouse.id = $2
        AND product.company_id = $3
        AND product.is_active = true
        AND warehouse.is_active = true
    `,
    [input.productId, input.warehouseId, input.companyId],
  );
  if (!ownership.rowCount) {
    throw new AppError(
      422,
      'INVALID_INVENTORY_DIMENSION',
      'کالا یا انبار انتخاب‌شده معتبر نیست.',
    );
  }

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
    [input.companyId, input.warehouseId, input.productId],
  );

  const balanceResult = await client.query<BalanceRow>(
    `
      SELECT
        balance.quantity,
        balance.reserved_quantity,
        balance.average_cost_irr,
        warehouse.allow_negative
      FROM inventory_balances balance
      JOIN warehouses warehouse ON warehouse.id = balance.warehouse_id
      WHERE balance.warehouse_id = $1 AND balance.product_id = $2
      FOR UPDATE OF balance
    `,
    [input.warehouseId, input.productId],
  );
  const balance = balanceResult.rows[0];
  if (!balance) throw new Error('Inventory balance row was not created');

  const calculated = calculateMovingAverage(
    balance.quantity,
    balance.average_cost_irr,
    input.quantityDelta,
    input.incomingUnitCost,
  );

  const reserved = new Decimal(balance.reserved_quantity);
  const releasedReservation = new Decimal(
    input.releaseReservedQuantity ?? 0,
  );
  if (
    releasedReservation.isNegative() ||
    releasedReservation.greaterThan(reserved)
  ) {
    throw new AppError(
      409,
      'INVALID_INVENTORY_RESERVATION_RELEASE',
      '\u0645\u0642\u062f\u0627\u0631 \u0622\u0632\u0627\u062f\u0633\u0627\u0632\u06cc \u0631\u0632\u0631\u0648 \u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
    );
  }
  const remainingReservation = reserved.minus(releasedReservation);
  const outboundQuantity = new Decimal(input.quantityDelta).isNegative()
    ? new Decimal(input.quantityDelta).abs()
    : new Decimal(0);
  const availableForOutbound = new Decimal(balance.quantity)
    .minus(remainingReservation);
  if (
    outboundQuantity.greaterThan(availableForOutbound) &&
    !balance.allow_negative
  ) {
    throw new AppError(
      409,
      'INSUFFICIENT_AVAILABLE_INVENTORY',
      '\u0645\u0648\u062c\u0648\u062f\u06cc \u0642\u0627\u0628\u0644 \u0645\u0635\u0631\u0641 \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u06a9\u0627\u0641\u06cc \u0646\u06cc\u0633\u062a.',
      {
        available: availableForOutbound.toString(),
        reserved: remainingReservation.toString(),
        requested: outboundQuantity.toString(),
      },
    );
  }

  if (calculated.newQuantity.isNegative() && !balance.allow_negative) {
    throw new AppError(
      409,
      'INSUFFICIENT_INVENTORY',
      'موجودی انبار برای انجام این عملیات کافی نیست.',
      {
        available: balance.quantity,
        requestedDelta: new Decimal(input.quantityDelta).toString(),
      },
    );
  }

  await client.query(
    `
      UPDATE inventory_balances
      SET
        quantity = $3,
        average_cost_irr = $4,
        reserved_quantity = $5,
        row_version = row_version + 1,
        updated_at = now()
      WHERE warehouse_id = $1 AND product_id = $2
    `,
    [
      input.warehouseId,
      input.productId,
      databaseDecimal(calculated.newQuantity),
      databaseDecimal(calculated.newAverageCost),
      databaseDecimal(remainingReservation),
    ],
  );

  const movementResult = await client.query<MovementRow>(
    `
      INSERT INTO inventory_movements (
        company_id,
        warehouse_id,
        product_id,
        serial_id,
        batch_id,
        movement_type,
        quantity_delta,
        unit_cost_irr,
        value_delta_irr,
        source_type,
        source_id,
        source_line_id,
        reason,
        reversal_of_id,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15
      )
      RETURNING id
    `,
    [
      input.companyId,
      input.warehouseId,
      input.productId,
      input.serialId ?? null,
      input.batchId ?? null,
      input.movementType,
      databaseDecimal(new Decimal(input.quantityDelta)),
      databaseDecimal(calculated.movementUnitCost),
      databaseDecimal(calculated.movementValue),
      input.sourceType,
      input.sourceId,
      input.sourceLineId ?? null,
      input.reason ?? null,
      input.reversalOfId ?? null,
      input.userId,
    ],
  );
  const movementId = movementResult.rows[0]?.id;
  if (!movementId) throw new Error('Inventory movement was not created');

  return {
    id: movementId,
    quantity: databaseDecimal(calculated.newQuantity),
    averageCostIrr: databaseDecimal(calculated.newAverageCost),
    unitCostIrr: databaseDecimal(calculated.movementUnitCost),
    valueDeltaIrr: databaseDecimal(calculated.movementValue),
  };
}
