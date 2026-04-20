import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Context, Telegraf } from 'telegraf';
import type { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import type { TelegramConfig } from '@core/config/telegram.config';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { User } from '@modules/users/models/user.model';
import { toTelegramHtml } from './telegram-formatter';

const MAX_TELEGRAM_MESSAGE = 4096;
const CHUNK_SOFT_LIMIT = 3800;

type TelegramFromUser = NonNullable<Context['from']>;

@Injectable()
export class BotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly bot: Telegraf | null;
  private readonly appUrl: string;
  private readonly webhookSecret: string;

  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly i18n: I18nService,
    config: ConfigService,
  ) {
    const cfg = config.getOrThrow<TelegramConfig>('telegram');
    this.bot = cfg.botToken ? new Telegraf(cfg.botToken) : null;
    this.appUrl = cfg.appUrl;
    this.webhookSecret = cfg.webhookSecret;
    if (!this.bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN missing — bot disabled');
    }
  }

  getBot(): Telegraf | null {
    return this.bot;
  }

  getAppUrl(): string {
    return this.appUrl;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.bot) return;

    await this.bot.telegram
      .setMyCommands([
        { command: 'start', description: 'Open GymBo' },
        { command: 'stats', description: 'Quick stats' },
        { command: 'coach', description: 'AI fitness coach' },
        { command: 'settings', description: 'Language & settings' },
      ])
      .catch(() => undefined);

    this.bot.catch((err) =>
      this.logger.error(`Bot error: ${(err as Error)?.message ?? err}`),
    );

    const useWebhook = process.env.BOT_MODE === 'webhook' && this.appUrl;
    if (useWebhook) {
      const webhookUrl = `${this.appUrl}/bot/webhook`;
      await this.bot.telegram
        .setWebhook(webhookUrl, { secret_token: this.webhookSecret })
        .catch((e: Error) => this.logger.warn(`Webhook setup failed: ${e.message}`));
      this.logger.log(`Bot webhook set: ${webhookUrl}`);
    } else {
      await this.bot.telegram.deleteWebhook().catch(() => undefined);
      this.bot.launch().catch((e: Error) =>
        this.logger.error(`Bot launch failed: ${e.message}`),
      );
      this.logger.log('Bot started in polling mode');
    }
  }

  onModuleDestroy(): void {
    this.bot?.stop('SIGTERM');
  }

  async sendMessage(
    chatId: number,
    text: string,
    extra?: ExtraReplyMessage,
  ): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (err) {
      this.logger.error(
        `Failed to send message to ${chatId}: ${(err as Error).message}`,
      );
    }
  }

  async sendFormatted(ctx: Context, text: string): Promise<void> {
    // The AI is instructed to emit Telegram HTML only, but occasionally
    // drifts back to Markdown (###, **bold**, - item). Normalize
    // defensively before chunking so the user never sees raw MD.
    const html = toTelegramHtml(text);
    for (const chunk of chunkForTelegram(html)) {
      try {
        await ctx.reply(chunk, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
      } catch {
        // Fallback: Telegram rejected the HTML. Ship the plain text
        // stripped of tags so the user still gets the message.
        await ctx.reply(this.stripHtml(chunk));
      }
    }
  }

  /** Same normalization as sendFormatted but targets a raw chatId
   * instead of a Telegraf Context (used when the reply is produced
   * out-of-band — e.g. the debounced coach queue). */
  async sendToChat(chatId: number, text: string): Promise<void> {
    if (!this.bot) return;
    const html = toTelegramHtml(text);
    for (const chunk of chunkForTelegram(html)) {
      try {
        await this.bot.telegram.sendMessage(chatId, chunk, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
      } catch {
        try {
          await this.bot.telegram.sendMessage(chatId, this.stripHtml(chunk));
        } catch (err) {
          this.logger.error(
            `sendToChat fallback failed for ${chatId}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  async findOrCreateUser(tgUser: TelegramFromUser): Promise<User> {
    const lang = this.i18n.detectLang(tgUser.language_code);
    let user = await this.userModel.findOne({ where: { telegramId: tgUser.id } });
    if (!user) {
      const name =
        [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User';
      user = await this.userModel.create({
        telegramId: tgUser.id,
        name,
        language: lang,
      } as Partial<User>);
    }
    return user;
  }

  private stripHtml(s: string): string {
    return s
      .replace(/<\/?[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
}

/**
 * Paragraph-aware splitter. Prefers \n\n, then \n, then sentence
 * boundary, then whitespace, so chunks never land mid-tag or mid-word
 * unless a single token is longer than 4096 chars on its own.
 */
function chunkForTelegram(text: string): string[] {
  if (text.length <= MAX_TELEGRAM_MESSAGE) return [text];
  const chunks: string[] = [];
  let buf = '';
  for (const para of text.split(/\n\n+/)) {
    const candidate = buf ? `${buf}\n\n${para}` : para;
    if (candidate.length <= CHUNK_SOFT_LIMIT) {
      buf = candidate;
    } else {
      if (buf) chunks.push(buf);
      if (para.length <= MAX_TELEGRAM_MESSAGE) {
        buf = para;
      } else {
        for (const piece of splitLongBlock(para)) chunks.push(piece);
        buf = '';
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

function splitLongBlock(s: string): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > MAX_TELEGRAM_MESSAGE) {
    const slice = rest.slice(0, MAX_TELEGRAM_MESSAGE);
    const cut =
      slice.lastIndexOf('\n') >= 0
        ? slice.lastIndexOf('\n')
        : slice.lastIndexOf('. ') >= 0
          ? slice.lastIndexOf('. ') + 1
          : slice.lastIndexOf(' ') >= 0
            ? slice.lastIndexOf(' ')
            : MAX_TELEGRAM_MESSAGE;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}
