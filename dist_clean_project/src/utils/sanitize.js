export const sanitizeNumber = (value) => {
  const num = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isNaN(num) ? 0 : num;
};
