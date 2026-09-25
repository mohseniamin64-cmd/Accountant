import {Factory, GitBranch} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {ProductionBomPanel} from './ProductionBomPanel.js';
import {ProductionOrderPanel} from './ProductionOrderPanel.js';
import type {ProductionOptions} from './production.types.js';
import './production.css';

interface ProductionPageProps {
  amountUnit: AmountUnit;
  permissions: readonly string[];
}

const emptyOptions: ProductionOptions = {
  products: [],
  branches: [],
  warehouses: [],
  boms: [],
};

export function ProductionPage({
  amountUnit,
  permissions,
}: ProductionPageProps) {
  const [tab, setTab] = useState<'orders' | 'boms'>('orders');
  const [options, setOptions] = useState<ProductionOptions>(emptyOptions);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canManage = permissions.includes('production.manage');
  const canPost = permissions.includes('production.post');

  const loadOptions = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setOptions(await api<ProductionOptions>('/api/production/options'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  return (
    <section className="content-page production-page business-forms">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.production} />
        <div>
          <p>فرمول ساخت، برنامه، مراحل، موجودی و بهای تمام‌شده واقعی</p>
          <h1>واحد تولید</h1>
        </div>
      </header>
      {error ? <div className="form-message error" role="alert">{error}</div> : null}
      <nav className="production-tabs" aria-label="بخش‌های واحد تولید">
        <button
          className={tab === 'orders' ? 'active' : ''}
          onClick={() => setTab('orders')}
          type="button"
        >
          <Factory aria-hidden /> دستورهای تولید
        </button>
        <button
          className={tab === 'boms' ? 'active' : ''}
          onClick={() => setTab('boms')}
          type="button"
        >
          <GitBranch aria-hidden /> فرمول‌های ساخت
        </button>
      </nav>
      {pending ? (
        <div className="table-card">
          <div className="empty-state">در حال دریافت اطلاعات واقعی تولید…</div>
        </div>
      ) : tab === 'orders' ? (
        <ProductionOrderPanel
          amountUnit={amountUnit}
          canManage={canManage}
          canPost={canPost}
          onChanged={loadOptions}
          options={options}
        />
      ) : (
        <ProductionBomPanel
          canManage={canManage}
          onChanged={loadOptions}
          options={options}
        />
      )}
    </section>
  );
}
