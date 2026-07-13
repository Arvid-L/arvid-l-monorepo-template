export const ROUTES = {
  EXAMPLES: 'examples',
  LOGIN: 'login',
  REGISTER: 'register',
  FORGOT_PASSWORD: 'forgot-password',
  // Keep in sync with the link in the API's password reset mail
  // (AuthService.forgotPassword: APP_BASE_URL/reset-password?token=...)
  RESET_PASSWORD: 'reset-password',
};
