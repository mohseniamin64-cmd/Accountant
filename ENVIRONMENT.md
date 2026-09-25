# تنظیمات محیط

## وضعیت واقعی ماشین (اصلاح‌شده در 2026-09-25)

کامپیوتر فعلی فقط محیط توسعه و آزمایش است و موقتاً برنامه روی آن اجرا می‌شود؛ هنوز سرور عملیاتی شرکت نداریم. استفاده فعلی در شبکه داخلی است. Cloudflare یا دسترسی بیرونی هنوز راه‌اندازی نشده و صرفاً برای آینده مطرح است. سرویس n8n در Docker جداگانه و برای آزمون اتوماسیون نصب شده؛ وابستگی عملیاتی برنامه حسابداری نیست.

`DATABASE_URL` چیزی برای دانلود نیست؛ رشته اتصال برنامه به PostgreSQL است که از میزبان، پورت، نام پایگاه داده، کاربر و رمز ساخته می‌شود. `BACKUP_ENCRYPTION_KEY` هم کلید جداگانه‌ای است که برای رمزگذاری/رمزگشایی فایل‌های پشتیبان ساخته و هنگام راه‌اندازی تنظیم می‌شود؛ از GitHub دانلود نمی‌شود. محل دقیق فعلی این دو مقدار هنوز در این مستندات تأیید نشده است: ممکن است در تنظیمات محلی برنامه، متغیرهای محیطی Docker/راه‌انداز یا تنظیمات Windows باشد. پیش از نصب مجدد باید از همان محل امن پیدا و نگهداری شوند. اگر کلید بکاپ گم شده باشد، بکاپ‌های رمزگذاری‌شده موجود قابل رمزگشایی نیستند. مقدار هیچ‌یک را در چت یا Git ثبت نکنید.

مقدار واقعی هیچ متغیری در این سند یا Git ذخیره نمی‌شود. `.env` محلی در `.gitignore` است؛ `.env.example` فقط نمونه ساختگی است. پروژه در `server/config.ts` از `dotenv/config` می‌خواند و تنظیمات مسیر نسبی را نسبت به `process.cwd()` resolve می‌کند؛ working directory را ثابت نگه دارید.

| نام | کاربرد | default/code |
|---|---|---|
| `NODE_ENV` | mode | development؛ production script آن را production می‌کند |
| `PORT` | پورت HTTP | config=3000؛ `npm start` اگر خالی باشد 5000؛ `.env.example` قدیمی 4173 |
| `DATABASE_URL` | اتصال PostgreSQL | اجباری؛ مقدار در محل امن |
| `DATABASE_SSL` | TLS PostgreSQL | false نمونه؛ تابع مقصد/gateway معتبر |
| `TRUST_PROXY` | اعتماد proxy headers | false نمونه؛ فقط پشت proxy شناخته‌شده |
| `COOKIE_SECURE` | Secure cookie | false نمونه HTTP LAN؛ برای HTTPS طراحی شود |
| `SESSION_IDLE_MINUTES` | بی‌کاری تا lock | default 30؛ بازه کد 5–1440 |
| `SESSION_ABSOLUTE_HOURS` | عمر مطلق نشست | default 12؛ بازه 1–720 |
| `UPLOADS_DIR` | فایل‌های آپلود | `data/uploads`, relative cwd |
| `BACKUPS_DIR` | فایل‌های محلی backup | `data/backups`, relative cwd |
| `BACKUP_ENCRYPTION_KEY` | key رمز AES-GCM | Base64 32 bytes؛ secret ضروری برای restore |
| `BACKUP_DOCKER_CONTAINER` | fallback Docker برای pg_dump/restore-list | نام container دیتابیس، در صورت نیاز |
| `PG_DUMP_PATH`, `PG_RESTORE_PATH` | مسیر executableهای PostgreSQL | `pg_dump`, `pg_restore` |
| `APP_VERSION` | شناسه نسخه داخل backup | code default `3.0.0` |

## مقدار نمونه ساختگی

`.env.example` در حال حاضر `postgres://diaco:CHANGE_ME@127.0.0.1:5432/diaco` و `BACKUP_ENCRYPTION_KEY=CHANGE_ME_TO_A_LONG_RANDOM_SECRET` دارد؛ این‌ها رمز واقعی نیستند و نباید بدون جایگزینی استفاده شوند. همچنین پورت نمونه 4173 قدیمی است. production script و config source مرجع port هستند.

## نصب مشاهده‌شده

Node v26.3.0, npm 11.16.0؛ Docker container `diaco-postgres` با PostgreSQL 16؛ env file واقعی در root checkout حاضر نبود و process shell فعلی `DATABASE_URL` نداشت. ممکن است launcher محیط جدا داشته باشد؛ این گزارش به معنی نبود secret در کل Windows نیست.

`DATABASE_URL`, SMS token, backup key, cookie/signing keys و DB passwords فقط از password manager/credential manager یا dashboard سرویس دوباره دریافت شوند. هیچ‌گاه خروجی `env`, `docker inspect` یا `git diff` شامل مقدار secret را در چت عمومی نگذارید.
