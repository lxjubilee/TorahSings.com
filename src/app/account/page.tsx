import type { Metadata } from 'next';

import { AccountPanel } from '@/components/account/AccountPanel';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your Jubilee Account — subscription status, downloads, and the resources kit.',
  robots: { index: false, follow: false },
};

/**
 * The account console owns its own hero and column width (JubiLujah's /account
 * caps at 680px, far narrower than the library's --wrap), so this page renders
 * it full-bleed rather than inside the site's PageHero + .wrap shell.
 */
export default function AccountPage() {
  return <AccountPanel />;
}
