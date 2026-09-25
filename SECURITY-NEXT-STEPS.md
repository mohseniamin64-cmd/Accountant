# امنیت: انجام‌شده و کارهای باقی‌مانده

## اصول مصوب

- هیچ password, API key, token, private key, cookie, recovery code یا secret زنده را در GitHub، issue، screenshot یا مستند ثبت نکنید؛ مخزن در زمان نگارش عمومی است.
- رازهای موجود در چت یا تنظیمات قدیمی را در این فایل تکرار نکنید. پیام: «این Credential باید از محل امن یا Dashboard مربوطه دوباره دریافت شود».
- اگر secret وارد Git history شده، حذف فایل/commit به تنهایی کافی نیست: ابتدا از issuer لغو و rotate، سپس تاریخچه و cacheها با برنامه مدیریت شود.
- کمترین دسترسی لازم؛ رمزهای جدا برای DB/app/user؛ owner اصلی و recovery محلی؛ audit بدون ذخیره رمز و token.

## شواهد امنیتی فعلی

- فایل `.env` واقعی در repository نیست؛ `.env.example` فقط placeholder دارد. `.gitignore` `.env*` را نادیده می‌گیرد و `.env.example` را مستثنا می‌کند.
- الگویابی heuristic روی 11 commit فعلی و مسیرهای tracked، 0 فایل دارای الگوی Secret پیدا کرد؛ نام `.env.example` تنها فایل شبیه config در تاریخچه است. این جایگزین Gitleaks/secret scanner کامل نیست.
- Backup با AES-256-GCM رمز می‌شود و key لازم 32 بایت Base64 است؛ کلید جدا از backup ذخیره شود.
- PostgreSQL در میزبان مشاهده‌شده فقط روی loopback 127.0.0.1:5432 publish شده بود. اپ production روی 0.0.0.0 است، پس port برنامه در LAN باید با Windows Firewall محدود شود.
- HTTPS/TLS، دامنه عمومی، tunnel، reverse proxy و firewall rule واقعی از repository قابل تأیید نیست. این محیط در زمان مشاهده هیچ listener برنامه‌ای نداشت.
- حساب owner یکتا، retention جداگانه audit security/financial، و restore امن هنوز نیازمند پیاده‌سازی/آزمون‌اند.

## پیش از production و پاک‌کردن سیستم

1. GitHub را بر اساس سیاست مالک Private کنید یا دسترسی را محدود کنید؛ سورس عمومی یعنی کد برای همه قابل دریافت است. اگر تغییر visibility می‌دهید، credential push را از دست ندهید.
2. Secret scanner واقعی روی worktree و Git history کامل اجرا شود. هر secret واقعی فوراً revoke/rotate شود؛ مقدار در گزارش درج نشود.
3. `.env` با ACL سیستم‌عامل محدود، خارج از backup عمومی/Git؛ `DATABASE_URL` و backup key در Password Manager/Secret Manager.
4. TLS و cookie policy با استقرار واقعی هم‌راستا شود. `COOKIE_SECURE`/`TRUST_PROXY` را پشت proxy فقط پس از طراحی معتبر فعال کنید؛ برای رفع خطا کورکورانه تغییر ندهید.
5. DB port در LAN بسته بماند؛ فقط app port 5000 برای subnet نیازمند از firewall مجاز شود. IP رزرو/ثابت و router conflict بررسی شود.
6. owner bootstrap در تمام routeهای تغییر role/status/delete/password آزمایش و محافظت شود؛ reset فراموشی رمز فقط از recovery محلی.
7. نشست لغوشده، lockout، brute force/rate limit، CSRF/origin, session cookie, permission boundaries و audit coverage با test مستقل بررسی شود.
8. backup خارج از میزبان و key جداگانه؛ restore واقعی روی DB خالی؛ uploads همراه؛ recovery runbook ثبت شود.
9. retention/rotation برای logs, audit, SMS/device secrets, backups و Docker volume تعیین شود.
10. ظرفیت 50–100 user و حمله/ترتیب concurrency در محیط آزمایشی بررسی شود؛ 20 connection pool ضمانت کاربر نیست.

## اقلامی که نباید عمومی شوند

مقادیر `.env`, `DATABASE_URL`, DB password/user credential, backup key، SMS token، recovery link/code، session cookie، فایل `.enc`, uploads، DB volume dump، logهای حاوی PII، شماره‌ها/نام مشتریان و کلید امضای TLS. اگر نمونه لازم است، فقط placeholder ساختگی.
