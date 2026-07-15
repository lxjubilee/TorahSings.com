import type { Metadata } from 'next';

import { AccountPanel } from '@/components/account/AccountPanel';
import { PageHero } from '@/components/system/PageHero';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your Jubilee Account — subscription status, downloads, and the resources kit.',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <>
      <PageHero eyebrow="Jubilee Account" title="Your account">
        One sign-in, good across the whole ecosystem. Whatever you have unlocked here follows you everywhere else.
      </PageHero>

      <div className={`wrap ${styles.page}`}>
        <AccountPanel />
      </div>
    </>
  );
}
