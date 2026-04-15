import { container } from '../../container.js';
import { BaseController } from './BaseController.js';

export class WithdrawalController extends BaseController {
    async createWithdrawal(req, res) {
        return this.handle(req, res, async () => {
            const sellerId = req.user.sellerId;
            const { amount, mpesaNumber, mpesaName, callbackUrl } = req.body;

            const result = await container.createWithdrawal.execute({
                sellerId, amount, mpesaNumber, mpesaName, callbackUrl
            });

            return this.success(res, result, 201);
        }, 'createWithdrawal');
    }

    async handleCallback(req, res) {
        try {
            await container.handleWithdrawalCallback.execute(req.body);
            res.status(200).send('OK');
        } catch (error) {
            res.status(500).send('Error');
        }
    }
}

export const withdrawalController = new WithdrawalController();
