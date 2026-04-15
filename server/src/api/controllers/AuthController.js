import { container } from '../../container.js';
import { BaseController } from './BaseController.js';

export class AuthController extends BaseController {
    async login(req, res) {
        return this.handle(req, res, async () => {
            const { email, password, portalType } = req.body;
            const result = await container.loginUser.execute({ email, password, portalType });

            if (!result) {
                return this.error(res, 'Invalid credentials', 401);
            }

            return this.success(res, result);
        }, 'login');
    }

    async register(req, res) {
        return this.handle(req, res, async () => {
            const { type } = req.params; // buyer or seller
            const result = await container.registerUser.execute(req.body, type);

            return this.success(res, result, 201);
        }, 'register');
    }

    async verifyEmail(req, res) {
        return this.handle(req, res, async () => {
            const { email, token } = req.query;
            const result = await container.verifyEmail.execute({ email, token });

            return this.success(res, { message: 'Email verified successfully', ...result });
        }, 'verifyEmail');
    }
}

export const authController = new AuthController();
