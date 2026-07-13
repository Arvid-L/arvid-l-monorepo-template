import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const configWith = (values: Record<string, string>): ConfigService =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('MailService', () => {
  it('falls back to a log-only transport without SMTP_HOST', async () => {
    const service = new MailService(configWith({}));

    // jsonTransport resolves without any network access — this throwing
    // would mean a real connection was attempted.
    await expect(
      service.send({ to: 'a@b.c', subject: 'Hi', text: 'Hello' }),
    ).resolves.toBeUndefined();
  });

  it('uses MAIL_FROM as the sender', async () => {
    const service = new MailService(
      configWith({ MAIL_FROM: 'noreply@example.org' }),
    );
    const transporter = (
      service as unknown as {
        transporter: { sendMail: jest.Mock };
      }
    ).transporter;
    const sendMail = jest.spyOn(transporter, 'sendMail');

    await service.send({ to: 'a@b.c', subject: 'Hi', text: 'Hello' });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'noreply@example.org', to: 'a@b.c' }),
    );
  });
});
