import CorePaymentService from '../core/CorePaymentService.js';
import paymentLifecycleService, { PaymentLifecycleService as BasePaymentService } from './paymentLifecycle.service.js';

export class PaymentService extends BasePaymentService {
    async initiateProductPayment(normalizedOrder) {
        return CorePaymentService.initiateProductPayment(normalizedOrder);
    }
}

const paymentService = new PaymentService();

export { paymentLifecycleService, BasePaymentService as PaymentLifecycleService };
export default paymentService;
