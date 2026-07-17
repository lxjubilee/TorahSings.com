import type { Metadata } from 'next';

import { SignInForm } from '../signin/SignInForm';

/**
 * /signup — a real, linkable URL that opens straight on the sign-up pane, the
 * way JubiLujah exposes it (jubilujah.com/signup).
 *
 * It shares the /signin component rather than duplicating the form: one auth
 * panel, one set of validation, one wiring to the identity API. The only
 * difference is which pane opens first; the in-page Sign In / Sign Up toggle
 * still swaps between them with no navigation.
 */
export const metadata: Metadata = {
  title: 'Sign up',
  description:
    'Create your Jubilee Account — one sign-on across the Torah Sings ecosystem.',
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <SignInForm initialMode="signup" />;
}
