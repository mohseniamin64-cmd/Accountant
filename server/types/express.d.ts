import type {AuthenticatedUser} from '../../shared/contracts.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth: AuthenticatedUser | null;
      sessionId: string | null;
    }
  }
}

export {};
