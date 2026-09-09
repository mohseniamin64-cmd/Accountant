export const chequeEventTypes = ['deposit', 'clear', 'bounce'] as const;

export type ChequeEventType = (typeof chequeEventTypes)[number];
export type ChequeDirection = 'receivable' | 'payable';
export type ChequeStatus =
  | 'received'
  | 'issued'
  | 'deposited'
  | 'cleared'
  | 'bounced'
  | 'returned'
  | 'cancelled';

type TransitionTable = Partial<
  Record<ChequeStatus, Partial<Record<ChequeEventType, ChequeStatus>>>
>;

const transitions: Record<ChequeDirection, TransitionTable> = {
  receivable: {
    received: {
      deposit: 'deposited',
      clear: 'cleared',
    },
    deposited: {
      clear: 'cleared',
      bounce: 'bounced',
    },
    bounced: {
      deposit: 'deposited',
      clear: 'cleared',
    },
  },
  payable: {
    issued: {
      clear: 'cleared',
    },
  },
};

export function nextChequeStatus(
  direction: ChequeDirection,
  status: ChequeStatus,
  eventType: ChequeEventType,
): ChequeStatus | null {
  return transitions[direction][status]?.[eventType] ?? null;
}

export function availableChequeEvents(
  direction: ChequeDirection,
  status: ChequeStatus,
): readonly ChequeEventType[] {
  return Object.keys(transitions[direction][status] ?? {}) as ChequeEventType[];
}
