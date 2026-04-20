import { Injectable, OnModuleInit, Inject, forwardRef, Logger } from '@nestjs/common';
import { BotService } from './bot.service';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { AiService } from '../ai/ai.service';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '@modules/users/models/user.model';

@Injectable()
export class BotUpdate implements OnModuleInit {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private botService: BotService,
    private i18n: I18nService,
    @Inject(forwardRef(() => AiService)) private aiService: AiService,
    @InjectModel(User) private userModel: typeof User,
  ) {}

  async onModuleInit() {
    const bot = this.botService.getBot();
    if (!bot) return;

    // /start
    bot.command('start', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      await user.update({ chatId: ctx.chat.id });
      const lang = user.language || 'en';
      const appUrl = process.env.APP_URL || 'https://gymbo.app';

      await ctx.reply(this.i18n.t('bot.welcome', lang), {
        reply_markup: {
          inline_keyboard: [[
            { text: this.i18n.t('bot.openApp', lang), web_app: { url: appUrl } },
          ]],
        },
      });
    });

    // /stats
    bot.command('stats', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      const lang = user.language || 'en';
      await ctx.reply(this.i18n.t('bot.noData', lang));
    });

    // /settings
    bot.command('settings', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      const lang = user.language || 'en';

      await ctx.reply(this.i18n.t('bot.chooseLanguage', lang), {
        reply_markup: {
          inline_keyboard: [[
            { text: 'English', callback_data: 'lang:en' },
            { text: 'Українська', callback_data: 'lang:ua' },
            { text: 'Русский', callback_data: 'lang:ru' },
          ]],
        },
      });
    });

    // /coach — just sends welcome, then all text goes to AI
    bot.command('coach', async (ctx) => {
      const user = await this.botService.findOrCreateUser(ctx.from);
      const lang = user.language || 'en';
      await ctx.reply(this.i18n.t('coach.welcome', lang));
    });

    // Language callback
    bot.action(/^lang:(.+)$/, async (ctx) => {
      const lang = ctx.match[1];
      const user = await this.userModel.findOne({ where: { telegramId: ctx.from.id } });
      if (user) await user.update({ language: lang });
      await ctx.answerCbQuery(this.i18n.t('bot.settingsSaved', lang));
      await ctx.editMessageText(`${this.i18n.t('bot.chooseLanguage', lang)} ✓`);
    });

    // ALL text messages → AI coach
    bot.on('text', async (ctx) => {
      const user = await this.userModel.findOne({ where: { telegramId: ctx.from.id } });
      if (!user) {
        // Auto-register if they haven't /start'd yet
        const newUser = await this.botService.findOrCreateUser(ctx.from);
        await newUser.update({ chatId: ctx.chat.id });
      }
      const activeUser = user || await this.userModel.findOne({ where: { telegramId: ctx.from.id } });
      if (!activeUser) return;

      const lang = activeUser.language || 'en';

      try {
        await ctx.sendChatAction('typing');
        const reply = await this.aiService.chat(activeUser.id, ctx.message.text);
        await this.sendFormatted(ctx, reply);
      } catch (err) {
        this.logger.error(`Bot AI error: ${(err as Error).message || err}`);
        await ctx.reply(this.i18n.t('coach.error', lang));
      }
    });

    bot.catch((err: any) => this.logger.error(`Bot error: ${err?.message ?? err}`));

    // Set commands
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Open GymBo' },
      { command: 'stats', description: 'Quick stats' },
      { command: 'coach', description: 'AI fitness coach' },
      { command: 'settings', description: 'Language & settings' },
    ]).catch(() => {});

    // Launch: use webhook in production, polling for local dev
    const useWebhook = process.env.BOT_MODE === 'webhook' && process.env.APP_URL;

    if (useWebhook) {
      const webhookUrl = `${process.env.APP_URL}/bot/webhook`;
      await bot.telegram.setWebhook(webhookUrl, {
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      }).catch((e) => this.logger.warn(`Webhook setup failed: ${e.message}`));
      this.logger.log(`Bot webhook set: ${webhookUrl}`);
    } else {
      // Clear any existing webhook, then start polling
      await bot.telegram.deleteWebhook().catch(() => {});
      bot.launch().catch((e) => this.logger.error(`Bot launch failed: ${e.message}`));
      this.logger.log('Bot started in polling mode');
    }
  }

  private async sendFormatted(ctx: any, text: string) {
    const MAX = 4096;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += MAX) chunks.push(text.slice(i, i + MAX));

    for (const chunk of chunks) {
      try {
        await ctx.reply(chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
      } catch {
        await ctx.reply(this.stripHtml(chunk));
      }
    }
  }

  private stripHtml(s: string): string {
    return s
      .replace(/<\/?[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
}
