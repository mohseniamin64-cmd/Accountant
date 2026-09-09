import type {PermissionCode} from '../../../shared/permissions.js';
import {PERMISSIONS} from '../../../shared/permissions.js';

export interface RoleDefinition {
  code: string;
  name: string;
  description: string;
  permissions: readonly PermissionCode[] | 'all';
}

export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  {
    code: 'administrator',
    name: '\u0645\u062f\u06cc\u0631 \u0633\u0627\u0645\u0627\u0646\u0647',
    description: '\u062f\u0633\u062a\u0631\u0633\u06cc \u06a9\u0627\u0645\u0644 \u0648 \u0645\u062f\u06cc\u0631\u06cc\u062a \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0648 \u06a9\u0627\u0631\u0628\u0631\u0627\u0646',
    permissions: 'all',
  },
  {
    code: 'accountant',
    name: '\u062d\u0633\u0627\u0628\u062f\u0627\u0631',
    description: '\u062b\u0628\u062a \u0627\u0633\u0646\u0627\u062f\u060c \u0645\u062f\u06cc\u0631\u06cc\u062a \u062e\u0632\u0627\u0646\u0647 \u0648 \u06af\u0632\u0627\u0631\u0634\u200c\u0647\u0627\u06cc \u0645\u0627\u0644\u06cc',
    permissions: [
      PERMISSIONS.ACCOUNTING_VIEW,
      PERMISSIONS.ACCOUNTING_CREATE,
      PERMISSIONS.ACCOUNTING_EDIT,
      PERMISSIONS.ACCOUNTING_POST,
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.TREASURY_MANAGE,
      PERMISSIONS.PARTIES_VIEW,
      PERMISSIONS.PARTIES_MANAGE,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.SALES_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
  {
    code: 'warehouse_keeper',
    name: '\u0627\u0646\u0628\u0627\u0631\u062f\u0627\u0631',
    description: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u0645\u0648\u062c\u0648\u062f\u06cc\u060c \u0627\u0646\u062a\u0642\u0627\u0644 \u06a9\u0627\u0644\u0627 \u0648 \u0639\u0645\u0644\u06cc\u0627\u062a \u0627\u0646\u0628\u0627\u0631',
    permissions: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.INVENTORY_TRANSFER,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.SALES_VIEW,
      PERMISSIONS.PRODUCTION_VIEW,
    ],
  },
  {
    code: 'sales',
    name: '\u0641\u0631\u0648\u0634',
    description: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u0645\u0634\u062a\u0631\u06cc\u0627\u0646\u060c \u0641\u0627\u06a9\u062a\u0648\u0631 \u0648 \u0646\u0647\u0627\u06cc\u06cc\u200c\u0633\u0627\u0632\u06cc \u0641\u0631\u0648\u0634',
    permissions: [
      PERMISSIONS.SALES_VIEW,
      PERMISSIONS.SALES_CREATE,
      PERMISSIONS.SALES_POST,
      PERMISSIONS.PARTIES_VIEW,
      PERMISSIONS.PARTIES_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
    ],
  },
  {
    code: 'purchasing',
    name: '\u062e\u0631\u06cc\u062f',
    description: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u06af\u0627\u0646 \u0648 \u062b\u0628\u062a \u062e\u0631\u06cc\u062f',
    permissions: [
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_POST,
      PERMISSIONS.PARTIES_VIEW,
      PERMISSIONS.PARTIES_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
    ],
  },
  {
    code: 'production',
    name: '\u0645\u0633\u0626\u0648\u0644 \u062a\u0648\u0644\u06cc\u062f',
    description: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u0641\u0631\u0645\u0648\u0644 \u0633\u0627\u062e\u062a\u060c \u062f\u0633\u062a\u0648\u0631 \u0648 \u0639\u0645\u0644\u06cc\u0627\u062a \u062a\u0648\u0644\u06cc\u062f',
    permissions: [
      PERMISSIONS.PRODUCTION_VIEW,
      PERMISSIONS.PRODUCTION_MANAGE,
      PERMISSIONS.PRODUCTION_POST,
      PERMISSIONS.INVENTORY_VIEW,
    ],
  },
  {
    code: 'service_reception',
    name: '\u067e\u0630\u06cc\u0631\u0634 \u062e\u062f\u0645\u0627\u062a',
    description: '\u067e\u0630\u06cc\u0631\u0634 \u062f\u0633\u062a\u06af\u0627\u0647 \u0648 \u0645\u0634\u0627\u0647\u062f\u0647 \u0635\u0641 \u062e\u062f\u0645\u0627\u062a',
    permissions: [
      PERMISSIONS.SERVICE_VIEW,
      PERMISSIONS.SERVICE_RECEPTION,
      PERMISSIONS.PARTIES_VIEW,
    ],
  },
  {
    code: 'service_technician',
    name: '\u062a\u06a9\u0646\u0633\u06cc\u0646 \u062e\u062f\u0645\u0627\u062a',
    description: '\u0639\u06cc\u0628\u200c\u06cc\u0627\u0628\u06cc\u060c \u062a\u0639\u0645\u06cc\u0631 \u0648 \u062b\u0628\u062a \u0642\u0637\u0639\u0627\u062a \u0645\u0635\u0631\u0641\u06cc',
    permissions: [
      PERMISSIONS.SERVICE_VIEW,
      PERMISSIONS.SERVICE_REPAIR,
      PERMISSIONS.INVENTORY_VIEW,
    ],
  },
  {
    code: 'service_delivery',
    name: '\u062a\u062d\u0648\u06cc\u0644 \u062e\u062f\u0645\u0627\u062a',
    description: '\u062a\u0633\u0648\u06cc\u0647 \u0646\u0647\u0627\u06cc\u06cc \u0648 \u062a\u062d\u0648\u06cc\u0644 \u062f\u0633\u062a\u06af\u0627\u0647',
    permissions: [
      PERMISSIONS.SERVICE_VIEW,
      PERMISSIONS.SERVICE_DELIVER,
      PERMISSIONS.TREASURY_VIEW,
    ],
  },
];

export interface AccountDefinition {
  key: string;
  parentKey: string | null;
  code: string;
  name: string;
  level: 'group' | 'general' | 'subsidiary';
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  normal: 'debit' | 'credit';
  posting?: boolean;
  party?: boolean;
}

export const DEFAULT_CHART: readonly AccountDefinition[] = [
  {key: 'assets', parentKey: null, code: '1', name: '\u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627', level: 'group', type: 'asset', normal: 'debit'},
  {key: 'current_assets', parentKey: 'assets', code: '11', name: '\u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627\u06cc \u062c\u0627\u0631\u06cc', level: 'general', type: 'asset', normal: 'debit'},
  {key: 'cash', parentKey: 'current_assets', code: '1101', name: '\u0635\u0646\u062f\u0648\u0642', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'bank', parentKey: 'current_assets', code: '1102', name: '\u0628\u0627\u0646\u06a9\u200c\u0647\u0627', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'cheques_receivable', parentKey: 'current_assets', code: '1103', name: '\u0627\u0633\u0646\u0627\u062f \u062f\u0631\u06cc\u0627\u0641\u062a\u0646\u06cc', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'accounts_receivable', parentKey: 'current_assets', code: '1201', name: '\u062d\u0633\u0627\u0628\u200c\u0647\u0627\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a\u0646\u06cc', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true, party: true},
  {key: 'inventory', parentKey: 'current_assets', code: '1301', name: '\u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u0648\u0627\u062f \u0648 \u06a9\u0627\u0644\u0627', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'work_in_progress', parentKey: 'current_assets', code: '1302', name: '\u06a9\u0627\u0644\u0627\u06cc \u062f\u0631 \u062c\u0631\u06cc\u0627\u0646 \u0633\u0627\u062e\u062a', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'finished_goods', parentKey: 'current_assets', code: '1303', name: '\u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u062d\u0635\u0648\u0644 \u0646\u0647\u0627\u06cc\u06cc', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'vat_receivable', parentKey: 'current_assets', code: '1401', name: '\u0645\u0627\u0644\u06cc\u0627\u062a \u0648 \u0639\u0648\u0627\u0631\u0636 \u062e\u0631\u06cc\u062f', level: 'subsidiary', type: 'asset', normal: 'debit', posting: true},
  {key: 'liabilities', parentKey: null, code: '2', name: '\u0628\u062f\u0647\u06cc\u200c\u0647\u0627', level: 'group', type: 'liability', normal: 'credit'},
  {key: 'current_liabilities', parentKey: 'liabilities', code: '21', name: '\u0628\u062f\u0647\u06cc\u200c\u0647\u0627\u06cc \u062c\u0627\u0631\u06cc', level: 'general', type: 'liability', normal: 'credit'},
  {key: 'accounts_payable', parentKey: 'current_liabilities', code: '2101', name: '\u062d\u0633\u0627\u0628\u200c\u0647\u0627\u06cc \u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc', level: 'subsidiary', type: 'liability', normal: 'credit', posting: true, party: true},
  {key: 'cheques_payable', parentKey: 'current_liabilities', code: '2102', name: '\u0627\u0633\u0646\u0627\u062f \u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc', level: 'subsidiary', type: 'liability', normal: 'credit', posting: true},
  {key: 'vat_payable', parentKey: 'current_liabilities', code: '2201', name: '\u0645\u0627\u0644\u06cc\u0627\u062a \u0648 \u0639\u0648\u0627\u0631\u0636 \u0641\u0631\u0648\u0634', level: 'subsidiary', type: 'liability', normal: 'credit', posting: true},
  {key: 'equity', parentKey: null, code: '3', name: '\u062d\u0642\u0648\u0642 \u0645\u0627\u0644\u06a9\u0627\u0646\u0647', level: 'group', type: 'equity', normal: 'credit'},
  {key: 'capital', parentKey: 'equity', code: '3101', name: '\u0633\u0631\u0645\u0627\u06cc\u0647', level: 'subsidiary', type: 'equity', normal: 'credit', posting: true},
  {key: 'income', parentKey: null, code: '4', name: '\u062f\u0631\u0622\u0645\u062f\u0647\u0627', level: 'group', type: 'income', normal: 'credit'},
  {key: 'operating_income', parentKey: 'income', code: '41', name: '\u062f\u0631\u0622\u0645\u062f \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc', level: 'general', type: 'income', normal: 'credit'},
  {key: 'sales_revenue', parentKey: 'operating_income', code: '4101', name: '\u0641\u0631\u0648\u0634 \u0645\u062d\u0635\u0648\u0644 \u0648 \u06a9\u0627\u0644\u0627', level: 'subsidiary', type: 'income', normal: 'credit', posting: true},
  {key: 'service_revenue', parentKey: 'operating_income', code: '4102', name: '\u062f\u0631\u0622\u0645\u062f \u062e\u062f\u0645\u0627\u062a \u0648 \u062a\u0639\u0645\u06cc\u0631\u0627\u062a', level: 'subsidiary', type: 'income', normal: 'credit', posting: true},
  {key: 'expenses', parentKey: null, code: '5', name: '\u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627', level: 'group', type: 'expense', normal: 'debit'},
  {key: 'costs', parentKey: 'expenses', code: '51', name: '\u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647', level: 'general', type: 'expense', normal: 'debit'},
  {key: 'cost_of_goods_sold', parentKey: 'costs', code: '5101', name: '\u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647 \u06a9\u0627\u0644\u0627\u06cc \u0641\u0631\u0648\u0634\u200c\u0631\u0641\u062a\u0647', level: 'subsidiary', type: 'expense', normal: 'debit', posting: true},
  {key: 'production_overhead', parentKey: 'costs', code: '5102', name: '\u0633\u0631\u0628\u0627\u0631 \u062a\u0648\u0644\u06cc\u062f', level: 'subsidiary', type: 'expense', normal: 'debit', posting: true},
  {key: 'service_parts_cost', parentKey: 'costs', code: '5103', name: '\u0647\u0632\u06cc\u0646\u0647 \u0642\u0637\u0639\u0627\u062a \u062e\u062f\u0645\u0627\u062a', level: 'subsidiary', type: 'expense', normal: 'debit', posting: true},
  {key: 'operating_expenses', parentKey: 'expenses', code: '52', name: '\u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc', level: 'general', type: 'expense', normal: 'debit'},
  {key: 'salary_expense', parentKey: 'operating_expenses', code: '5201', name: '\u0647\u0632\u06cc\u0646\u0647 \u062d\u0642\u0648\u0642 \u0648 \u062f\u0633\u062a\u0645\u0632\u062f', level: 'subsidiary', type: 'expense', normal: 'debit', posting: true},
  {key: 'general_expense', parentKey: 'operating_expenses', code: '5202', name: '\u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u0639\u0645\u0648\u0645\u06cc', level: 'subsidiary', type: 'expense', normal: 'debit', posting: true},
];
