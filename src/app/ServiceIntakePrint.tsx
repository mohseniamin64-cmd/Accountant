import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import {formatJalaliDateTime} from './jalali-date.js';

export interface ServiceIntakePrintData {
  companyName: string;
  branchName: string;
  orderNumber: string;
  trackingCode: string;
  receivedAt: string;
  customerName: string;
  customerMobile: string | null;
  productName: string;
  serialNumber: string;
  complaint: string;
  intakeCondition: string | null;
  receivedAccessories: string | null;
  warrantyLabel: string;
  paperSize: 'A4' | '80mm';
  printReceipt: boolean;
  printDeviceLabel: boolean;
}

const code39: Readonly<Record<string, string>> = {
  '0': 'nnwwnwnnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn',
  I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww',
  L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww',
  R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn',
  X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '*': 'nwnnwnwnn',
};

function TrackingBarcode({value}: {value: string}) {
  const encoded = ('*' + value.toUpperCase() + '*')
    .split('')
    .filter((character) => code39[character]);
  let x = 0;
  const bars: Array<{x: number; width: number}> = [];
  for (const character of encoded) {
    const pattern = code39[character] as string;
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === 'w' ? 4 : 2;
      if (index % 2 === 0) bars.push({x, width});
      x += width;
    }
    x += 2;
  }
  return (
    <svg aria-label={'بارکد کد پیگیری ' + value} className="service-print-barcode" role="img" viewBox={'0 0 ' + x + ' 52'}>
      {bars.map((bar, index) => (
        <rect height="42" key={index} width={bar.width} x={bar.x} y="0" />
      ))}
    </svg>
  );
}

export function ServiceIntakePrint({
  data,
  onFinished,
}: {
  data: ServiceIntakePrintData;
  onFinished: () => void;
}) {
  useEffect(() => {
    const finish = () => onFinished();
    window.addEventListener('afterprint', finish, {once: true});
    const timer = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [onFinished]);

  return createPortal(
    <div className={'service-print-root service-print-' + data.paperSize.toLowerCase()}>
      <style>{data.paperSize === 'A4' ? '@page { size: A4; margin: 5mm; }' : '@page { margin: 0; }'}</style>
      {data.printReceipt ? (
        <article className="service-print-receipt">
          <header>
            <h1>{data.companyName}</h1>
            <h2>رسید پذیرش خدمات و گارانتی</h2>
          </header>
          <dl>
            <div><dt>شماره پذیرش</dt><dd>{data.orderNumber}</dd></div>
            <div><dt>تاریخ پذیرش</dt><dd>{formatJalaliDateTime(data.receivedAt)}</dd></div>
            <div><dt>شعبه</dt><dd>{data.branchName}</dd></div>
            <div><dt>مشتری</dt><dd>{data.customerName}</dd></div>
            <div><dt>موبایل</dt><dd dir="ltr">{data.customerMobile || '—'}</dd></div>
            <div><dt>محصول</dt><dd>{data.productName}</dd></div>
            <div><dt>سریال</dt><dd dir="ltr">{data.serialNumber}</dd></div>
            <div><dt>وضعیت گارانتی</dt><dd>{data.warrantyLabel}</dd></div>
            <div className="full"><dt>شرح ایراد</dt><dd>{data.complaint}</dd></div>
            <div className="full"><dt>وضعیت ظاهری</dt><dd>{data.intakeCondition || 'ثبت نشده'}</dd></div>
            <div className="full"><dt>متعلقات</dt><dd>{data.receivedAccessories || 'ثبت نشده'}</dd></div>
          </dl>
          <TrackingBarcode value={data.trackingCode} />
          <strong className="service-print-code" dir="ltr">{data.trackingCode}</strong>
          <p>این کد را برای رهگیری وضعیت دستگاه نگهداری کنید.</p>
        </article>
      ) : null}
      {data.printDeviceLabel ? (
        <article className="service-print-label">
          <strong>{data.companyName}</strong>
          <span>خدمات و گارانتی · پذیرش {data.orderNumber}</span>
          <span>{data.productName}</span>
          <b dir="ltr">{data.serialNumber}</b>
          <TrackingBarcode value={data.trackingCode} />
          <b dir="ltr">{data.trackingCode}</b>
        </article>
      ) : null}
    </div>,
    document.body,
  );
}
