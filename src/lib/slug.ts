// Custom publish slugs: /p/mariama-shop instead of /p/E4wjjEO7BreT9tIv06fa.
// Uniqueness = a `slugs` collection whose DOC ID is the slug (claimed in a
// transaction). Old raw-id links keep working — serving tries id then slug.
import { db, doc, runTransaction, serverTimestamp } from '../firebase';

// lowercase letters/digits/hyphens, 3–40 chars, no leading/trailing hyphen
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

/** Latin project name → slug suggestion; ADLaM/short names → neutral app-<id> stub. */
export function suggestSlug(name: string, projectId: string): string {
  const latin = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (e-acute -> e)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (latin.length >= 3) return latin;
  return `app-${projectId.slice(0, 8).toLowerCase()}`;
}

/**
 * Atomically claim `slug` for a project (and release the project's previous
 * slug, if different). Throws Error('taken') when someone else holds it.
 */
export async function claimSlug(
  uid: string,
  projectId: string,
  slug: string,
  oldSlug?: string,
): Promise<void> {
  if (!isValidSlug(slug)) throw new Error('invalid');
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'slugs', slug);
    const snap = await tx.get(ref);
    const cur = snap.data();
    if (snap.exists() && cur?.projectId !== projectId) throw new Error('taken');
    if (!snap.exists()) tx.set(ref, { projectId, userId: uid, createdAt: serverTimestamp() });
    if (oldSlug && oldSlug !== slug) tx.delete(doc(db, 'slugs', oldSlug));
    tx.update(doc(db, 'projects', projectId), { slug });
  });
}
