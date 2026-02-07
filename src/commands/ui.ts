import { Command } from 'commander'
import open from 'open'
import { print } from '../utils/print.js'
import { startServer } from '../ui/server.js'

interface UiOptions {
  port?: string
  noBrowser?: boolean
}

async function uiAction(options: UiOptions): Promise<void> {
  const port = options.port ? parseInt(options.port, 10) : 3847

  print.header('cron8n Web UI')
  print.newline()

  // Start server
  await startServer(port)

  // Open browser
  if (!options.noBrowser) {
    print.info('Opening browser...')
    await open(`http://localhost:${port}`)
  }

  print.newline()
  print.dim('Press Ctrl+C to stop the server')
}

export function createUiCommand(): Command {
  return new Command('ui')
    .description('Start the web UI for managing workflows')
    .option('-p, --port <port>', 'Port to run the server on', '3847')
    .option('--no-browser', 'Do not open browser automatically')
    .action(uiAction)
}
