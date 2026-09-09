import {
  BookOpenText,
  Calculator,
  CalendarRange,
  RefreshCw,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import type {
  AccountingOptions,
  AccountingTab,
} from './accounting.types.js';
import {AccountingFiscalYearPanel} from './AccountingFiscalYearPanel.js';
import {AccountingJournalPanel} from './AccountingJournalPanel.js';
import {AccountingReportsPanel} from './AccountingReportsPanel.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import './accounting.css';

interface Props {
  amountUnit: AmountUnit;
  initialTab?: AccountingTab;
  permissions: readonly string[];
}

const emptyOptions: AccountingOptions = {
  accounts: [],
  branches: [],
  parties: [],
  fiscalYears: [],
};

export function AccountingPage({
  amountUnit,
  initialTab = 'journals',
  permissions,
}: Props) {
  const [options, setOptions] = useState<AccountingOptions>(emptyOptions);
  const [activeTab, setActiveTab] = useState<AccountingTab>(initialTab);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tabs = useMemo(() => {
    const available: Array<{
      id: AccountingTab;
      title: string;
      icon: typeof Calculator;
    }> = [];
    if (permissions.includes('accounting.view')) {
      available.push({id: 'journals', title: 'اسناد', icon: Calculator});
      available.push({
        id: 'fiscal-years',
        title: 'سال مالی',
        icon: CalendarRange,
      });
    }
    if (permissions.includes('reports.view')) {
      available.push({id: 'reports', title: 'گزارش‌ها', icon: BookOpenText});
    }
    return available;
  }, [permissions]);

  const loadOptions = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setOptions(
        await api<AccountingOptions>('/api/accounting/options'),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab) && tabs[0]) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  return (
    <section className="content-page accounting-page">
      <header className="page-heading compact">
        <ContextHelpButton
          help={initialTab === 'reports' ? appHelp.reports : appHelp.accounting}
        />
        <div>
          <p>ثبت دوبل، سال مالی و گزارش‌های متکی بر داده واقعی</p>
          <h1>{initialTab === 'reports' ? 'گزارش‌های حسابداری' : 'حسابداری'}</h1>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => void loadOptions()}
            type="button"
          >
            <RefreshCw aria-hidden />
            {pending ? 'در حال بازخوانی…' : 'بازخوانی'}
          </button>
        </div>
      </header>

      {error ? <div className="form-message error" role="alert">{error}</div> : null}

      <nav aria-label="بخش‌های حسابداری" className="accounting-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={activeTab === tab.id ? 'active' : ''}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <Icon aria-hidden /> {tab.title}
            </button>
          );
        })}
      </nav>

      {pending && options.branches.length === 0 ? (
        <div className="empty-state card">
          در حال دریافت کدینگ حساب‌ها و سال‌های مالی واقعی…
        </div>
      ) : activeTab === 'journals' ? (
        <AccountingJournalPanel
          amountUnit={amountUnit}
          options={options}
          permissions={permissions}
        />
      ) : activeTab === 'fiscal-years' ? (
        <AccountingFiscalYearPanel
          canManage={permissions.includes('accounting.close_period')}
          fiscalYears={options.fiscalYears}
          onChanged={loadOptions}
        />
      ) : (
        <AccountingReportsPanel amountUnit={amountUnit} options={options} />
      )}
    </section>
  );
}
