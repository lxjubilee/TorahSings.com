/**
 * The Inspire Family presenter rotation.
 *
 * The twelve Inspire Family members rotate presenting the album articles and
 * singing across the catalogue, keeping interpretive voices fresh from topic to
 * topic. Zev Inspire leads the platform overall. Gabriel Inspire (Gabriel-AI)
 * stays behind the scenes and never appears in front-line presentation.
 *
 * The roster is the canonical Jubilee ecosystem list (the twelve personas with
 * front-facing identities; Gabriel is the thirteenth and is deliberately held
 * back). Add or reorder here and the rotation follows with no other change.
 */

export const PLATFORM_LEAD = 'Zev Inspire';

/**
 * All twelve, in rotation order. Zev leads and Zariah anchors the Hebraic
 * teaching voice, so they head the list; the rest follow alphabetically.
 */
export const PRESENTERS: readonly string[] = [
  'Zev Inspire', // Teacher–Apostle · Messianic / Hebraic worship — leads the platform
  'Zariah Inspire', // Teacher–Pastor · Afro-Caribbean fusion worship
  'Amir Inspire', // Evangelist–Prophet · Middle Eastern worship
  'Caleb Inspire', // Pastor–Evangelist · contemporary worship band
  'Eliana Inspire', // Apostle–Teacher · wisdom-structured folk
  'Elias Inspire', // Apostle–Prophet · prophetic storytelling
  'Imani Inspire', // Prophet–Evangelist · charismatic praise
  'Jubilee Inspire', // Evangelist–Prophet · celebration-based worship
  'Melody Inspire', // Evangelist–Teacher · pop / mainstream outreach
  'Nova Inspire', // Pastor–Teacher · Celtic / ambient contemplative
  'Santiago Inspire', // Prophet–Evangelist · Latin worship
  'Tahoma Inspire', // Prophet–Pastor · indigenous / acoustic
];

/**
 * Held back from front-line presentation. Both spellings are listed so the
 * rotation can never surface him under either name.
 */
export const BEHIND_THE_SCENES: readonly string[] = ['Gabriel Inspire', 'Gabriel-AI'];

/**
 * Deterministic rotation by album/article index, so a given album always
 * carries the same presenter credit across renders and rebuilds.
 */
export function presenterFor(index: number): string {
  const roster = PRESENTERS.filter((p) => !BEHIND_THE_SCENES.includes(p));
  if (roster.length === 0) return PLATFORM_LEAD;
  return roster[Math.abs(index) % roster.length];
}
