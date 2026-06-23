import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lang } from '../common/i18n/localize';

export interface ListingText {
  title: string;
  location: string;
  description: string;
}

export interface BilingualListingText {
  titleEn: string;
  titleAr: string;
  locationEn: string;
  locationAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('libretranslate.url') ?? 'http://localhost:5000'
    ).replace(/\/$/, '');
    this.apiKey = config.get<string>('libretranslate.apiKey') || undefined;
  }

  async translate(text: string, source: Lang, target: Lang): Promise<string> {
    if (source === target || !text?.trim()) return text;

    const res = await fetch(`${this.baseUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text',
        ...(this.apiKey ? { api_key: this.apiKey } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(
        `LibreTranslate responded ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as { translatedText: string };
    return data.translatedText;
  }

  async toBilingual(
    text: ListingText,
    source: Lang,
  ): Promise<BilingualListingText> {
    const target: Lang = source === 'ar' ? 'en' : 'ar';

    let translated: ListingText;
    try {
      const [title, location, description] = await Promise.all([
        this.translate(text.title, source, target),
        this.translate(text.location, source, target),
        this.translate(text.description, source, target),
      ]);
      translated = { title, location, description };
    } catch (err) {
      // Never let a translation outage block listing creation.
      this.logger.error(
        `Translation ${source}→${target} failed; storing source text in both languages.`,
        err as Error,
      );
      translated = text;
    }

    return this.assemble(source, text, translated);
  }

  async fieldToBilingual(
    text: string,
    source: Lang,
  ): Promise<{ en: string; ar: string }> {
    const target: Lang = source === 'ar' ? 'en' : 'ar';
    let translated = text;
    try {
      translated = await this.translate(text, source, target);
    } catch (err) {
      this.logger.error(
        `Translation ${source}→${target} failed; storing source text in both languages.`,
        err as Error,
      );
    }
    return source === 'ar'
      ? { ar: text, en: translated }
      : { en: text, ar: translated };
  }

  private assemble(
    source: Lang,
    original: ListingText,
    translated: ListingText,
  ): BilingualListingText {
    const en = source === 'en' ? original : translated;
    const ar = source === 'ar' ? original : translated;
    return {
      titleEn: en.title,
      titleAr: ar.title,
      locationEn: en.location,
      locationAr: ar.location,
      descriptionEn: en.description,
      descriptionAr: ar.description,
    };
  }
}
