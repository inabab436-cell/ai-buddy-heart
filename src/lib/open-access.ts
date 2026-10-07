/**
 * TEMPORARY open-access mode.
 *
 * While `OPEN_ACCESS` is true nobody has to sign in: merchants automatically
 * get the single allowed account session, and storefront visitors get an
 * automatic guest customer session. Set to `false` to restore real sign-in.
 */
export const OPEN_ACCESS = false;

/** The only merchant account used while open access is on. */
export const ALLOWED_EMAIL = "";
