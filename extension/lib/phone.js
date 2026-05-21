// UK phone helpers — mirror of /app/lib/phone.ts so the two stay in sync.
// Exposed on window.PopformPhone.

(function (root) {
  function digitsOnly(raw) {
    return String(raw || '').replace(/\D/g, '');
  }

  function toE164(raw) {
    let digits = digitsOnly(raw);
    if (digits.startsWith('44')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    if (!/^7\d{9}$/.test(digits)) return null;
    return '+44' + digits;
  }

  function channelForE164(e164) {
    return 'reg-' + e164.replace(/^\+/, '');
  }

  // Pretty UK mobile: "07700 900 123"
  function formatUk(raw) {
    let digits = digitsOnly(raw);
    if (digits.startsWith('44')) digits = '0' + digits.slice(2);
    if (!digits.startsWith('0')) digits = digits.length ? '0' + digits : '';
    digits = digits.slice(0, 11);
    if (digits.length <= 5) return digits;
    if (digits.length <= 8) return digits.slice(0, 5) + ' ' + digits.slice(5);
    return digits.slice(0, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
  }

  root.PopformPhone = { toE164, channelForE164, formatUk };
})(window);
