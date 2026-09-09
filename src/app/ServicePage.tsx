import {ClipboardPlus, RefreshCw, X} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {ServiceOrderPanel} from './ServiceOrderPanel.js';
import {ServiceReceptionPanel} from './ServiceReceptionPanel.js';
import type {ServiceOptions} from './service.types.js';
import './service.css';

interface Props {
  amountUnit: AmountUnit;
  permissions: readonly string[];
}

const emptyOptions: ServiceOptions = {
  branches: [],
  warehouses: [],
  products: [],
  balances: [],
};

export function ServicePage({amountUnit, permissions}: Props) {
  const [options, setOptions] = useState<ServiceOptions>(emptyOptions);
  const [showReception, setShowReception] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canReceive = permissions.includes('service.reception');

  const loadOptions = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setOptions(await api<ServiceOptions>('/api/service/options'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  async function handleChanged(): Promise<void> {
    await loadOptions();
  }

  async function handleCreated(): Promise<void> {
    setRefreshVersion((value) => value + 1);
    setShowReception(false);
    await loadOptions();
  }

  return (
    <section className="content-page service-page">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.service} />
        <div>
          <p>پذیرش، گارانتی، تعمیر، قطعات، هزینه، تحویل و رهگیری</p>
          <h1>خدمات و گارانتی</h1>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => void loadOptions()}
            type="button"
          >
            <RefreshCw aria-hidden /> بازخوانی
          </button>
          {canReceive ? (
            <button
              className={showReception ? 'button secondary' : 'button primary'}
              onClick={() => setShowReception((value) => !value)}
              type="button"
            >
              {showReception ? <X aria-hidden /> : <ClipboardPlus aria-hidden />}
              {showReception ? 'بستن پذیرش' : 'پذیرش دستگاه'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="form-message error" role="alert">{error}</div> : null}
      {pending && options.branches.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">در حال دریافت اطلاعات واقعی خدمات…</div>
        </div>
      ) : (
        <>
          {showReception && canReceive ? (
            <ServiceReceptionPanel
              onCreated={handleCreated}
              options={options}
              pending={pending}
            />
          ) : null}
          <ServiceOrderPanel
            amountUnit={amountUnit}
            onChanged={handleChanged}
            options={options}
            permissions={permissions}
            refreshVersion={refreshVersion}
          />
        </>
      )}
    </section>
  );
}
