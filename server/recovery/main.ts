import {randomBytes} from 'node:crypto';
import {execFile, execFileSync} from 'node:child_process';
import express, {type Request} from 'express';
import helmet from 'helmet';
import {z} from 'zod';
import {AppError} from '../common/errors.js';
import {pool} from '../db/pool.js';
import {
  listRecoverableAdmins,
  recoverAdminPassword,
} from './service.js';

const LOOPBACK = '127.0.0.1';
const launchToken = randomBytes(32).toString('base64url');
const nonce = randomBytes(18).toString('base64url');
let failures = 0;
let lockedUntil = 0;

function requireWindowsAdministrator(): void {
  if (process.platform !== 'win32') {
    throw new Error('این ابزار فقط روی کامپیوتر سرور ویندوز اجرا می‌شود.');
  }
  const command =
    '[Security.Principal.WindowsPrincipal]::new(' +
    '[Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(' +
    '[Security.Principal.WindowsBuiltInRole]::Administrator)';
  const result = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {encoding: 'utf8', windowsHide: true},
  ).trim();
  if (result.toLowerCase() !== 'true') {
    throw new Error(
      'برای بازیابی مدیر، ترمینال را با گزینه Run as administrator باز کنید.',
    );
  }
}

function isLoopback(request: Request): boolean {
  const address = request.socket.remoteAddress ?? '';
  return address === LOOPBACK || address === '::1' || address === '::ffff:127.0.0.1';
}

function authorize(request: Request): void {
  if (!isLoopback(request)) {
    throw new AppError(403, 'LOCAL_ACCESS_REQUIRED', 'این ابزار فقط روی خود سرور قابل استفاده است.');
  }
  if (request.get('x-recovery-token') !== launchToken) {
    throw new AppError(403, 'RECOVERY_TOKEN_INVALID', 'نشست بازیابی معتبر نیست.');
  }
}

function page(): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>بازیابی مدیر سامانه دیاکو</title>
<style>
:root{font-family:Tahoma,Arial,sans-serif;color:#172033;background:#e4eaf1;color-scheme:light}
*{box-sizing:border-box}body{margin:0;min-width:320px;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#dbe4ee,#edf2f7)}
main{position:relative;width:min(540px,100%);padding:34px;background:#fff;border:1px solid #cbd7e3;border-radius:24px;box-shadow:0 16px 45px #18314b20}
h1{text-align:center;margin:0 0 10px;color:#17314d;font-size:1.45rem}p{text-align:center;color:#647386;line-height:1.9;font-size:.9rem}
label{display:grid;gap:8px;margin-top:18px;text-align:center;font-weight:700;color:#27384a}
input{width:100%;min-height:48px;padding:10px 14px;text-align:center;border:1px solid #b9c8d7;border-radius:11px;background:#f7f9fc;font:inherit}
input:focus,.admin-picker-button:focus-visible,.admin-option:focus-visible{outline:3px solid #3973b744;outline-offset:2px;border-color:#3973b7}
.password-field{position:relative;display:block}
.password-field input{padding-left:58px}
.password-toggle{position:absolute;left:8px;top:7px;width:40px;min-height:34px;margin:0;padding:5px;display:grid;place-items:center;color:#3973b7;background:transparent;border:0;border-radius:8px}
.password-toggle:hover,.password-toggle:focus-visible{background:#eaf2fb}
.password-toggle svg{width:21px;height:21px}
.admin-picker{position:relative;margin-top:18px}
.admin-picker>label{margin-top:0}
.admin-picker-button{width:100%;min-height:52px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:right;border:1px solid #b9c8d7;border-radius:11px;background:#f7f9fc;color:#27384a;font:inherit;cursor:pointer}
.admin-picker-button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.admin-picker-button::after{content:'⌄';color:#3973b7;font-size:1.2rem;line-height:1}
.admin-picker-button[aria-expanded=true]{border-color:#3973b7;background:#fff}
.admin-options{position:absolute;z-index:5;right:0;bottom:calc(100% + 8px);left:0;max-height:min(260px,calc(100vh - 180px));overflow-y:auto;padding:6px;background:#fff;border:1px solid #9eb5c9;border-radius:13px;box-shadow:0 14px 34px #18314b2b}
.admin-option{width:100%;min-height:54px;margin:0;padding:9px 11px;display:grid;gap:2px;text-align:right;color:#27384a;background:#fff;border:0;border-bottom:1px solid #e5ebf1;border-radius:8px;font:inherit;cursor:pointer}
.admin-option:last-child{border-bottom:0}
.admin-option:hover,.admin-option[aria-selected=true]{background:#eaf2fb}
.admin-option strong{font-size:.88rem}
.admin-option small{color:#647386;font-size:.76rem;direction:ltr;text-align:right}
button{width:100%;min-height:48px;margin-top:22px;border:0;border-radius:11px;background:#3973b7;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button:disabled{opacity:.6;cursor:not-allowed}.message{min-height:26px;margin-top:15px;text-align:center;color:#a33}.success{color:#276b59}
.note{padding:12px;border:1px solid #d7e0ea;border-radius:11px;background:#f4f7fa}
@media (max-width:600px){body{padding:12px}main{padding:24px 18px}.admin-options{max-height:230px}}
</style>
</head>
<body>
<main>
<h1>بازیابی مدیر سامانه</h1>
<p class="note">این ابزار فقط روی کامپیوتر سرور و با دسترسی مدیر ویندوز اجرا شده است. اطلاعات مالی و عملیاتی تغییر نمی‌کنند.</p>
<form id="form">
<div class="admin-picker">
<label for="admin-picker-button">حساب مدیر</label>
<input id="admin" type="hidden" required>
<button id="admin-picker-button" type="button" aria-haspopup="listbox" aria-expanded="false" disabled><span>در حال دریافت مدیران…</span></button>
<div id="admin-options" class="admin-options" role="listbox" hidden></div>
</div>
<label>رمز عبور جدید<span class="password-field"><input id="password" type="password" minlength="10" maxlength="256" autocomplete="new-password" required><button class="password-toggle" type="button" data-target="password" aria-label="نمایش رمز عبور" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg></button></span></label>
<label>تکرار رمز عبور جدید<span class="password-field"><input id="confirmation" type="password" minlength="10" maxlength="256" autocomplete="new-password" required><button class="password-toggle" type="button" data-target="confirmation" aria-label="نمایش تکرار رمز عبور" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg></button></span></label>
<button id="submit" type="submit">ثبت رمز جدید و بستن نشست‌های قبلی</button>
</form>
<div id="message" class="message" role="alert"></div>
</main>
<script nonce="${nonce}">
const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
const headers={'x-recovery-token':token};
const admin=document.getElementById('admin');
const adminPickerButton=document.getElementById('admin-picker-button');
const adminOptions=document.getElementById('admin-options');
const form=document.getElementById('form');
const message=document.getElementById('message');
const submit=document.getElementById('submit');
async function parse(response){const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'عملیات ناموفق بود.');return body.data}
document.querySelectorAll('.password-toggle').forEach((toggle)=>{toggle.addEventListener('click',()=>{const field=document.getElementById(toggle.dataset.target);const visible=field.type==='password';field.type=visible?'text':'password';toggle.setAttribute('aria-pressed',String(visible));toggle.setAttribute('aria-label',visible?'پنهان‌کردن رمز عبور':'نمایش رمز عبور')})})
function closeAdminOptions(){adminOptions.hidden=true;adminPickerButton.setAttribute('aria-expanded','false')}
function chooseAdmin(row,option){admin.value=row.id;adminPickerButton.querySelector('span').textContent=row.fullName+' — '+row.username;adminOptions.querySelectorAll('[role=option]').forEach((item)=>item.setAttribute('aria-selected','false'));option.setAttribute('aria-selected','true');closeAdminOptions()}
adminPickerButton.addEventListener('click',()=>{adminOptions.hidden=!adminOptions.hidden;adminPickerButton.setAttribute('aria-expanded',String(!adminOptions.hidden));if(!adminOptions.hidden)adminOptions.querySelector('[role=option]')?.focus()})
document.addEventListener('click',(event)=>{if(!event.target.closest('.admin-picker'))closeAdminOptions()})
async function load(){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);try{const rows=await parse(await fetch('/local-api/admins',{headers,signal:controller.signal}));for(const row of rows){const option=document.createElement('button');option.type='button';option.className='admin-option';option.setAttribute('role','option');option.setAttribute('aria-selected','false');const name=document.createElement('strong');name.textContent=row.fullName;const username=document.createElement('small');username.textContent=row.username;option.append(name,username);option.addEventListener('click',()=>chooseAdmin(row,option));adminOptions.append(option)}if(!rows.length)throw new Error('هیچ مدیر فعالی پیدا نشد.');adminPickerButton.disabled=false;adminPickerButton.querySelector('span').textContent='یک مدیر را انتخاب کنید';submit.disabled=false}catch(error){message.textContent=error.name==='AbortError'?'دریافت اطلاعات مدیر بیش از ۸ ثانیه طول کشید؛ پنجره را ببندید و دوباره از صفحه اصلی اجرا کنید.':error.message;submit.disabled=true;adminPickerButton.disabled=true}finally{clearTimeout(timeout)}}
form.addEventListener('submit',async(event)=>{event.preventDefault();message.className='message';message.textContent='';const password=document.getElementById('password').value;const confirmation=document.getElementById('confirmation').value;if(!admin.value){message.textContent='ابتدا حساب مدیر را انتخاب کنید.';adminPickerButton.focus();return}if(password!==confirmation){message.textContent='رمز و تکرار آن یکسان نیستند.';return}submit.disabled=true;try{const result=await parse(await fetch('/local-api/recover',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({userId:admin.value,password,confirmation})}));message.className='message success';message.textContent='رمز مدیر تغییر کرد و '+result.sessionsInvalidated+' نشست قبلی بسته شد. اکنون این پنجره را ببندید و از صفحه اصلی وارد شوید.';form.reset();admin.value='';adminPickerButton.querySelector('span').textContent='یک مدیر را انتخاب کنید'}catch(error){message.textContent=error.message;submit.disabled=false}});
load();
</script>
</body>
</html>`;
}

async function main(): Promise<void> {
  requireWindowsAdministrator();
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          styleSrc: ["'unsafe-inline'"],
          scriptSrc: [`'nonce-${nonce}'`],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(express.json({limit: '8kb'}));

  app.get('/', (request, response) => {
    if (!isLoopback(request)) {
      response.status(403).end();
      return;
    }
    response.set('cache-control', 'no-store').type('html').send(page());
  });

  app.get('/local-api/admins', async (request, response, next) => {
    try {
      authorize(request);
      response.set('cache-control', 'no-store').json({
        data: await listRecoverableAdmins(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/local-api/recover', async (request, response, next) => {
    try {
      authorize(request);
      const origin = request.get('origin');
      const expectedOrigin = `http://127.0.0.1:${request.socket.localPort}`;
      if (origin !== expectedOrigin) {
        throw new AppError(403, 'INVALID_ORIGIN', 'درخواست بازیابی معتبر نیست.');
      }
      if (lockedUntil > Date.now()) {
        throw new AppError(429, 'RECOVERY_LOCKED', 'تلاش‌های ناموفق زیاد بوده است؛ ۱۵ دقیقه بعد دوباره تلاش کنید.');
      }
      const input = z
        .object({
          userId: z.string().uuid(),
          password: z.string().min(1).max(256),
          confirmation: z.string().min(1).max(256),
        })
        .refine((value) => value.password === value.confirmation, {
          message: 'رمز و تکرار آن یکسان نیستند.',
        })
        .parse(request.body);
      const result = await recoverAdminPassword(input.userId, input.password);
      failures = 0;
      response.set('cache-control', 'no-store').json({data: result});
    } catch (error) {
      failures += 1;
      if (failures >= 5) lockedUntil = Date.now() + 15 * 60_000;
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: express.Response, _next: express.NextFunction) => {
    const status = error instanceof AppError ? error.status : error instanceof z.ZodError ? 422 : 500;
    const message = error instanceof AppError || error instanceof Error
      ? error.message
      : 'خطای پیش‌بینی‌نشده‌ای رخ داد.';
    response.status(status).set('cache-control', 'no-store').json({
      error: {code: error instanceof AppError ? error.code : 'RECOVERY_ERROR', message},
    });
  });

  const server = app.listen(0, LOOPBACK, () => {
    const address = server.address();
    if (!address || typeof address === 'string') return;
    const url = `http://127.0.0.1:${address.port}/#${launchToken}`;
    console.info('ابزار بازیابی مدیر در مرورگر باز شد. این پنجره ترمینال را تا پایان کار نبندید.');
    execFile('explorer.exe', [url], {windowsHide: true}, () => undefined);
  });

  const shutdownTimer = setTimeout(() => server.close(), 10 * 60_000);
  shutdownTimer.unref();
  server.on('close', () => {
    void pool.end().finally(() => process.exit(0));
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  void pool.end().finally(() => process.exit(1));
});
