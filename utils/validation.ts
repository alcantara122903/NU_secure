/**
 * Email validation utility
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Password validation utility
 * Minimum 6 characters required (login)
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Matches NU-Secure web reset policy:
 * min 8 chars, uppercase, lowercase, number
 */
export const isValidResetPassword = (password: string): boolean => {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
};

/**
 * Email validation with error message
 */
export const validateEmail = (email: string): string | undefined => {
  if (!email.trim()) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address.';
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

export const validateResetPassword = (password: string): string | undefined => {
  if (!password) {
    return 'New password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!isValidResetPassword(password)) {
    return 'Password must include at least one uppercase letter, one lowercase letter, and one number.';
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

export const validateForgotPasswordForm = (email: string) => {
  const emailError = validateEmail(email);
  return {
    isValid: !emailError,
    errors: {
      ...(emailError && { email: emailError }),
    },
  };
};

export const validateResetPasswordForm = (
  password: string,
  passwordConfirmation: string,
) => {
  const passwordError = validateResetPassword(password);
  let confirmError: string | undefined;

  if (!passwordConfirmation) {
    confirmError = 'Please confirm your new password.';
  } else if (password !== passwordConfirmation) {
    confirmError = 'Passwords do not match.';
  }

  return {
    isValid: !passwordError && !confirmError,
    errors: {
      ...(passwordError && { password: passwordError }),
      ...(confirmError && { passwordConfirmation: confirmError }),
    },
  };
};
