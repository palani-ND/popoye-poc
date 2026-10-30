import axios from 'axios';
import type { SendMessageInput, SendMessageResult, WhatsAppProvider } from './WhatsAppProvider.js';
import { config } from '../../config/index.js';

/** AiSensy API Campaign adapter (https://backend.aisensy.com/campaign/t1/api/v2). */
export class AiSensyAdapter implements WhatsAppProvider {
  private baseUrl = 'https://backend.aisensy.com/campaign/t1/api/v2';

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!config.AISENSY_API_KEY) {
      return { ok: false, error: 'AISENSY_API_KEY not configured' };
    }
    try {
      const res = await axios.post(
        this.baseUrl,
        {
          apiKey: config.AISENSY_API_KEY,
          campaignName: input.campaignName,
          destination: input.recipientMobile,
          userName: input.userName,
          templateParams: input.templateParams,
        },
        { timeout: 10_000 },
      );
      return { ok: res.status === 200, providerMessageId: undefined };
    } catch (err) {
      const message = axios.isAxiosError(err) ? (err.response?.data?.message ?? err.message) : String(err);
      return { ok: false, error: message };
    }
  }
}
