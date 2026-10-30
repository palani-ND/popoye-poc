/** Provider-agnostic payment gateway interface. Business logic depends only on this. */
export interface CreateOrderInput {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  notifyUrl: string;
  returnUrl: string;
}

export interface CreateOrderResult {
  gatewayOrderId: string;
  paymentSessionId: string;
  gatewayOrderStatus?: string;
}

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  getOrderStatus(gatewayOrderId: string): Promise<{ status: string }>;
  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean;
}
