import Decimal from 'decimal.js';
import {nonNegativeQuantity} from './master-data.helpers.js';
import {parseSerialNumbers} from './purchase.helpers.js';
import type {
  BomComponentDraft,
  ProductionMaterial,
  TrackingType,
} from './production.types.js';

export function positiveProductionQuantity(
  value: string,
  label = 'مقدار',
): string {
  const normalized = nonNegativeQuantity(value);
  if (!new Decimal(normalized).isPositive()) {
    throw new Error(label + ' باید بزرگ‌تر از صفر باشد.');
  }
  return normalized;
}

export function nonNegativeProductionQuantity(
  value: string,
  label = 'مقدار',
): string {
  try {
    return nonNegativeQuantity(value);
  } catch {
    throw new Error(label + ' باید عددی نامنفی با حداکثر شش رقم اعشار باشد.');
  }
}

export function requiredComponentQuantity(
  componentQuantity: string,
  wastePercent: string,
  bomOutputQuantity: string,
  plannedOutputQuantity: string,
): string {
  const result = new Decimal(positiveProductionQuantity(componentQuantity))
    .times(
      new Decimal(1).plus(
        new Decimal(nonNegativeProductionQuantity(wastePercent)).div(100),
      ),
    )
    .times(positiveProductionQuantity(plannedOutputQuantity))
    .div(positiveProductionQuantity(bomOutputQuantity));
  return result.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toString();
}

export function validateBomComponents(
  outputProductId: string,
  components: readonly BomComponentDraft[],
): void {
  if (!outputProductId) {
    throw new Error('محصول نهایی را انتخاب کنید.');
  }
  if (components.length === 0) {
    throw new Error('حداقل یک قطعه برای فرمول ساخت ثبت کنید.');
  }
  const ids = components.map((component) => component.productId);
  if (ids.some((id) => !id)) {
    throw new Error('کالای تمام ردیف‌های فرمول را انتخاب کنید.');
  }
  if (ids.includes(outputProductId)) {
    throw new Error('محصول نهایی نمی‌تواند قطعه خودش باشد.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('یک قطعه در یک نسخه فرمول نباید دوبار ثبت شود.');
  }
  for (const component of components) {
    positiveProductionQuantity(component.quantity, 'مقدار مصرف قطعه');
    const waste = new Decimal(
      nonNegativeProductionQuantity(component.wastePercent, 'درصد ضایعات'),
    );
    if (waste.greaterThan(100)) {
      throw new Error('درصد ضایعات باید بین صفر تا صد باشد.');
    }
    if (!/^[a-zA-Z0-9_-]{2,60}$/.test(component.stageCode.trim())) {
      throw new Error(
        'کد مرحله هر قطعه باید ۲ تا ۶۰ نویسه انگلیسی، عدد، خط تیره یا زیرخط باشد.',
      );
    }
  }
}

export function validateProductionStages(
  stages: readonly {code: string; title: string}[],
): void {
  if (stages.length === 0) {
    throw new Error('حداقل یک مرحله برای دستور تولید ثبت کنید.');
  }
  const codes = stages.map((stage) => stage.code.trim());
  if (new Set(codes).size !== codes.length) {
    throw new Error('کد مراحل یک دستور تولید باید یکتا باشد.');
  }
  for (const stage of stages) {
    if (!/^[a-zA-Z0-9_-]{2,60}$/.test(stage.code.trim())) {
      throw new Error('کد مرحله باید انگلیسی و دارای ۲ تا ۶۰ نویسه باشد.');
    }
    if (stage.title.trim().length < 2) {
      throw new Error('عنوان هر مرحله باید حداقل دو نویسه داشته باشد.');
    }
  }
}

export function parseAndValidateProductionSerials(
  value: string,
  trackingType: TrackingType,
  quantity: string,
  label: string,
): string[] {
  const serials = parseSerialNumbers(value);
  if (trackingType !== 'serial') {
    if (serials.length > 0) {
      throw new Error('برای ' + label + ' غیرسریالی نباید سریال وارد شود.');
    }
    return [];
  }
  const parsedQuantity = new Decimal(
    positiveProductionQuantity(quantity, 'مقدار ' + label),
  );
  if (
    !parsedQuantity.isInteger() ||
    parsedQuantity.toNumber() !== serials.length
  ) {
    throw new Error(
      'تعداد سریال‌های ' + label + ' باید دقیقاً با مقدار آن برابر باشد.',
    );
  }
  return serials;
}

export function validateCompletionMaterials(
  materials: readonly ProductionMaterial[],
  values: ReadonlyMap<
    string,
    {actualQuantity: string; returnedQuantity: string; serialText: string}
  >,
): Array<{
  productionMaterialId: string;
  actualQuantity: string;
  returnedQuantity: string;
  serialNumbers: string[];
}> {
  return materials.map((material) => {
    const value = values.get(material.id);
    if (!value) {
      throw new Error('مصرف واقعی تمام مواد باید ثبت شود.');
    }
    const actualQuantity = positiveProductionQuantity(
      value.actualQuantity,
      'مصرف واقعی «' + material.productName + '»',
    );
    const returnedQuantity = nonNegativeProductionQuantity(
      value.returnedQuantity,
      'برگشت «' + material.productName + '»',
    );
    return {
      productionMaterialId: material.id,
      actualQuantity,
      returnedQuantity,
      serialNumbers: parseAndValidateProductionSerials(
        value.serialText,
        material.trackingType,
        actualQuantity,
        material.productName,
      ),
    };
  });
}
