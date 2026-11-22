import type { ValidationResult } from '@/lib/validation/auth';

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export type ProfileFormField =
  | 'fullName'
  | 'username'
  | 'lagosLifeUsername'
  | 'bio';

export interface ProfileFormInput {
  fullName: string;
  username: string;
  lagosLifeUsername: string;
  bio: string;
}

export function validateProfileUpdate(
  input: ProfileFormInput,
): ValidationResult<ProfileFormField> {
  const errors: Partial<Record<ProfileFormField, string>> = {};

  const fullName = input.fullName.trim();
  const username = input.username.trim();
  const lagosLifeUsername = input.lagosLifeUsername.trim();
  const bio = input.bio.trim();

  if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = 'Full name must be between 2 and 100 characters.';
  }

  if (username.length < 3 || username.length > 32) {
    errors.username = 'VATAR username must be between 3 and 32 characters.';
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username =
      'VATAR username may only contain letters, numbers, underscores, dots, and hyphens.';
  }

  if (lagosLifeUsername.length < 2 || lagosLifeUsername.length > 64) {
    errors.lagosLifeUsername =
      'Lagos Life username must be between 2 and 64 characters.';
  }

  if (bio.length > 300) {
    errors.bio = 'Bio must be 300 characters or fewer.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
