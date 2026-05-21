/**
 * UK phone number helpers. We accept the common UK mobile formats receptionists
 * type (07XXX XXX XXX, +447XXX, 447XXX) and normalise to E.164 with the leading
 * "+44" stripped to "44" for use in Pusher channel names (which forbid "+").
 */

/** Strip everything but digits and a single leading "+" prefix. */
export function normaliseInput(raw: string): string {
  const trimmed = raw.trim();
  const sign = trimmed.startsWith('+') ? '+' : '';
  return sign + trimmed.replace(/\D/g, '');
}

/**
 * Convert UK input to canonical E.164 (e.g. "+447700900123").
 * Returns null when input doesn't look like a UK mobile.
 */
export function toE164(raw: string): string | null {
  const cleaned = normaliseInput(raw).replace(/^\+/, '');

  let digits = cleaned;
  if (digits.startsWith('44')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // UK mobiles begin with 7 and are 10 digits long after the leading 0/44.
  if (!/^7\d{9}$/.test(digits)) return null;
  return `+44${digits}`;
}

/**
 * Pusher channel name format used by both client and server.
 * Pusher channel names can't contain "+", so we use the bare digits.
 */
export function channelForPhone(e164: string): string {
  return `reg-${e164.replace(/^\+/, '')}`;
}

/** Pretty UK mobile format for display: "07700 900 123". */
export function formatUkMobile(raw: string): string {
  const cleaned = normaliseInput(raw).replace(/^\+/, '');
  let digits = cleaned;
  if (digits.startsWith('44')) digits = '0' + digits.slice(2);
  if (!digits.startsWith('0')) digits = '0' + digits;
  digits = digits.slice(0, 11);

  if (digits.length <= 5) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}
