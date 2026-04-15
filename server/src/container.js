// Infrastructure
import { pool } from './infrastructure/db/pool.js';
import { withTransaction } from './infrastructure/db/transaction.js';
import { OrderRepository } from './infrastructure/repositories/OrderRepository.js';
import { PaymentRepository } from './infrastructure/repositories/PaymentRepository.js';
import { SellerRepository } from './infrastructure/repositories/SellerRepository.js';
import { BuyerRepository } from './infrastructure/repositories/BuyerRepository.js';
import { ProductRepository } from './infrastructure/repositories/ProductRepository.js';
import { UserRepository } from './infrastructure/repositories/UserRepository.js';
import { WithdrawalRepository } from './infrastructure/repositories/WithdrawalRepository.js';
import { PendingRegistrationRepository } from './infrastructure/repositories/PendingRegistrationRepository.js';
import { PaydPaymentProvider } from './infrastructure/external/PaydPaymentProvider.js';
import { PaydPayoutProvider } from './infrastructure/external/PaydPayoutProvider.js';
import { defaultQueue } from './infrastructure/queue/JobQueue.js';

// Application Use Cases
import { CreateOrder } from './application/usecases/orders/CreateOrder.js';
import { CompleteOrder } from './application/usecases/orders/CompleteOrder.js';
import { UpdateOrderStatus } from './application/usecases/orders/UpdateOrderStatus.js';
import { LoginUser } from './application/usecases/auth/LoginUser.js';
import { RegisterUser } from './application/usecases/auth/RegisterUser.js';
import { VerifyEmail } from './application/usecases/auth/VerifyEmail.js';
import { InitiatePayment } from './application/usecases/payments/InitiatePayment.js';
import { HandlePaymentCallback } from './application/usecases/payments/HandlePaymentCallback.js';
import { CreateWithdrawal } from './application/usecases/withdrawals/CreateWithdrawal.js';
import { HandleWithdrawalCallback } from './application/usecases/withdrawals/HandleWithdrawalCallback.js';
import { RegisterSellerProfile } from './application/usecases/sellers/RegisterSellerProfile.js';
import { UpdateSellerProfile } from './application/usecases/sellers/UpdateSellerProfile.js';

// Application Jobs
import { registerJobs } from './application/jobs/index.js';

// Domain Services (if needed as singletons)
import { OrderDomainService } from './domain/services/OrderDomainService.js';

// Dependency Container (Composition Root)
class Container {
    constructor() {
        this._initializeInfrastructure();
        this._initializeUseCases();
        this._initializeJobs();
    }

    _initializeInfrastructure() {
        // Repositories
        this.orderRepository = new OrderRepository(pool);
        this.paymentRepository = new PaymentRepository(pool);
        this.sellerRepository = new SellerRepository(pool);
        this.buyerRepository = new BuyerRepository(pool);
        this.productRepository = new ProductRepository(pool);
        this.userRepository = new UserRepository(pool);
        this.withdrawalRepository = new WithdrawalRepository(pool);
        this.pendingRegistrationRepository = new PendingRegistrationRepository(pool);

        // External Providers
        this.paymentProvider = new PaydPaymentProvider();
        this.payoutProvider = new PaydPayoutProvider();

        // Transaction Manager
        this.transactionManager = { withTransaction };

        // Queue
        this.queue = defaultQueue;
    }

    _initializeUseCases() {
        // Shared dependencies object
        const deps = {
            orderRepository: this.orderRepository,
            paymentRepository: this.paymentRepository,
            sellerRepository: this.sellerRepository,
            buyerRepository: this.buyerRepository,
            productRepository: this.productRepository,
            userRepository: this.userRepository,
            withdrawalRepository: this.withdrawalRepository,
            pendingRegistrationRepository: this.pendingRegistrationRepository,
            paymentProvider: this.paymentProvider,
            payoutProvider: this.payoutProvider,
            transactionManager: this.transactionManager
        };

        // Orders
        this.createOrder = new CreateOrder(deps);
        this.completeOrder = new CompleteOrder(deps);
        this.updateOrderStatus = new UpdateOrderStatus(deps);

        // Auth
        this.loginUser = new LoginUser(deps);
        this.registerUser = new RegisterUser(deps);
        this.verifyEmail = new VerifyEmail(deps);

        // Payments
        this.initiatePayment = new InitiatePayment(deps);
        this.handlePaymentCallback = new HandlePaymentCallback({
            ...deps,
            completeOrderUseCase: this.completeOrder
        });

        // Withdrawals
        this.createWithdrawal = new CreateWithdrawal(deps);
        this.handleWithdrawalCallback = new HandleWithdrawalCallback(deps);

        // Sellers
        this.registerSellerProfile = new RegisterSellerProfile(deps);
        this.updateSellerProfile = new UpdateSellerProfile(deps);
    }

    _initializeJobs() {
        this.jobs = registerJobs(this, this.queue);
    }
}

export const container = new Container();
