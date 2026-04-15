import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class RegisterUser {
    constructor({ userRepository, pendingRegistrationRepository, sellerRepository, buyerRepository, emailService }) {
        this.userRepository = userRepository;
        this.pendingRegistrationRepository = pendingRegistrationRepository;
        this.sellerRepository = sellerRepository;
        this.buyerRepository = buyerRepository;
        this.emailService = emailService;
    }

    async execute(data, type) {
        const { email, password, termsAccepted } = data;
        const normalizedEmail = email.trim().toLowerCase();

        if (!termsAccepted) {
            throw new Error('Terms and conditions must be accepted.');
        }

        const existingUser = await this.userRepository.findByEmail(normalizedEmail);
        if (existingUser) {
            throw new Error('User already exists.');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        const registrationData = { ...data };
        delete registrationData.password;

        await this.pendingRegistrationRepository.create({
            email: normalizedEmail,
            passwordHash,
            role: type,
            registrationData,
            verificationToken: hashedToken,
            expiresAt,
            termsAccepted: true
        });

        // Send email (async)
        this.emailService.sendVerificationEmail(normalizedEmail, verificationToken, type).catch(() => { });

        return { status: 'pending_verification', email: normalizedEmail };
    }
}
