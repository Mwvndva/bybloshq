import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import ejs from 'ejs';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy Resend client initialization
let resendClient = null;
const getResendClient = () => {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

// Helper function to create transporter as fallback if RESEND_API_KEY is not set
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
    port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
    user: process.env.EMAIL_USERNAME || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASS,
    fromEmail: process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@byblosafrica.site',
    fromName: process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Byblos'
  };

  const requiredFields = ['host', 'port', 'user', 'pass'];
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    logger.warn('[EMAIL] Fallback SMTP configuration incomplete', { missingFields });
    return null;
  }

  const port = parseInt(config.port, 10);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    socketTimeout: 30000,
    connectionTimeout: 10000,
    greetingTimeout: 15000,
    dnsTimeout: 5000,
    tls: {
      rejectUnauthorized: process.env.EMAIL_IGNORE_CERT_ERRORS === 'true' ? false : (process.env.NODE_ENV === 'production'),
    },
  });
};

let transporter = null;

// Email templates are read once per name and cached for the lifetime of the process
const templateCache = new Map();
const readTemplate = async (templateName, data) => {
  let template = templateCache.get(templateName);
  if (!template) {
    const candidatePaths = [
      join(__dirname, `../../email-templates/${templateName}.ejs`),
      join(__dirname, `../../../email-templates/${templateName}.ejs`)
    ];
    let templatePath = null;
    for (const candidate of candidatePaths) {
      try {
        await fs.promises.access(candidate);
        templatePath = candidate;
        break;
      } catch {
        // try next candidate
      }
    }
    if (!templatePath) {
      throw new Error(`Email template not found: ${templateName}`);
    }
    template = await fs.promises.readFile(templatePath, 'utf-8');
    templateCache.set(templateName, template);
  }
  return ejs.render(template, data);
};

export const sendEmail = async (options) => {
  const fromName = process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Byblos';
  const fromEmail = process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_FROM || 'no-reply@byblosafrica.site';
  const fromAddress = `"${fromName}" <${fromEmail}>`;

  logger.info('[EMAIL] Preparing email dispatch', {
    to: options.to,
    subject: options.subject,
    from: fromAddress
  });

  // 1. Primary Transport: Resend HTTP API
  const resend = getResendClient();
  if (resend) {
    try {
      const payload = {
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || undefined,
      };

      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          path: att.path
        }));
      }

      const { data, error } = await resend.emails.send(payload);

      if (error) {
        logger.error('[EMAIL] Resend API error response:', { error, to: options.to });
        throw new Error(`Resend API Error: ${error.message || JSON.stringify(error)}`);
      }

      logger.info('[EMAIL] Successfully sent email via Resend', { to: options.to, id: data?.id });
      return data;
    } catch (resendError) {
      logger.error('[EMAIL] Resend send failure:', { error: resendError.message, to: options.to });
      throw resendError;
    }
  }

  // 2. Fallback Transport: Nodemailer SMTP
  logger.warn('[EMAIL] RESEND_API_KEY not found, falling back to SMTP transporter');
  if (!transporter) {
    transporter = createTransporter();
  }

  if (!transporter) {
    logger.warn('[EMAIL] Neither Resend nor SMTP is configured. Email skipped.', { to: options.to, subject: options.subject });
    return { id: 'mock-id', skipped: true };
  }

  try {
    const mailOptions = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || [],
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('[EMAIL] Successfully sent email via fallback SMTP', { to: options.to, messageId: info.messageId });
    return info;
  } catch (smtpError) {
    logger.error('[EMAIL] Fallback SMTP failed to send email', { error: smtpError.message, to: options.to });
    throw smtpError;
  }
};

export const sendVerificationEmail = async (email, token, userType = 'buyer') => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  logger.info('[EMAIL] Dispatching verification email', { email: normalizedEmail, userType });
  try {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://www.byblosafrica.site';
    const baseUrl = rawFrontendUrl.replace(/\/+$/, '');
    // Include email in URL so backend can look up the user without a session
    const verificationUrl = `${baseUrl}/verify-email?token=${token}&email=${encodeURIComponent(normalizedEmail)}&type=${userType}`;
    const appName = process.env.APP_NAME || 'Byblos';

    const html = await readTemplate('verify-email', {
      verificationUrl,
      appName,
      name: normalizedEmail.split('@')[0], // fallback name until we have it
    });

    const result = await sendEmail({
      to: normalizedEmail,
      subject: `${appName} — Please verify your email address`,
      html,
      text: `Please verify your email by clicking: ${verificationUrl}\n\nThis link expires in 24 hours.`
    });

    if (result?.skipped) {
      logger.warn('[EMAIL] Verification email skipped (no email transport configured)', { email: normalizedEmail, userType });
    } else {
      logger.info('[EMAIL] Verification email sent successfully', { email: normalizedEmail, userType, id: result?.id });
    }

    return true;
  } catch (error) {
    logger.error('[EMAIL] Error sending verification email:', { email: normalizedEmail, error: error.message, stack: error.stack });
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, token, userType = 'seller') => {
  try {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://www.byblosafrica.site';
    const baseUrl = rawFrontendUrl.replace(/\/+$/, '');
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
      websiteUrl: process.env.FRONTEND_URL || 'https://byblosafrica.site',
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
      } : null,
      downloadUrl: orderData.metadata?.download_url || null,
      downloadUrls: orderData.metadata?.download_urls || [],
      pre_handoff_sla: orderData.pre_handoff_sla || orderData.preHandoffSla || orderData.metadata?.pre_handoff_sla || null,
      custom_product: orderData.custom_product || orderData.customProduct || orderData.metadata?.custom_product || null,
      custom_production_deadline_at: orderData.custom_production_deadline_at || orderData.customProductionDeadlineAt || orderData.metadata?.pre_handoff_sla?.ready_deadline_at || orderData.metadata?.custom_production_deadline_at || null,
      custom_production_grace_deadline_at: orderData.custom_production_grace_deadline_at || orderData.customProductionGraceDeadlineAt || orderData.metadata?.pre_handoff_sla?.ready_grace_deadline_at || orderData.metadata?.custom_production_grace_deadline_at || null
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
      websiteUrl: process.env.FRONTEND_URL || 'https://byblosafrica.site',
      sellerName: orderData.seller_name || 'Seller',
      orderNumber: orderData.order_number,
      orderDate: new Date(orderData.created_at).toLocaleDateString(),
      items: orderData.items || [],
      buyerName: orderData.buyer_name,
      buyerPhone: orderData.buyer_whatsapp_number || orderData.buyer_phone,
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

export const sendPaymentReceiptEmail = async (email, orderData, isSeller = false) => {
  try {
    const receiptId = orderData.receipt_id || orderData.receiptId || orderData.receipt_number || orderData.payment_reference || 'Receipt pending';
    const transactionId = orderData.transaction_id
      || orderData.transactionId
      || orderData.payment_reference
      || orderData.provider_reference
      || receiptId;
    const paymentDate = orderData.paid_at || orderData.paidAt || orderData.completed_at || new Date();

    const templateData = {
      appName: process.env.APP_NAME || 'Byblos Atelier',
      websiteUrl: process.env.FRONTEND_URL || 'https://byblosafrica.site',
      buyerName: orderData.buyer_name || 'Customer',
      buyerEmail: orderData.buyer_email || 'Not specified',
      orderNumber: orderData.order_number,
      receiptTitle: orderData.receipt_title || orderData.receiptTitle || 'Official Payment Receipt',
      billingLabel: orderData.billing_label || orderData.billingLabel || 'Billed To',
      confirmationNote: orderData.confirmation_note || orderData.confirmationNote || 'Payment confirmed. This serves as your official record of purchase.',
      receiptId,
      paymentDate: new Date(paymentDate).toLocaleDateString(),
      items: orderData.items || [],
      totalAmount: orderData.total_amount,
      paymentMethod: orderData.payment_method || 'mpesa',
      transactionId,
      isSeller,
      pre_handoff_sla: orderData.pre_handoff_sla || orderData.preHandoffSla || orderData.metadata?.pre_handoff_sla || null,
      custom_product: orderData.custom_product || orderData.customProduct || orderData.metadata?.custom_product || null,
      custom_production_deadline_at: orderData.custom_production_deadline_at || orderData.customProductionDeadlineAt || orderData.metadata?.pre_handoff_sla?.ready_deadline_at || orderData.metadata?.custom_production_deadline_at || null,
      custom_production_grace_deadline_at: orderData.custom_production_grace_deadline_at || orderData.customProductionGraceDeadlineAt || orderData.metadata?.pre_handoff_sla?.ready_grace_deadline_at || orderData.metadata?.custom_production_grace_deadline_at || null
    };

    const html = await readTemplate('product-payment-receipt', templateData);

    await sendEmail({
      to: email,
      subject: `Payment Receipt - Order #${orderData.order_number}`,
      html,
      text: `Payment Receipt for Order #${orderData.order_number}. Total amount: KSh ${orderData.total_amount}`
    });
  } catch (error) {
    console.error('Error sending payment receipt email:', error);
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
