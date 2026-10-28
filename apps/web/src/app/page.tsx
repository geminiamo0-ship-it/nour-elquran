import { redirect } from 'next/navigation';

/** Preserve the approved standalone V3 design and all native interactions exactly. */
export default function HomePage() {
  redirect('/landing-approved-v3.html');
}
