import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminShell } from '@/components/admin/AdminShell';
import { PageHero } from '@/components/system/PageHero';

/** Applies to every /admin route — none of the console belongs in an index. */
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Restricted" title="Operations Console">
        Account, catalogue, and production administration for Torah Sings.
      </PageHero>

      <div className="wrap">
        <AdminShell>{children}</AdminShell>
      </div>
    </>
  );
}
