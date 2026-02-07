import { Command } from 'commander'
import prompts from 'prompts'
import { print } from '../utils/print.js'
import { handleError, ValidationError } from '../utils/errors.js'
import { createSlug, isValidSlug } from '../utils/slug.js'
import { parseCron, CRON_PRESETS, getTimezoneOptions } from '../utils/time.js'
import { writeJson, getCwd } from '../utils/fs.js'
import { 
  createManifest, 
  saveManifest, 
  getWorkflowPath, 
  getManifestPath,
  manifestExists 
} from '../workflows/manifest.js'
import { getTemplate, getTemplateChoices, type TemplateName, type TemplateOptions } from '../workflows/templates.js'
import { upsertRegistryEntry } from '../config/registry.js'

interface NewOptions {
  name?: string
  cron?: string
  timezone?: string
  template?: TemplateName
  shellCommand?: string
}

async function newAction(options: NewOptions): Promise<void> {
  try {
    let workflowName = options.name
    let cronExpression = options.cron
    let timezone = options.timezone
    let template = options.template
    let shellCommand = options.shellCommand

    // Interactive prompts if options not provided
    if (!workflowName || !cronExpression || !timezone || !template) {
      const answers = await prompts([
        {
          type: workflowName ? null : 'text',
          name: 'name',
          message: 'Workflow name:',
          initial: 'My Cron Workflow',
          validate: (value: string) => value.trim().length > 0 || 'Name is required'
        },
        {
          type: cronExpression ? null : 'select',
          name: 'cronType',
          message: 'Cron schedule:',
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
          message: 'Custom cron expression:',
          initial: '0 * * * *',
          validate: (value: string) => {
            const result = parseCron(value)
            return result.isValid || `Invalid cron: ${result.error}`
          }
        },
        {
          type: timezone ? null : 'autocomplete',
          name: 'timezone',
          message: 'Timezone:',
          choices: getTimezoneOptions().map(tz => ({ title: tz, value: tz })),
          initial: 0
        },
        {
          type: template ? null : 'select',
          name: 'template',
          message: 'Workflow template:',
          choices: getTemplateChoices()
        }
      ], {
        onCancel: () => {
          print.warning('Cancelled')
          process.exit(0)
        }
      })

      workflowName = workflowName ?? answers['name'] as string
      cronExpression = cronExpression ?? 
        (answers['cronType'] === 'custom' ? answers['customCron'] : answers['cronType']) as string
      timezone = timezone ?? answers['timezone'] as string
      template = template ?? answers['template'] as TemplateName
    }

    // Shell command prompt for shell-command template
    if (template === 'shell-command' && !shellCommand) {
      const shellAnswer = await prompts({
        type: 'text',
        name: 'shellCommand',
        message: 'Shell command to execute:',
        initial: 'echo "Hello from cron8n! Time: $(date)"',
        validate: (value: string) => value.trim().length > 0 || 'Command is required'
      }, {
        onCancel: () => {
          print.warning('Cancelled')
          process.exit(0)
        }
      })
      shellCommand = shellAnswer['shellCommand'] as string
    }

    // Validate inputs
    if (!workflowName) {
      throw new ValidationError('Workflow name is required')
    }

    if (!cronExpression) {
      throw new ValidationError('Cron expression is required')
    }

    if (!timezone) {
      throw new ValidationError('Timezone is required')
    }

    if (!template) {
      throw new ValidationError('Template is required')
    }

    // Validate cron expression
    const cronInfo = parseCron(cronExpression, timezone)
    if (!cronInfo.isValid) {
      throw new ValidationError(`Invalid cron expression: ${cronInfo.error}`)
    }

    // Generate slug
    let slug = createSlug(workflowName)
    
    // Check if slug already exists
    if (await manifestExists(slug)) {
      const { newSlug } = await prompts({
        type: 'text',
        name: 'newSlug',
        message: `Slug "${slug}" already exists. Enter a new slug:`,
        initial: `${slug}-2`,
        validate: async (value: string) => {
          if (!isValidSlug(value)) {
            return 'Invalid slug format (use lowercase letters, numbers, and hyphens)'
          }
          if (await manifestExists(value)) {
            return 'This slug also exists'
          }
          return true
        }
      })
      
      if (!newSlug) {
        print.warning('Cancelled')
        process.exit(0)
      }
      
      slug = newSlug
    }

    // Create manifest
    const manifest = createManifest(slug, workflowName, template, cronExpression, timezone)

    // Create workflow from template
    const templateConfig = getTemplate(template)
    const templateOptions: TemplateOptions = {}
    if (shellCommand) {
      templateOptions.shellCommand = shellCommand
    }
    const workflow = templateConfig.create(workflowName, cronExpression, timezone, templateOptions)

    // Save files
    const basePath = getCwd()
    const workflowPath = getWorkflowPath(slug, basePath)
    const manifestPath = getManifestPath(slug, basePath)

    await writeJson(workflowPath, workflow)
    await saveManifest(manifest, basePath)

    // Register in central registry
    await upsertRegistryEntry({
      slug,
      projectPath: basePath,
      manifestPath
    })

    // Output
    print.success('Workflow created successfully!')
    print.newline()
    print.keyValue('Slug', slug)
    print.keyValue('Name', workflowName)
    print.keyValue('Template', templateConfig.name)
    print.keyValue('Cron', cronExpression)
    print.keyValue('Timezone', timezone)
    print.newline()
    print.header('Files created')
    print.list([workflowPath, manifestPath])
    print.newline()
    print.header('Next scheduled runs')
    cronInfo.nextRuns.slice(0, 5).forEach(date => {
      print.dim(`  ${date.toLocaleString()}`)
    })
    print.newline()
    print.info(`Deploy with: cron8n cron deploy ${slug}`)
  } catch (error) {
    handleError(error)
  }
}

export function createCronNewCommand(): Command {
  return new Command('new')
    .description('Create a new cron workflow')
    .option('--name <name>', 'Workflow name')
    .option('--cron <expression>', 'Cron expression')
    .option('--timezone <tz>', 'Timezone (default: Europe/Istanbul)')
    .option('--template <template>', 'Template: cron-only, http-request, webhook-call, shell-command')
    .option('--shell-command <command>', 'Shell command to execute (for shell-command template)')
    .action(newAction)
}
