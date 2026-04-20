import { Logger } from '@nestjs/common';
import type { Context, MiddlewareFn } from 'telegraf';

/**
 * Telegraf middleware that logs every update with a correlation-ready
 * payload: { updateType, userId, chatId, command?, durationMs,
 * ok|error }. Attaches to the bot's middleware chain first so the
 * timer starts before handlers register their own listeners.
 */
export function createUpdateLoggingMiddleware(
  logger: Logger,
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const start = Date.now();
    const updateType = extractUpdateType(ctx);
    const command = extractCommand(ctx);
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    try {
      await next();
      logger.log(
        `bot.update ok type=${updateType}${command ? ` cmd=${command}` : ''} userId=${userId ?? '-'} chatId=${chatId ?? '-'} durationMs=${Date.now() - start}`,
      );
    } catch (err) {
      logger.error(
        `bot.update error type=${updateType}${command ? ` cmd=${command}` : ''} userId=${userId ?? '-'} chatId=${chatId ?? '-'} durationMs=${Date.now() - start}: ${(err as Error).message}`,
      );
      throw err;
    }
  };
}

function extractUpdateType(ctx: Context): string {
  const u = ctx.update as unknown as Record<string, unknown>;
  for (const key of [
    'message',
    'edited_message',
    'callback_query',
    'inline_query',
    'chat_member',
    'my_chat_member',
  ]) {
    if (u[key]) return key;
  }
  return 'unknown';
}

function extractCommand(ctx: Context): string | null {
  const msg = (ctx.message ?? ctx.editedMessage) as
    | { text?: string; entities?: Array<{ type: string; offset: number; length: number }> }
    | undefined;
  if (!msg?.text || !msg.entities) return null;
  const cmd = msg.entities.find((e) => e.type === 'bot_command' && e.offset === 0);
  if (!cmd) return null;
  return msg.text.slice(cmd.offset + 1, cmd.offset + cmd.length).split('@')[0];
}
