import { Injectable, Logger } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../users/user.model';
import { I18nService } from '@modules/i18n/services/i18n.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private bot: Telegraf | null = null;

  constructor(
    @InjectModel(User) private userModel: typeof User,
    private i18n: I18nService,
  ) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new Telegraf(token);
    }
  }

  getBot(): Telegraf | null {
    return this.bot;
  }

  async sendMessage(chatId: number, text: string, extra?: any): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (err) {
      this.logger.error(
        `Failed to send message to ${chatId}: ${(err as Error).message}`,
      );
    }
  }

  async findOrCreateUser(tgUser: any): Promise<User> {
    const lang = this.i18n.detectLang(tgUser.language_code);
    let user = await this.userModel.findOne({ where: { telegramId: tgUser.id } });
    if (!user) {
      user = await this.userModel.create({
        telegramId: tgUser.id,
        name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User',
        language: lang,
      });
    }
    return user;
  }
}
