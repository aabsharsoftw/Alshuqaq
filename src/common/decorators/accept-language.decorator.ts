import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LANG, Lang, resolveLang } from '../i18n/localize';

export const AcceptLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Lang => {
    const request = ctx.switchToHttp().getRequest();
    // An explicit header overrides the authenticated user's saved preference.
    const header = request.headers?.['accept-language'];
    if (header) return resolveLang(header);
    const pref = request.user?.preferredLanguage;
    return pref ? resolveLang(pref) : DEFAULT_LANG;
  },
);
