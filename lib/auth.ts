type ResolvePostAuthPathArgs = {
  role?: string | null;
  redirectTo?: string | null;
  defaultPath?: string;
  adminPath?: string;
};

const normalizeInternalPath = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "";
  }
  return trimmed;
};

export const resolvePostAuthPath = ({
  role,
  redirectTo,
  defaultPath = "/",
  adminPath = "/dashboard",
}: ResolvePostAuthPathArgs) => {
  const safeRedirect = normalizeInternalPath(redirectTo);

  if (role === "ADMIN") {
    return safeRedirect.startsWith("/dashboard") ? safeRedirect : adminPath;
  }

  return safeRedirect || defaultPath;
};
