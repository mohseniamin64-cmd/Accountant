import {Router} from 'express';
import {z} from 'zod';
import {currentUser} from '../../common/auth-context.js';
import {AppError, asyncRoute} from '../../common/errors.js';
import {identifierSchema} from '../../common/values.js';
import {query} from '../../db/pool.js';

export const productionReadRouter = Router();

productionReadRouter.get(
  '/options',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const [products, branches, warehouses, boms] = await Promise.all([
      query(
        `
          SELECT
            product.id,
            product.code,
            product.name,
            product.product_type AS "productType",
            product.tracking_type AS "trackingType",
            product.is_producible AS "isProducible",
            unit.name AS "unitName"
          FROM products product
          JOIN units unit ON unit.id = product.base_unit_id
          WHERE product.company_id = $1
            AND product.is_active = true
            AND product.product_type <> 'service'
          ORDER BY product.name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT id, code, name, is_head_office AS "isHeadOffice"
          FROM branches
          WHERE company_id = $1 AND is_active = true
          ORDER BY is_head_office DESC, name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            warehouse.id,
            warehouse.branch_id AS "branchId",
            branch.name AS "branchName",
            warehouse.code,
            warehouse.name
          FROM warehouses warehouse
          JOIN branches branch ON branch.id = warehouse.branch_id
          WHERE warehouse.company_id = $1
            AND warehouse.is_active = true
            AND branch.is_active = true
          ORDER BY branch.name, warehouse.name
        `,
        [actor.companyId],
      ),
      query(
        `
          SELECT
            bom.id,
            bom.code,
            bom.name,
            bom.product_id AS "productId",
            product.code AS "productCode",
            product.name AS "productName",
            product.tracking_type AS "trackingType",
            version.id AS "activeVersionId",
            version.version_number AS "activeVersionNumber",
            version.output_quantity::text AS "outputQuantity"
          FROM boms bom
          JOIN products product ON product.id = bom.product_id
          JOIN bom_versions version
            ON version.bom_id = bom.id
            AND version.status = 'active'
          WHERE bom.company_id = $1
            AND bom.is_active = true
            AND product.is_active = true
          ORDER BY product.name
        `,
        [actor.companyId],
      ),
    ]);
    response.json({
      data: {
        products: products.rows,
        branches: branches.rows,
        warehouses: warehouses.rows,
        boms: boms.rows,
      },
    });
  }),
);

productionReadRouter.get(
  '/material-serials',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const input = z
      .object({
        productId: identifierSchema,
        warehouseId: identifierSchema,
        search: z.string().trim().max(160).default(''),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(request.query);
    const result = await query(
      `
        SELECT
          serial.id,
          serial.serial_number AS "serialNumber",
          serial.acquired_on::text AS "acquiredOn"
        FROM serial_numbers serial
        JOIN products product ON product.id = serial.product_id
        JOIN warehouses warehouse ON warehouse.id = serial.warehouse_id
        WHERE serial.company_id = $1
          AND serial.product_id = $2
          AND serial.warehouse_id = $3
          AND serial.status = 'in_stock'
          AND product.company_id = $1
          AND warehouse.company_id = $1
          AND (
            $4 = ''
            OR serial.serial_number ILIKE '%' || $4 || '%'
          )
        ORDER BY serial.serial_number
        LIMIT $5
      `,
      [
        actor.companyId,
        input.productId,
        input.warehouseId,
        input.search,
        input.limit,
      ],
    );
    response.json({data: result.rows});
  }),
);

productionReadRouter.get(
  '/orders/:id',
  asyncRoute(async (request, response) => {
    const actor = currentUser(request);
    const orderId = identifierSchema.parse(request.params.id);
    const header = await query(
      `
        SELECT
          production.id,
          production.order_number::text AS "orderNumber",
          production.status,
          production.planned_quantity::text AS "plannedQuantity",
          production.actual_quantity::text AS "actualQuantity",
          production.planned_start_on::text AS "plannedStartOn",
          production.planned_end_on::text AS "plannedEndOn",
          production.started_at AS "startedAt",
          production.completed_at AS "completedAt",
          production.direct_labor_cost_irr::text AS "directLaborCostIrr",
          production.subcontract_cost_irr::text AS "subcontractCostIrr",
          production.overhead_cost_irr::text AS "overheadCostIrr",
          production.packaging_cost_irr::text AS "packagingCostIrr",
          production.total_cost_irr::text AS "totalCostIrr",
          production.description,
          production.row_version AS "rowVersion",
          production.branch_id AS "branchId",
          branch.name AS "branchName",
          production.material_warehouse_id AS "materialWarehouseId",
          material_warehouse.name AS "materialWarehouseName",
          production.output_warehouse_id AS "outputWarehouseId",
          output_warehouse.name AS "outputWarehouseName",
          production.product_id AS "productId",
          product.code AS "productCode",
          product.name AS "productName",
          product.tracking_type AS "trackingType",
          production.bom_version_id AS "bomVersionId",
          bom.code AS "bomCode",
          bom.name AS "bomName",
          version.version_number AS "bomVersionNumber"
        FROM production_orders production
        JOIN branches branch ON branch.id = production.branch_id
        JOIN warehouses material_warehouse
          ON material_warehouse.id = production.material_warehouse_id
        JOIN warehouses output_warehouse
          ON output_warehouse.id = production.output_warehouse_id
        JOIN products product ON product.id = production.product_id
        JOIN bom_versions version ON version.id = production.bom_version_id
        JOIN boms bom ON bom.id = version.bom_id
        WHERE production.id = $1 AND production.company_id = $2
      `,
      [orderId, actor.companyId],
    );
    if (!header.rows[0]) {
      throw new AppError(
        404,
        'PRODUCTION_ORDER_NOT_FOUND',
        'دستور تولید پیدا نشد.',
      );
    }

    const [stages, materials, outputs] = await Promise.all([
      query(
        `
          SELECT
            stage.id,
            stage.sequence_number AS "sequenceNumber",
            stage.stage_code AS "stageCode",
            stage.title,
            stage.status,
            stage.started_at AS "startedAt",
            stage.completed_at AS "completedAt",
            stage.notes,
            stage.row_version AS "rowVersion"
          FROM production_order_stages stage
          WHERE stage.production_order_id = $1
          ORDER BY stage.sequence_number
        `,
        [orderId],
      ),
      query(
        `
          SELECT
            material.id,
            material.product_id AS "productId",
            product.code AS "productCode",
            product.name AS "productName",
            product.tracking_type AS "trackingType",
            unit.name AS "unitName",
            material.warehouse_id AS "warehouseId",
            warehouse.name AS "warehouseName",
            material.planned_quantity::text AS "plannedQuantity",
            material.actual_quantity::text AS "actualQuantity",
            material.returned_quantity::text AS "returnedQuantity",
            material.unit_cost_irr::text AS "unitCostIrr",
            COALESCE(
              json_agg(serial.serial_number ORDER BY serial.serial_number)
                FILTER (WHERE serial.id IS NOT NULL),
              '[]'::json
            ) AS "serialNumbers"
          FROM production_materials material
          JOIN products product ON product.id = material.product_id
          JOIN units unit ON unit.id = product.base_unit_id
          JOIN warehouses warehouse ON warehouse.id = material.warehouse_id
          LEFT JOIN production_material_serials link
            ON link.production_material_id = material.id
          LEFT JOIN serial_numbers serial ON serial.id = link.serial_id
          WHERE material.production_order_id = $1
          GROUP BY
            material.id,
            product.id,
            unit.name,
            warehouse.id
          ORDER BY product.name
        `,
        [orderId],
      ),
      query(
        `
          SELECT
            output.id,
            output.quantity::text,
            output.unit_cost_irr::text AS "unitCostIrr",
            output.warehouse_id AS "warehouseId",
            warehouse.name AS "warehouseName",
            COALESCE(
              json_agg(serial.serial_number ORDER BY serial.serial_number)
                FILTER (WHERE serial.id IS NOT NULL),
              '[]'::json
            ) AS "serialNumbers"
          FROM production_outputs output
          JOIN warehouses warehouse ON warehouse.id = output.warehouse_id
          LEFT JOIN production_output_serials link
            ON link.production_output_id = output.id
          LEFT JOIN serial_numbers serial ON serial.id = link.serial_id
          WHERE output.production_order_id = $1
          GROUP BY output.id, warehouse.id
          ORDER BY output.created_at
        `,
        [orderId],
      ),
    ]);

    response.json({
      data: {
        ...header.rows[0],
        stages: stages.rows,
        materials: materials.rows,
        outputs: outputs.rows,
      },
    });
  }),
);
