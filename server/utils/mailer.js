const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const BRAND = 'Blood Bank';
const OTP_TTL_MINUTES = 10;

// Which service sends the code emails, picked from server/.env:
//   gmail   - GMAIL_USER + GMAIL_APP_PASSWORD. Reaches any address without owning a domain.
//   resend  - RESEND_API_KEY. Reaches any address only with a verified domain in MAIL_FROM; the default
//             onboarding@resend.dev sender only delivers to the email the Resend account was made with.
//   console - neither is set (local development only): the code is printed in the server console.
function mailProvider() {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'console';
}

let gmail = null;
function getGmail() {
  if (!gmail) {
    gmail = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        // Google shows app passwords in groups of four ("abcd efgh ijkl mnop")
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '')
      }
    });
  }
  return gmail;
}

let resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const ACTIONS = {
  signup: 'finish creating your account',
  login: 'finish logging in',
  reset: 'set a new password'
};

// A login code is only sent after the correct password, so an unexpected one means someone else knows it
const NOTES = {
  login: "If this wasn't you, someone else knows your password. Change it with \"Forgot password?\" on the login page."
};
const DEFAULT_NOTE = "If you didn't ask for it, you can ignore this email.";

function otpEmail(code, purpose) {
  const action = ACTIONS[purpose];
  const note = NOTES[purpose] || DEFAULT_NOTE;
  const subject = `${code} is your ${BRAND} verification code`;
  const text =
    `Use this code to ${action}: ${code}\n\n` +
    `It expires in ${OTP_TTL_MINUTES} minutes. ${note}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#222">
      <h2 style="margin:0 0 12px;font-size:18px">${BRAND}</h2>
      <p style="margin:0 0 16px;font-size:14px">Use this code to ${action}:</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
      <p style="margin:0;font-size:12px;color:#666">
        It expires in ${OTP_TTL_MINUTES} minutes. ${note}
      </p>
    </div>`;
  return { subject, text, html };
}

// Emails the one-time code. Throws if the email could not be sent.
async function sendOtpEmail(to, code, purpose) {
  const provider = mailProvider();
  if (provider === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No email service is set up (GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY)');
    }
    console.warn(`[mail] no email service set - ${purpose} code for ${to}: ${code}`);
    return;
  }

  const { subject, text, html } = otpEmail(code, purpose);

  if (provider === 'gmail') {
    // Gmail only sends as the signed-in account, so From is always GMAIL_USER
    await getGmail().sendMail({ from: { name: BRAND, address: process.env.GMAIL_USER }, to, subject, text, html });
    return;
  }

  // The Resend SDK reports failures in `error` rather than throwing
  const { error } = await getResend().emails.send({
    from: process.env.MAIL_FROM || `${BRAND} <onboarding@resend.dev>`,
    to,
    subject,
    text,
    html
  });
  if (error) {
    throw new Error(`Resend rejected the email (${error.name || 'error'}): ${error.message}`);
  }
}

// Run at startup, so a wrong Gmail app password shows up in the console straight away, not at the first sign up
async function checkMailer() {
  const provider = mailProvider();
  if (provider === 'gmail') {
    try {
      await getGmail().verify();
      console.log(`Email: sending codes from ${process.env.GMAIL_USER} through Gmail`);
    } catch (error) {
      console.error(`Email: Gmail login failed for ${process.env.GMAIL_USER}. Check GMAIL_APP_PASSWORD. (${error.message})`);
    }
  } else if (provider === 'resend') {
    console.log(`Email: sending codes through Resend as ${process.env.MAIL_FROM || 'onboarding@resend.dev'}`);
  } else {
    console.log('Email: no email service set up, codes are printed in this console instead');
  }
}

module.exports = { sendOtpEmail, checkMailer, OTP_TTL_MINUTES };
