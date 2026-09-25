# پایگاه داده

## موتور و اتصال

- PostgreSQL؛ کد با کتابخانه `pg` کار می‌کند.
- آخرین محیط بررسی‌شده: Docker container `diaco-postgres`, image `postgres:16-alpine`, restart `unless-stopped`, network `bridge`.
- host publish فقط `127.0.0.1:5432 -> 5432/tcp` بود.
- volume Docker `diaco-postgres-data` روی `/var/lib/postgresql/data` mount شده؛ host source داخل Docker engine `/var/lib/docker/volumes/diaco-postgres-data/_data`. این مسیر در Windows معمولاً فایل مستقیم قابل کپی نیست.
- نام دیتابیس، کاربر و رمز از env container/`DATABASE_URL` می‌آیند؛ مقدار واقعی در Git یا این سند نیست.

## طرح داده و migration

SQLهای ترتیبی `server/db/migrations/001_core.sql` تا `016_user_security_and_audit.sql` حوزه‌های شرکت/کاربران، حسابداری، تجارت/انبار، تولید/خدمات، خزانه/چک، برگشت، هویت/بایگانی و امنیت/audit را پوشش می‌دهند. دقیق‌ترین schema از خود migrationها استخراج شود؛ README یا جدول حاضر فهرست کامل ستون‌ها نیست.

`server/db/migrate.ts` migrationها را مرتب می‌خواند، advisory lock و checksum استفاده می‌کند و نسخه اجراشده را در `schema_migrations` ثبت می‌کند. تغییر SQL migration اجراشده را ویرایش نکنید؛ migration جبرانی جدید بسازید. برنامه در startup migrationهای pending را اجرا می‌کند. `npm run db:migrate` نیز migration را اجرا می‌کند.

Pool: max 20 per Node process، اتصال timeout 5s، idle 30s. برای چند process مجموع اتصال‌های بالقوه مضرب pool است.

## داده/محفوظات

- GitHub کد/schema/migration را دارد، نه محتوای PostgreSQL.
- App backup از `pg_dump --format=custom --no-owner --no-privileges` می‌گیرد، سپس AES-256-GCM رمز می‌کند.
- `.enc` در مسیر `BACKUPS_DIR` پیش‌فرض `data/backups`; پیوست‌ها در `UPLOADS_DIR` پیش‌فرض `data/uploads`; هیچ‌کدام لزوماً داخل DB dump نیستند.
- Docker volume حاوی live DB است؛ Windows/Docker reset می‌تواند آن را پاک کند. logical dump را مستقل نگه دارید.

## Connection string

فرمت عمومی `postgres://<user>:<password>@<host>:<port>/<database>` است. برای همان Docker نصب‌شده host معمولاً loopback است؛ placeholderهای `.env.example` را با اطلاعات همان نصب عوض کنید. مقدار را در چت/گیت چاپ نکنید. `DATABASE_SSL` طبق گواهی مقصد تعیین شود؛ برای local docker معمولاً false در نمونه است.

## بازیابی

برنامه فعلی endpoint restore کامل ندارد. endpoint verify فایل را hash-check، decrypt موقت و `pg_restore --list` می‌کند؛ temporary dump را پاک می‌کند و `restore_verification` log می‌نویسد. این کار جدول‌ها را در database مقصد restore نمی‌کند.

Restore نیاز دارد: رمزگذاری key اصلی، decrypt به custom dump، PostgreSQL سازگار و DB خالی، `pg_restore` و صحت‌سنجی رکورد/موجودی/تراز. دستور تخریبی روی DB اصلی ممنوع. [BACKUP-RESTORE.md](BACKUP-RESTORE.md) و [Windows recovery](WINDOWS-REINSTALL.md).
