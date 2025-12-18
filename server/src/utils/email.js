import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import ejs from 'ejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to create transporter with retry logic
const createTransporter = () => {
  // Validate required environment variables
  const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USERNAME', 'EMAIL_PASSWORD', 'EMAIL_FROM_EMAIL', 'EMAIL_FROM_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Missing required email configuration:', missingVars.join(', '));
    throw new Error(`Missing required email configuration: ${missingVars.join(', ')}`);
  }

  // Parse port as number and handle secure flag
  const port = parseInt(process.env.EMAIL_PORT, 10);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  console.log('Creating transporter with config:', {
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USERNAME,
      // Don't log the actual password
      hasPassword: !!process.env.EMAIL_PASSWORD
    }
  });

  // Create transporter with connection pooling and timeout
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    pool: true, // use pooled connections
    maxConnections: 5, // maximum number of connections in the pool
    maxMessages: 100, // maximum number of messages to send through a single connection
    socketTimeout: 30000, // 30 seconds socket timeout
    connectionTimeout: 10000, // 10 seconds connection timeout
    greetingTimeout: 30000, // 30 seconds to wait for greeting after connection
    dnsTimeout: 5000, // 5 seconds DNS lookup timeout
    debug: process.env.NODE_ENV !== 'production', // Enable debug logging in non-production
    logger: process.env.NODE_ENV !== 'production', // Enable logging in non-production
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: process.env.NODE_ENV === 'production',
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
      console.error('Failed to create email transporter:', error);
      throw new Error('Email service is not properly configured');
    }
  }

  try {
    console.log(`[Email] Preparing to send email (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, {
      to: options.to,
      subject: options.subject,
      hasHtml: !!options.html,
      hasText: !!options.text,
      attachmentCount: options.attachments ? options.attachments.length : 0
    });

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
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
      await transporter.verify();
      console.log('Testing SMTP connection...');
      const isConnected = await transporter.verify();
      console.log('SMTP connection verified:', isConnected);
    } catch (verifyError) {
      console.error('SMTP connection verification failed:', {
        message: verifyError.message,
        code: verifyError.code,
        command: verifyError.command
      });
      throw new Error(`SMTP connection failed: ${verifyError.message}`);
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email] Successfully sent email to ${options.to}:`, info.messageId);
      return info;
    } catch (sendError) {
      console.error(`[Email] Error sending email (attempt ${retryCount + 1}):`, {
        error: sendError.message,
        code: sendError.code,
        command: sendError.command,
        response: sendError.response
      });

      // If we have retries left, wait and try again
      if (retryCount < MAX_RETRIES) {
        console.log(`[Email] Retrying in ${RETRY_DELAY}ms...`);
        await delay(RETRY_DELAY);
        return sendEmail(options, retryCount + 1);
      }

      // If we've exhausted retries, rethrow the error
      throw new Error(`Failed to send email after ${MAX_RETRIES + 1} attempts: ${sendError.message}`);
    }
  } catch (error) {
    console.error('[Email] Fatal error in sendEmail:', {
      message: error.message,
      stack: error.stack,
      retryCount,
      to: options.to,
      subject: options.subject
    });

    // If this is a connection error, we might want to recreate the transporter
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      console.log('[Email] Connection error detected, recreating transporter...');
      try {
        transporter = createTransporter();
        // If we have retries left, try again with the new transporter
        if (retryCount < MAX_RETRIES) {
          console.log(`[Email] Retrying with new transporter in ${RETRY_DELAY}ms...`);
          await delay(RETRY_DELAY);
          return sendEmail(options, retryCount + 1);
        }
      } catch (transporterError) {
        console.error('[Email] Failed to recreate transporter:', transporterError);
      }
    }

    throw new Error(`Failed to send email: ${error.message}`);
    throw error;
  }
};

export const sendVerificationEmail = async (email, token) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const html = await readTemplate('verify-email', {
      verificationUrl,
      appName: process.env.APP_NAME || 'Byblos',
    });

    await sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html,
      text: `Please verify your email by clicking on the following link: ${verificationUrl}`,
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

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
      subject: `${appName} - ${userType === 'organizer' ? 'Organizer ' : ''}Password Reset Request`,
      html,
      text: `You requested a password reset for your ${userType} account. Please click on the following link to reset your password: ${resetUrl}`,
    });

    console.log('Password reset email sent successfully to:', email);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
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

export const sendPaymentConfirmationEmail = async (email, paymentData) => {
  try {
    const templateData = {
      // App info
      appName: process.env.APP_NAME || 'Byblos Atelier',
      websiteUrl: process.env.FRONTEND_URL || 'https://bybloshq.space',

      // Payment & Ticket Info
      ticketNumber: paymentData.ticketNumber || 'N/A',
      ticketType: paymentData.ticketType || 'General Admission',
      eventName: paymentData.eventName || paymentData.event_name || 'Event',
      eventDate: paymentData.eventDate || paymentData.event_date || new Date().toLocaleDateString(),
      eventLocation: paymentData.eventLocation || paymentData.event_location || 'Venue',
      customerName: paymentData.customerName || paymentData.customer_name || 'Guest',
      customerEmail: email,
      price: parseFloat(paymentData.price || paymentData.amount || 0).toFixed(2),
      quantity: paymentData.quantity || 1,
      totalPrice: parseFloat(paymentData.totalPrice || paymentData.amount || 0).toFixed(2),
      purchaseDate: paymentData.purchaseDate || new Date().toLocaleString(),
      qrCode: paymentData.qrCode || '',
      reference: paymentData.reference || paymentData.invoice_id,

      // Compatibility aliases
      event: paymentData.event_name || paymentData.eventName || 'Event',
      formattedDate: paymentData.event_date || paymentData.eventDate || '',
      ticket: {
        number: paymentData.ticketNumber,
        type: paymentData.ticketType,
        price: paymentData.price,
        quantity: paymentData.quantity
      }
    };

    const html = await readTemplate('ticket-confirmation', templateData);

    const mailOptions = {
      to: email,
      subject: `Your Ticket Confirmation - ${templateData.eventName}`,
      html,
      text: `Thank you for your purchase! Event: ${templateData.eventName}, Ticket: ${templateData.ticketNumber}`,
      attachments: []
    };

    // Add QR code CID attachment if present
    if (paymentData.qrCode && paymentData.qrCode.startsWith('data:image/')) {
      const { qrCodeToBuffer } = await import('./qrCodeUtils.js');
      const qrBuffer = await qrCodeToBuffer(paymentData.qrCode);
      mailOptions.attachments.push({
        filename: `ticket-qr.png`,
        content: qrBuffer,
        cid: 'qrcode'
      });
    }

    await sendEmail(mailOptions);
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    throw error;
  }
};

export const sendProductOrderConfirmationEmail = async (email, orderData) => {
  try {
    const templateData = {
      appName: process.env.APP_NAME || 'Byblos Atelier',
      websiteUrl: process.env.FRONTEND_URL || 'https://bybloshq.space',
      buyerName: orderData.buyer_name || 'Customer',
      orderNumber: orderData.order_number,
      orderDate: new Date(orderData.created_at).toLocaleDateString(),
      items: orderData.items || [],
      totalAmount: orderData.total_amount
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
      buyerPhone: orderData.buyer_phone,
      shippingAddress: orderData.shipping_address,
      totalAmount: orderData.total_amount,
      platformFee: orderData.platform_fee_amount,
      sellerPayout: orderData.seller_payout_amount
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
      text: `Welcome to Byblos, ${name}! You can now log in to your account and start creating events.`,
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};
