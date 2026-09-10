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
main{width:min(540px,100%);padding:34px;background:#fff;border:1px solid #cbd7e3;border-radius:24px;box-shadow:0 16px 45px #18314b20}
h1{text-align:center;margin:0 0 10px;color:#17314d;font-size:1.45rem}p{text-align:center;color:#647386;line-height:1.9;font-size:.9rem}
label{display:grid;gap:8px;margin-top:18px;text-align:center;font-weight:700;color:#27384a}
select,input{width:100%;min-height:48px;padding:10px 14px;text-align:center;border:1px solid #b9c8d7;border-radius:11px;background:#f7f9fc;font:inherit}
button{width:100%;min-height:48px;margin-top:22px;border:0;border-radius:11px;background:#3973b7;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button:disabled{opacity:.6;cursor:not-allowed}.message{min-height:26px;margin-top:15px;text-align:center;color:#a33}.success{color:#276b59}
.note{padding:12px;border:1px solid #d7e0ea;border-radius:11px;background:#f4f7fa}
</style>
</head>
<body>
<main>
<h1>بازیابی مدیر سامانه</h1>
<p class="note">این ابزار فقط روی کامپیوتر سرور و با دسترسی مدیر ویندوز اجرا شده است. اطلاعات مالی و عملیاتی تغییر نمی‌کنند.</p>
<form id="form">
<label>حساب مدیر<select id="admin" required></select></label>
<label>رمز عبور جدید<input id="password" type="password" minlength="10" maxlength="256" autocomplete="new-password" required></label>
<label>تکرار رمز عبور جدید<input id="confirmation" type="password" minlength="10" maxlength="256" autocomplete="new-password" required></label>
<button id="submit" type="submit">ثبت رمز جدید و بستن نشست‌های قبلی</button>
</form>
<div id="message" class="message" role="alert"></div>
</main>
<script nonce="${nonce}">
const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
const headers={'x-recovery-token':token};
const admin=document.getElementById('admin');
const form=document.getElementById('form');
const message=document.getElementById('message');
const submit=document.getElementById('submit');
async function parse(response){const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'عملیات ناموفق بود.');return body.data}
async function load(){try{const rows=await parse(await fetch('/local-api/admins',{headers}));for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.fullName+' — '+row.username;admin.append(option)}if(!rows.length)throw new Error('هیچ مدیر فعالی پیدا نشد.')}catch(error){message.textContent=error.message;submit.disabled=true}}
form.addEventListener('submit',async(event)=>{event.preventDefault();message.className='message';message.textContent='';const password=document.getElementById('password').value;const confirmation=document.getElementById('confirmation').value;if(password!==confirmation){message.textContent='رمز و تکرار آن یکسان نیستند.';return}submit.disabled=true;try{const result=await parse(await fetch('/local-api/recover',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({userId:admin.value,password,confirmation})}));message.className='message success';message.textContent='رمز مدیر تغییر کرد و '+result.sessionsInvalidated+' نشست قبلی بسته شد. اکنون این پنجره را ببندید و از صفحه اصلی وارد شوید.';form.reset()}catch(error){message.textContent=error.message;submit.disabled=false}});
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
