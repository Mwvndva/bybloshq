import { sendEmail } from '../utils/email.js';

export const sendWithdrawalEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required email fields'
      });
    }

    console.log('Sending withdrawal email with:', { to, subject, hasHtml: !!html });

    const info = await sendEmail({
      to,
      subject,
      html
    });

    console.log('Withdrawal email sent successfully:', info.messageId);

    res.status(200).json({
      status: 'success',
      message: 'Withdrawal request email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending withdrawal email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send withdrawal request email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
