import { container } from '../../container.js';
import { BaseController } from './BaseController.js';

export class PaymentController extends BaseController {
    async initiatePayment(req, res) {
        return this.handle(req, res, async () => {
            const { orderId, amount, phone, email, callbackUrl } = req.body;
            const result = await container.initiatePayment.execute({
                orderId, amount, phone, email, callbackUrl
            });
            return this.success(res, result);
        }, 'initiatePayment');
    }

    async handleCallback(req, res) {
        try {
            // Callback handler is special as it returns "OK" string for third party
            await container.handlePaymentCallback.execute(req.body);
            res.status(200).send('OK');
        } catch (error) {
            // Still log but return specific error format for the provider
            res.status(500).send('Error');
        }
    }
}

export const paymentController = new PaymentController();
