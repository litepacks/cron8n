import { Command } from 'commander'
import prompts from 'prompts'
import { print } from '../utils/print.js'
import { handleError } from '../utils/errors.js'
import { parseCron, formatDate, CRON_PRESETS, getTimezoneOptions } from '../utils/time.js'

interface ValidateOptions {
  timezone?: string
  count?: string
  json?: boolean
}

async function validateAction(expression?: string, options?: ValidateOptions): Promise<void> {
  try {
    let cronExpression = expression
    let timezone = options?.timezone ?? 'Europe/Istanbul'
    const count = options?.count ? parseInt(options.count, 10) : 5

    // Interactive prompt if no expression provided
    if (!cronExpression) {
      const answers = await prompts([
        {
          type: 'select',
          name: 'cronType',
          message: 'Select cron expression:',
          choices: [
            ...CRON_PRESETS.map(p => ({
              title: `${p.name} (${p.expression})`,
              value: p.expression,
              description: p.description
            })),
            { title: 'Custom expression', value: 'custom' }
          ]
        },
        {
          type: (prev) => prev === 'custom' ? 'text' : null,
          name: 'customCron',
          message: 'Enter cron expression:',
          initial: '0 * * * *'
        },
        {
          type: 'autocomplete',
          name: 'timezone',
          message: 'Timezone:',
          choices: getTimezoneOptions().map(tz => ({ title: tz, value: tz })),
          initial: 0
        }
      ], {
        onCancel: () => {
          print.warning('Cancelled')
          process.exit(0)
        }
      })

      cronExpression = answers['cronType'] === 'custom' 
        ? answers['customCron'] as string
        : answers['cronType'] as string
      timezone = answers['timezone'] as string
    }

    // Parse and validate
    const result = parseCron(cronExpression, timezone, count)

    // JSON output
    if (options?.json) {
      print.json({
        expression: cronExpression,
        timezone,
        isValid: result.isValid,
        error: result.error,
        nextRuns: result.nextRuns.map(d => d.toISOString())
      })
      return
    }

    // Human-readable output
    print.header('Cron Expression Validation')
    print.keyValue('Expression', cronExpression)
    print.keyValue('Timezone', timezone)
    print.newline()

    if (!result.isValid) {
      print.error(`Invalid cron expression: ${result.error}`)
      print.newline()
      print.info('Cron format: minute hour day-of-month month day-of-week')
      print.info('Example: 0 9 * * 1-5 (Every weekday at 9:00 AM)')
      return
    }

    print.success('Valid cron expression')
    print.newline()

    // Show cron breakdown
    const parts = cronExpression.split(' ')
    if (parts.length >= 5) {
      print.header('Expression Breakdown')
      print.keyValue('Minute', parts[0] ?? '*')
      print.keyValue('Hour', parts[1] ?? '*')
      print.keyValue('Day of Month', parts[2] ?? '*')
      print.keyValue('Month', parts[3] ?? '*')
      print.keyValue('Day of Week', parts[4] ?? '*')
      print.newline()
    }

    print.header(`Next ${count} scheduled runs`)
    for (const date of result.nextRuns) {
      print.dim(`  • ${formatDate(date)}`)
    }

    // Show common presets for reference
    print.newline()
    print.header('Common Presets')
    for (const preset of CRON_PRESETS.slice(0, 4)) {
      print.keyValue(preset.name, `${preset.expression} - ${preset.description}`)
    }
  } catch (error) {
    handleError(error)
  }
}

export function createCronValidateCommand(): Command {
  return new Command('validate')
    .description('Validate a cron expression and show next run times')
    .argument('[expression]', 'Cron expression to validate')
    .option('--timezone <tz>', 'Timezone (default: Europe/Istanbul)')
    .option('--count <n>', 'Number of next runs to show (default: 5)')
    .option('--json', 'Output as JSON')
    .action(validateAction)
}
