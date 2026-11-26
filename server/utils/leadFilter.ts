/**
 * Identifies unmistakable internal QA / developer test lead submissions
 * so they never pollute client lead tables, modals, or totals.
 * Deliberately strict to avoid false positives on real customer inquiries.
 */
export function isInternalTestLead(lead: any): boolean {
  if (!lead) return false;

  const formData = lead.form_data?.body || lead.form_data || {};

  const email = String(
    formData['your-email'] ||
      formData['email'] ||
      lead.email ||
      ''
  )
    .trim()
    .toLowerCase();

  const name = String(
    formData['your-name'] ||
      formData['name'] ||
      formData['first-name'] ||
      formData['fist-name'] ||
      lead.customerName ||
      lead.name ||
      ''
  )
    .trim()
    .toLowerCase();

  const message = String(
    formData['your-comments'] ||
      formData['your-message'] ||
      formData['message'] ||
      lead.message ||
      ''
  )
    .trim()
    .toLowerCase();

  // 1. Internal agency / test emails
  if (email) {
    if (
      email.endsWith('@netstripes.com') ||
      email.endsWith('@netstripes.com.au') ||
      email.startsWith('test@') ||
      email.startsWith('test-leadcheck@') ||
      email === 'testing@gmail.com' ||
      email === 'test@example.com'
    ) {
      return true;
    }
  }

  // 2. Explicit test names (e.g. "test", "test test", "SHI Test", "TEST - Netstripes Lead Check")
  if (name) {
    if (
      /^test+s?(\s+test+s?\d*|\d*)?$/i.test(name) ||
      /\btest\b/i.test(name) ||
      name.includes('netstripes lead check') ||
      name.includes('shihab netstripes')
    ) {
      return true;
    }
  }

  // 3. Explicit test messages
  if (message) {
    if (
      message === 'test' ||
      message === 'testing' ||
      message.includes('test submission by netstripes') ||
      message.includes('test enquiry to confirm the contact form')
    ) {
      return true;
    }
  }

  return false;
}
