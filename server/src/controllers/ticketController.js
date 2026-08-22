import { sendEmail } from '../utils/email.js';
import path from 'path';
import fs from 'fs';
import ejs from 'ejs';
import { qrCodeToBuffer, saveQrCodeAsPng } from '../utils/qrCodeUtils.js';

// Path to email templates
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the root directory of the project (go up two levels from src/controllers)
const projectRoot = path.resolve(__dirname, '../..');
const emailTemplatesDir = path.join(projectRoot, 'email-templates');

// Create the email-templates directory if it doesn't exist
if (!fs.existsSync(emailTemplatesDir)) {
  console.warn(`Email templates directory does not exist at: ${emailTemplatesDir}`);
  try {
    fs.mkdirSync(emailTemplatesDir, { recursive: true });
    console.log(`Created email templates directory at: ${emailTemplatesDir}`);
  } catch (error) {
    console.error('Failed to create email templates directory:', error);
  }
}

console.log('Email templates directory:', emailTemplatesDir);
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Read email template
const readTemplate = async (templateName, data) => {
  try {
    const templatePath = path.join(emailTemplatesDir, `${templateName}.ejs`);
    console.log(`Looking for template at: ${templatePath}`);
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at: ${templatePath}`);
    }
    
    const template = fs.readFileSync(templatePath, 'utf-8');
    return ejs.render(template, data);
  } catch (error) {
    console.error('Error in readTemplate:', {
      error: error.message,
      templateName,
      emailTemplatesDir,
      filesInDir: fs.existsSync(emailTemplatesDir) ? fs.readdirSync(emailTemplatesDir) : 'Directory does not exist'
    });
    throw error;
  }
};

export const sendTicketEmail = async (req, res) => {
  console.log('Received email request:', {
    body: {
      ...req.body,
      ticketData: {
        ...req.body.ticketData,
        qrCode: req.body.ticketData?.qrCode ? '***[BASE64_DATA]***' : 'MISSING'
      }
    },
    headers: req.headers
  });

  try {
    const { to, subject, ticketData } = req.body;

    // Validate required fields
    if (!to || !subject || !ticketData) {
      const error = new Error('Missing required fields');
      error.statusCode = 400;
      error.details = { 
        missing: [
          !to && 'to', 
          !subject && 'subject', 
          !ticketData && 'ticketData'
        ].filter(Boolean)
      };
      throw error;
    }
    
    if (!ticketData.qrCode) {
      console.warn('No QR code data provided in ticket data');
    }

    // Ensure price is a valid number
    let price = 0;
    
    // Try to get price from different possible locations
    if (ticketData.price !== undefined && ticketData.price !== null) {
      price = typeof ticketData.price === 'number' ? ticketData.price : 
             parseFloat(ticketData.price) || 0;
    } else if (ticketData.totalPrice !== undefined && ticketData.totalPrice !== null) {
      // If price is not set but totalPrice is, use that
      price = typeof ticketData.totalPrice === 'number' ? ticketData.totalPrice : 
             parseFloat(ticketData.totalPrice) || 0;
      
      // If quantity is provided, calculate price per ticket
      if (ticketData.quantity && ticketData.quantity > 1) {
        price = price / ticketData.quantity;
      }
    }
    
    // Ensure price is a positive number
    price = Math.max(0, price);
    
    // Format price with KES currency
    const formattedPrice = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
    
    console.log('Formatted price:', { 
      original: ticketData.price, 
      totalPrice: ticketData.totalPrice,
      quantity: ticketData.quantity,
      processed: price, 
      formatted: formattedPrice 
    });

    // Format purchase date with validation
    let formattedDate = 'Date not available';
    try {
      // Try to parse the date if it exists
      const purchaseDate = ticketData.purchaseDate ? new Date(ticketData.purchaseDate) : new Date();
      
      // Check if the date is valid
      if (isNaN(purchaseDate.getTime())) {
        throw new Error('Invalid date');
      }
      
      // Format the date
      formattedDate = purchaseDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Nairobi' // Set timezone to East Africa Time
      });
    } catch (error) {
      console.error('Error formatting purchase date:', error.message);
      // Fallback to current date if there's an error
      formattedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Nairobi'
      });
    }

    // Prepare QR code as an embedded image
    let qrCodeBuffer = null;
    
    if (ticketData.qrCode) {
      try {
        // If it's a data URL, convert it to a buffer
        if (ticketData.qrCode.startsWith('data:image/')) {
          qrCodeBuffer = await qrCodeToBuffer(ticketData.qrCode);
        } else {
          // If it's just the QR code data, generate the QR code
          const QRCode = (await import('qrcode')).default;
          const qrCodeDataUrl = await QRCode.toDataURL(ticketData.qrCode, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 1,
            scale: 4
          });
          qrCodeBuffer = await qrCodeToBuffer(qrCodeDataUrl);
        }
      } catch (error) {
        console.error('Error processing QR code:', error);
        // Continue without QR code if there's an error
      }
    }

    // Prepare template data
    const templateData = {
      appName: process.env.APP_NAME || 'Byblos',
      subject: subject, // Add subject to template data
      ...ticketData,
      
      // Price information - ensure it's always available in multiple formats
      price: price, // The numeric price
      formattedPrice: formattedPrice, // Formatted price string (e.g., 'KSh 1,000')
      
      // Date information
      purchaseDate: ticketData.purchaseDate,
      formattedDate: formattedDate,
      
      // Ensure all template variables are defined
      title: subject, // Some templates might use 'title' instead of 'subject'
      eventName: ticketData.eventName, // Make sure eventName is available
      event: ticketData.eventName, // Alias for eventName
      
      // Structured ticket data
      ticket: {
        number: ticketData.ticketNumber,
        type: ticketData.ticketType,
        price: price, // Numeric price
        formattedPrice: formattedPrice, // Formatted price string
        purchaseDate: ticketData.purchaseDate,
        formattedDate: formattedDate,
        quantity: ticketData.quantity || 1
      },
      
      // User information
      user: {
        name: ticketData.customerName,
        email: ticketData.customerEmail
      },
      
      // QR code is embedded as an attachment with cid:qrcode
      
      // Add quantity at root level for easier access
      quantity: ticketData.quantity || 1
    };
    
    console.log('Template data prepared:', {
      price: templateData.price,
      formattedPrice: templateData.formattedPrice,
      ticketPrice: templateData.ticket?.price,
      quantity: templateData.quantity
    });

    // Log template data for debugging
    console.log('Preparing to render email template with data:', {
      ...templateData,
      qrCode: templateData.qrCode ? '***[BASE64_DATA]***' : 'MISSING'
    });
    
    let html;
    try {
      // Get the path to the email templates directory
      const emailTemplatesDir = path.join(process.cwd(), 'email-templates');
      const templatePath = path.join(emailTemplatesDir, 'ticket-confirmation.ejs');
      
      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template not found at: ${templatePath}`);
      }
      
      // Read and render the template
      const template = fs.readFileSync(templatePath, 'utf-8');
      html = ejs.render(template, templateData);
      
      // Verify the rendered HTML
      if (!html || typeof html !== 'string' || html.trim() === '') {
        throw new Error('Rendered template is empty');
      }
      
      console.log('Email template rendered successfully');
    } catch (templateError) {
      console.error('Failed to render email template:', {
        error: templateError.message,
        stack: templateError.stack,
        templatePath: templatePath || 'Not determined',
        templateData: Object.keys(templateData),
        currentWorkingDir: process.cwd(),
        emailTemplatesDir: emailTemplatesDir || 'Not determined',
        dirContents: emailTemplatesDir && fs.existsSync(emailTemplatesDir) 
          ? fs.readdirSync(emailTemplatesDir) 
          : 'Directory does not exist'
      });
      throw new Error(`Failed to render email template: ${templateError.message}`);
    }

    // Prepare email options
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Byblos Experience'}" <${process.env.EMAIL_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: `Thank you for your purchase! Here's your ticket information:

Event: ${ticketData.eventName}
Ticket Number: ${ticketData.ticketNumber}
Ticket Type: ${ticketData.ticketType}
Price: ${formattedPrice}

Please present this email and the QR code at the event entrance.

Thank you for choosing Byblos Experience!`,
      attachments: []
    };

    // Add QR code as an attachment if available
    if (qrCodeBuffer) {
      mailOptions.attachments.push({
        filename: `ticket-${ticketData.ticketNumber}.png`,
        content: qrCodeBuffer,
        cid: 'qrcode' // Content ID to reference in the HTML
      });
    }

    console.log('Sending email with options:', {
      ...mailOptions,
      html: '***[HTML_CONTENT]***',
      text: mailOptions.text.substring(0, 100) + '...'
    });

    // Send email
    await sendEmail(mailOptions);
    console.log('Email sent successfully');

    res.status(200).json({
      success: true,
      message: 'Ticket email sent successfully',
    });
  } catch (error) {
    console.error('❌ Error sending ticket email:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      statusCode: error.statusCode,
      details: error.details
    });
    
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Failed to send ticket email';
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    });
  }
};
