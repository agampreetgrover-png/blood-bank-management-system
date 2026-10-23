// Input checks shared by more than one controller

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;
const URGENCIES = ['Normal', 'Urgent', 'Critical'];

// The website lets people type a mobile number with spaces or dashes ("98765 43210")
function cleanPhone(phone) {
  return String(phone).replace(/[\s-]/g, '');
}

module.exports = { EMAIL_RE, PHONE_RE, URGENCIES, cleanPhone };
