import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDoc } from '@/components/legal/LegalDoc';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Torah Sings and your Jubilee Account handle your information.',
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title={<>Privacy <em>Policy</em></>}
      lead="This policy explains what we collect, how we use it, and the choices you have. Torah Sings keeps your listening simple and the data we hold to a minimum."
      effective="Effective July 14, 2026"
      contact={
        <>
          <p>
            <strong>Jubilee Ministries</strong>
          </p>
          <p>Privacy inquiries: privacy@torahsings.com</p>
          <p>We aim to respond within a reasonable time.</p>
        </>
      }
    >
      <p>
        This Privacy Policy explains how Jubilee Ministries (&ldquo;Torah Sings,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and protects your information when you use
        TorahSings.com (the &ldquo;Service&rdquo;). It should be read together with our{' '}
        <Link href="/terms">Terms of Use</Link>.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with your Jubilee Account, we receive the
          basic profile details needed to identify you — such as your name and email address.
        </li>
        <li>
          <strong>Usage and playback.</strong> We may collect which albums and tracks you open, and your
          playback position, so the Service works the way you expect.
        </li>
        <li>
          <strong>Device and log data.</strong> Standard technical information such as browser type, device,
          and approximate region, collected automatically as you use the Service.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>
        We use your information to provide and maintain the Service, remember your session and playback
        position, understand how the Service is used so we can improve it, keep the Service secure, and
        communicate with you about your account when necessary.
      </p>

      <h2>3. Your Jubilee Account</h2>
      <p>
        Torah Sings uses your <strong>Jubilee Account</strong> as a single sign-on shared across the Jubilee
        ecosystem. Signing in links your use of Torah Sings to that account so your experience carries across
        sites. Your Jubilee Account profile is governed by this policy together with any terms presented when
        you created it.
      </p>

      <h2>4. Cookies and Local Storage</h2>
      <p>
        We keep your listening simple: your session and playback position live in your own browser&rsquo;s
        local storage, and we use only the cookies necessary to sign you in and operate the Service. You can
        clear this data at any time through your browser settings.
      </p>

      <h2>5. How We Share Information</h2>
      <p>
        We do not sell your personal information. We share it only with service providers who help us run the
        Service (such as hosting, streaming, and sign-on providers) under appropriate safeguards, or where
        required by law or to protect the Service and its users.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We keep your information only as long as needed to provide the Service and for legitimate operational,
        legal, or security purposes. When it is no longer needed, we take reasonable steps to delete or
        anonymize it.
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect your information. No method of
        transmission or storage is completely secure, however, and we cannot guarantee absolute security.
      </p>

      <h2>8. Your Rights and Choices</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, or delete your personal
        information, or to object to certain processing. To make a request, contact us using the details below.
        You can also manage much of your data directly through your Jubilee Account and your browser.
      </p>

      <h2>9. Children&rsquo;s Privacy</h2>
      <p>
        The Service is not directed to children under 13, and we do not knowingly collect personal information
        from them. If you believe a child has provided us information, please contact us so we can remove it.
      </p>

      <h2>10. International Users</h2>
      <p>
        The Service may be operated from, and your information processed in, countries other than your own. By
        using the Service, you understand that your information may be transferred and handled in accordance
        with this policy and applicable law.
      </p>

      <h2>11. Third-Party Links and Services</h2>
      <p>
        The Service may link to or rely on third-party sites and services, including your Jubilee Account and
        the wider Jubilee ecosystem. Their handling of your information is governed by their own privacy
        policies, which we encourage you to review.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we make material changes, we will update the
        effective date above and, where appropriate, provide additional notice. Your continued use of the
        Service after changes take effect means you accept the revised policy.
      </p>

      <h2>13. Contact Us</h2>
      <p>Questions about your privacy are welcome. You can reach us at the address below.</p>
    </LegalDoc>
  );
}
