import * as Joi from 'joi';

/**
 * Joi schema validating all environment variables at boot.
 * The app fails fast (refuses to start) if a required variable is missing/invalid.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(6).required(),
  ADMIN_NAME: Joi.string().default('Administrator'),
  ADMIN_NOTIFY_EMAIL: Joi.string().email().optional(),

  RESEND_API_KEY: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),

  IMAGEKIT_PUBLIC_KEY: Joi.string().required(),
  IMAGEKIT_PRIVATE_KEY: Joi.string().required(),
  IMAGEKIT_URL_ENDPOINT: Joi.string().uri().required(),
  IMAGEKIT_FOLDER: Joi.string().default('/rental-listings'),
});
