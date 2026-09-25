import {ArrowRight, ShieldCheck} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {ServiceReceptionPanel} from './ServiceReceptionPanel.js';
import type {ServiceOptions} from './service.types.js';
import './service.css';

interface Props {
  companyName: string;
  permissions: readonly string[];
}

const emptyOptions: ServiceOptions = {
  branches: [],
  warehouses: [],
  products: [],
  balances: [],
};

export function ServiceReceptionPage({companyName, permissions}: Props) {
  const navigate = useNavigate();
  const [options, setOptions] = useState<ServiceOptions>(emptyOptions);
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

  return (
    <section className="content-page service-page service-reception-page">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.serviceReception} />
        <div>
          <p>ثبت مستند دستگاه فروخته‌شده، همراه با استعلام واقعی فروش و گارانتی</p>
          <h1>پذیرش دستگاه</h1>
        </div>
        <button className="button secondary" onClick={() => navigate('/service')} type="button">
          <ArrowRight aria-hidden /> بازگشت به میز خدمات
        </button>
      </header>

      {!canReceive ? (
        <div className="form-message error" role="alert">
          شما مجوز پذیرش دستگاه را ندارید.
        </div>
      ) : (
        <div className="service-reception-layout">
          <main className="service-reception-main">
            <div className="service-reception-steps" aria-label="مراحل ثبت پذیرش">
              <div className="service-reception-step">
                <strong>۱</strong>
                <span>استعلام سریال</span>
                <small>شناسه فروش دستگاه را بررسی کنید</small>
              </div>
              <div className="service-reception-step">
                <strong>۲</strong>
                <span>بررسی اطلاعات واقعی</span>
                <small>فروش، مشتری و وضعیت گارانتی نمایش داده می‌شود</small>
              </div>
              <div className="service-reception-step">
                <strong>۳</strong>
                <span>ثبت پذیرش</span>
                <small>ایراد و وضعیت هنگام تحویل را ثبت کنید</small>
              </div>
            </div>

            {error ? <div className="form-message error" role="alert">{error}</div> : null}
            {pending && options.branches.length === 0 ? (
              <div className="table-card"><div className="empty-state">در حال دریافت اطلاعات واقعی پذیرش…</div></div>
            ) : (
              <ServiceReceptionPanel
                companyName={companyName}
                onCreated={loadOptions}
                options={options}
                pending={pending}
              />
            )}
          </main>

          <aside className="service-reception-sidecard" aria-label="راهنمای کوتاه پذیرش">
            <ShieldCheck aria-hidden />
            <div>
              <h2>پذیرش قابل پیگیری</h2>
              <p>پس از ثبت واقعی، کد پیگیری، چاپ رسید یا برچسب و ارسال پیامک براساس تنظیمات سامانه انجام می‌شود.</p>
            </div>
            <ul>
              <li><span>۱</span><div>بارکدخوان در موبایل از دوربین و در رایانه مانند صفحه‌کلید عمل می‌کند.</div></li>
              <li><span>۲</span><div>شرح ایراد الزامی است؛ وضعیت ظاهری و متعلقات برای جلوگیری از اختلاف ثبت می‌شوند.</div></li>
              <li><span>۳</span><div>عکس الزامی نیست و نبود دوربین مانع ثبت پذیرش نخواهد شد.</div></li>
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}
