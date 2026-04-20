import { Markup } from 'telegraf';

export function openAppKeyboard(appUrl: string, buttonLabel: string) {
  return Markup.inlineKeyboard([Markup.button.webApp(buttonLabel, appUrl)]);
}
