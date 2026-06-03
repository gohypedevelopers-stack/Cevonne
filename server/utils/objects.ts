export const isPlainObject = (value: unknown) =>
  Boolean(value) &&
  typeof value === "object" &&
  Object.prototype.toString.call(value) === "[object Object]";

export const compactObject = (value: unknown) => {
  if (!isPlainObject(value)) return {};

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).filter(([, current]) => {
      if (Array.isArray(current)) return current.length > 0;
      if (isPlainObject(current)) return Object.keys(current as Record<string, unknown>).length > 0;
      return current !== undefined && current !== null && current !== "";
    })
  );
};
