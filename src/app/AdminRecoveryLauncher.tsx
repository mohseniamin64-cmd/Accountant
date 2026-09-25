import {
  CheckCircle2,
  KeyRound,
  MonitorCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';
import {errorMessage, postJson} from './api.js';

interface RecoveryLaunchResult {
  launched: boolean;
}

type RecoveryStep = 1 | 2 | 3;

function isServerBrowser(): boolean {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
    window.location.hostname.toLowerCase(),
  );
}

export function AdminRecoveryLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<RecoveryStep>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const localBrowser = isServerBrowser();

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) setIsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [isOpen, pending]);

  function open(): void {
    setStep(1);
    setError(null);
    setIsOpen(true);
  }

  function close(): void {
    if (!pending) setIsOpen(false);
  }

  async function launch(): Promise<void> {
    if (pending || !localBrowser) return;
    setPending(true);
    setError(null);
    try {
      const result = await postJson<RecoveryLaunchResult>(
        '/api/recovery/launch',
        {},
      );
      if (!result.launched) {
        throw new Error('ابزار بازیابی اجرا نشد.');
      }
      setStep(3);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const dialog = isOpen
    ? (
        <div
          className="recovery-wizard-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            aria-labelledby={titleId}
            aria-modal="true"
            className="recovery-wizard"
            role="dialog"
          >
            <header className="recovery-wizard-header">
              <div>
                <span>مرحله {step} از ۳</span>
                <h2 id={titleId}>بازیابی مدیر اصلی</h2>
              </div>
              <button
                aria-label="بستن پنجره بازیابی"
                className="recovery-wizard-close"
                disabled={pending}
                onClick={close}
                ref={closeRef}
                type="button"
              >
                <X aria-hidden />
              </button>
            </header>

            <div
              aria-label={'مرحله ' + step + ' از ۳'}
              className="recovery-wizard-progress"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={step}
            >
              {[1, 2, 3].map((item) => (
                <span className={item <= step ? 'active' : ''} key={item} />
              ))}
            </div>

            {step === 1 ? (
              <div className="recovery-wizard-step">
                <div className="recovery-wizard-icon">
                  <MonitorCheck aria-hidden />
                </div>
                <h3>ابتدا روی کامپیوتر سرور باشید</h3>
                <p>
                  به دلایل امنیتی، بازیابی مدیر اصلی از موبایل یا کامپیوترهای
                  دیگر شبکه اجرا نمی‌شود.
                </p>
                <div
                  className={
                    localBrowser
                      ? 'recovery-wizard-status success'
                      : 'recovery-wizard-status error'
                  }
                >
                  {localBrowser
                    ? 'این صفحه روی خود سرور باز شده و آماده ادامه است.'
                    : 'این صفحه روی سرور باز نشده است؛ بازیابی را از آدرس 127.0.0.1 روی سرور انجام دهید.'}
                </div>
                <button
                  className="button primary wide"
                  disabled={!localBrowser}
                  onClick={() => setStep(2)}
                  type="button"
                >
                  ادامه
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="recovery-wizard-step">
                <div className="recovery-wizard-icon">
                  <ShieldCheck aria-hidden />
                </div>
                <h3>اجازه اجرای امن ویندوز</h3>
                <p>
                  پس از زدن دکمه زیر، پنجره تأیید ویندوز نمایش داده می‌شود.
                  گزینه «Yes» را انتخاب کنید تا ابزار امن بازیابی باز شود.
                </p>
                {error ? (
                  <div className="form-message error" role="alert">
                    {error}
                  </div>
                ) : null}
                <div className="recovery-wizard-actions">
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={() => setStep(1)}
                    type="button"
                  >
                    مرحله قبل
                  </button>
                  <button
                    className="button primary"
                    disabled={pending}
                    onClick={() => void launch()}
                    type="button"
                  >
                    {pending ? 'در حال اجرا…' : 'اجرای ابزار بازیابی'}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="recovery-wizard-step">
                <div className="recovery-wizard-icon success">
                  <CheckCircle2 aria-hidden />
                </div>
                <h3>پنجره امن بازیابی باز شد</h3>
                <ol>
                  <li>حساب مدیر اصلی را انتخاب کنید.</li>
                  <li>رمز جدید را دو بار وارد کنید.</li>
                  <li>ثبت رمز جدید را بزنید تا نشست‌های قبلی بسته شوند.</li>
                  <li>به این صفحه برگردید و با رمز جدید وارد شوید.</li>
                </ol>
                <button className="button primary wide" onClick={close} type="button">
                  متوجه شدم
                </button>
              </div>
            ) : null}
          </section>
        </div>
      )
    : null;

  return (
    <>
      <button
        aria-haspopup="dialog"
        className="auth-recovery-launch"
        onClick={open}
        ref={triggerRef}
        type="button"
      >
        <KeyRound aria-hidden />
        <span>شروع بازیابی گرافیکی</span>
      </button>
      {dialog}
    </>
  );
}
