'use client';
import Link from 'next/link';
import { AccountForm } from './AccountForm';
import { useAccount } from './AccountProvider';
import { AccountProfiles, SessionControls } from './AccountProfiles';
import css from './Account.module.css';

export function AccountGate() {
  const account = useAccount();
  return <main className={css.screen} id="account-gate"><div>
    {account.state.status === 'authenticated' ? <><AccountProfiles /><SessionControls /></> : <AccountForm initialMode="login" />}
    <div className={css.actions}><Link href="/" className={`${css.button} ${css.secondary}`}>العودة إلى نور القرآن</Link></div>
  </div></main>;
}
