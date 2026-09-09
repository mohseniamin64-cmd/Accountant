import Decimal from 'decimal.js';
import {Router} from 'express';
import {z} from 'zod';
import {PERMISSIONS} from '../../../shared/permissions.js';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {
  identifierSchema,
  nonNegativeIrrSchema,
  positiveQuantitySchema,
} from '../../common/values.js';
import {query, withTransaction} from '../../db/pool.js';
import {writeAudit} from '../../infrastructure/audit.js';
import {nextSequence} from '../../infrastructure/sequences.js';
import {
  requireAuthentication,
  requirePermissions,
} from '../auth/middleware.js';
import {applyInventoryMovement} from './inventory.service.js';

export const inventoryRouter = Router();
inventoryRouter.use(
  requireAuthentication,
  requirePermissions(PERMISSIONS.INVENTORY_VIEW),
);

inventoryRouter.get(
  '/balances',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        warehouseId: identifierSchema.optional(),
        q: z.string().trim().max(160).default(''),
        belowMinimum: z.enum(['true', 'false']).default('false'),
        limit: z.coerce.number().int().min(1).max(200).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          balance.product_id AS "productId",
          product.code AS "productCode",
          product.name AS "productName",
          product.tracking_type AS "trackingType",
          unit.name AS "unitName",
          balance.warehouse_id AS "warehouseId",
          warehouse.name AS "warehouseName",
          balance.quantity::text,
          balance.reserved_quantity::text AS "reservedQuantity",
          (balance.quantity - balance.reserved_quantity)::text
            AS "availableQuantity",
          balance.average_cost_irr::text AS "averageCostIrr",
          (
            balance.quantity * balance.average_cost_irr
          )::text AS "inventoryValueIrr",
          product.minimum_stock::text AS "minimumStock",
          balance.row_version AS "rowVersion"
        FROM inventory_balances balance
        JOIN products product ON product.id = balance.product_id
        JOIN units unit ON unit.id = product.base_unit_id
        JOIN warehouses warehouse ON warehouse.id = balance.warehouse_id
        WHERE balance.company_id = $1
          AND ($2::uuid IS NULL OR balance.warehouse_id = $2)
          AND (
            $3 = ''
            OR product.code ILIKE '%' || $3 || '%'
            OR product.name ILIKE '%' || $3 || '%'
          )
          AND (
            $4 = false
            OR balance.quantity <= product.minimum_stock
          )
        ORDER BY product.name, warehouse.name
        LIMIT $5 OFFSET $6
      `,
      [
        actor.companyId,
        input.warehouseId ?? null,
        input.q,
        input.belowMinimum === 'true',
        input.limit,
        input.offset,
      ],
    );
    response.json({data: result.rows});
  }),
);

inventoryRouter.get(
  '/serials',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        q: z.string().trim().min(1).max(160),
        status: z
          .enum([
            'in_stock',
            'reserved',
            'sold',
            'in_production',
            'in_service',
            'returned',
            'supplier_return',
            'scrapped',
            'all',
          ])
          .default('all'),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          serial.id,
          serial.serial_number AS "serialNumber",
          serial.status,
          serial.warehouse_id AS "warehouseId",
          warehouse.name AS "warehouseName",
          serial.acquired_on::text AS "acquiredOn",
          serial.manufactured_on::text AS "manufacturedOn",
          serial.sold_on::text AS "soldOn",
          product.id AS "productId",
          product.code AS "productCode",
          product.name AS "productName",
          serial.row_version AS "rowVersion"
        FROM serial_numbers serial
        JOIN products product ON product.id = serial.product_id
        LEFT JOIN warehouses warehouse ON warehouse.id = serial.warehouse_id
        WHERE serial.company_id = $1
          AND (
            serial.serial_number ILIKE '%' || $2 || '%'
            OR product.code ILIKE '%' || $2 || '%'
            OR product.name ILIKE '%' || $2 || '%'
          )
          AND ($3 = 'all' OR serial.status = $3)
        ORDER BY serial.updated_at DESC
        LIMIT $4
      `,
      [actor.companyId, input.q, input.status, input.limit],
    );
    response.json({data: result.rows});
  }),
);

inventoryRouter.get(
  '/movements',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        productId: identifierSchema.optional(),
        warehouseId: identifierSchema.optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          movement.id,
          movement.posted_at AS "postedAt",
          movement.movement_type AS "movementType",
          movement.quantity_delta::text AS "quantityDelta",
          movement.unit_cost_irr::text AS "unitCostIrr",
          movement.value_delta_irr::text AS "valueDeltaIrr",
          movement.source_type AS "sourceType",
          movement.source_id AS "sourceId",
          movement.reason,
          product.code AS "productCode",
          product.name AS "productName",
          warehouse.name AS "warehouseName",
          "user".full_name AS "createdByName"
        FROM inventory_movements movement
        JOIN products product ON product.id = movement.product_id
        JOIN warehouses warehouse ON warehouse.id = movement.warehouse_id
        JOIN users "user" ON "user".id = movement.created_by
        WHERE movement.company_id = $1
          AND ($2::uuid IS NULL OR movement.product_id = $2)
          AND ($3::uuid IS NULL OR movement.warehouse_id = $3)
        ORDER BY movement.posted_at DESC, movement.id DESC
        LIMIT $4 OFFSET $5
      `,
      [
        actor.companyId,
        input.productId ?? null,
        input.warehouseId ?? null,
        input.limit,
        input.offset,
      ],
    );
    response.json({data: result.rows});
  }),
);

inventoryRouter.post(
  '/adjustments',
  requirePermissions(PERMISSIONS.INVENTORY_ADJUST),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        productId: identifierSchema,
        warehouseId: identifierSchema,
        quantityDelta: z.string().refine((value) => {
          try {
            return !new Decimal(value).isZero();
          } catch {
            return false;
          }
        }, '\u0645\u0642\u062f\u0627\u0631 \u062a\u0639\u062f\u06cc\u0644 \u0628\u0627\u06cc\u062f \u0639\u062f\u062f\u06cc \u063a\u06cc\u0631\u0635\u0641\u0631 \u0628\u0627\u0634\u062f.'),
        incomingUnitCostIrr: nonNegativeIrrSchema.default('0'),
        serialNumbers: z
          .array(z.string().trim().min(1).max(160))
          .default([]),
        reason: z.string().trim().min(5).max(1000),
      })
      .parse(request.body);

    const result = await withTransaction(async (client) => {
      const productResult = await client.query<{
        tracking_type: 'none' | 'serial' | 'batch';
      }>(
        `
          SELECT tracking_type
          FROM products
          WHERE id = $1 AND company_id = $2 AND is_active = true
          FOR UPDATE
        `,
        [input.productId, actor.companyId],
      );
      const product = productResult.rows[0];
      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', '\u06a9\u0627\u0644\u0627 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
      }

      const delta = new Decimal(input.quantityDelta);
      const serialNumbers = [...new Set(input.serialNumbers)];
      if (product.tracking_type === 'serial') {
        if (!delta.isInteger() || delta.abs().toNumber() !== serialNumbers.length) {
          throw new AppError(
            422,
            'SERIAL_COUNT_MISMATCH',
            '\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627 \u0628\u0627\u06cc\u062f \u0628\u0627 \u0642\u062f\u0631\u0645\u0637\u0644\u0642 \u0645\u0642\u062f\u0627\u0631 \u062a\u0639\u062f\u06cc\u0644 \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.',
          );
        }
      } else if (serialNumbers.length > 0) {
        throw new AppError(
          422,
          'SERIAL_NOT_ALLOWED',
          '\u0627\u06cc\u0646 \u06a9\u0627\u0644\u0627 \u0633\u0631\u06cc\u0627\u0644\u06cc \u0646\u06cc\u0633\u062a.',
        );
      }

      const adjustmentIdResult = await client.query<{id: string}>(
        'SELECT gen_random_uuid() AS id',
      );
      const adjustmentId = adjustmentIdResult.rows[0]?.id;
      if (!adjustmentId) throw new Error('Adjustment id was not generated');

      const movement = await applyInventoryMovement(client, {
        companyId: actor.companyId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        movementType: 'adjustment',
        quantityDelta: delta,
        incomingUnitCost: input.incomingUnitCostIrr,
        sourceType: 'inventory_adjustment',
        sourceId: adjustmentId,
        reason: input.reason,
        userId: actor.id,
      });

      if (product.tracking_type === 'serial' && delta.isPositive()) {
        for (const serialNumber of serialNumbers) {
          await client.query(
            `
              INSERT INTO serial_numbers (
                company_id,
                product_id,
                serial_number,
                warehouse_id,
                status,
                source_type,
                source_id
              )
              VALUES (
                $1, $2, $3, $4, 'in_stock',
                'inventory_adjustment', $5
              )
            `,
            [
              actor.companyId,
              input.productId,
              serialNumber,
              input.warehouseId,
              adjustmentId,
            ],
          );
        }
      }
      if (product.tracking_type === 'serial' && delta.isNegative()) {
        const serialResult = await client.query<{id: string}>(
          `
            SELECT id
            FROM serial_numbers
            WHERE company_id = $1
              AND product_id = $2
              AND warehouse_id = $3
              AND serial_number = ANY($4::text[])
              AND status = 'in_stock'
            FOR UPDATE
          `,
          [
            actor.companyId,
            input.productId,
            input.warehouseId,
            serialNumbers,
          ],
        );
        if (serialResult.rows.length !== serialNumbers.length) {
          throw new AppError(
            409,
            'SERIAL_NOT_AVAILABLE',
            '\u06cc\u06a9 \u06cc\u0627 \u0686\u0646\u062f \u0633\u0631\u06cc\u0627\u0644 \u0628\u0631\u0627\u06cc \u062a\u0639\u062f\u06cc\u0644 \u06a9\u0627\u0647\u0634\u06cc \u0645\u0648\u062c\u0648\u062f \u0646\u06cc\u0633\u062a.',
          );
        }
        await client.query(
          `
            UPDATE serial_numbers
            SET
              status = 'scrapped',
              warehouse_id = NULL,
              row_version = row_version + 1
            WHERE id = ANY($1::uuid[])
          `,
          [serialResult.rows.map((row) => row.id)],
        );
      }

      await writeAudit(client, request, {
        action: 'inventory.adjust',
        entityType: 'inventory_adjustment',
        entityId: adjustmentId,
        after: {
          ...input,
          movementId: movement.id,
        },
      });
      return {id: adjustmentId, movement};
    });
    response.status(201).json({data: result});
  }),
);

const transferLineSchema = z.object({
  productId: identifierSchema,
  quantity: positiveQuantitySchema,
  serialNumbers: z.array(z.string().trim().min(1).max(160)).default([]),
});

inventoryRouter.get(
  '/transfers',
  requirePermissions(PERMISSIONS.INVENTORY_TRANSFER),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const result = await query(
      `
        SELECT
          transfer.id,
          transfer.transfer_number::text AS "transferNumber",
          transfer.transfer_date::text AS "transferDate",
          transfer.status,
          transfer.description,
          origin.name AS "fromWarehouseName",
          destination.name AS "toWarehouseName",
          transfer.row_version AS "rowVersion"
        FROM stock_transfers transfer
        JOIN warehouses origin ON origin.id = transfer.from_warehouse_id
        JOIN warehouses destination ON destination.id = transfer.to_warehouse_id
        WHERE transfer.company_id = $1
        ORDER BY transfer.transfer_date DESC, transfer.transfer_number DESC
        LIMIT 100
      `,
      [actor.companyId],
    );
    response.json({data: result.rows});
  }),
);

inventoryRouter.post(
  '/transfers',
  requirePermissions(PERMISSIONS.INVENTORY_TRANSFER),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        transferDate: z.string().date(),
        fromWarehouseId: identifierSchema,
        toWarehouseId: identifierSchema,
        description: z.string().trim().max(1000).nullable().default(null),
        lines: z.array(transferLineSchema).min(1).max(200),
      })
      .refine(
        (value) => value.fromWarehouseId !== value.toWarehouseId,
        {path: ['toWarehouseId'], message: '\u0627\u0646\u0628\u0627\u0631 \u0645\u0628\u062f\u0623 \u0648 \u0645\u0642\u0635\u062f \u0628\u0627\u06cc\u062f \u0645\u062a\u0641\u0627\u0648\u062a \u0628\u0627\u0634\u0646\u062f.'},
      )
      .parse(request.body);

    const created = await withTransaction(async (client) => {
      const warehouses = await client.query<{id: string}>(
        `
          SELECT id
          FROM warehouses
          WHERE company_id = $1
            AND is_active = true
            AND id = ANY($2::uuid[])
          FOR UPDATE
        `,
        [
          actor.companyId,
          [input.fromWarehouseId, input.toWarehouseId],
        ],
      );
      if (warehouses.rows.length !== 2) {
        throw new AppError(
          422,
          'INVALID_WAREHOUSE',
          '\u0627\u0646\u0628\u0627\u0631 \u0645\u0628\u062f\u0623 \u06cc\u0627 \u0645\u0642\u0635\u062f \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
        );
      }

      const number = await nextSequence(
        client,
        actor.companyId,
        'stock_transfer',
      );
      const transferResult = await client.query<{id: string}>(
        `
          INSERT INTO stock_transfers (
            company_id,
            transfer_number,
            transfer_date,
            from_warehouse_id,
            to_warehouse_id,
            description,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          actor.companyId,
          number.toString(),
          input.transferDate,
          input.fromWarehouseId,
          input.toWarehouseId,
          input.description,
          actor.id,
        ],
      );
      const transferId = transferResult.rows[0]?.id;
      if (!transferId) throw new Error('Transfer was not created');

      for (const [index, line] of input.lines.entries()) {
        const productResult = await client.query<{
          tracking_type: string;
        }>(
          `
            SELECT tracking_type
            FROM products
            WHERE id = $1 AND company_id = $2 AND is_active = true
          `,
          [line.productId, actor.companyId],
        );
        const product = productResult.rows[0];
        if (!product) {
          throw new AppError(422, 'INVALID_PRODUCT', '\u06a9\u0627\u0644\u0627 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
        }
        const serialNumbers = [...new Set(line.serialNumbers)];
        if (
          product.tracking_type === 'serial' &&
          (
            !new Decimal(line.quantity).isInteger() ||
            new Decimal(line.quantity).toNumber() !== serialNumbers.length
          )
        ) {
          throw new AppError(
            422,
            'SERIAL_COUNT_MISMATCH',
            '\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u0627\u0646\u062a\u0642\u0627\u0644 \u0628\u0627\u06cc\u062f \u0628\u0627 \u062a\u0639\u062f\u0627\u062f \u06a9\u0627\u0644\u0627 \u0628\u0631\u0627\u0628\u0631 \u0628\u0627\u0634\u062f.',
          );
        }
        const lineResult = await client.query<{id: string}>(
          `
            INSERT INTO stock_transfer_lines (
              transfer_id,
              line_number,
              product_id,
              quantity
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `,
          [transferId, index + 1, line.productId, line.quantity],
        );
        const lineId = lineResult.rows[0]?.id;
        if (!lineId) throw new Error('Transfer line was not created');
        if (serialNumbers.length) {
          const serialResult = await client.query<{id: string}>(
            `
              SELECT id
              FROM serial_numbers
              WHERE company_id = $1
                AND product_id = $2
                AND warehouse_id = $3
                AND serial_number = ANY($4::text[])
                AND status = 'in_stock'
            `,
            [
              actor.companyId,
              line.productId,
              input.fromWarehouseId,
              serialNumbers,
            ],
          );
          if (serialResult.rows.length !== serialNumbers.length) {
            throw new AppError(
              409,
              'SERIAL_NOT_AVAILABLE',
              '\u06cc\u06a9 \u06cc\u0627 \u0686\u0646\u062f \u0633\u0631\u06cc\u0627\u0644 \u0627\u0646\u062a\u0642\u0627\u0644 \u0645\u0648\u062c\u0648\u062f \u0646\u06cc\u0633\u062a.',
            );
          }
          for (const serial of serialResult.rows) {
            await client.query(
              `
                INSERT INTO stock_transfer_serials (
                  transfer_line_id,
                  serial_id
                )
                VALUES ($1, $2)
              `,
              [lineId, serial.id],
            );
          }
        }
      }
      return {id: transferId, transferNumber: number.toString()};
    });
    response.status(201).json({data: created});
  }),
);

inventoryRouter.post(
  '/transfers/:id/dispatch',
  requirePermissions(PERMISSIONS.INVENTORY_TRANSFER),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const transferId = identifierSchema.parse(request.params.id);
    await withTransaction(async (client) => {
      const transferResult = await client.query<{
        from_warehouse_id: string;
        status: string;
      }>(
        `
          SELECT from_warehouse_id, status
          FROM stock_transfers
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [transferId, actor.companyId],
      );
      const transfer = transferResult.rows[0];
      if (!transfer || transfer.status !== 'draft') {
        throw new AppError(
          409,
          'TRANSFER_NOT_DISPATCHABLE',
          '\u0627\u0646\u062a\u0642\u0627\u0644 \u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0642\u0627\u0628\u0644 \u0627\u0631\u0633\u0627\u0644 \u0646\u06cc\u0633\u062a.',
        );
      }
      const lines = await client.query<{
        id: string;
        product_id: string;
        quantity: string;
      }>(
        `
          SELECT id, product_id, quantity::text
          FROM stock_transfer_lines
          WHERE transfer_id = $1
          ORDER BY line_number
        `,
        [transferId],
      );
      for (const line of lines.rows) {
        await applyInventoryMovement(client, {
          companyId: actor.companyId,
          warehouseId: transfer.from_warehouse_id,
          productId: line.product_id,
          movementType: 'transfer_out',
          quantityDelta: new Decimal(line.quantity).negated(),
          incomingUnitCost: 0,
          sourceType: 'stock_transfer',
          sourceId: transferId,
          sourceLineId: line.id,
          userId: actor.id,
        });
        const serials = await client.query<{id: string}>(
          `
            SELECT serial.id
            FROM stock_transfer_serials link
            JOIN serial_numbers serial ON serial.id = link.serial_id
            WHERE link.transfer_line_id = $1
              AND serial.status = 'in_stock'
              AND serial.warehouse_id = $2
            FOR UPDATE OF serial
          `,
          [line.id, transfer.from_warehouse_id],
        );
        await client.query(
          `
            UPDATE serial_numbers
            SET
              status = 'reserved',
              warehouse_id = NULL,
              row_version = row_version + 1
            WHERE id = ANY($1::uuid[])
          `,
          [serials.rows.map((row) => row.id)],
        );
      }
      await client.query(
        `
          UPDATE stock_transfers
          SET
            status = 'in_transit',
            dispatched_by = $2,
            dispatched_at = now(),
            row_version = row_version + 1
          WHERE id = $1
        `,
        [transferId, actor.id],
      );
    });
    response.status(204).end();
  }),
);

inventoryRouter.post(
  '/transfers/:id/receive',
  requirePermissions(PERMISSIONS.INVENTORY_TRANSFER),
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const transferId = identifierSchema.parse(request.params.id);
    await withTransaction(async (client) => {
      const transferResult = await client.query<{
        to_warehouse_id: string;
        status: string;
      }>(
        `
          SELECT to_warehouse_id, status
          FROM stock_transfers
          WHERE id = $1 AND company_id = $2
          FOR UPDATE
        `,
        [transferId, actor.companyId],
      );
      const transfer = transferResult.rows[0];
      if (!transfer || transfer.status !== 'in_transit') {
        throw new AppError(
          409,
          'TRANSFER_NOT_RECEIVABLE',
          '\u0627\u0646\u062a\u0642\u0627\u0644 \u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0642\u0627\u0628\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0646\u06cc\u0633\u062a.',
        );
      }
      const lines = await client.query<{
        id: string;
        product_id: string;
        quantity: string;
        unit_cost_irr: string;
      }>(
        `
          SELECT
            line.id,
            line.product_id,
            line.quantity::text,
            movement.unit_cost_irr::text
          FROM stock_transfer_lines line
          JOIN inventory_movements movement
            ON movement.source_line_id = line.id
            AND movement.source_type = 'stock_transfer'
            AND movement.movement_type = 'transfer_out'
          WHERE line.transfer_id = $1
          ORDER BY line.line_number
        `,
        [transferId],
      );
      for (const line of lines.rows) {
        await applyInventoryMovement(client, {
          companyId: actor.companyId,
          warehouseId: transfer.to_warehouse_id,
          productId: line.product_id,
          movementType: 'transfer_in',
          quantityDelta: line.quantity,
          incomingUnitCost: line.unit_cost_irr,
          sourceType: 'stock_transfer',
          sourceId: transferId,
          sourceLineId: line.id,
          userId: actor.id,
        });
        const serials = await client.query<{id: string}>(
          `
            SELECT serial.id
            FROM stock_transfer_serials link
            JOIN serial_numbers serial ON serial.id = link.serial_id
            WHERE link.transfer_line_id = $1
              AND serial.status = 'reserved'
            FOR UPDATE OF serial
          `,
          [line.id],
        );
        await client.query(
          `
            UPDATE serial_numbers
            SET
              status = 'in_stock',
              warehouse_id = $2,
              row_version = row_version + 1
            WHERE id = ANY($1::uuid[])
          `,
          [
            serials.rows.map((row) => row.id),
            transfer.to_warehouse_id,
          ],
        );
      }
      await client.query(
        `
          UPDATE stock_transfers
          SET
            status = 'received',
            received_by = $2,
            received_at = now(),
            row_version = row_version + 1
          WHERE id = $1
        `,
        [transferId, actor.id],
      );
    });
    response.status(204).end();
  }),
);
