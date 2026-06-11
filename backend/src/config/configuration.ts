/**
 * Centralized, typed application configuration.
 *
 * All environment access goes through this factory so the rest of the
 * codebase never reads `process.env` directly.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  mongodbUri: string;
  frontendUrl: string;
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  cookies: {
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  adminEmails: string[];
}

/**
 * Builds the {@link AppConfig} object from the current environment.
 */
export default function configuration(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const sameSite = (process.env.COOKIE_SAME_SITE ?? 'lax') as AppConfig['cookies']['sameSite'];

  return {
    nodeEnv,
    port: parseInt(process.env.PORT ?? '4000', 10),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/invoice-copilot',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/api/v1/auth/google/callback',
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    cookies: {
      sameSite,
      // Cross-site cookies ("none") and production both require Secure.
      secure: nodeEnv === 'production' || sameSite === 'none',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    adminEmails: (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  };
}
