import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
}

// Admin view of a user — what GET /auth/users returns.
export interface AdminUser extends AuthUser {
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface UpdateUserStatusDto {
  disabled: boolean;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  displayName?: string;
  // GDPR: registration requires explicit consent to the privacy policy.
  privacyAccepted: boolean;
}

export interface UpdateProfileDto {
  displayName: string;
}

export interface RefreshDto {
  refreshToken: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeEmailDto {
  newEmail: string;
  password: string;
}

export interface DeleteAccountDto {
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationDto {
  email: string;
}

// register() no longer returns tokens — the account must be verified first.
export interface RegisterResponse {
  message: string;
}
