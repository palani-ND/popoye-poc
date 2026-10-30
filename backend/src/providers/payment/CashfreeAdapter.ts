import { createHmac, timingSafeEqual } from 'node:crypto';
import axios from 'axios';
import type { CreateOrderInput, CreateOrderResult, PaymentProvider } from './PaymentProvider.js';
import { config } from '../../config/index.js';

/** Cashfree Payment Gateway adapter (sandbox + production). */
export class CashfreeAdapter implements PaymentProvider {
  private baseUrl =
    config.CASHFREE_ENV === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

  private headers() {
    return {
      'x-api-version': config.CASHFREE_API_VERSION,
      'x-client-id': config.CASHFREE_APP_ID,
      'x-client-secret': config.CASHFREE_SECRET_KEY,
      'Content-Type': 'application/json',
    };
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const res = await axios.post(
      `${this.baseUrl}/orders`,
      {
        order_id: input.orderId,
        order_amount: input.amount,
        order_currency: input.currency,
        customer_details: {
          customer_id: input.customerId,
          customer_phone: input.customerPhone,
          customer_name: input.customerName,
        },
        order_meta: {
          return_url: input.returnUrl,
          notify_url: input.notifyUrl,
        },
      },
      { headers: this.headers(), timeout: 15_000 },
    );
    return {
      gatewayOrderId: res.data.order_id,
      paymentSessionId: res.data.payment_session_id,
      gatewayOrderStatus: res.data.order_status,
    };
  }

  async getOrderStatus(gatewayOrderId: string): Promise<{ status: string }> {
    const res = await axios.get(`${this.baseUrl}/orders/${gatewayOrderId}`, {
      headers: this.headers(),
      timeout: 15_000,
    });
    return { status: res.data.order_status };
  }

  /**
   * Cashfree webhook signature: Base64(HMAC-SHA256(x-webhook-timestamp + rawBody, secretKey)).
   * Must use the exact raw request body.
   */
  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
    if (!signature || !timestamp) return false;
    const signedPayload = timestamp + rawBody;
    const expected = createHmac('sha256', config.CASHFREE_SECRET_KEY).update(signedPayload).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
