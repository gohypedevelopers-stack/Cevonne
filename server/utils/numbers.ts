export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toDecimalString = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value);
};
