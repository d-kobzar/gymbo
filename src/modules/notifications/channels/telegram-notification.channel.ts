/**
 * Abstraction over the outbound notification channel. For now the
 * implementation lives inside BotService; this interface exists so
 * notification jobs can be ported off Telegram (e.g. to email or
 * push) without touching job code.
 *
 * Phase 2 wires TelegramNotificationChannel directly to BotService;
 * Phase 4 may expand it.
 */
export interface NotificationChannel {
  send(chatId: number, text: string): Promise<void>;
}
