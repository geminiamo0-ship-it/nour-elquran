import type { AccountLearner, AccountSession } from './api';
export type AccountState =
  | { status: 'disabled' | 'checking' | 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; session: AccountSession; learners: readonly AccountLearner[] };

/** A lease changes before logout/refresh/login. Old asynchronous results cannot restore an old account. */
export function canApplyResult(currentLease: number, requestLease: number): boolean {
  return currentLease === requestLease;
}
