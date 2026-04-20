import { Markup } from 'telegraf';

export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ua', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
];

export function languageKeyboard() {
  return Markup.inlineKeyboard(
    SUPPORTED_LANGUAGES.map((l) => Markup.button.callback(l.label, `lang:${l.code}`)),
  );
}
