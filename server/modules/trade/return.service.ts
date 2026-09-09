import Decimal from 'decimal.js';
import type {PoolClient, QueryResultRow} from 'pg';
import {AppError} from '../../common/errors.js';
import {nextSequence} from '../../infrastructure/sequences.js';
import {
  createJournalEntry,
  systemAccountIds,
  type JournalLineInput,
} from '../accounting/journal.service.js';
import {applyInventoryMovement} from '../inventory/inventory.service.js';
import {
  calculateJournalBalancingAmount,
  calculatePartialReturnAmount,
  validateReturnDate,
} from './invoice.calculations.js';

export interface InvoiceReturnLineSelection {
  originalLineId: string;
  quantity: string;
  serialNumbers: readonly string[];
}

export interface InvoiceReturnResult {
  id: string;
  invoiceNumber: string;
  journalEntryId: string | null;
  originalStatus: 'posted' | 'reversed';
  returnedIrr: string;
}

interface FiscalRow extends QueryResultRow {
  id: string;
}

interface IdRow extends QueryResultRow {
  id: string;
}

interface PurchaseReturnHeaderRow extends QueryResultRow {
  id: string;
  company_id: string;
  branch_id: string;
  invoice_number: string;
  supplier_invoice_number: string | null;
  invoice_type: string;
  invoice_date: string;
  supplier_id: string;
  status: string;
  total_irr: string;
  paid_irr: string;
  returned_irr: string;
  row_version: number;
}

interface SaleReturnHeaderRow extends QueryResultRow {
  id: string;
  company_id: string;
  branch_id: string;
  invoice_number: string;
  invoice_type: string;
  invoice_date: string;
  customer_id: string;
  status: string;
  total_irr: string;
  received_irr: string;
  returned_irr: string;
  row_version: number;
}

interface OriginalReturnLineRow extends QueryResultRow {
  id: string;
  line_number: number;
  product_id: string;
  warehouse_id: string;
  quantity: string;
  unit_price_irr: string;
  discount_irr: string;
  tax_irr: string;
  allocated_cost_irr: string;
  line_total_irr: string;
  cost_of_goods_irr: string;
  description: string | null;
  product_type: string;
  tracking_type: 'none' | 'serial' | 'batch';
  returned_quantity: string;
  returned_discount_irr: string;
  returned_tax_irr: string;
  returned_allocated_cost_irr: string;
  returned_line_total_irr: string;
  returned_cost_of_goods_irr: string;
}

interface SerialRow extends QueryResultRow {
  id: string;
  serial_number: string;
  product_id: string;
  warehouse_id: string | null;
  status: string;
}

interface PreparedReturnLine {
  original: OriginalReturnLineRow;
  quantity: Decimal;
  serialNumbers: string[];
  useAllRemainingSerials: boolean;
  discountIrr: bigint;
  taxIrr: bigint;
  allocatedCostIrr: bigint;
  lineTotalIrr: bigint;
  costOfGoodsIrr: bigint;
}

async function openFiscalYear(
  client: PoolClient,
  companyId: string,
  date: string,
): Promise<string> {
  const result = await client.query<FiscalRow>(
    `
      SELECT id
      FROM fiscal_years
      WHERE company_id = $1
        AND $2::date BETWEEN starts_on AND ends_on
        AND status = 'open'
      ORDER BY starts_on DESC
      LIMIT 1
    `,
    [companyId, date],
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new AppError(
      422,
      'NO_OPEN_FISCAL_YEAR',
      'برای تاریخ مرجوعی، سال مالی باز وجود ندارد.',
    );
  }
  return id;
}

function roundedAbsoluteIrr(value: string): bigint {
  return BigInt(
    new Decimal(value)
      .abs()
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toFixed(0),
  );
}

function returnAmount(
  line: OriginalReturnLineRow,
  quantity: Decimal,
  originalAmount: keyof Pick<
    OriginalReturnLineRow,
    | 'discount_irr'
    | 'tax_irr'
    | 'allocated_cost_irr'
    | 'line_total_irr'
    | 'cost_of_goods_irr'
  >,
  returnedAmount: keyof Pick<
    OriginalReturnLineRow,
    | 'returned_discount_irr'
    | 'returned_tax_irr'
    | 'returned_allocated_cost_irr'
    | 'returned_line_total_irr'
    | 'returned_cost_of_goods_irr'
  >,
): bigint {
  return calculatePartialReturnAmount({
    originalAmountIrr: BigInt(line[originalAmount]),
    originalQuantity: line.quantity,
    alreadyReturnedAmountIrr: BigInt(line[returnedAmount]),
    alreadyReturnedQuantity: line.returned_quantity,
    returnQuantity: quantity,
  });
}

function prepareReturnLines(
  lines: readonly OriginalReturnLineRow[],
  selections: readonly InvoiceReturnLineSelection[],
): {lines: PreparedReturnLine[]; completesOriginal: boolean} {
  const requested = new Map<string, InvoiceReturnLineSelection>();
  for (const selection of selections) {
    if (requested.has(selection.originalLineId)) {
      throw new AppError(
        422,
        'DUPLICATE_RETURN_LINE',
        'هر ردیف فاکتور فقط یک‌بار می‌تواند در درخواست مرجوعی انتخاب شود.',
      );
    }
    requested.set(selection.originalLineId, selection);
  }

  const prepared: PreparedReturnLine[] = [];
  const selectedSerials = new Set<string>();
  for (const line of lines) {
    const originalQuantity = new Decimal(line.quantity);
    const alreadyReturned = new Decimal(line.returned_quantity);
    const remaining = originalQuantity.minus(alreadyReturned);
    const selection = selections.length === 0
      ? (remaining.isPositive()
          ? {
              originalLineId: line.id,
              quantity: remaining.toString(),
              serialNumbers: [],
            }
          : undefined)
      : requested.get(line.id);
    if (!selection) continue;
    requested.delete(line.id);

    const quantity = new Decimal(selection.quantity);
    if (!quantity.isPositive() || quantity.greaterThan(remaining)) {
      throw new AppError(
        422,
        'RETURN_QUANTITY_EXCEEDS_REMAINING',
        'مقدار انتخاب‌شده از مانده قابل مرجوعی بیشتر است.',
      );
    }

    const serialNumbers = selection.serialNumbers
      .map((serial) => serial.trim())
      .filter(Boolean);
    if (line.tracking_type === 'serial') {
      if (!quantity.isInteger()) {
        throw new AppError(
          422,
          'SERIAL_RETURN_QUANTITY_NOT_INTEGER',
          'مقدار کالای سریالی باید عدد صحیح باشد.',
        );
      }
      if (
        selections.length > 0 &&
        serialNumbers.length !== quantity.toNumber()
      ) {
        throw new AppError(
          422,
          'RETURN_SERIAL_COUNT_MISMATCH',
          'تعداد سریال‌های انتخاب‌شده باید با مقدار مرجوعی برابر باشد.',
        );
      }
      for (const serial of serialNumbers) {
        const key = serial.toLocaleLowerCase('en-US');
        if (selectedSerials.has(key)) {
          throw new AppError(
            422,
            'DUPLICATE_RETURN_SERIAL',
            'یک شماره سریال بیش از یک‌بار برای مرجوعی انتخاب شده است.',
          );
        }
        selectedSerials.add(key);
      }
    } else if (serialNumbers.length > 0) {
      throw new AppError(
        422,
        'SERIALS_NOT_ALLOWED_FOR_LINE',
        'برای ردیف غیرسریالی نباید شماره سریال ارسال شود.',
      );
    }

    prepared.push({
      original: line,
      quantity,
      serialNumbers,
      useAllRemainingSerials:
        line.tracking_type === 'serial' && selections.length === 0,
      discountIrr: returnAmount(
        line,
        quantity,
        'discount_irr',
        'returned_discount_irr',
      ),
      taxIrr: returnAmount(
        line,
        quantity,
        'tax_irr',
        'returned_tax_irr',
      ),
      allocatedCostIrr: returnAmount(
        line,
        quantity,
        'allocated_cost_irr',
        'returned_allocated_cost_irr',
      ),
      lineTotalIrr: returnAmount(
        line,
        quantity,
        'line_total_irr',
        'returned_line_total_irr',
      ),
      costOfGoodsIrr: returnAmount(
        line,
        quantity,
        'cost_of_goods_irr',
        'returned_cost_of_goods_irr',
      ),
    });
  }

  if (requested.size > 0) {
    throw new AppError(
      422,
      'RETURN_LINE_NOT_FOUND',
      'یکی از ردیف‌های انتخاب‌شده متعلق به فاکتور اصلی نیست.',
    );
  }
  if (prepared.length === 0) {
    throw new AppError(
      422,
      'RETURN_LINES_REQUIRED',
      'حداقل یک ردیف دارای مانده باید برای مرجوعی انتخاب شود.',
    );
  }

  const quantityByLine = new Map(
    prepared.map((line) => [line.original.id, line.quantity]),
  );
  const completesOriginal = lines.every((line) =>
    new Decimal(line.returned_quantity)
      .plus(quantityByLine.get(line.id) ?? 0)
      .equals(line.quantity),
  );
  return {lines: prepared, completesOriginal};
}

async function purchaseOriginalLines(
  client: PoolClient,
  invoiceId: string,
): Promise<OriginalReturnLineRow[]> {
  const result = await client.query<OriginalReturnLineRow>(
    `
      SELECT
        line.id,
        line.line_number,
        line.product_id,
        line.warehouse_id,
        line.quantity::text,
        line.unit_price_irr::text,
        line.discount_irr::text,
        line.tax_irr::text,
        line.allocated_cost_irr::text,
        line.line_total_irr::text,
        '0'::text AS cost_of_goods_irr,
        line.description,
        product.product_type,
        product.tracking_type,
        coalesce(sum(returned_line.quantity)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_quantity,
        coalesce(sum(returned_line.discount_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_discount_irr,
        coalesce(sum(returned_line.tax_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_tax_irr,
        coalesce(sum(returned_line.allocated_cost_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_allocated_cost_irr,
        coalesce(sum(returned_line.line_total_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_line_total_irr,
        '0'::text AS returned_cost_of_goods_irr
      FROM purchase_invoice_lines line
      JOIN products product ON product.id = line.product_id
      LEFT JOIN purchase_invoice_lines returned_line
        ON returned_line.original_line_id = line.id
      LEFT JOIN purchase_invoices returned_invoice
        ON returned_invoice.id = returned_line.invoice_id
       AND returned_invoice.return_of_id = $1
       AND returned_invoice.invoice_type = 'return'
       AND returned_invoice.status = 'posted'
      WHERE line.invoice_id = $1
      GROUP BY line.id, product.product_type, product.tracking_type
      ORDER BY line.line_number
    `,
    [invoiceId],
  );
  return result.rows;
}

async function saleOriginalLines(
  client: PoolClient,
  invoiceId: string,
): Promise<OriginalReturnLineRow[]> {
  const result = await client.query<OriginalReturnLineRow>(
    `
      SELECT
        line.id,
        line.line_number,
        line.product_id,
        line.warehouse_id,
        line.quantity::text,
        line.unit_price_irr::text,
        line.discount_irr::text,
        line.tax_irr::text,
        '0'::text AS allocated_cost_irr,
        line.line_total_irr::text,
        line.cost_of_goods_irr::text,
        line.description,
        product.product_type,
        product.tracking_type,
        coalesce(sum(returned_line.quantity)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_quantity,
        coalesce(sum(returned_line.discount_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_discount_irr,
        coalesce(sum(returned_line.tax_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_tax_irr,
        '0'::text AS returned_allocated_cost_irr,
        coalesce(sum(returned_line.line_total_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_line_total_irr,
        coalesce(sum(returned_line.cost_of_goods_irr)
          FILTER (WHERE returned_invoice.id IS NOT NULL), 0)::text
          AS returned_cost_of_goods_irr
      FROM sale_invoice_lines line
      JOIN products product ON product.id = line.product_id
      LEFT JOIN sale_invoice_lines returned_line
        ON returned_line.original_line_id = line.id
      LEFT JOIN sale_invoices returned_invoice
        ON returned_invoice.id = returned_line.invoice_id
       AND returned_invoice.return_of_id = $1
       AND returned_invoice.invoice_type = 'return'
       AND returned_invoice.status = 'posted'
      WHERE line.invoice_id = $1
      GROUP BY line.id, product.product_type, product.tracking_type
      ORDER BY line.line_number
    `,
    [invoiceId],
  );
  return result.rows;
}

async function purchaseReturnSerials(
  client: PoolClient,
  invoiceId: string,
  line: PreparedReturnLine,
): Promise<SerialRow[]> {
  if (line.original.tracking_type !== 'serial') return [];
  const result = await client.query<SerialRow>(
    `
      SELECT
        serial.id,
        serial.serial_number,
        serial.product_id,
        serial.warehouse_id,
        serial.status
      FROM purchase_invoice_serials original_link
      JOIN serial_numbers serial ON serial.id = original_link.serial_id
      WHERE original_link.invoice_line_id = $1
        AND ($3::boolean OR serial.serial_number = ANY($4::text[]))
        AND NOT EXISTS (
          SELECT 1
          FROM purchase_invoice_serials prior_link
          JOIN purchase_invoice_lines prior_line
            ON prior_line.id = prior_link.invoice_line_id
          JOIN purchase_invoices prior_invoice
            ON prior_invoice.id = prior_line.invoice_id
          WHERE prior_line.original_line_id = $1
            AND prior_invoice.return_of_id = $2
            AND prior_invoice.invoice_type = 'return'
            AND prior_invoice.status = 'posted'
            AND prior_link.serial_id = serial.id
        )
      ORDER BY serial.serial_number
      FOR UPDATE OF serial
    `,
    [
      line.original.id,
      invoiceId,
      line.useAllRemainingSerials,
      line.serialNumbers,
    ],
  );
  if (
    result.rows.length !== line.quantity.toNumber() ||
    result.rows.some(
      (serial) =>
        serial.status !== 'in_stock' ||
        serial.warehouse_id !== line.original.warehouse_id ||
        serial.product_id !== line.original.product_id,
    )
  ) {
    throw new AppError(
      409,
      'PURCHASE_SERIAL_NOT_RETURNABLE',
      'سریال‌های انتخاب‌شده باید متعلق به همین خرید، در همان انبار و در وضعیت موجود باشند.',
    );
  }
  return result.rows;
}

async function saleReturnSerials(
  client: PoolClient,
  invoiceId: string,
  line: PreparedReturnLine,
): Promise<SerialRow[]> {
  if (line.original.tracking_type !== 'serial') return [];
  const result = await client.query<SerialRow>(
    `
      SELECT
        serial.id,
        serial.serial_number,
        serial.product_id,
        serial.warehouse_id,
        serial.status
      FROM sale_invoice_serials original_link
      JOIN serial_numbers serial ON serial.id = original_link.serial_id
      WHERE original_link.invoice_line_id = $1
        AND ($3::boolean OR serial.serial_number = ANY($4::text[]))
        AND NOT EXISTS (
          SELECT 1
          FROM sale_invoice_serials prior_link
          JOIN sale_invoice_lines prior_line
            ON prior_line.id = prior_link.invoice_line_id
          JOIN sale_invoices prior_invoice
            ON prior_invoice.id = prior_line.invoice_id
          WHERE prior_line.original_line_id = $1
            AND prior_invoice.return_of_id = $2
            AND prior_invoice.invoice_type = 'return'
            AND prior_invoice.status = 'posted'
            AND prior_link.serial_id = serial.id
        )
      ORDER BY serial.serial_number
      FOR UPDATE OF serial
    `,
    [
      line.original.id,
      invoiceId,
      line.useAllRemainingSerials,
      line.serialNumbers,
    ],
  );
  if (
    result.rows.length !== line.quantity.toNumber() ||
    result.rows.some(
      (serial) =>
        serial.status !== 'sold' ||
        serial.product_id !== line.original.product_id,
    )
  ) {
    throw new AppError(
      409,
      'SALE_SERIAL_NOT_RETURNABLE',
      'سریال‌های انتخاب‌شده باید متعلق به همین فروش، مرجوع‌نشده و خارج از تعمیر باشند.',
    );
  }
  return result.rows;
}

function returnTotals(lines: readonly PreparedReturnLine[]) {
  return lines.reduce(
    (totals, line) => {
      totals.discountIrr += line.discountIrr;
      totals.taxIrr += line.taxIrr;
      totals.otherCostsIrr += line.allocatedCostIrr;
      totals.linesTotalIrr += line.lineTotalIrr;
      totals.subtotalIrr +=
        line.lineTotalIrr + line.discountIrr - line.taxIrr;
      return totals;
    },
    {
      subtotalIrr: 0n,
      discountIrr: 0n,
      taxIrr: 0n,
      otherCostsIrr: 0n,
      linesTotalIrr: 0n,
    },
  );
}

async function finalizeOriginalPurchase(
  client: PoolClient,
  invoiceId: string,
  rowVersion: number,
  returnedIrr: bigint,
  completesOriginal: boolean,
): Promise<{status: 'posted' | 'reversed'; returned_irr: string}> {
  const result = await client.query<{
    status: 'posted' | 'reversed';
    returned_irr: string;
  }>(
    `
      UPDATE purchase_invoices
      SET
        returned_irr = returned_irr + $2,
        status = CASE WHEN $3 THEN 'reversed' ELSE 'posted' END,
        payment_status = CASE
          WHEN paid_irr >= total_irr - (returned_irr + $2) THEN 'paid'
          WHEN paid_irr = 0 THEN 'unpaid'
          ELSE 'partial'
        END,
        row_version = row_version + 1
      WHERE id = $1
        AND row_version = $4
        AND status = 'posted'
        AND returned_irr + $2 <= total_irr
      RETURNING status, returned_irr::text
    `,
    [invoiceId, returnedIrr.toString(), completesOriginal, rowVersion],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(
      409,
      'PURCHASE_RETURN_CONFLICT',
      'فاکتور خرید هم‌زمان تغییر کرده یا مبلغ مرجوعی از مانده بیشتر شده است.',
    );
  }
  return row;
}

async function finalizeOriginalSale(
  client: PoolClient,
  invoiceId: string,
  rowVersion: number,
  returnedIrr: bigint,
  completesOriginal: boolean,
): Promise<{status: 'posted' | 'reversed'; returned_irr: string}> {
  const result = await client.query<{
    status: 'posted' | 'reversed';
    returned_irr: string;
  }>(
    `
      UPDATE sale_invoices
      SET
        returned_irr = returned_irr + $2,
        status = CASE WHEN $3 THEN 'reversed' ELSE 'posted' END,
        payment_status = CASE
          WHEN received_irr >= total_irr - (returned_irr + $2) THEN 'paid'
          WHEN received_irr = 0 THEN 'unpaid'
          ELSE 'partial'
        END,
        row_version = row_version + 1
      WHERE id = $1
        AND row_version = $4
        AND status = 'posted'
        AND returned_irr + $2 <= total_irr
      RETURNING status, returned_irr::text
    `,
    [invoiceId, returnedIrr.toString(), completesOriginal, rowVersion],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(
      409,
      'SALE_RETURN_CONFLICT',
      'فاکتور فروش هم‌زمان تغییر کرده یا مبلغ مرجوعی از مانده بیشتر شده است.',
    );
  }
  return row;
}

export async function returnPurchaseInvoice(
  client: PoolClient,
  companyId: string,
  invoiceId: string,
  userId: string,
  returnDate: string,
  reason: string,
  rowVersion: number,
  selections: readonly InvoiceReturnLineSelection[] = [],
): Promise<InvoiceReturnResult> {
  const headerResult = await client.query<PurchaseReturnHeaderRow>(
    `
      SELECT
        id,
        company_id,
        branch_id,
        invoice_number::text,
        supplier_invoice_number,
        invoice_type,
        invoice_date::text,
        supplier_id,
        status,
        total_irr::text,
        paid_irr::text,
        returned_irr::text,
        row_version
      FROM purchase_invoices
      WHERE id = $1 AND company_id = $2
      FOR UPDATE
    `,
    [invoiceId, companyId],
  );
  const header = headerResult.rows[0];
  if (!header) {
    throw new AppError(404, 'PURCHASE_NOT_FOUND', 'فاکتور خرید پیدا نشد.');
  }
  if (
    header.invoice_type !== 'purchase' ||
    header.status !== 'posted' ||
    header.row_version !== rowVersion
  ) {
    throw new AppError(
      409,
      'PURCHASE_NOT_RETURNABLE',
      'فاکتور خرید قطعی نیست، قبلاً کامل مرجوع شده یا هم‌زمان تغییر کرده است.',
    );
  }
  validateReturnDate(returnDate, header.invoice_date);
  if (BigInt(header.paid_irr) > 0n) {
    throw new AppError(
      409,
      'PURCHASE_PAYMENT_REVERSAL_REQUIRED',
      'پیش از مرجوعی، پرداخت‌های تخصیص‌یافته به این خرید باید در خزانه برگشت داده شوند.',
    );
  }

  const prepared = prepareReturnLines(
    await purchaseOriginalLines(client, invoiceId),
    selections,
  );
  const totals = returnTotals(prepared.lines);
  const returnTotal = totals.linesTotalIrr + totals.otherCostsIrr;
  const fiscalYearId = await openFiscalYear(client, companyId, returnDate);
  const number = await nextSequence(
    client,
    companyId,
    'purchase_invoice',
    fiscalYearId,
  );
  const returnKind = prepared.completesOriginal ? 'کامل' : 'جزئی';
  const returnResult = await client.query<IdRow>(
    `
      INSERT INTO purchase_invoices (
        company_id,
        branch_id,
        fiscal_year_id,
        invoice_number,
        supplier_invoice_number,
        invoice_type,
        invoice_date,
        supplier_id,
        status,
        subtotal_irr,
        discount_irr,
        tax_irr,
        other_costs_irr,
        total_irr,
        paid_irr,
        payment_status,
        description,
        return_of_id,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, 'return', $6, $7, 'draft',
        $8, $9, $10, $11, $12, $12, 'paid', $13, $14, $15
      )
      RETURNING id
    `,
    [
      companyId,
      header.branch_id,
      fiscalYearId,
      number.toString(),
      header.supplier_invoice_number,
      returnDate,
      header.supplier_id,
      totals.subtotalIrr.toString(),
      totals.discountIrr.toString(),
      totals.taxIrr.toString(),
      totals.otherCostsIrr.toString(),
      returnTotal.toString(),
      `مرجوعی ${returnKind} فاکتور خرید شماره ${header.invoice_number}: ${reason}`,
      invoiceId,
      userId,
    ],
  );
  const returnId = returnResult.rows[0]?.id;
  if (!returnId) throw new Error('Purchase return invoice was not created');

  let inventoryCredit = 0n;
  let serviceExpenseCredit = 0n;
  for (const [index, line] of prepared.lines.entries()) {
    const insertedLine = await client.query<IdRow>(
      `
        INSERT INTO purchase_invoice_lines (
          invoice_id,
          line_number,
          product_id,
          warehouse_id,
          quantity,
          unit_price_irr,
          discount_irr,
          tax_irr,
          allocated_cost_irr,
          line_total_irr,
          description,
          original_line_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        returnId,
        index + 1,
        line.original.product_id,
        line.original.warehouse_id,
        line.quantity.toString(),
        line.original.unit_price_irr,
        line.discountIrr.toString(),
        line.taxIrr.toString(),
        line.allocatedCostIrr.toString(),
        line.lineTotalIrr.toString(),
        line.original.description,
        line.original.id,
      ],
    );
    const returnLineId = insertedLine.rows[0]?.id;
    if (!returnLineId) throw new Error('Purchase return line was not created');

    const net = line.lineTotalIrr - line.taxIrr;
    if (line.original.product_type === 'service') {
      serviceExpenseCredit += net;
      continue;
    }

    const serials = await purchaseReturnSerials(
      client,
      invoiceId,
      line,
    );
    const movement = await applyInventoryMovement(client, {
      companyId,
      warehouseId: line.original.warehouse_id,
      productId: line.original.product_id,
      movementType: 'purchase_return',
      quantityDelta: line.quantity.negated(),
      incomingUnitCost: 0,
      sourceType: 'purchase_return',
      sourceId: returnId,
      sourceLineId: returnLineId,
      reason,
      reversalOfId: null,
      userId,
    });
    inventoryCredit += roundedAbsoluteIrr(movement.valueDeltaIrr);

    for (const serial of serials) {
      await client.query(
        `
          UPDATE serial_numbers
          SET
            status = 'supplier_return',
            warehouse_id = NULL,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [serial.id],
      );
      await client.query(
        `
          INSERT INTO purchase_invoice_serials (
            invoice_line_id,
            serial_number,
            serial_id
          )
          VALUES ($1, $2, $3)
        `,
        [returnLineId, serial.serial_number, serial.id],
      );
    }
  }

  const accounts = await systemAccountIds(client, companyId, [
    'inventory',
    'general_expense',
    'vat_receivable',
    'accounts_payable',
  ]);
  const journalLines: JournalLineInput[] = [];
  if (returnTotal > 0n) {
    journalLines.push({
      accountId: accounts.get('accounts_payable') as string,
      partyId: header.supplier_id,
      debitIrr: returnTotal.toString(),
      creditIrr: '0',
    });
  }
  if (inventoryCredit > 0n) {
    journalLines.push({
      accountId: accounts.get('inventory') as string,
      debitIrr: '0',
      creditIrr: inventoryCredit.toString(),
    });
  }
  if (serviceExpenseCredit > 0n) {
    journalLines.push({
      accountId: accounts.get('general_expense') as string,
      debitIrr: '0',
      creditIrr: serviceExpenseCredit.toString(),
    });
  }
  if (totals.taxIrr > 0n) {
    journalLines.push({
      accountId: accounts.get('vat_receivable') as string,
      debitIrr: '0',
      creditIrr: totals.taxIrr.toString(),
    });
  }
  const balancingAmount = calculateJournalBalancingAmount(
    returnTotal,
    inventoryCredit + serviceExpenseCredit + totals.taxIrr,
  );
  if (balancingAmount.creditIrr > 0n) {
    journalLines.push({
      accountId: accounts.get('general_expense') as string,
      debitIrr: '0',
      creditIrr: balancingAmount.creditIrr.toString(),
    });
  } else if (balancingAmount.debitIrr > 0n) {
    journalLines.push({
      accountId: accounts.get('general_expense') as string,
      debitIrr: balancingAmount.debitIrr.toString(),
      creditIrr: '0',
    });
  }

  const journal = journalLines.length > 0
    ? await createJournalEntry(client, {
        companyId,
        branchId: header.branch_id,
        entryDate: returnDate,
        description: `مرجوعی ${returnKind} فاکتور خرید شماره ${header.invoice_number}: ${reason}`,
        sourceType: 'purchase_return',
        sourceId: returnId,
        createdBy: userId,
        lines: journalLines,
        post: true,
      })
    : null;
  await client.query(
    `
      UPDATE purchase_invoices
      SET
        status = 'posted',
        journal_entry_id = $2,
        posted_by = $3,
        posted_at = now(),
        row_version = row_version + 1
      WHERE id = $1
    `,
    [returnId, journal?.id ?? null, userId],
  );
  const original = await finalizeOriginalPurchase(
    client,
    invoiceId,
    rowVersion,
    returnTotal,
    prepared.completesOriginal,
  );
  return {
    id: returnId,
    invoiceNumber: number.toString(),
    journalEntryId: journal?.id ?? null,
    originalStatus: original.status,
    returnedIrr: original.returned_irr,
  };
}

export async function returnSaleInvoice(
  client: PoolClient,
  companyId: string,
  invoiceId: string,
  userId: string,
  returnDate: string,
  reason: string,
  rowVersion: number,
  selections: readonly InvoiceReturnLineSelection[] = [],
): Promise<InvoiceReturnResult> {
  const headerResult = await client.query<SaleReturnHeaderRow>(
    `
      SELECT
        id,
        company_id,
        branch_id,
        invoice_number::text,
        invoice_type,
        invoice_date::text,
        customer_id,
        status,
        total_irr::text,
        received_irr::text,
        returned_irr::text,
        row_version
      FROM sale_invoices
      WHERE id = $1 AND company_id = $2
      FOR UPDATE
    `,
    [invoiceId, companyId],
  );
  const header = headerResult.rows[0];
  if (!header) {
    throw new AppError(404, 'SALE_NOT_FOUND', 'فاکتور فروش پیدا نشد.');
  }
  if (
    header.invoice_type !== 'sale' ||
    header.status !== 'posted' ||
    header.row_version !== rowVersion
  ) {
    throw new AppError(
      409,
      'SALE_NOT_RETURNABLE',
      'فاکتور فروش قطعی نیست، قبلاً کامل مرجوع شده یا هم‌زمان تغییر کرده است.',
    );
  }
  validateReturnDate(returnDate, header.invoice_date);
  if (BigInt(header.received_irr) > 0n) {
    throw new AppError(
      409,
      'SALE_RECEIPT_REVERSAL_REQUIRED',
      'پیش از مرجوعی، دریافت‌های تخصیص‌یافته به این فروش باید در خزانه برگشت داده شوند.',
    );
  }

  const prepared = prepareReturnLines(
    await saleOriginalLines(client, invoiceId),
    selections,
  );
  const totals = returnTotals(prepared.lines);
  const returnTotal = totals.linesTotalIrr;
  const fiscalYearId = await openFiscalYear(client, companyId, returnDate);
  const number = await nextSequence(
    client,
    companyId,
    'sale_invoice',
    fiscalYearId,
  );
  const returnKind = prepared.completesOriginal ? 'کامل' : 'جزئی';
  const returnResult = await client.query<IdRow>(
    `
      INSERT INTO sale_invoices (
        company_id,
        branch_id,
        fiscal_year_id,
        invoice_number,
        invoice_type,
        invoice_date,
        customer_id,
        status,
        subtotal_irr,
        discount_irr,
        tax_irr,
        total_irr,
        received_irr,
        payment_status,
        official_invoice,
        taxpayer_status,
        buyer_snapshot,
        company_snapshot,
        description,
        return_of_id,
        created_by
      )
      SELECT
        company_id,
        branch_id,
        $3,
        $4,
        'return',
        $5,
        customer_id,
        'draft',
        $6,
        $7,
        $8,
        $9,
        $9,
        'paid',
        official_invoice,
        'not_submitted',
        buyer_snapshot,
        company_snapshot,
        $10,
        id,
        $11
      FROM sale_invoices
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `,
    [
      invoiceId,
      companyId,
      fiscalYearId,
      number.toString(),
      returnDate,
      totals.subtotalIrr.toString(),
      totals.discountIrr.toString(),
      totals.taxIrr.toString(),
      returnTotal.toString(),
      `مرجوعی ${returnKind} فاکتور فروش شماره ${header.invoice_number}: ${reason}`,
      userId,
    ],
  );
  const returnId = returnResult.rows[0]?.id;
  if (!returnId) throw new Error('Sale return invoice was not created');

  let goodsRevenue = 0n;
  let serviceRevenue = 0n;
  let returnedCost = 0n;
  for (const [index, line] of prepared.lines.entries()) {
    const insertedLine = await client.query<IdRow>(
      `
        INSERT INTO sale_invoice_lines (
          invoice_id,
          line_number,
          product_id,
          warehouse_id,
          quantity,
          unit_price_irr,
          discount_irr,
          tax_irr,
          line_total_irr,
          cost_of_goods_irr,
          description,
          original_line_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        returnId,
        index + 1,
        line.original.product_id,
        line.original.warehouse_id,
        line.quantity.toString(),
        line.original.unit_price_irr,
        line.discountIrr.toString(),
        line.taxIrr.toString(),
        line.lineTotalIrr.toString(),
        line.costOfGoodsIrr.toString(),
        line.original.description,
        line.original.id,
      ],
    );
    const returnLineId = insertedLine.rows[0]?.id;
    if (!returnLineId) throw new Error('Sale return line was not created');

    const net = line.lineTotalIrr - line.taxIrr;
    if (line.original.product_type === 'service') {
      serviceRevenue += net;
      continue;
    }
    goodsRevenue += net;

    const serials = await saleReturnSerials(client, invoiceId, line);
    const unitCost = line.costOfGoodsIrr === 0n
      ? new Decimal(0)
      : new Decimal(line.costOfGoodsIrr.toString()).div(line.quantity);
    const movement = await applyInventoryMovement(client, {
      companyId,
      warehouseId: line.original.warehouse_id,
      productId: line.original.product_id,
      movementType: 'sale_return',
      quantityDelta: line.quantity,
      incomingUnitCost: unitCost,
      sourceType: 'sale_return',
      sourceId: returnId,
      sourceLineId: returnLineId,
      reason,
      reversalOfId: null,
      userId,
    });
    returnedCost += roundedAbsoluteIrr(movement.valueDeltaIrr);

    for (const serial of serials) {
      await client.query(
        `
          UPDATE serial_numbers
          SET
            status = 'in_stock',
            warehouse_id = $2,
            sold_on = NULL,
            row_version = row_version + 1
          WHERE id = $1
        `,
        [serial.id, line.original.warehouse_id],
      );
      await client.query(
        `
          INSERT INTO sale_invoice_serials (invoice_line_id, serial_id)
          VALUES ($1, $2)
        `,
        [returnLineId, serial.id],
      );
    }
    if (serials.length > 0) {
      await client.query(
        `
          UPDATE warranties
          SET status = 'voided', updated_at = now()
          WHERE sale_invoice_id = $1
            AND serial_id = ANY($2::uuid[])
            AND status IN ('active', 'expired')
        `,
        [invoiceId, serials.map((serial) => serial.id)],
      );
    }
  }

  const accounts = await systemAccountIds(client, companyId, [
    'accounts_receivable',
    'sales_revenue',
    'service_revenue',
    'vat_payable',
    'cost_of_goods_sold',
    'inventory',
  ]);
  const journalLines: JournalLineInput[] = [];
  if (goodsRevenue > 0n) {
    journalLines.push({
      accountId: accounts.get('sales_revenue') as string,
      debitIrr: goodsRevenue.toString(),
      creditIrr: '0',
    });
  }
  if (serviceRevenue > 0n) {
    journalLines.push({
      accountId: accounts.get('service_revenue') as string,
      debitIrr: serviceRevenue.toString(),
      creditIrr: '0',
    });
  }
  if (totals.taxIrr > 0n) {
    journalLines.push({
      accountId: accounts.get('vat_payable') as string,
      debitIrr: totals.taxIrr.toString(),
      creditIrr: '0',
    });
  }
  if (returnTotal > 0n) {
    journalLines.push({
      accountId: accounts.get('accounts_receivable') as string,
      partyId: header.customer_id,
      debitIrr: '0',
      creditIrr: returnTotal.toString(),
    });
  }
  if (returnedCost > 0n) {
    journalLines.push(
      {
        accountId: accounts.get('inventory') as string,
        debitIrr: returnedCost.toString(),
        creditIrr: '0',
      },
      {
        accountId: accounts.get('cost_of_goods_sold') as string,
        debitIrr: '0',
        creditIrr: returnedCost.toString(),
      },
    );
  }

  const journal = journalLines.length > 0
    ? await createJournalEntry(client, {
        companyId,
        branchId: header.branch_id,
        entryDate: returnDate,
        description: `مرجوعی ${returnKind} فاکتور فروش شماره ${header.invoice_number}: ${reason}`,
        sourceType: 'sale_return',
        sourceId: returnId,
        createdBy: userId,
        lines: journalLines,
        post: true,
      })
    : null;
  await client.query(
    `
      UPDATE sale_invoices
      SET
        status = 'posted',
        journal_entry_id = $2,
        posted_by = $3,
        posted_at = now(),
        row_version = row_version + 1
      WHERE id = $1
    `,
    [returnId, journal?.id ?? null, userId],
  );
  const original = await finalizeOriginalSale(
    client,
    invoiceId,
    rowVersion,
    returnTotal,
    prepared.completesOriginal,
  );
  return {
    id: returnId,
    invoiceNumber: number.toString(),
    journalEntryId: journal?.id ?? null,
    originalStatus: original.status,
    returnedIrr: original.returned_irr,
  };
}
