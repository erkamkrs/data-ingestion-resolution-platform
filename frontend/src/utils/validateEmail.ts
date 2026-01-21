
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (trimmed.includes(';') || trimmed.includes(',')) return false;
  const atIdx = trimmed.lastIndexOf('@');
  if (atIdx <= 0 || atIdx === trimmed.length - 1) return false;
  const domain = trimmed.substring(atIdx + 1);
  if (!domain.includes('.')) return false;
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(trimmed);
}

export default validateEmail;
