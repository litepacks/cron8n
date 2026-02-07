import { Command } from 'commander'
import prompts from 'prompts'
import { saveAuth, type AuthMode } from '../config/store.js'
import { createClient } from '../api/n8nClient.js'
import { print } from '../utils/print.js'
import { handleError, ValidationError } from '../utils/errors.js'

interface LoginOptions {
  baseUrl?: string
  mode?: AuthMode
  secret?: string
}

async function loginAction(options: LoginOptions): Promise<void> {
  try {
    let baseUrl = options.baseUrl
    let authMode = options.mode
    let secret = options.secret

    // Interactive prompts if options not provided
    if (!baseUrl || !authMode || !secret) {
      const answers = await prompts([
        {
          type: baseUrl ? null : 'text',
          name: 'baseUrl',
          message: 'n8n Base URL:',
          initial: 'https://n8n.example.com',
          validate: (value: string) => {
            try {
              new URL(value)
              return true
            } catch {
              return 'Please enter a valid URL'
            }
          }
        },
        {
          type: authMode ? null : 'select',
          name: 'authMode',
          message: 'Authentication mode:',
          choices: [
            { title: 'API Key (X-N8N-API-KEY)', value: 'apiKey' },
            { title: 'Bearer Token (Authorization: Bearer)', value: 'bearerToken' }
          ]
        },
        {
          type: secret ? null : 'password',
          name: 'secret',
          message: (prev, values) => 
            values['authMode'] === 'apiKey' || authMode === 'apiKey'
              ? 'API Key:'
              : 'Bearer Token:'
        }
      ], {
        onCancel: () => {
          print.warning('Login cancelled')
          process.exit(0)
        }
      })

      baseUrl = baseUrl ?? answers['baseUrl'] as string
      authMode = authMode ?? answers['authMode'] as AuthMode
      secret = secret ?? answers['secret'] as string
    }

    // Validate inputs
    if (!baseUrl) {
      throw new ValidationError('Base URL is required')
    }

    if (!authMode) {
      throw new ValidationError('Auth mode is required')
    }

    if (!secret) {
      throw new ValidationError('Secret (API key or token) is required')
    }

    // Validate URL format
    try {
      new URL(baseUrl)
    } catch {
      throw new ValidationError('Invalid URL format')
    }

    // Remove trailing slash from URL
    baseUrl = baseUrl.replace(/\/$/, '')

    print.info('Verifying credentials...')

    // Test the connection
    const client = createClient({ baseUrl, authMode, secret })
    const isValid = await client.testConnection()

    if (!isValid) {
      throw new ValidationError(
        'Failed to connect to n8n',
        'Please check your URL and credentials'
      )
    }

    // Save credentials
    await saveAuth({ baseUrl, authMode, secret })

    print.success('Successfully authenticated!')
    print.keyValue('Base URL', baseUrl)
    print.keyValue('Auth Mode', authMode)
  } catch (error) {
    handleError(error)
  }
}

export function createAuthLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with n8n instance')
    .option('--baseUrl <url>', 'n8n base URL (e.g., https://n8n.example.com)')
    .option('--mode <mode>', 'Auth mode: apiKey or bearerToken')
    .option('--secret <secret>', 'API key or bearer token')
    .action(loginAction)
}
