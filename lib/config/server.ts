import "server-only";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBackendBaseUrl() {
  return trimTrailingSlash(process.env.RUTA_BACKEND_URL || "http://127.0.0.1:8000");
}

export function resolveAppBaseUrl(requestUrl: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return trimTrailingSlash(configured || new URL(requestUrl).origin);
}

export function getSupabaseAdminConfig() {
  return {
    url: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getSmtpConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host: readRequiredEnv("SMTP_HOST"),
    port,
    secure: port === 465,
    user: readRequiredEnv("SMTP_USER"),
    pass: readRequiredEnv("SMTP_PASS"),
    from: readRequiredEnv("SMTP_FROM"),
  };
}

