import { IPaymentGateway } from './gateway.interface.js';

export class PaymentGatewayFactory {
  private adapters = new Map<string, IPaymentGateway>();

  register(adapter: IPaymentGateway): void {
    this.adapters.set(adapter.getProviderName().toLowerCase(), adapter);
  }

  getAdapter(providerName: string): IPaymentGateway | undefined {
    return this.adapters.get(providerName.toLowerCase());
  }
}
