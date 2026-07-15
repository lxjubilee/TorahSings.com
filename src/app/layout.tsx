import type { Metadata, Viewport } from 'next';
import { Orbitron, Spline_Sans_Mono } from 'next/font/google';

import { AudioProvider } from '@/components/audio/AudioProvider';
import { NowPlayingBar } from '@/components/audio/NowPlayingBar';
import { IntroModal } from '@/components/intro/IntroModal';
import { IntroProvider } from '@/components/intro/IntroProvider';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Particles } from '@/components/system/Particles';
import { JubileeAccountProvider } from '@/lib/jubilee-account';

import './globals.css';

/* Brand wordmark — Orbitron, the JubiLujah "logo" face. */
const orbitron = Orbitron({
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cosmic',
});

/* Labels, eyebrows, meta, prices-as-data. UI + reading text runs in the
   system Segoe UI stack (see globals.css) to match JubiLujah — no web font. */
const splineSansMono = Spline_Sans_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://torahsings.com'),
  title: {
    default: 'Torah Sings — The stars sang. The angels sang. Now you can hear it.',
    template: '%s · Torah Sings',
  },
  description:
    'There are songs hidden inside the Scriptures. Taken symbol by symbol, the Paleo-Hebrew text surfaces melodies that read as sung from the angelic perspective. Not canon — something to consider.',
  openGraph: {
    title: 'Torah Sings',
    description: 'Fragments of a song scattered through the Scriptures — now unveiled.',
    siteName: 'Torah Sings',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0c1226',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [orbitron.variable, splineSansMono.variable].join(' ');

  return (
    <html lang="en" className={fontVars}>
      <body>
        <Particles />
        <JubileeAccountProvider>
          <AudioProvider>
            <IntroProvider>
              <SiteHeader />
              <main>{children}</main>
              <SiteFooter />
              <NowPlayingBar />
              <IntroModal />
            </IntroProvider>
          </AudioProvider>
        </JubileeAccountProvider>
      </body>
    </html>
  );
}
