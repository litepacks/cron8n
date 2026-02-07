import { Command } from 'commander'
import { getAuth, printAuthStatus } from '../config/store.js'
import { createClient } from '../api/n8nClient.js'
import { print } from '../utils/print.js'
import { handleError } from '../utils/errors.js'

interface StatusOptions {
  json?: boolean
}

async function statusAction(options: StatusOptions): Promise<void> {
  try {
    const auth = await getAuth()

    if (options.json) {
      if (!auth) {
        print.json({ authenticated: false })
        return
      }

      const client = createClient(auth)
      const isConnected = await client.testConnection()

      print.json({
        authenticated: true,
        baseUrl: auth.baseUrl,
        authMode: auth.authMode,
        secretMasked: '*'.repeat(auth.secret.length - 4) + auth.secret.slice(-4),
        connectionValid: isConnected
      })
      return
    }

    print.header('Authentication Status')

    if (!auth) {
      print.warning('Not authenticated')
      print.info('Run "cron8n auth login" to authenticate')
      return
    }

    await printAuthStatus()

    print.newline()
    print.info('Verifying connection...')

    const client = createClient(auth)
    const isConnected = await client.testConnection()

    if (isConnected) {
      print.success('Connection verified')
    } else {
      print.error('Connection failed')
      print.warning('Your credentials may be invalid or the server is unreachable')
    }
  } catch (error) {
    handleError(error)
  }
}

export function createAuthStatusCommand(): Command {
  return new Command('status')
    .description('Show current authentication status')
    .option('--json', 'Output as JSON')
    .action(statusAction)
}
