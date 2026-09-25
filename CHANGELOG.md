# CHANGELOG

## Project recovery documentation — 2026-09-25

- Added root-level roadmap, architecture, decision log, implementation timeline, troubleshooting, runbook, Windows recovery, security follow-ups, database, deployment, backup/restore, environment, and API reference.
- Recorded the observed Docker PostgreSQL 16 volume and local backup folder without storing their contents or credentials.
- Explicitly recorded that current backup verification is not a full restore, that `.env.example` uses a stale 4173 port, and that the app was not listening during inspection.
- Repository was public per owner statement. A heuristic secret-pattern scan over 11 Git commits found no matches; comprehensive secret scanning and isolated restore remain open.
- Initial documentation package was pushed to `main` as `3625eb3563714a5dbd20fd818b69106a9df32320`; follow-up corrections expand the decision register and conversation errors. Runtime restore gap and owner-supplied installation details remain open. See [PROJECT_STATUS](PROJECT_STATUS.md) and [WINDOWS-REINSTALL](WINDOWS-REINSTALL.md).

## مستندات — 2026-09-25

- افزودن START_HERE و دفتر تصمیم‌های دسته‌بندی‌شده، قواعد، رودمپ و خلاصه تحویل.
- حفظ کامل دفتر وضعیت قبلی در docs/archive و جایگزینی مرجع جاری بدون درصد پیشرفت حدسی.
- ثبت طرح آینده ابزار مستقل داده‌سازی/تست ظرفیت و اصلاحیه رمز مالک؛ بدون تغییر رفتار برنامه یا دیتابیس.
- نتیجه‌های نسخه‌های زیر تاریخی هستند؛ وضعیت اجرا و امنیت امروز باید از مستندات جاری و کد بررسی شود.

## [2.5.1] - 2026-08-12

### 🐛 برطرف‌سازی مشکلات و باگ‌ها (Bug Fixes)
- **رفع مشکل گیرکردن در صفحه ورود (Login Redirect Issue):**
  - برطرف‌سازی مسدود شدن کوکی‌های نشست (`diaco_session`) در محیط‌های پیش‌نمایش و iframe آی‌دی‌ای به دلیل محدودیت‌های امنیت مروری (`SameSite=Strict` / `HttpOnly`).
  - حذف `window.location.reload()` غیرضروری پس از ورود موفق و انتقال مدیریت نشست به حافظه پویا (`sessionStorage` و `localStorage`) جهت حفظ اتصال بدون بازنشانی صفحه.
  - پشتیبانی کامل سرور از هدر استاندارد `Authorization: Bearer <token>` در کنار کوکی‌ها برای سازگاری همزمان در محیط پیش‌نمایش آی‌دی‌ای و شبکه داخلی (`http://192.168.1.100:3000`).

### 🔒 امنیت و احراز هویت (Security & Auth)
- عدم ارسال اطلاعات حساس ماند `passwordHash` به مرورگر در تمام پاسخ‌های API.
- پاک‌سازی کامل توکن در `sessionStorage` و `localStorage` هنگام خروج صریح یا خروج خودکار پس از ۱۰ دقیقه بی‌کاری.
- حفظ قفل ۱۵ دقیقه‌ای حساب در صورت ثبت ۵ ورود ناموفق متوالی.
