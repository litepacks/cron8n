import { z } from 'zod'
import { join } from 'pathe'
import { getHomeDir, readJson, writeJson, exists, ensureDir } from '../utils/fs.js'
import { AuthError } from '../utils/errors.js'
import { print } from '../utils/print.js'

const CONFIG_DIR = join(getHomeDir(), '.cron8n')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

const AuthModeSchema = z.enum(['apiKey', 'bearerToken'])
export type AuthMode = z.infer<typeof AuthModeSchema>

const ConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  authMode: AuthModeSchema.optional(),
  secret: z.string().optional()
})

export type Config = z.infer<typeof ConfigSchema>

export interface AuthCredentials {
  baseUrl: string
  authMode: AuthMode
  secret: string
}

/**
 * Loads config from disk
 */
async function loadConfig(): Promise<Config> {
  if (!(await exists(CONFIG_FILE))) {
    return {}
  }

  try {
    const data = await readJson<unknown>(CONFIG_FILE)
    return ConfigSchema.parse(data)
  } catch {
    return {}
  }
}

/**
 * Saves config to disk
 */
async function saveConfig(config: Config): Promise<void> {
  await ensureDir(CONFIG_DIR)
  await writeJson(CONFIG_FILE, config)
}

/**
 * Saves authentication credentials
 */
export async function saveAuth(credentials: AuthCredentials): Promise<void> {
  const config = await loadConfig()
  config.baseUrl = credentials.baseUrl
  config.authMode = credentials.authMode
  config.secret = credentials.secret
  await saveConfig(config)
}

/**
 * Gets the current authentication credentials
 */
export async function getAuth(): Promise<AuthCredentials | null> {
  const config = await loadConfig()

  if (!config.baseUrl || !config.authMode || !config.secret) {
    return null
  }

  return {
    baseUrl: config.baseUrl,
    authMode: config.authMode,
    secret: config.secret
  }
}

/**
 * Gets auth or throws if not configured
 */
export async function requireAuth(): Promise<AuthCredentials> {
  const auth = await getAuth()
  if (!auth) {
    throw new AuthError(
      'Not authenticated',
      'Run "cron8n auth login" to authenticate'
    )
  }
  return auth
}

/**
 * Clears authentication credentials
 */
export async function clearAuth(): Promise<void> {
  const config = await loadConfig()
  delete config.baseUrl
  delete config.authMode
  delete config.secret
  await saveConfig(config)
}

/**
 * Checks if authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  return (await getAuth()) !== null
}

/**
 * Gets the authorization header value
 */
export function getAuthHeader(auth: AuthCredentials): Record<string, string> {
  if (auth.authMode === 'apiKey') {
    return { 'X-N8N-API-KEY': auth.secret }
  }
  return { 'Authorization': `Bearer ${auth.secret}` }
}

/**
 * Prints current auth status
 */
export async function printAuthStatus(): Promise<void> {
  const auth = await getAuth()
  
  if (!auth) {
    print.warning('Not authenticated')
    print.info('Run "cron8n auth login" to authenticate')
    return
  }

  print.keyValue('Base URL', auth.baseUrl)
  print.keyValue('Auth Mode', auth.authMode)
  print.keyValue('Secret', print.mask(auth.secret))
}

/**
 * Gets the config file path (for debugging)
 */
export function getConfigPath(): string {
  return CONFIG_FILE
}
