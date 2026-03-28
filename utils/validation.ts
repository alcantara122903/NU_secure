/**
 * Email validation utility
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Password validation utility
 * Minimum 6 characters required
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Email validation with error message
 */
export const validateEmail = (email: string): string | undefined => {
  if (!email.trim()) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email';
  }
  return undefined;
};

/**
 * Password validation with error message
 */
export const validatePassword = (password: string): string | undefined => {
  if (!password) {
    return 'Password is required';
  }
  if (!isValidPassword(password)) {
    return 'Password must be at least 6 characters';
  }
  return undefined;
};

/**
 * Validate login form
 */
export const validateLoginForm = (email: string, password: string) => {
  const errors = {
    email: validateEmail(email),
    password: validatePassword(password),
  };

  return {
    isValid: !errors.email && !errors.password,
    errors: {
      ...(errors.email && { email: errors.email }),
      ...(errors.password && { password: errors.password }),
    },
  };
};
