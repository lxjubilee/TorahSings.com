import type { Metadata } from 'next';

import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Set a new password for your Jubilee Account on Torah Sings.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
