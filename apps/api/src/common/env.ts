const DEV_JWT_SECRET = 'nova-dev-secret-change';
const DEV_INTEGRATION_SECRET_KEY = 'nova-local-dev-only-change-me';

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function readRequiredEnv(name: string) {
  const value = String(process.env[name] || '').trim();

  if (!value) {
    throw new Error(
      `${name} ausente. Configure a variável de ambiente antes de iniciar a API.`,
    );
  }

  return value;
}

export function readCsvEnv(name: string) {
  return String(process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getJwtSecret() {
  const value = String(process.env.JWT_SECRET || '').trim();

  if (value) {
    if (isProduction() && value.length < 32) {
      throw new Error(
        'JWT_SECRET deve ter pelo menos 32 caracteres em produção.',
      );
    }

    return value;
  }

  if (isProduction()) {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }

  return DEV_JWT_SECRET;
}

export function getIntegrationSecretKey() {
  const value = String(process.env.INTEGRATION_SECRET_KEY || '').trim();

  if (value) {
    if (isProduction() && value.length < 32) {
      throw new Error(
        'INTEGRATION_SECRET_KEY deve ter pelo menos 32 caracteres em produção.',
      );
    }

    return value;
  }

  if (isProduction()) {
    throw new Error('INTEGRATION_SECRET_KEY é obrigatório em produção.');
  }

  return DEV_INTEGRATION_SECRET_KEY;
}
