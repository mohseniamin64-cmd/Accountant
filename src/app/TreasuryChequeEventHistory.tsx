import {useEffect, useState} from 'react';
import {api, errorMessage} from './api.js';

interface TreasuryChequeEvent {
  id: string;
  eventType: 'deposit' | 'clear' | 'bounce';
  eventDate: string;
  fromStatus: string;
  toStatus: string;
  notes: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversalDate: string | null;
  reversalReason: string | null;
  bankName: string | null;
  createdByName: string;
  reversedByName: string | null;
  journalEntryNumber: string | null;
  reversalJournalEntryNumber: string | null;
}

interface TreasuryChequeEventHistoryProps {
  chequeId: string;
  chequeNumber: string;
}

const eventTitles: Record<TreasuryChequeEvent['eventType'], string> = {
  deposit: '\u0648\u0627\u06af\u0630\u0627\u0631\u06cc \u0628\u0647 \u0628\u0627\u0646\u06a9',
  clear: '\u0648\u0635\u0648\u0644 / \u067e\u0627\u0633 \u0686\u06a9',
  bounce: '\u0628\u0631\u06af\u0634\u062a \u0627\u0632 \u0628\u0627\u0646\u06a9',
};

const statusTitles: Record<string, string> = {
  received: '\u062f\u0631\u06cc\u0627\u0641\u062a\u200c\u0634\u062f\u0647',
  issued: '\u0635\u0627\u062f\u0631\u0634\u062f\u0647',
  deposited: '\u0648\u0627\u06af\u0630\u0627\u0631\u0634\u062f\u0647 \u0628\u0647 \u0628\u0627\u0646\u06a9',
  cleared: '\u0648\u0635\u0648\u0644\u200c\u0634\u062f\u0647',
  bounced: '\u0628\u0631\u06af\u0634\u062a\u06cc',
  returned: '\u0628\u0627\u0632\u06af\u0634\u062a\u200c\u062f\u0627\u062f\u0647\u200c\u0634\u062f\u0647',
  cancelled: '\u0644\u063a\u0648\u0634\u062f\u0647',
};

function formatDate(value: string): string {
  const normalized = value.slice(0, 10);
  const date = new Date(normalized + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

function statusTitle(status: string): string {
  return statusTitles[status] ?? status;
}

export function TreasuryChequeEventHistory({
  chequeId,
  chequeNumber,
}: TreasuryChequeEventHistoryProps) {
  const [events, setEvents] = useState<readonly TreasuryChequeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setLoading(true);
    setLoadError(null);

    api<TreasuryChequeEvent[]>(
      '/api/treasury/cheques/' + encodeURIComponent(chequeId) + '/events',
      {signal: controller.signal},
    )
      .then((result) => {
        setEvents(result);
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setLoadError(errorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [chequeId]);

  return (
    <section
      className="cheque-event-history"
      aria-label={
        '\u0633\u0627\u0628\u0642\u0647 \u0639\u0645\u0644\u06cc\u0627\u062a \u0686\u06a9 ' + chequeNumber
      }
    >
      <div className="cheque-event-history-heading">
        <strong>{'\u0633\u0627\u0628\u0642\u0647 \u0639\u0645\u0644\u06cc\u0627\u062a \u0686\u06a9'}</strong>
        <span>
          {'\u0634\u0645\u0627\u0631\u0647 '}
          <b dir="ltr">{chequeNumber}</b>
        </span>
      </div>

      {loading ? (
        <div className="cheque-history-message">
          {'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0633\u0627\u0628\u0642\u0647\u2026'}
        </div>
      ) : loadError ? (
        <div className="cheque-history-message error" role="alert">
          {loadError}
        </div>
      ) : events.length === 0 ? (
        <div className="cheque-history-message">
          {'\u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u0686\u06a9 \u0647\u0646\u0648\u0632 \u0639\u0645\u0644\u06cc\u0627\u062a \u062b\u0627\u0646\u0648\u06cc\u0647\u200c\u0627\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.'}
        </div>
      ) : (
        <ol className="cheque-event-timeline">
          {events.map((event) => (
            <li
              className={event.reversedAt ? 'is-reversed' : undefined}
              key={event.id}
            >
              <div className="cheque-event-timeline-title">
                <strong>{eventTitles[event.eventType]}</strong>
                <span>{formatDate(event.eventDate)}</span>
              </div>
              <div className="cheque-event-transition">
                <span>{statusTitle(event.fromStatus)}</span>
                <span aria-hidden="true">{'\u2190'}</span>
                <span>{statusTitle(event.toStatus)}</span>
              </div>
              <div className="cheque-event-meta">
                <span>
                  {'\u062b\u0628\u062a\u200c\u06a9\u0646\u0646\u062f\u0647: '}
                  {event.createdByName}
                </span>
                {event.bankName ? (
                  <span>{'\u0628\u0627\u0646\u06a9: ' + event.bankName}</span>
                ) : null}
                {event.journalEntryNumber ? (
                  <span>
                    {'\u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc: '}
                    <b dir="ltr">{event.journalEntryNumber}</b>
                  </span>
                ) : null}
              </div>
              {event.notes ? (
                <p className="cheque-event-note">{event.notes}</p>
              ) : null}
              {event.reversedAt ? (
                <div className="cheque-event-reversal">
                  <strong>{'\u0627\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0628\u0631\u06af\u0634\u062a \u062f\u0627\u062f\u0647 \u0634\u062f\u0647 \u0627\u0633\u062a.'}</strong>
                  <span>
                    {event.reversalDate ? formatDate(event.reversalDate) : '\u2014'}
                    {event.reversedByName ? ' \u2022 ' + event.reversedByName : ''}
                  </span>
                  {event.reversalReason ? <p>{event.reversalReason}</p> : null}
                  {event.reversalJournalEntryNumber ? (
                    <span>
                      {'\u0633\u0646\u062f \u0645\u0639\u06a9\u0648\u0633: '}
                      <b dir="ltr">{event.reversalJournalEntryNumber}</b>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
