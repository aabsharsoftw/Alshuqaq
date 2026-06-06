/**
 * Strongly-typed configuration namespace assembled from validated env vars.
 * Access via ConfigService.get('...') using these keys.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  admin: {
    email: process.env.ADMIN_EMAIL as string,
    password: process.env.ADMIN_PASSWORD as string,
    name: process.env.ADMIN_NAME ?? 'Administrator',
    notifyEmail:
      process.env.ADMIN_NOTIFY_EMAIL ?? (process.env.ADMIN_EMAIL as string),
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY as string,
    from: process.env.MAIL_FROM as string,
  },

  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY as string,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT as string,
    folder: process.env.IMAGEKIT_FOLDER ?? '/rental-listings',
  },
});
