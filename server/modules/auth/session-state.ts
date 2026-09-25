export const ONLINE_WINDOW_MS = 120_000;

export function isSessionOnline(
  lastSeenAt: Date | string | null,
  now = new Date(),
): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  return Number.isFinite(seen) && now.getTime() - seen <= ONLINE_WINDOW_MS;
}

export function describeDevice(userAgent: string | null | undefined): string {
  const source = userAgent ?? '';
  const browser = /Edg\//i.test(source)
    ? 'Edge'
    : /Firefox\//i.test(source)
      ? 'Firefox'
      : /Chrome\//i.test(source)
        ? 'Chrome'
        : /Safari\//i.test(source)
          ? 'Safari'
          : 'مرورگر ناشناس';
  const device = /Android/i.test(source)
    ? 'Android'
    : /iPhone|iPad/i.test(source)
      ? 'iOS'
      : /Windows/i.test(source)
        ? 'Windows'
        : /Macintosh|Mac OS X/i.test(source)
          ? 'macOS'
          : /Linux/i.test(source)
            ? 'Linux'
            : 'دستگاه ناشناس';
  return browser + ' / ' + device;
}
