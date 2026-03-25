import { en } from './en';
import { zh } from './zh';

type DeepValue<T> = T extends object
  ? { [K in keyof T]: DeepValue<T[K]> }[keyof T]
  : T;

const translations = { en, zh } as const;

export type Lang = keyof typeof translations;

export function getLang(url: URL): Lang {
  const pathname = url.pathname.replace('/lastwar-tools', '');
  const [, first] = pathname.split('/');
  if (first === 'zh') return 'zh';
  return 'en';
}

export function t(lang: Lang, path: string): string {
  const keys = path.split('.');
  let obj: any = translations[lang];
  for (const key of keys) {
    obj = obj?.[key];
  }
  // fallback to English
  if (obj === undefined) {
    let fallback: any = translations.en;
    for (const key of keys) {
      fallback = fallback?.[key];
    }
    return fallback ?? path;
  }
  return String(obj);
}

export function localePath(lang: Lang, path: string): string {
  const base = '/lastwar-tools';
  if (lang === 'en') return `${base}${path}`;
  return `${base}/zh${path}`;
}

export function switchLangPath(url: URL): string {
  const lang = getLang(url);
  const base = '/lastwar-tools';
  const pathname = url.pathname.replace(base, '');
  if (lang === 'en') {
    return `${base}/zh${pathname}`;
  } else {
    return `${base}${pathname.replace(/^\/zh/, '')}`;
  }
}
