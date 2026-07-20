import type { Metadata } from 'next';

import { LikedGrid } from '@/components/account/LikedGrid';
import { PageHero } from '@/components/system/PageHero';

export const metadata: Metadata = {
  title: 'Liked albums',
  description: 'The albums you have liked.',
  robots: { index: false, follow: false },
};

export default function LikedPage() {
  return (
    <>
      <PageHero eyebrow="Your favorites" title="Liked albums">
        Every album you like is kept here, ready to play. Your favorites travel with your Jubilee Account.
      </PageHero>

      <div className="wrap" style={{ paddingBottom: 72 }}>
        <LikedGrid />
      </div>
    </>
  );
}
