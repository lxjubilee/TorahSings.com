'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useJubileeAccount } from '@/lib/jubilee-account';
import styles from './SiteHeader.module.css';

/** The three prongs, then membership. */
const NAV = [
  { href: '/', label: 'Torah Sings' },
  { href: '/hebraic-christianity', label: 'Hebraic Christianity' },
  { href: '/learn-hebrew', label: 'Learn Hebrew' },
  { href: '/membership', label: 'Membership' },
] as const;

/** The ecosystem's AI Bible Chat (same destination JubiLujah links to). */
const AI_BIBLE_CHAT_URL = 'https://www.jubileeinspire.com';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/album');
  return pathname.startsWith(href);
}

/**
 * Two-row header, JubiLujah-style. Top bar: logo, then the AI Bible Chat link,
 * a search bar, Sign in, and Subscribe. Nav bar beneath scrolls horizontally
 * rather than wrapping, so it stays one clean line at any zoom or width.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, status } = useJubileeAccount();
  const [query, setQuery] = useState('');

  const signedIn = status === 'ready' && session !== null;

  return (
    <header className={styles.header}>
      {/* Row 1 — logo · AI Bible Chat · search · account actions */}
      <div className={styles.topbar}>
        <div className={`wrap ${styles.topInner}`}>
          <Link href="/" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.icon} src="/zev-circle.png" alt="" width={34} height={34} aria-hidden="true" />
            <span className={styles.text}>
              Torah<span className={styles.accent}>Sings</span>.com
            </span>
          </Link>

          <div className={styles.actions}>
            <a
              className={styles.medialink}
              href={AI_BIBLE_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              AI Bible Chat
            </a>

            <form
              className={styles.search}
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = query.trim();
                if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
              }}
            >
              <svg
                className={styles.searchIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className={styles.searchInput}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search albums…"
                aria-label="Search the catalog"
                autoComplete="off"
              />
              <button type="submit" className={styles.searchBtn}>
                SEARCH
              </button>
            </form>

            {signedIn ? (
              <Link href="/account" className={styles.signin}>
                Account
              </Link>
            ) : (
              <Link href="/signin" className={styles.signin}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — primary navigation (scrolls sideways, never wraps) */}
      <div className={styles.navbar}>
        <nav className={`wrap ${styles.navInner}`} aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[styles.link, isActive(pathname, item.href) ? styles.active : ''].filter(Boolean).join(' ')}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
