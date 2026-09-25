export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'unknown';

interface DeviceInfo {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  userAgentData?: {mobile?: boolean};
}

export function detectDeviceKind(info: DeviceInfo): DeviceKind {
  const ua = info.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) ||
      (/Mac/i.test(info.platform) && info.maxTouchPoints > 1)) return 'tablet';
  if (/iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'mobile' : 'tablet';
  if (info.userAgentData?.mobile === true) return 'mobile';
  if (/Windows NT|Macintosh|X11/i.test(ua)) return 'desktop';
  return 'unknown';
}

export function currentDeviceKind(): DeviceKind {
  if (typeof navigator === 'undefined') return 'unknown';
  return detectDeviceKind(navigator as Navigator & {userAgentData?: {mobile?: boolean}});
}
