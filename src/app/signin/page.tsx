import type { Metadata } from 'next';

import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Jubilee Account — one sign-on across the Torah Sings ecosystem.',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <SignInForm />;
}
