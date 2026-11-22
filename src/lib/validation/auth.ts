export interface ValidationResult<T extends string> {
  isValid: boolean;
  errors: Partial<Record<T, string>>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export type RegisterField =
  | 'fullName'
  | 'email'
  | 'username'
  | 'lagosLifeUsername'
  | 'password'
  | 'confirmPassword';

export interface RegisterFormInput {
  fullName: string;
  email: string;
  username: string;
  lagosLifeUsername: string;
  password: string;
  confirmPassword: string;
}

export function validateRegistration(
  input: RegisterFormInput,
): ValidationResult<RegisterField> {
  const errors: Partial<Record<RegisterField, string>> = {};

  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const username = input.username.trim();
  const lagosLifeUsername = input.lagosLifeUsername.trim();

  if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = 'Full name must be between 2 and 100 characters.';
  }

  if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (username.length < 3 || username.length > 32) {
    errors.username = 'Username must be between 3 and 32 characters.';
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username =
      'Username may only contain letters, numbers, underscores, dots, and hyphens.';
  }

  if (lagosLifeUsername.length < 2 || lagosLifeUsername.length > 64) {
    errors.lagosLifeUsername =
      'Lagos Life username must be between 2 and 64 characters.';
  }

  if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export type LoginField = 'email' | 'password';

export function validateLogin(
  email: string,
  password: string,
): ValidationResult<LoginField> {
  const errors: Partial<Record<LoginField, string>> = {};

  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (password.length === 0) {
    errors.password = 'Enter your password.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateResetEmail(email: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Enter the email address associated with your account.';
  }
  return null;
}
