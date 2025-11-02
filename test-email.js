/**
 * Test Brevo Email Configuration
 * Run this file to test if your Brevo setup is working
 * 
 * Usage: node testBrevo.js
 */

require('dotenv').config();
const sendEmail = require('./utils/sendEmail');
const { meetingRequestTemplate } = require('./utils/emailTemplates');

const testBrevoConfiguration = async () => {
  console.log('\n🧪 ========================================');
  console.log('   TESTING BREVO CONFIGURATION');
  console.log('========================================\n');

  // Check environment variables
  console.log('📋 Checking environment variables...');
  const requiredVars = ['BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME'];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    console.log('\n💡 Please check your .env file and add the missing variables.');
    console.log('\n📝 Get your API key from: https://app.brevo.com/settings/keys/api\n');
    process.exit(1);
  }

  console.log('✅ All environment variables found\n');

  // Display current configuration
  console.log('📧 Current Brevo Configuration:');
  console.log('   API Key:', process.env.BREVO_API_KEY.substring(0, 20) + '...');
  console.log('   From Name:', process.env.EMAIL_FROM_NAME);
  console.log('   From Email:', process.env.EMAIL_FROM);
  console.log('');

  // Send test email
  try {
    console.log('📤 Sending test email via Brevo...\n');

    // Change this to your email for testing
    const testEmail = process.env.TEST_EMAIL || 'putra.a.gusti.anggara@gmail.com';
    const testName = 'Test Client';

    // Generate test HTML email
    const htmlContent = meetingRequestTemplate({
      clientName: testName,
      unitNumber: 'TEST-001',
      preferredDate: 'Senin, 15 Januari 2025',
      preferredTime: '10:00 WIB',
      alternateDate: 'Selasa, 16 Januari 2025',
      alternateTime: '14:00 WIB',
      meetingType: 'virtual',
      notes: 'This is a test email from Brevo configuration test'
    });

    await sendEmail({
      to: testEmail,
      toName: testName,
      subject: '✅ Brevo Test - Meeting Request Confirmation',
      htmlContent: htmlContent
    });

    console.log('✅ TEST SUCCESSFUL!');
    console.log('========================================');
    console.log('✨ Email sent successfully via Brevo!');
    console.log('📬 Check your inbox at:', testEmail);
    console.log('📊 Check Brevo dashboard for delivery status');
    console.log('🔗 Dashboard: https://app.brevo.com/');
    console.log('========================================\n');

    console.log('💡 Next Steps:');
    console.log('1. Check the inbox of', testEmail);
    console.log('2. Verify the email looks good and all formatting is correct');
    console.log('3. Check spam folder if email not received');
    console.log('4. Monitor delivery in Brevo dashboard');
    console.log('5. If successful, you\'re ready to use Brevo in production!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('========================================\n');
    
    console.log('💡 Troubleshooting Tips:');
    console.log('1. Check your BREVO_API_KEY is correct');
    console.log('2. Verify your API key is active in Brevo dashboard');
    console.log('3. Make sure EMAIL_FROM is a verified sender in Brevo');
    console.log('4. Check if you\'ve exceeded daily sending limits');
    console.log('5. Verify your Brevo account is active and not suspended');
    console.log('6. Check Brevo dashboard for any account issues');
    console.log('\n📝 Brevo Free Plan Limits:');
    console.log('   - 300 emails per day');
    console.log('   - Brevo logo in emails');
    console.log('   - Basic features');
    console.log('\n🔗 Get help: https://help.brevo.com/\n');
    
    process.exit(1);
  }
};

// Run the test
testBrevoConfiguration();