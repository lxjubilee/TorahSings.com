import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDoc } from '@/components/legal/LegalDoc';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms that govern your use of Torah Sings and your Jubilee Account.',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title={<>Terms of <em>Use</em></>}
      lead="These terms are the agreement between you and Torah Sings. Please read them carefully — by creating a Jubilee Account or using the Service, you agree to be bound by them."
      effective="Effective July 14, 2026"
      contact={
        <>
          <p>
            <strong>Jubilee Ministries</strong>
          </p>
          <p>Legal inquiries: legal@torahsings.com</p>
          <p>We aim to respond within a reasonable time.</p>
        </>
      }
    >
      <p>
        Welcome to TorahSings.com. These Terms of Use (&ldquo;Terms&rdquo;) are a legal agreement between
        you and Jubilee Ministries (&ldquo;Torah Sings,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) governing your access to and use of the TorahSings.com website and the music,
        readings, and study materials offered through it (the &ldquo;Service&rdquo;). Please also review our{' '}
        <Link href="/privacy">Privacy Policy</Link>, which explains how we handle your information and is
        incorporated into these Terms by reference.
      </p>

      <h2>1. Acceptance of These Terms</h2>
      <p>
        By creating an account, accessing, or using the Service, you confirm that you have read, understood,
        and agree to be bound by these Terms and our Privacy Policy. If you do not agree, please do not use the
        Service. If you are using the Service on behalf of an organization, you represent that you are
        authorized to accept these Terms on its behalf.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 13 years old (or the minimum age required in your country) to create an account
        and use the Service. If you are a minor in your jurisdiction, you may use the Service only with the
        involvement and consent of a parent or legal guardian. By using the Service, you represent that you
        meet these requirements.
      </p>

      <h2>3. Your Account</h2>
      <ul>
        <li>You agree to provide accurate, current, and complete information when you register and to keep it up to date.</li>
        <li>
          Torah Sings uses your <strong>Jubilee Account</strong> — the single sign-on shared across the Jubilee
          ecosystem — to identify you across sites.
        </li>
        <li>
          You are responsible for safeguarding your credentials and for all activity that occurs under your
          account. Notify us promptly of any unauthorized use.
        </li>
      </ul>

      <h2>4. License to Use the Service</h2>
      <p>
        Subject to these Terms, we grant you a limited, personal, non-exclusive, non-transferable, and
        revocable license to access and use the Service for your own personal, non-commercial listening and
        study. This license does not permit resale, redistribution, or any use of the Service or its content
        beyond what these Terms allow.
      </p>

      <h2>5. Content and Intellectual Property</h2>
      <p>
        The Service and its contents — including the recordings, songs, artwork, text, the accompanying book,
        the underlying discovery, and the software — are owned by Jubilee Ministries or its licensors and are
        protected by copyright and other laws. The songs and the book are offered as something to consider for
        study and reflection — <strong>not as canon</strong>. Nothing in these Terms transfers ownership of any
        content to you.
      </p>

      <h2>6. Your Content</h2>
      <p>
        If you submit feedback, suggestions, or other materials to us, you grant Jubilee Ministries a
        worldwide, royalty-free license to use them to operate and improve the Service. You are responsible for
        anything you submit and represent that you have the right to share it.
      </p>

      <h2>7. Acceptable Use</h2>
      <ul>
        <li>Do not copy, scrape, download in bulk, redistribute, or publicly perform the content except as the Service expressly allows.</li>
        <li>Do not attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service or its systems.</li>
        <li>Do not use the Service unlawfully, or to infringe the rights of others.</li>
      </ul>

      <h2>8. Third-Party Services</h2>
      <p>
        The Service relies on third parties — including your Jubilee Account for sign-on, and providers for
        hosting, streaming, and payments. Your use of those services may be subject to their own terms and
        privacy policies. We are not responsible for third-party services we do not control.
      </p>

      <h2>9. Suspension and Termination</h2>
      <p>
        We may suspend or terminate your access to the Service at any time if you violate these Terms or if we
        need to protect the Service or other users. You may stop using the Service at any time. Provisions that
        by their nature should survive termination will survive.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
        kind, whether express or implied. The interpretive material is offered for study and reflection and is
        not presented as doctrine. We do not warrant that the Service will be uninterrupted, error-free, or
        secure.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, Jubilee Ministries will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for any loss of data or goodwill, arising
        out of or related to your use of the Service.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Jubilee Ministries and its affiliates from any claims,
        damages, or expenses arising out of your use of the Service or your violation of these Terms.
      </p>

      <h2>13. Changes to the Service and These Terms</h2>
      <p>
        We may update the Service and these Terms from time to time. When we make material changes, we will
        update the effective date above and, where appropriate, provide additional notice. Your continued use
        of the Service after changes take effect means you accept the revised Terms.
      </p>

      <h2>14. Governing Law</h2>
      <p>
        These Terms are governed by the laws applicable at the place of Jubilee Ministries&rsquo; principal
        operations, without regard to conflict-of-laws rules. Any disputes will be resolved in the courts of
        that jurisdiction, unless applicable law requires otherwise.
      </p>

      <h2>15. Contact Us</h2>
      <p>Questions about these Terms are welcome. You can reach us at the address below.</p>
    </LegalDoc>
  );
}
