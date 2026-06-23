export type Lang = 'en' | 'ar';

export enum LangCode {
  EN = 'en',
  AR = 'ar',
}

export const DEFAULT_LANG: Lang = 'en';

export function resolveLang(header?: string | string[]): Lang {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return DEFAULT_LANG;
  const primary = raw.split(',')[0]?.trim().toLowerCase() ?? '';
  return primary.startsWith('ar') ? 'ar' : DEFAULT_LANG;
}

/** Maps a Lang to the Prisma `Language` enum value. */
export function toLanguageEnum(lang: Lang): 'EN' | 'AR' {
  return lang === 'ar' ? 'AR' : 'EN';
}

interface BilingualListing {
  titleEn: string;
  titleAr: string;
  locationEn: string;
  locationAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export function localizeListing<T extends BilingualListing>(
  listing: T,
  lang: Lang,
): T & { title: string; location: string; description: string; language: Lang } {
  return {
    ...listing,
    title: lang === 'ar' ? listing.titleAr : listing.titleEn,
    location: lang === 'ar' ? listing.locationAr : listing.locationEn,
    description: lang === 'ar' ? listing.descriptionAr : listing.descriptionEn,
    language: lang,
  };
}

export function localizeMany<T extends BilingualListing>(
  listings: T[],
  lang: Lang,
) {
  return listings.map((l) => localizeListing(l, lang));
}
