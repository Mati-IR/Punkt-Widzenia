// Operator details and privacy settings used by the legal pages, the footer and the consent banner.
// Fill in the empty fields before going public: the law (UŚUDE art. 5) requires the operator's
// name, address and e-mail on the site. Empty fields are shown as "do uzupełnienia".

export const operator = {
  /** Full name or company name of the person/firm running the site. */
  name: '',
  /** Postal address (a correspondence address or virtual office is fine). */
  address: '',
  /** Contact e-mail. Also receives reports from the forms. */
  email: '',
  /** Optional: NIP / REGON once a business is registered. */
  taxId: '',
};

/** Date shown as "obowiązuje od" on Regulamin and Polityka prywatności (YYYY-MM-DD). */
export const legalVersion = '2026-11-11';

/** Hours within which we answer takedown / infringement reports (internal SLA). */
export const TAKEDOWN_SLA_HOURS = 48;

/**
 * Optional analytics. Leave `src` empty and the site sets no cookies and loads no third-party
 * scripts, so no consent banner is shown (none is needed). If you add a tool that stores anything
 * on the visitor's device, set `src` and the banner appears: nothing loads until "Akceptuję".
 * Cookieless tools (e.g. Cloudflare Web Analytics, Plausible) can set `needsConsent: false`.
 */
export const analytics: { name: string; src: string; attrs: Record<string, string>; needsConsent: boolean } = {
  name: '',
  src: '',
  attrs: {},
  needsConsent: true,
};

export const TODO = 'do uzupełnienia';
