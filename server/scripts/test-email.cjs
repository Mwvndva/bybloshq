require('dotenv').config();
const path = require('path');
const { sendEmail, _test } = require('../src/utils/email');

// Load environment variables from server root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Test configuration
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

// Helper function to log test results
function logTestResult(testName, result) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(50)}`);
  console.log('RESULT:', result.success ? '✅ SUCCESS' : '❌ FAILED');
  
  if (result.error) {
    console.error('ERROR:', result.error);
  } else {
    console.log('DETAILS:', JSON.stringify(result.details, null, 2));
  }
  
  console.log('\n');
  return result.success;
}

async function testDirectEmail() {
  try {
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: '📧 Direct Test Email from Byblos',
      text: 'This is a test email sent directly via SMTP.',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email sent directly via SMTP.</p>
        <p>Time: ${new Date().toISOString()}</p>
      `,
      priority: 'high',
    });
    
    return {
      success: true,
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
}

async function testTemplateEmail() {
  try {
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: '🎨 Test Email with Template',
      template: 'test-email',
      templateData: {
        name: 'Template Tester',
        message: 'This email uses a template with custom styling and layout.',
        actionUrl: 'https://byblos.exchange/dashboard',
        actionText: 'Go to Dashboard',
      },
      priority: 'normal',
    });
    
    return {
      success: true,
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        templateRendered: !!result.html && result.html.length > 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
}

async function testAttachmentEmail() {
  try {
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: '📎 Test Email with Attachment',
      text: 'This is a test email with an attachment.',
      html: `
        <h1>Test Email with Attachment</h1>
        <p>This email includes a test attachment.</p>
        <p>Time: ${new Date().toISOString()}</p>
      `,
      attachments: [
        {
          filename: 'test.txt',
          content: 'This is a test attachment.',
          contentType: 'text/plain'
        }
      ]
    });
    
    return {
      success: true,
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        hasAttachments: result.message && result.message.attachments && result.message.attachments.length > 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
}

async function testInvalidEmail() {
  try {
    // This should fail with invalid email
    await sendEmail({
      to: 'invalid-email',
      subject: 'This should fail',
      text: 'This email should not be sent.'
    });
    
    return { success: false, error: 'Expected validation error but email was sent' };
  } catch (error) {
    return {
      success: error.message.includes('valid email'),
      error: error.message,
      expected: 'Validation error for invalid email'
    };
  }
}

async function runTests() {
  console.log('🚀 Starting Email System Tests');
  console.log(`📧 Test emails will be sent to: ${TEST_EMAIL}`);
  console.log('='.repeat(60) + '\n');
  
  // Clear caches before tests
  _test.clearCaches();
  
  // Run tests
  const testResults = [
    { name: 'Direct Email Sending', test: testDirectEmail },
    { name: 'Template Email Rendering', test: testTemplateEmail },
    { name: 'Email with Attachment', test: testAttachmentEmail },
    { name: 'Invalid Email Validation', test: testInvalidEmail },
  ];
  
  let allPassed = true;
  
  for (const { name, test } of testResults) {
    const result = await test();
    if (!logTestResult(name, result)) {
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`TEST SUMMARY: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(60) + '\n');
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error in test runner:', error);
  process.exit(1);
});
