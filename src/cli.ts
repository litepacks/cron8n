import { Command } from 'commander'
import { createAuthLoginCommand } from './commands/auth.login.js'
import { createAuthStatusCommand } from './commands/auth.status.js'
import { createCronNewCommand } from './commands/cron.new.js'
import { createCronDeployCommand } from './commands/cron.deploy.js'
import { createCronListCommand } from './commands/cron.list.js'
import { createCronInspectCommand } from './commands/cron.inspect.js'
import { createCronImportCommand } from './commands/cron.import.js'
import { createCronValidateCommand } from './commands/cron.validate.js'
import { createCronArchiveCommand } from './commands/cron.archive.js'
import { createCronActivateCommand } from './commands/cron.activate.js'
import { createCronDeactivateCommand } from './commands/cron.deactivate.js'
import { createCronEditCommand } from './commands/cron.edit.js'
import { createUiCommand } from './commands/ui.js'

const program = new Command()

program
  .name('cron8n')
  .description('CLI tool for managing n8n cron-triggered workflows')
  .version('1.0.0')

// Auth commands
const authCommand = new Command('auth')
  .description('Manage n8n authentication')

authCommand.addCommand(createAuthLoginCommand())
authCommand.addCommand(createAuthStatusCommand())

program.addCommand(authCommand)

// Cron commands
const cronCommand = new Command('cron')
  .description('Manage cron workflows')

cronCommand.addCommand(createCronNewCommand())
cronCommand.addCommand(createCronEditCommand())
cronCommand.addCommand(createCronDeployCommand())
cronCommand.addCommand(createCronListCommand())
cronCommand.addCommand(createCronInspectCommand())
cronCommand.addCommand(createCronImportCommand())
cronCommand.addCommand(createCronValidateCommand())
cronCommand.addCommand(createCronActivateCommand())
cronCommand.addCommand(createCronDeactivateCommand())
cronCommand.addCommand(createCronArchiveCommand())

program.addCommand(cronCommand)

// UI command
program.addCommand(createUiCommand())

// Parse arguments
program.parse()
