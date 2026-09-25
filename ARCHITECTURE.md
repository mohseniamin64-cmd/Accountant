# معماری فنی

Browser -> HTTP(S) / Express -> middleware -> API modules -> PostgreSQL / filesystem / external services

- Frontend: src/ با React و Vite؛ خروجی production در dist/.
- Backend مرجع: server/main.ts؛ server.ts ریشه‌ای legacy است.
- app.ts: ساخت Express، helmet، compression، same-origin، auth و mount routeها.
- config.ts: اعتبارسنجی محیط با zod.
- db/: pool، transaction و migration.
- modules/: bootstrap، auth، users، roles، parties، inventory، products، purchases، sales، production، service، treasury، accounting، audit، backups، settings و SMS.
- recovery/: جریان recovery محلی و UAC.
- data/uploads و data/backups: داده runtime و خارج از Git.

## اجرا و پورت

- توسعه: npm run dev.
- production: npm run build سپس npm start.
- start-production.mjs پیش‌فرض PORT=5000 دارد؛ Express روی 0.0.0.0 listen می‌کند.
- مقدار PORT می‌تواند override شود.
- دامنه، IP عمومی، tunnel، reverse proxy، DNS و سرویس اجرای Windows هنوز ثبت/تأیید نشده‌اند.
- وضعیت میدانی 2026-09-25: Docker `diaco-postgres` از `postgres:16-alpine` با restart=`unless-stopped`، network bridge، bind فقط `127.0.0.1:5432` و named volume `diaco-postgres-data` روی `/var/lib/postgresql/data` روشن بود. volume source داخل Docker engine به `/var/lib/docker/volumes/diaco-postgres-data/_data` می‌رسید.
- در همان snapshot، app روی 3000، 4173 یا 5000 listener نداشت؛ Node v26.3.0/npm 11.16.0 نصب بود. این مشاهده نصب‌های دیگر را توصیف نمی‌کند.
- یک container `n8n` با پورت 5678 هم بود؛ ارتباطش با دیاکو، volume و اهمیت بازیابی آن هنوز از مالک تأیید نشده.

## دیتابیس

Pool با max=20، idle timeout سی ثانیه و connection timeout پنج ثانیه تنظیم شده است. این مقدار سقف کاربر نیست. migrationها در schema_migrations با checksum و advisory lock کنترل می‌شوند؛ mismatch باید عملیات را متوقف کند.

## backup و جریان راه‌اندازی

config خوانده و validate می‌شود؛ migration اجرا می‌شود؛ directoryها ساخته می‌شوند؛ Express بالا می‌آید؛ در production dist سرو می‌شود؛ scheduler backup فعال می‌شود؛ در shutdown backup و سپس pool close می‌شوند. Backup با AES-256-GCM و hash کنترل می‌شود. کلید و مقصد backup باید خارج از Git نگهداری شوند.

## جریان داده

درخواست UI از middleware هویت و same-origin عبور می‌کند، به route/service می‌رسد، تغییرات مهم در transaction انجام می‌شود و عملیات حساس audit می‌گردد. داده ساختاریافته در PostgreSQL و فایل‌ها در filesystem هستند.
