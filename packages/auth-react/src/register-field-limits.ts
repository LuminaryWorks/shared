/**
 * Register field lengths. Auth Gateway enforces the same numbers
 * (`services/auth-gateway/src/register-abuse.mjs`).
 */
export const REGISTER_FIELD_LIMITS = {
  emailMin: 6,
  emailMax: 64,
  usernameMin: 3,
  usernameMax: 20,
  passwordMin: 8,
  passwordMax: 32,
  codeLength: 6,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CODE_RE = /^\d{6}$/;

export function isRegisterEmailShape(email: string): boolean {
  const value = email.trim();
  return (
    value.length >= REGISTER_FIELD_LIMITS.emailMin &&
    value.length <= REGISTER_FIELD_LIMITS.emailMax &&
    EMAIL_RE.test(value)
  );
}

export function isRegisterUsernameShape(username: string): boolean {
  const value = username.trim();
  return (
    value.length >= REGISTER_FIELD_LIMITS.usernameMin &&
    value.length <= REGISTER_FIELD_LIMITS.usernameMax &&
    USERNAME_RE.test(value)
  );
}

export function isRegisterPasswordLength(password: string): boolean {
  return (
    password.length >= REGISTER_FIELD_LIMITS.passwordMin &&
    password.length <= REGISTER_FIELD_LIMITS.passwordMax
  );
}

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "admin123",
  "admin1234",
  "qwerty123",
  "abc12345",
  "abcd1234",
  "letmein1",
  "welcome1",
  "iloveyou",
  "1q2w3e4r",
  "1qaz2wsx",
]);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

function isStraightRun(slice: string): boolean {
  const codes = [...slice].map((char) => char.charCodeAt(0));
  const ascending = codes.every((code, index) => index === 0 || code === codes[index - 1] + 1);
  const descending = codes.every((code, index) => index === 0 || code === codes[index - 1] - 1);
  return ascending || descending;
}

function isKeyboardRun(slice: string): boolean {
  return KEYBOARD_ROWS.some((row) => {
    const reversed = [...row].reverse().join("");
    return row.includes(slice) || reversed.includes(slice);
  });
}

/** Letters and digits are required. Repeats, straight runs, and common passwords are rejected. */
export function isRegisterPasswordTooSimple(password: string): boolean {
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return true;
  if (/(.)\1{3,}/.test(password)) return true;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  for (let index = 0; index <= lower.length - 6; index += 1) {
    const slice = lower.slice(index, index + 6);
    if (isStraightRun(slice) || isKeyboardRun(slice)) return true;
  }
  return false;
}

export function isRegisterVerificationCode(code: string): boolean {
  return CODE_RE.test(code.trim());
}
