export const USER_ROLES = ["ADMIN", "CUSTOMER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  passwordHash?: string | null;
  otp?: string | null;
  otpExpiresAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  role: UserRole;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface PublicUser extends SessionUser {
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AuthPayload {
  id: string;
  role: UserRole;
}

export interface AuthResponse {
  user: PublicUser | null;
  token: string;
}
