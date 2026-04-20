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

const MAX_TELEGRAM_MESSAGE = 4096;

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
    for (let i = 0; i < text.length; i += MAX_TELEGRAM_MESSAGE) {
      const chunk = text.slice(i, i + MAX_TELEGRAM_MESSAGE);
      try {
        await ctx.reply(chunk, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
      } catch {
        await ctx.reply(this.stripHtml(chunk));
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
