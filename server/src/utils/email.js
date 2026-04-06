import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import ejs from 'ejs';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to create transporter with retry logic
const createTransporter = () => {
  // Map standard variable names to their values or fallback to alternative names
  const config = {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
    port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
    user: process.env.EMAIL_USERNAME || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASS,
    fromEmail: process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER,
    fromName: process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Byblos'
  };

  // Validate required environment variables
  const requiredFields = ['host', 'port', 'user', 'pass', 'fromEmail'];
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    const errorMsg = `Missing required email configuration fields: ${missingFields.join(', ')}. ` +
      `Checked both EMAIL_* and SMTP_* environment variables.`;
    logger.error('Email Configuration Error', { missingFields });
    throw new Error(errorMsg);
  }

  // Parse port as number and handle secure flag
  const port = parseInt(config.port, 10);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  logger.info('Creating email transporter', {
    host: config.host,
    port,
    secure,
    user: config.user,
    fromEmail: config.fromEmail,
    hasPassword: !!config.pass
  });

  // Create transporter with connection pooling and timeout
  return nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true, // use pooled connections
    maxConnections: 5, // maximum number of connections in the pool
    maxMessages: 100, // maximum number of messages to send through a single connection
    socketTimeout: 60000, // 60 seconds socket timeout
    connectionTimeout: 20000, // 20 seconds connection timeout
    greetingTimeout: 30000, // 30 seconds to wait for greeting after connection
    dnsTimeout: 10000, // 10 seconds DNS lookup timeout
    debug: process.env.NODE_ENV !== 'production' || process.env.DEBUG_EMAIL === 'true',
    logger: process.env.NODE_ENV !== 'production' || process.env.DEBUG_EMAIL === 'true',
    tls: {
      // Allow ignoring cert errors if EMAIL_IGNORE_CERT_ERRORS is set, 
      // otherwise only fail on invalid certs in production
      rejectUnauthorized: process.env.EMAIL_IGNORE_CERT_ERRORS === 'true' ? false : (process.env.NODE_ENV === 'production'),
    },
  });
};

// Transporter will be lazily initialized in sendEmail
let transporter;

// Read email templates
const readTemplate = async (templateName, data) => {
  const templatePath = join(__dirname, `../../email-templates/${templateName}.ejs`);
  const template = fs.readFileSync(templatePath, 'utf-8');
  return ejs.render(template, data);
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const sendEmail = async (options, retryCount = 0) => {
  // Ensure we have a valid transporter
  if (!transporter) {
    try {
      transporter = createTransporter();
    } catch (error) {
      logger.error('Failed to create email transporter', { error: error.message });
      throw new Error('Email service is not properly configured');
    }
  }

  try {
    logger.info('Preparing to send email', {
      attempt: retryCount + 1,
      to: options.to,
      subject: options.subject
    });

    const fromName = process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Byblos';
    const fromEmail = process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER;

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || [],
      // Add message-id and other headers for better tracking
      messageId: `<${Date.now()}@${process.env.EMAIL_DOMAIN || 'byblos.exchange'}>`,
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Precedence': 'bulk'
      }
    };

    // Verify connection before sending
    try {
      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_EMAIL === 'true') {
        logger.debug('Verifying SMTP connection...');
      }
      await transporter.verify();
    } catch (verifyError) {
      logger.error('SMTP connection verification failed', {
        message: verifyError.message,
        code: verifyError.code
      });
      throw new Error(`SMTP connection failed: ${verifyError.message}`);
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info('Successfully sent email', { to: options.to, messageId: info.messageId });
      return info;
    } catch (sendError) {
      logger.error('Error sending email', {
        attempt: retryCount + 1,
        error: sendError.message,
        code: sendError.code
      });

      // If we have retries left, wait and try again
      if (retryCount < MAX_RETRIES) {
        logger.info('Retrying email delivery', { delay: RETRY_DELAY, nextAttempt: retryCount + 2 });
        await delay(RETRY_DELAY);
        return sendEmail(options, retryCount + 1);
      }

      // If we've exhausted retries, rethrow the error
      throw new Error(`Failed to send email after ${MAX_RETRIES + 1} attempts: ${sendError.message}`);
    }
  } catch (error) {
    logger.error('Fatal error in sendEmail', {
      message: error.message,
      retryCount,
      to: options.to,
      subject: options.subject
    });

    // If this is a connection error, we might want to recreate the transporter
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      logger.warn('Connection error detected, recreating transporter...');
      try {
        transporter = createTransporter();
        // If we have retries left, try again with the new transporter
        if (retryCount < MAX_RETRIES) {
          logger.info('Retrying with new transporter', { delay: RETRY_DELAY });
          await delay(RETRY_DELAY);
          return sendEmail(options, retryCount + 1);
        }
      } catch (transporterError) {
        logger.error('Failed to recreate transporter', { error: transporterError.message });
      }
    }

    throw new Error(`Failed to send email: ${error.message}`);
  }
};

export const sendVerificationEmail = async (email, token, userType = 'buyer') => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    // Include email in URL so backend can look up the user without a session
    const verificationUrl = `${baseUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`
    const appName = process.env.APP_NAME || 'Byblos'

    const html = await readTemplate('verify-email', {
      verificationUrl,
      appName,
      name: email.split('@')[0], // fallback name until we have it
    })

    await sendEmail({
      to: email,
      subject: `${appName} — Please verify your email address`,
      html,
      text: `Please verify your email by clicking: ${verificationUrl}\n\nThis link expires in 24 hours.`
    })

    logger.info('Verification email sent', { email, userType })
    return true
  } catch (error) {
    logger.error('Error sending verification email:', { email, error: error.message })
    throw error
  }
}

export const sendPasswordResetEmail = async (email, token, userType = 'seller') => {
  try {
    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/${userType}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    const appName = process.env.APP_NAME || 'Byblos';

    const html = await readTemplate('reset-password', {
      resetUrl,
      appName,
      userType: userType.charAt(0).toUpperCase() + userType.slice(1) // Capitalize first letter
    });

    await sendEmail({
      to: email,
      subject: `${appName} - Password Reset Request`,
      html,
      text: `You requested a password reset for your account. Please click on the following link to reset your password: ${resetUrl}`,
    });

    logger.info('Password reset email sent successfully', { email });
    return true;
  } catch (error) {
    logger.error('Error sending password reset email', { email, error: error.message });
    throw new Error('Failed to send password reset email');
  }
};

// Ensure environment variables are loaded if not already
if (!process.env.EMAIL_HOST) {
  const serverEnvPath = join(__dirname, '../.env');
  if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
  }
}


export const sendProductOrderConfirmationEmail = async (email, orderData) => {
  try {
    const templateData = {
      appName: process.env.APP_NAME || 'Byblos Atelier',
      websiteUrl: process.env.FRONTEND_URL || 'https://bybloshq.space',
      buyerName: orderData.buyer_name || 'Customer',
      orderNumber: orderData.order_number,
      orderDate: new Date(orderData.created_at).toLocaleDateString(),
      items: orderData.items || [],
      totalAmount: orderData.total_amount,
      bookingDetails: orderData.metadata?.product_type === 'service' ? {
        date: orderData.metadata.booking_date,
        time: orderData.metadata.booking_time,
        location: orderData.metadata.service_location,
        locationLabel: orderData.metadata.location_type === 'seller_visits_buyer' ? 'Client Location' : 'Service Location'
      } : null
    };

    const html = await readTemplate('product-order-confirmation', templateData);

    await sendEmail({
      to: email,
      subject: `Order Confirmation - #${orderData.order_number}`,
      html,
      text: `Thank you for your order! Order Number: ${orderData.order_number}`
    });
  } catch (error) {
    console.error('Error sending product order confirmation email:', error);
    throw error;
  }
};

export const sendNewOrderNotificationEmail = async (email, orderData) => {
  try {
    const templateData = {
      appName: process.env.APP_NAME || 'Byblos Atelier',
      websiteUrl: process.env.FRONTEND_URL || 'https://bybloshq.space',
      sellerName: orderData.seller_name || 'Seller',
      orderNumber: orderData.order_number,
      orderDate: new Date(orderData.created_at).toLocaleDateString(),
      items: orderData.items || [],
      buyerName: orderData.buyer_name,
      buyerPhone: orderData.buyer_whatsapp_number || orderData.buyer_phone,
      shippingAddress: orderData.shipping_address,
      totalAmount: orderData.total_amount,
      platformFee: orderData.platform_fee_amount,
      sellerPayout: orderData.seller_payout_amount,
      bookingDetails: orderData.metadata?.product_type === 'service' ? {
        date: orderData.metadata.booking_date,
        time: orderData.metadata.booking_time,
        location: orderData.metadata.service_location,
        locationLabel: orderData.metadata.location_type === 'seller_visits_buyer' ? 'Client Location' : 'Service Location'
      } : null
    };

    const html = await readTemplate('new-order-notification', templateData);

    await sendEmail({
      to: email,
      subject: `New Order Received - #${orderData.order_number}`,
      html,
      text: `You have received a new order! Order Number: ${orderData.order_number}`
    });
  } catch (error) {
    console.error('Error sending new order notification email:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, name) => {
  try {
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    const html = await readTemplate('welcome', {
      name,
      loginUrl,
      appName: process.env.APP_NAME || 'Byblos',
    });

    await sendEmail({
      to: email,
      subject: 'Welcome to Byblos',
      html,
      text: `Welcome to Byblos, ${name}! You can now log in to your account and start shopping and selling uniquely.`,
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};
