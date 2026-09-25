import {Eye, EyeOff, LockKeyhole} from 'lucide-react';
import {useId, useState} from 'react';

interface PasswordFieldProps {
  label: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  title?: string;
  showLockIcon?: boolean;
}

export function PasswordField({
  label,
  name,
  required = false,
  autoComplete,
  minLength,
  maxLength,
  pattern,
  title,
  showLockIcon = false,
}: PasswordFieldProps) {
  const inputId = useId();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={showLockIcon ? 'field password-field password-field--with-leading-icon' : 'field password-field'}>
      <label htmlFor={inputId}>
        {label}
        {required ? <b aria-label="الزامی"> *</b> : null}
      </label>
      <div className="field-control">
        <input
          id={inputId}
          name={name}
          type={isVisible ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          pattern={pattern}
          title={title}
          dir="ltr"
        />
        {showLockIcon ? <LockKeyhole className="field-leading-icon" aria-hidden /> : null}
        <button
          aria-controls={inputId}
          aria-label={isVisible ? 'پنهان‌کردن رمز عبور' : 'نمایش رمز عبور'}
          aria-pressed={isVisible}
          className="field-icon-button"
          onClick={() => setIsVisible((visible) => !visible)}
          title={isVisible ? 'پنهان‌کردن رمز عبور' : 'نمایش رمز عبور'}
          type="button"
        >
          {isVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      </div>
    </div>
  );
}
