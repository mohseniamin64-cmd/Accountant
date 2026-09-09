import Decimal from 'decimal.js';
import type {PoolClient, QueryResultRow} from 'pg';
import {AppError} from '../../common/errors.js';
import {asBigInt} from '../../common/values.js';
import {nextSequence} from '../../infrastructure/sequences.js';
import {
  createJournalEntry,
  systemAccountIds,
  type JournalLineInput,
} from '../accounting/journal.service.js';
import {applyInventoryMovement} from '../inventory/inventory.service.js';
import {loadActiveTradeParty} from './party.service.js';
import {
  allocateProportionally,
  calculateInvoiceLine,
  type InvoiceLineAmounts,
} from './invoice.calculations.js';

export interface DraftInvoiceLine {
  productId: string;
  warehouseId: string;
  quantity: string;
  unitPriceIrr: string;
  discountIrr: string;
  taxIrr: string;
  description: string | null;
  serialNumbers: readonly string[];
}

export interface DraftPurchaseInput {
  companyId: string;
  branchId: string;
  supplierId: string;
  invoiceDate: string;
  supplierInvoiceNumber: string | null;
  otherCostsIrr: string;
  description: string | null;
  createdBy: string;
  lines: readonly DraftInvoiceLine[];
}

export interface DraftSaleInput {
  companyId: string;
  branchId: string;
  customerId: string;
  invoiceDate: string;
  officialInvoice: boolean;
  description: string | null;
  createdBy: string;
  lines: readonly DraftInvoiceLine[];
}

interface FiscalRow extends QueryResultRow {
  id: string;
}

interface ProductRow extends QueryResultRow {
  id: string;
  product_type: string;
  tracking_type: 'none' | 'serial' | 'batch';
  is_purchasable: boolean;
  is_sellable: boolean;
}

interface IdRow extends QueryResultRow {
  id: string;
}

interface PurchaseHeaderRow extends QueryResultRow {
  id: string;
  company_id: string;
  branch_id: string;
  fiscal_year_id: string;
  invoice_number: string;
  invoice_date: string;
  supplier_id: string;
  status: string;
  other_costs_irr: string;
  total_irr: string;
}

interface SaleHeaderRow extends QueryResultRow {
  id: string;
  company_id: string;
  branch_id: string;
  fiscal_year_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  status: string;
  subtotal_irr: string;
  discount_irr: string;
  tax_irr: string;
  total_irr: string;
}

interface StoredLineRow extends QueryResultRow {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: string;
  unit_price_irr: string;
  discount_irr: string;
  tax_irr: string;
  line_total_irr: string;
  product_type: string;
  tracking_type: 'none' | 'serial' | 'batch';
}

interface SerialRow extends QueryResultRow {
  id: string;
  serial_number: string;
  product_id: string;
  warehouse_id: string | null;
  status: string;
}

interface PolicyRow extends QueryResultRow {
  id: string;
  duration_months: number;
}

interface ComputedLine {
  input: DraftInvoiceLine;
  amounts: InvoiceLineAmounts;
  product: ProductRow;
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
      '\u0628\u0631\u0627\u06cc \u062a\u0627\u0631\u06cc\u062e \u0641\u0627\u06a9\u062a\u0648\u0631\u060c \u0633\u0627\u0644 \u0645\u0627\u0644\u06cc \u0628\u0627\u0632 \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.',
    );
  }
  return id;
}

async function computeLines(
  client: PoolClient,
  companyId: string,
  branchId: string,
  lines: readonly DraftInvoiceLine[],
  mode: 'purchase' | 'sale',
): Promise<ComputedLine[]> {
  if (lines.length === 0) {
    throw new AppError(
      422,
      'INVOICE_LINES_REQUIRED',
      '\u0641\u0627\u06a9\u062a\u0648\u0631 \u0628\u0627\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u0631\u062f\u06cc\u0641 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.',
    );
  }

  const result: ComputedLine[] = [];
  const invoiceSerials = new Set<string>();
  for (const line of lines) {
    const productResult = await client.query<ProductRow>(
      `
        SELECT
          id,
          product_type,
          tracking_type,
          is_purchasable,
          is_sellable
        FROM products
        WHERE id = $1 AND company_id = $2 AND is_active = true
      `,
      [line.productId, companyId],
    );
    const product = productResult.rows[0];
    if (!product) {
      throw new AppError(422, 'INVALID_PRODUCT', '\u06a9\u0627\u0644\u0627\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }
    if (mode === 'purchase' && !product.is_purchasable) {
      throw new AppError(
        422,
        'PRODUCT_NOT_PURCHASABLE',
        '\u06cc\u06a9\u06cc \u0627\u0632 \u06a9\u0627\u0644\u0627\u0647\u0627 \u0628\u0631\u0627\u06cc \u062e\u0631\u06cc\u062f \u0641\u0639\u0627\u0644 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
      );
    }
    if (mode === 'sale' && !product.is_sellable) {
      throw new AppError(
        422,
        'PRODUCT_NOT_SELLABLE',
        '\u06cc\u06a9\u06cc \u0627\u0632 \u06a9\u0627\u0644\u0627\u0647\u0627 \u0628\u0631\u0627\u06cc \u0641\u0631\u0648\u0634 \u0641\u0639\u0627\u0644 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
      );
    }
    const warehouse = await client.query(
      `
        SELECT 1
        FROM warehouses warehouse
        JOIN branches branch ON branch.id = warehouse.branch_id
        WHERE warehouse.id = $1
          AND warehouse.company_id = $2
          AND warehouse.branch_id = $3
          AND warehouse.is_active = true
          AND branch.is_active = true
      `,
      [line.warehouseId, companyId, branchId],
    );
    if (!warehouse.rowCount) {
      throw new AppError(422, 'INVALID_WAREHOUSE', '\u0627\u0646\u0628\u0627\u0631 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }

    const amounts = calculateInvoiceLine(
      line.quantity,
      asBigInt(line.unitPriceIrr, '\u0642\u06cc\u0645\u062a \u0648\u0627\u062d\u062f'),
      asBigInt(line.discountIrr, '\u062a\u062e\u0641\u06cc\u0641'),
      asBigInt(line.taxIrr, '\u0645\u0627\u0644\u06cc\u0627\u062a'),
    );
    const serials = [...new Set(line.serialNumbers.map((item) => item.trim()))]
      .filter(Boolean);
    if (serials.length !== line.serialNumbers.length) {
      throw new AppError(
        422,
        'DUPLICATE_SERIAL_IN_LINE',
        '\u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u062a\u06a9\u0631\u0627\u0631\u06cc \u06cc\u0627 \u062e\u0627\u0644\u06cc \u062f\u0631 \u0641\u0627\u06a9\u062a\u0648\u0631 \u0648\u062c\u0648\u062f \u062f\u0627\u0631\u062f.',
      );
    }
    for (const serial of serials) {
      if (invoiceSerials.has(serial)) {
        throw new AppError(
          422,
          'DUPLICATE_SERIAL_IN_INVOICE',
          '\u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u062a\u06a9\u0631\u0627\u0631\u06cc \u062f\u0631 \u0641\u0627\u06a9\u062a\u0648\u0631 \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a.',
        );
      }
      invoiceSerials.add(serial);
    }
    if (product.tracking_type === 'serial') {
      const quantity = new Decimal(line.quantity);
      if (
        !quantity.isInteger() ||
        quantity.toNumber() !== serials.length
      ) {
        throw new AppError(
          422,
          'SERIAL_COUNT_MISMATCH',
          '\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627 \u0628\u0627\u06cc\u062f \u062f\u0642\u06cc\u0642\u0627\u064b \u0628\u0627 \u062a\u0639\u062f\u0627\u062f \u06a9\u0627\u0644\u0627 \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.',
        );
      }
    } else if (serials.length > 0) {
      throw new AppError(
        422,
        'SERIAL_NOT_ALLOWED',
        '\u0628\u0631\u0627\u06cc \u06a9\u0627\u0644\u0627\u06cc \u063a\u06cc\u0631\u0633\u0631\u06cc\u0627\u0644\u06cc \u0646\u0628\u0627\u06cc\u062f \u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644 \u062b\u0628\u062a \u0634\u0648\u062f.',
      );
    }
    result.push({
      input: {...line, serialNumbers: serials},
      amounts,
      product,
    });
  }
  return result;
}

function aggregateTotals(lines: readonly ComputedLine[]): {
  subtotalIrr: bigint;
  discountIrr: bigint;
  taxIrr: bigint;
  linesTotalIrr: bigint;
} {
  return lines.reduce(
    (total, line) => ({
      subtotalIrr: total.subtotalIrr + line.amounts.grossIrr,
      discountIrr: total.discountIrr + line.amounts.discountIrr,
      taxIrr: total.taxIrr + line.amounts.taxIrr,
      linesTotalIrr: total.linesTotalIrr + line.amounts.totalIrr,
    }),
    {
      subtotalIrr: 0n,
      discountIrr: 0n,
      taxIrr: 0n,
      linesTotalIrr: 0n,
    },
  );
}

export async function createPurchaseDraft(
  client: PoolClient,
  input: DraftPurchaseInput,
): Promise<{id: string; invoiceNumber: string}> {
  const fiscalYearId = await openFiscalYear(
    client,
    input.companyId,
    input.invoiceDate,
  );
  await loadActiveTradeParty(
    client,
    input.companyId,
    input.supplierId,
  );

  const computed = await computeLines(
    client,
    input.companyId,
    input.branchId,
    input.lines,
    'purchase',
  );
  const totals = aggregateTotals(computed);
  const otherCosts = asBigInt(input.otherCostsIrr, '\u0647\u0632\u06cc\u0646\u0647 \u062c\u0627\u0646\u0628\u06cc');
  const total = totals.linesTotalIrr + otherCosts;
  if (total <= 0n) {
    throw new AppError(
      422,
      'ZERO_INVOICE_TOTAL',
      '\u0645\u0628\u0644\u063a \u0646\u0647\u0627\u06cc\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.',
    );
  }

  const number = await nextSequence(
    client,
    input.companyId,
    'purchase_invoice',
    fiscalYearId,
  );
  const invoiceResult = await client.query<IdRow>(
    `
      INSERT INTO purchase_invoices (
        company_id,
        branch_id,
        fiscal_year_id,
        invoice_number,
        supplier_invoice_number,
        invoice_date,
        supplier_id,
        subtotal_irr,
        discount_irr,
        tax_irr,
        other_costs_irr,
        total_irr,
        description,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING id
    `,
    [
      input.companyId,
      input.branchId,
      fiscalYearId,
      number.toString(),
      input.supplierInvoiceNumber,
      input.invoiceDate,
      input.supplierId,
      totals.subtotalIrr.toString(),
      totals.discountIrr.toString(),
      totals.taxIrr.toString(),
      otherCosts.toString(),
      total.toString(),
      input.description,
      input.createdBy,
    ],
  );
  const invoiceId = invoiceResult.rows[0]?.id;
  if (!invoiceId) throw new Error('Purchase invoice was not created');

  for (const [index, line] of computed.entries()) {
    const lineResult = await client.query<IdRow>(
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
          line_total_irr,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        invoiceId,
        index + 1,
        line.input.productId,
        line.input.warehouseId,
        line.input.quantity,
        line.input.unitPriceIrr,
        line.input.discountIrr,
        line.input.taxIrr,
        line.amounts.totalIrr.toString(),
        line.input.description,
      ],
    );
    const lineId = lineResult.rows[0]?.id;
    if (!lineId) throw new Error('Purchase invoice line was not created');
    for (const serial of line.input.serialNumbers) {
      await client.query(
        `
          INSERT INTO purchase_invoice_serials (
            invoice_line_id,
            serial_number
          )
          VALUES ($1, $2)
        `,
        [lineId, serial],
      );
    }
  }
  return {id: invoiceId, invoiceNumber: number.toString()};
}

export async function createSaleDraft(
  client: PoolClient,
  input: DraftSaleInput,
): Promise<{id: string; invoiceNumber: string}> {
  const fiscalYearId = await openFiscalYear(
    client,
    input.companyId,
    input.invoiceDate,
  );
  const customer = await loadActiveTradeParty(
    client,
    input.companyId,
    input.customerId,
  );

  const computed = await computeLines(
    client,
    input.companyId,
    input.branchId,
    input.lines,
    'sale',
  );
  const totals = aggregateTotals(computed);
  if (totals.linesTotalIrr <= 0n) {
    throw new AppError(
      422,
      'ZERO_INVOICE_TOTAL',
      '\u0645\u0628\u0644\u063a \u0646\u0647\u0627\u06cc\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.',
    );
  }
  const companyResult = await client.query(
    'SELECT * FROM companies WHERE id = $1',
    [input.companyId],
  );
  const company = companyResult.rows[0];
  const number = await nextSequence(
    client,
    input.companyId,
    'sale_invoice',
    fiscalYearId,
  );
  const invoiceResult = await client.query<IdRow>(
    `
      INSERT INTO sale_invoices (
        company_id,
        branch_id,
        fiscal_year_id,
        invoice_number,
        invoice_date,
        customer_id,
        subtotal_irr,
        discount_irr,
        tax_irr,
        total_irr,
        official_invoice,
        buyer_snapshot,
        company_snapshot,
        description,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING id
    `,
    [
      input.companyId,
      input.branchId,
      fiscalYearId,
      number.toString(),
      input.invoiceDate,
      input.customerId,
      totals.subtotalIrr.toString(),
      totals.discountIrr.toString(),
      totals.taxIrr.toString(),
      totals.linesTotalIrr.toString(),
      input.officialInvoice,
      JSON.stringify(customer),
      JSON.stringify(company ?? {}),
      input.description,
      input.createdBy,
    ],
  );
  const invoiceId = invoiceResult.rows[0]?.id;
  if (!invoiceId) throw new Error('Sale invoice was not created');

  for (const [index, line] of computed.entries()) {
    const lineResult = await client.query<IdRow>(
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
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        invoiceId,
        index + 1,
        line.input.productId,
        line.input.warehouseId,
        line.input.quantity,
        line.input.unitPriceIrr,
        line.input.discountIrr,
        line.input.taxIrr,
        line.amounts.totalIrr.toString(),
        line.input.description,
      ],
    );
    const lineId = lineResult.rows[0]?.id;
    if (!lineId) throw new Error('Sale invoice line was not created');

    if (line.product.tracking_type === 'serial') {
      const serialResult = await client.query<SerialRow>(
        `
          SELECT
            id,
            serial_number,
            product_id,
            warehouse_id,
            status
          FROM serial_numbers
          WHERE company_id = $1
            AND product_id = $2
            AND warehouse_id = $3
            AND serial_number = ANY($4::text[])
            AND status = 'in_stock'
          FOR UPDATE
        `,
        [
          input.companyId,
          line.input.productId,
          line.input.warehouseId,
          line.input.serialNumbers,
        ],
      );
      if (serialResult.rows.length !== line.input.serialNumbers.length) {
        throw new AppError(
          409,
          'SERIAL_NOT_AVAILABLE',
          '\u06cc\u06a9 \u06cc\u0627 \u0686\u0646\u062f \u0633\u0631\u06cc\u0627\u0644 \u0645\u0648\u062c\u0648\u062f \u0646\u06cc\u0633\u062a \u06cc\u0627 \u0642\u0628\u0644\u0627\u064b \u0631\u0632\u0631\u0648 \u0634\u062f\u0647 \u0627\u0633\u062a.',
        );
      }
      for (const serial of serialResult.rows) {
        await client.query(
          `
            INSERT INTO sale_invoice_serials (invoice_line_id, serial_id)
            VALUES ($1, $2)
          `,
          [lineId, serial.id],
        );
        await client.query(
          `
            UPDATE serial_numbers
            SET status = 'reserved', row_version = row_version + 1
            WHERE id = $1
          `,
          [serial.id],
        );
      }
    }
  }
  return {id: invoiceId, invoiceNumber: number.toString()};
}

export async function postPurchaseInvoice(
  client: PoolClient,
  companyId: string,
  invoiceId: string,
  userId: string,
): Promise<{id: string; journalEntryId: string}> {
  const headerResult = await client.query<PurchaseHeaderRow>(
    `
      SELECT
        id,
        company_id,
        branch_id,
        fiscal_year_id,
        invoice_number::text,
        invoice_date::text,
        supplier_id,
        status,
        other_costs_irr::text,
        total_irr::text
      FROM purchase_invoices
      WHERE id = $1 AND company_id = $2
      FOR UPDATE
    `,
    [invoiceId, companyId],
  );
  const header = headerResult.rows[0];
  if (!header) {
    throw new AppError(404, 'PURCHASE_NOT_FOUND', '\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
  }
  if (header.status !== 'draft') {
    throw new AppError(
      409,
      'PURCHASE_NOT_DRAFT',
      '\u0641\u0642\u0637 \u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0642\u0627\u0628\u0644 \u0642\u0637\u0639\u06cc\u200c\u0634\u062f\u0646 \u0627\u0633\u062a.',
    );
  }

  const lineResult = await client.query<StoredLineRow>(
    `
      SELECT
        line.id,
        line.product_id,
        line.warehouse_id,
        line.quantity::text,
        line.unit_price_irr::text,
        line.discount_irr::text,
        line.tax_irr::text,
        line.line_total_irr::text,
        product.product_type,
        product.tracking_type
      FROM purchase_invoice_lines line
      JOIN products product ON product.id = line.product_id
      WHERE line.invoice_id = $1
      ORDER BY line.line_number
    `,
    [invoiceId],
  );
  const physical = lineResult.rows.filter(
    (line) => line.product_type !== 'service',
  );
  const physicalBases = physical.map(
    (line) =>
      BigInt(line.line_total_irr) - BigInt(line.tax_irr),
  );
  const allocations = allocateProportionally(
    BigInt(header.other_costs_irr),
    physicalBases,
  );
  const allocationByLine = new Map(
    physical.map((line, index) => [line.id, allocations[index] ?? 0n]),
  );

  let inventoryDebit = 0n;
  let expenseDebit = 0n;
  let taxDebit = 0n;
  for (const line of lineResult.rows) {
    const net = BigInt(line.line_total_irr) - BigInt(line.tax_irr);
    const allocation = allocationByLine.get(line.id) ?? 0n;
    taxDebit += BigInt(line.tax_irr);
    if (line.product_type === 'service') {
      expenseDebit += net;
      continue;
    }

    const serialRows = await client.query<{serial_number: string}>(
      `
        SELECT serial_number
        FROM purchase_invoice_serials
        WHERE invoice_line_id = $1
      `,
      [line.id],
    );
    if (
      line.tracking_type === 'serial' &&
      new Decimal(line.quantity).toNumber() !== serialRows.rows.length
    ) {
      throw new AppError(
        422,
        'SERIAL_COUNT_MISMATCH',
        '\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u062e\u0631\u06cc\u062f \u0628\u0627 \u062a\u0639\u062f\u0627\u062f \u06a9\u0627\u0644\u0627 \u0628\u0631\u0627\u0628\u0631 \u0646\u06cc\u0633\u062a.',
      );
    }

    const inventoryValue = net + allocation;
    const unitCost = new Decimal(inventoryValue.toString()).div(line.quantity);
    await applyInventoryMovement(client, {
      companyId,
      warehouseId: line.warehouse_id,
      productId: line.product_id,
      movementType: 'purchase',
      quantityDelta: line.quantity,
      incomingUnitCost: unitCost,
      sourceType: 'purchase_invoice',
      sourceId: invoiceId,
      sourceLineId: line.id,
      userId,
    });
    inventoryDebit += inventoryValue;
    await client.query(
      `
        UPDATE purchase_invoice_lines
        SET allocated_cost_irr = $2
        WHERE id = $1
      `,
      [line.id, allocation.toString()],
    );

    for (const serial of serialRows.rows) {
      const serialResult = await client.query<IdRow>(
        `
          INSERT INTO serial_numbers (
            company_id,
            product_id,
            serial_number,
            warehouse_id,
            status,
            acquired_on,
            source_type,
            source_id
          )
          VALUES (
            $1, $2, $3, $4, 'in_stock', $5,
            'purchase_invoice', $6
          )
          RETURNING id
        `,
        [
          companyId,
          line.product_id,
          serial.serial_number,
          line.warehouse_id,
          header.invoice_date,
          invoiceId,
        ],
      );
      await client.query(
        `
          UPDATE purchase_invoice_serials
          SET serial_id = $2
          WHERE invoice_line_id = $1 AND serial_number = $3
        `,
        [line.id, serialResult.rows[0]?.id, serial.serial_number],
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
  if (inventoryDebit > 0n) {
    journalLines.push({
      accountId: accounts.get('inventory') as string,
      debitIrr: inventoryDebit.toString(),
      creditIrr: '0',
    });
  }
  const unallocatedOtherCosts =
    BigInt(header.other_costs_irr) -
    [...allocationByLine.values()].reduce((sum, value) => sum + value, 0n);
  expenseDebit += unallocatedOtherCosts;
  if (expenseDebit > 0n) {
    journalLines.push({
      accountId: accounts.get('general_expense') as string,
      debitIrr: expenseDebit.toString(),
      creditIrr: '0',
    });
  }
  if (taxDebit > 0n) {
    journalLines.push({
      accountId: accounts.get('vat_receivable') as string,
      debitIrr: taxDebit.toString(),
      creditIrr: '0',
    });
  }
  journalLines.push({
    accountId: accounts.get('accounts_payable') as string,
    partyId: header.supplier_id,
    debitIrr: '0',
    creditIrr: header.total_irr,
  });

  const journal = await createJournalEntry(client, {
    companyId,
    branchId: header.branch_id,
    entryDate: header.invoice_date,
    description: `\u062b\u0628\u062a \u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u0634\u0645\u0627\u0631\u0647 ${header.invoice_number}`,
    sourceType: 'purchase_invoice',
    sourceId: invoiceId,
    createdBy: userId,
    lines: journalLines,
    post: true,
  });
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
    [invoiceId, journal.id, userId],
  );
  return {id: invoiceId, journalEntryId: journal.id};
}

export async function postSaleInvoice(
  client: PoolClient,
  companyId: string,
  invoiceId: string,
  userId: string,
): Promise<{id: string; journalEntryId: string}> {
  const headerResult = await client.query<SaleHeaderRow>(
    `
      SELECT
        id,
        company_id,
        branch_id,
        fiscal_year_id,
        invoice_number::text,
        invoice_date::text,
        customer_id,
        status,
        subtotal_irr::text,
        discount_irr::text,
        tax_irr::text,
        total_irr::text
      FROM sale_invoices
      WHERE id = $1 AND company_id = $2
      FOR UPDATE
    `,
    [invoiceId, companyId],
  );
  const header = headerResult.rows[0];
  if (!header) {
    throw new AppError(404, 'SALE_NOT_FOUND', '\u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
  }
  if (header.status !== 'draft') {
    throw new AppError(
      409,
      'SALE_NOT_DRAFT',
      '\u0641\u0642\u0637 \u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0642\u0627\u0628\u0644 \u0642\u0637\u0639\u06cc\u200c\u0634\u062f\u0646 \u0627\u0633\u062a.',
    );
  }

  const lineResult = await client.query<StoredLineRow>(
    `
      SELECT
        line.id,
        line.product_id,
        line.warehouse_id,
        line.quantity::text,
        line.unit_price_irr::text,
        line.discount_irr::text,
        line.tax_irr::text,
        line.line_total_irr::text,
        product.product_type,
        product.tracking_type
      FROM sale_invoice_lines line
      JOIN products product ON product.id = line.product_id
      WHERE line.invoice_id = $1
      ORDER BY line.line_number
    `,
    [invoiceId],
  );

  let goodsRevenue = 0n;
  let serviceRevenue = 0n;
  let costOfGoods = 0n;
  for (const line of lineResult.rows) {
    const net = BigInt(line.line_total_irr) - BigInt(line.tax_irr);
    if (line.product_type === 'service') {
      serviceRevenue += net;
      continue;
    }
    goodsRevenue += net;

    const movement = await applyInventoryMovement(client, {
      companyId,
      warehouseId: line.warehouse_id,
      productId: line.product_id,
      movementType: 'sale',
      quantityDelta: new Decimal(line.quantity).negated(),
      incomingUnitCost: 0,
      sourceType: 'sale_invoice',
      sourceId: invoiceId,
      sourceLineId: line.id,
      userId,
    });
    const lineCost = BigInt(
      new Decimal(movement.valueDeltaIrr)
        .abs()
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toFixed(0),
    );
    costOfGoods += lineCost;
    await client.query(
      'UPDATE sale_invoice_lines SET cost_of_goods_irr = $2 WHERE id = $1',
      [line.id, lineCost.toString()],
    );

    if (line.tracking_type === 'serial') {
      const serialResult = await client.query<SerialRow>(
        `
          SELECT
            serial.id,
            serial.serial_number,
            serial.product_id,
            serial.warehouse_id,
            serial.status
          FROM sale_invoice_serials link
          JOIN serial_numbers serial ON serial.id = link.serial_id
          WHERE link.invoice_line_id = $1
          FOR UPDATE OF serial
        `,
        [line.id],
      );
      if (
        serialResult.rows.length !== new Decimal(line.quantity).toNumber() ||
        serialResult.rows.some(
          (serial) =>
            serial.product_id !== line.product_id ||
            serial.warehouse_id !== line.warehouse_id ||
            serial.status !== 'reserved',
        )
      ) {
        throw new AppError(
          409,
          'SERIAL_NOT_AVAILABLE',
          '\u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u062f\u06cc\u06af\u0631 \u0642\u0627\u0628\u0644 \u0641\u0631\u0648\u0634 \u0646\u06cc\u0633\u062a\u0646\u062f.',
        );
      }

      const policyResult = await client.query<PolicyRow>(
        `
          SELECT id, duration_months
          FROM warranty_policy_versions
          WHERE product_id = $1
            AND is_active = true
            AND effective_from <= $2::date
            AND (effective_to IS NULL OR effective_to >= $2::date)
          ORDER BY effective_from DESC
          LIMIT 1
        `,
        [line.product_id, header.invoice_date],
      );
      const policy = policyResult.rows[0];
      if (!policy) {
        throw new AppError(
          409,
          'WARRANTY_POLICY_REQUIRED',
          '\u0628\u0631\u0627\u06cc \u06a9\u0627\u0644\u0627\u06cc \u0633\u0631\u06cc\u0627\u0644\u06cc\u060c \u0633\u06cc\u0627\u0633\u062a \u06af\u0627\u0631\u0627\u0646\u062a\u06cc \u0645\u0639\u062a\u0628\u0631 \u062f\u0631 \u062a\u0627\u0631\u06cc\u062e \u0641\u0631\u0648\u0634 \u062a\u0639\u0631\u06cc\u0641 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
        );
      }

      for (const serial of serialResult.rows) {
        await client.query(
          `
            UPDATE serial_numbers
            SET
              status = 'sold',
              warehouse_id = NULL,
              sold_on = $2,
              row_version = row_version + 1
            WHERE id = $1
          `,
          [serial.id, header.invoice_date],
        );
        await client.query(
          `
            INSERT INTO warranties (
              company_id,
              serial_id,
              sale_invoice_id,
              sale_line_id,
              customer_id,
              policy_version_id,
              starts_on,
              ends_on,
              original_duration_months
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              ($7::date + make_interval(months => $8))::date,
              $8
            )
          `,
          [
            companyId,
            serial.id,
            invoiceId,
            line.id,
            header.customer_id,
            policy.id,
            header.invoice_date,
            policy.duration_months,
          ],
        );
      }
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
  const journalLines: JournalLineInput[] = [
    {
      accountId: accounts.get('accounts_receivable') as string,
      partyId: header.customer_id,
      debitIrr: header.total_irr,
      creditIrr: '0',
    },
  ];
  if (goodsRevenue > 0n) {
    journalLines.push({
      accountId: accounts.get('sales_revenue') as string,
      debitIrr: '0',
      creditIrr: goodsRevenue.toString(),
    });
  }
  if (serviceRevenue > 0n) {
    journalLines.push({
      accountId: accounts.get('service_revenue') as string,
      debitIrr: '0',
      creditIrr: serviceRevenue.toString(),
    });
  }
  const tax = BigInt(header.tax_irr);
  if (tax > 0n) {
    journalLines.push({
      accountId: accounts.get('vat_payable') as string,
      debitIrr: '0',
      creditIrr: tax.toString(),
    });
  }
  if (costOfGoods > 0n) {
    journalLines.push(
      {
        accountId: accounts.get('cost_of_goods_sold') as string,
        debitIrr: costOfGoods.toString(),
        creditIrr: '0',
      },
      {
        accountId: accounts.get('inventory') as string,
        debitIrr: '0',
        creditIrr: costOfGoods.toString(),
      },
    );
  }

  const journal = await createJournalEntry(client, {
    companyId,
    branchId: header.branch_id,
    entryDate: header.invoice_date,
    description: `\u062b\u0628\u062a \u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634 \u0634\u0645\u0627\u0631\u0647 ${header.invoice_number}`,
    sourceType: 'sale_invoice',
    sourceId: invoiceId,
    createdBy: userId,
    lines: journalLines,
    post: true,
  });
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
    [invoiceId, journal.id, userId],
  );
  return {id: invoiceId, journalEntryId: journal.id};
}
