#!/usr/bin/env npx ts-node
/**
 * Email Testing Utility
 * Phase 0 Task 0.4: Test email flow
 *
 * Usage:
 *   npx ts-node scripts/test-email.ts
 *
 * Prerequisites:
 *   1. Set RESEND_API_KEY in Supabase secrets
 *   2. Have at least one user with email preferences enabled
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fapxxswgdfomqtugibgf.supabase.co';

async function testDigestEmail() {
  console.log('=================================');
  console.log('SyllabusStack Email Test Utility');
  console.log('=================================\n');

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.log('\nTo get your service role key:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to Settings > API');
    console.log('3. Copy the "service_role" key (keep this secret!)');
    console.log('\nThen run:');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_key npx ts-node scripts/test-email.ts');
    process.exit(1);
  }

  console.log('Step 1: Testing edge function availability...');

  try {
    // Test 1: Check if function is reachable
    const healthCheck = await fetch(`${SUPABASE_URL}/functions/v1/send-digest-email`, {
      method: 'OPTIONS',
    });

    if (!healthCheck.ok) {
      console.error('FAILED: Edge function not reachable');
      console.log('Make sure the function is deployed: supabase functions deploy send-digest-email');
      process.exit(1);
    }

    console.log('PASSED: Edge function is reachable\n');

    console.log('Step 2: Triggering digest email...');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-digest-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FAILED: Email function returned error');
      console.log('Error:', result.error || result);

      if (result.error?.includes('RESEND_API_KEY')) {
        console.log('\nThe RESEND_API_KEY is not configured.');
        console.log('Follow the Email_Setup_Guide.md to configure it.');
      }
      process.exit(1);
    }

    console.log('PASSED: Email function executed successfully\n');

    console.log('Results:');
    console.log('---------');
    console.log(`Emails sent: ${result.emailsSent || 0}`);
    console.log(`Errors: ${result.errors || 0}`);

    if (result.details?.sent?.length > 0) {
      console.log('\nRecipients:');
      result.details.sent.forEach((email: string) => {
        console.log(`  - ${email}`);
      });
    }

    if (result.emailsSent === 0) {
      console.log('\nNo emails were sent. This could mean:');
      console.log('1. No users have weekly_digest enabled in email preferences');
      console.log('2. All users have been active recently');
      console.log('3. No users have an email address set');
      console.log('\nTo test with a specific user, ensure they:');
      console.log('- Have weekly_digest: true in email_preferences');
      console.log('- Have not been active in the last 7 days');
    }

    console.log('\n=================================');
    console.log('Email Test Complete!');
    console.log('=================================');

  } catch (error) {
    console.error('FAILED: Unexpected error');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testDigestEmail();
