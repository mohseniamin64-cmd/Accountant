# استقرار Windows و LAN

## تفاوت آزمایش فعلی و نصب در شرکت‌های دیگر

Cloudflare Tunnel فعلی برای محیط خودمان/آزمایش است و نباید به‌عنوان الگوی اجباری نصب همه شرکت‌ها فرض شود. برای استقرار در شبکه بزرگ‌تر ابتدا توپولوژی و سیاست‌های IT شرکت را بررسی می‌کنیم. داخل LAN معمولاً سرور باید نشانی داخلی پایدار داشته باشد؛ این کار می‌تواند با IP ثابت روی دستگاه یا DHCP reservation در روتر انجام شود (رزرو روتر معمولاً مدیریت را ساده‌تر می‌کند). سپس فایروال فقط پورت برنامه را برای شبکه مجاز باز می‌کند و دیتابیس مستقیم در معرض کاربران شبکه قرار نمی‌گیرد.

برای دسترسی مستقیم از اینترنت، علاوه بر IP عمومی ثابت/قابل‌دسترسی و تنظیم روتر (port forwarding)، باید HTTPS، فایروال، احراز هویت و ارزیابی امنیتی انجام شود؛ این مسیر را بدون بررسی امنیتی فعال نکنید. Cloudflare Tunnel می‌تواند جایگزین بازکردن پورت ورودی باشد، ولی نیاز به سرویس `cloudflared` و تنظیم دامنه/تونل دارد. انتخاب نهایی برای هر شرکت وابسته به روتر، اینترنت، DNS و الزامات امنیتی آن شرکت است.

> **تکمیل وضعیت Cloudflare (2026-09-25):** نوع اتصال تأییدشده Cloudflare Tunnel است؛ بعد از نصب Windows باید `cloudflared` و تنظیمات تونل دوباره نصب/بازیابی شوند. نام تونل و دامنه هنوز ثبت نشده‌اند.

> **اصلاح وضعیت (2026-09-25):** مالک پروژه تأیید کرد Cloudflare Tunnel روی کامپیوتر فعلی استفاده می‌شود. عبارت بعدی که می‌گوید نصب/پیکربندی نشده، قدیمی/نادرست است. پس از نصب ویندوز `cloudflared` و تنظیمات تونل دوباره نصب/اعمال می‌شوند؛ نام تونل و دامنه هنوز ثبت نشده‌اند. واژه‌نامه ساده: `NETWORK-GLOSSARY.md`.

## تفکیک محیط آزمایش از عملیاتی

اصلاح مالک پروژه در 2026-09-25: هنوز سرور عملیاتی شرکت نداریم. همین یک کامپیوتر برای توسعه و آزمایش استفاده می‌شود و فعلاً موقتاً نقش میزبان برنامه را دارد. دسترسی فعلی فقط از شبکه داخلی در نظر گرفته شده؛ Cloudflare برای آینده است و هنوز نصب/پیکربندی نشده. n8n داخل Docker، پروژه آزمایشی جدا برای تست روال‌ها و اتوماسیون‌هاست و جزو نیازمندی‌های استقرار برنامه حسابداری نیست.

## نصب دیده‌شده و هدف

مخزن روی Windows/PowerShell بررسی شد. Node v26.3.0/npm 11.16.0 روی میزبان نصب بود. Docker Desktop، PostgreSQL 16 در container `diaco-postgres`، loopback 5432 و volume `diaco-postgres-data` دیده شد. هنگام این بازبینی، برنامه app روی پورت‌های 3000/4173/5000 بالا نبود. روش اجرای ماندگار (Task Scheduler، Windows service یا console) در مخزن ثبت نشده.

## نصب developer

1. Git و Node/npm سازگار با lockfile نصب شود؛ نسخه Node در `package.json engines` pin نشده است.
2. GitHub clone، سپس `npm ci`.
3. Docker Desktop/PostgreSQL 16 نصب و DB/user/database ایجاد شود؛ رازها از vault محلی وارد شوند.
4. `.env` محلی مطابق ENVIRONMENT.md ساخته شود. نمونه `.env.example` عمداً placeholder دارد و `PORT=4173` آن با production default=5000 و config development=3000 فرق دارد.
5. `npm run build`, بعد `npm start`.
6. اگر داده restore می‌شود، اول DB آزمایشی و [restore procedure](BACKUP-RESTORE.md)؛ startup migration می‌تواند schema را تغییر دهد.

## اجرای production دستی

از ریشه پروژه، با `.env` معتبر:

```powershell
npm ci
npm run build
npm start
```

Production script `NODE_ENV=production` و اگر PORT خالی باشد 5000 می‌گذارد. Server روی تمام interfaceها bind می‌کند. `http://localhost:5000` روی سرور؛ `http://<LAN-IP>:5000` روی clientها. IP واقعی/استاتیک در repo ثبت نشده.

## شبکه

برای LAN، Windows Firewall فقط subnet موردنیاز را برای TCP 5000 allow کند. PostgreSQL 5432 به clientها باز نشود؛ نصب مشاهده‌شده آن را به loopback محدود کرده بود. آدرس را در DHCP reservation/router reserve یا static IP بدون overlap تثبیت کنید و تغییر hostname را با config/DNS/service path تطبیق دهید. Domain/tunnel/public ingress برای این برنامه تأیید نشده؛ عمومی‌کردن port مجاز فرض نشود.

## سرویس پایدار و deployment

مخزن Windows service definition، compose file، installer یا Task Scheduler task پروژه ندارد. برای startup خودکار باید یک روش واحد انتخاب و مستند شود، با working directory ثابت (برای `data/uploads`, `data/backups`)، env امن، restart policy کنترل‌شده، log rotation و دسترسی service account حداقلی. Docker container DB restart policy دارد؛ برنامه Node ندارد که در snapshot دیده شود.

`n8n` روی 5678 یک سرویس جدا مشاهده شد؛ با برنامه یکی فرض نکنید. مالکیت، integrations و داده‌اش از سؤال مالک باید تعیین شود.
