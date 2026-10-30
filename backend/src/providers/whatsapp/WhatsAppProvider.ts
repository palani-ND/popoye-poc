/** Provider-agnostic WhatsApp interface. Business logic depends only on this. */
export interface SendMessageInput {
  recipientMobile: string;
  campaignName: string;
  userName: string;
  templateParams: string[];
}

export interface SendMessageResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
