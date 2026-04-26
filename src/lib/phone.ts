export const normalizePhoneForAuth = (phone: string) => {
  const compact = phone.replace(/[\s-]/g, '');

  if (!compact) {
    return '';
  }

  if (compact.startsWith('+')) {
    return compact;
  }

  if (/^86\d{11}$/.test(compact)) {
    return `+${compact}`;
  }

  if (/^1\d{10}$/.test(compact)) {
    return `+86${compact}`;
  }

  return compact;
};

export const getPhoneTail = (phone: string | null | undefined) => {
  if (!phone) {
    return null;
  }

  return phone.replace(/\D/g, '').slice(-4) || null;
};
