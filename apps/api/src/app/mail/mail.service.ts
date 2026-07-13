import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Generic transactional mail sender. Configure via SMTP_* env vars; without
// SMTP_HOST (local dev) mails are printed to the log instead of sent, so
// flows like password reset are testable without a mail account.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly smtpConfigured: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.from = config.get<string>('MAIL_FROM') ?? 'noreply@localhost';
    this.smtpConfigured = Boolean(host);

    if (host) {
      this.transporter = createTransport({
        host,
        port: Number(config.get('SMTP_PORT') ?? 587),
        // true = implicit TLS (port 465); on 587 nodemailer upgrades via
        // STARTTLS automatically.
        secure: config.get('SMTP_SECURE') === 'true',
        auth: user
          ? { user, pass: config.get<string>('SMTP_PASSWORD') }
          : undefined,
      });
    } else {
      this.transporter = createTransport({ jsonTransport: true });
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          'SMTP_HOST is not set — outgoing mail will only be logged, not delivered',
        );
      }
    }
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      ...message,
    });

    if (this.smtpConfigured) {
      this.logger.log(`Mail sent to ${message.to}: ${message.subject}`);
    } else {
      // jsonTransport: the full mail ends up in info.message — this is how
      // you grab e.g. the password reset link in local dev.
      this.logger.log(`Mail (not sent, no SMTP): ${info.message}`);
    }
  }
}
