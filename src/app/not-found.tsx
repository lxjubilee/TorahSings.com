import Link from 'next/link';
import { Eyebrow } from '@/components/system/Eyebrow';

export default function NotFound() {
  return (
    <div
      className="wrap"
      style={{ padding: '120px 24px 80px', textAlign: 'center', maxWidth: 620 }}
    >
      <Eyebrow>Nothing here</Eyebrow>
      <h1 style={{ margin: '24px 0 20px' }}>This fragment has not surfaced.</h1>
      <p className="muted" style={{ marginBottom: 34, lineHeight: 1.7 }}>
        Whatever you were looking for is not at this address. It may not have been uncovered yet, or it may never
        have been here at all.
      </p>
      <Link href="/" className="pill">
        Back to the library
      </Link>
    </div>
  );
}
