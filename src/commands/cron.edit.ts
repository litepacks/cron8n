import { Command } from 'commander'
import prompts from 'prompts'
import { print } from '../utils/print.js'
import { handleError, FileError } from '../utils/errors.js'
import { parseCron, CRON_PRESETS, getTimezoneOptions } from '../utils/time.js'
import { readJson, writeJson, getCwd } from '../utils/fs.js'
import { 
  loadManifest, 
  saveManifest,
  getWorkflowPath,
  manifestExists 
} from '../workflows/manifest.js'
import type { N8nWorkflow, N8nNode } from '../api/n8nClient.js'

interface EditOptions {
  name?: string
  cron?: string
  timezone?: string
  shellCommand?: string
}

/**
 * Finds Execute Command node in workflow
 */
function findExecuteCommandNode(nodes: N8nNode[]): N8nNode | undefined {
  return nodes.find(n => n.type === 'n8n-nodes-base.executeCommand')
}

/**
 * Finds Schedule Trigger node in workflow
 */
function findScheduleTriggerNode(nodes: N8nNode[]): N8nNode | undefined {
  return nodes.find(n => 
    n.type === 'n8n-nodes-base.scheduleTrigger' || 
    n.type === 'n8n-nodes-base.cron'
  )
}

/**
 * Gets shell command from Execute Command node
 */
function getShellCommand(node: N8nNode): string {
  return (node.parameters?.['command'] as string) || ''
}

/**
 * Gets cron expression from Schedule Trigger node
 */
function getCronExpression(node: N8nNode): string {
  const rule = node.parameters?.['rule'] as { interval?: Array<{ expression?: string }> } | undefined
  return rule?.interval?.[0]?.expression || ''
}

/**
 * Gets timezone from Schedule Trigger node
 */
function getTimezone(node: N8nNode): string {
  const options = node.parameters?.['options'] as { timezone?: string } | undefined
  return options?.timezone || 'Europe/Istanbul'
}

async function editAction(slug: string, options: EditOptions): Promise<void> {
  try {
    const basePath = getCwd()

    // Check if manifest exists
    if (!(await manifestExists(slug, basePath))) {
      throw new FileError(
        `Workflow "${slug}" not found`,
        `Make sure the workflow exists in ./workflows/${slug}.cron8n.json`
      )
    }

    // Load manifest and workflow
    const manifest = await loadManifest(slug, basePath)
    const workflowPath = getWorkflowPath(slug, basePath)
    const workflow = await readJson<N8nWorkflow>(workflowPath)

    // Get current values
    const scheduleNode = findScheduleTriggerNode(workflow.nodes)
    const executeNode = findExecuteCommandNode(workflow.nodes)

    const currentCron = scheduleNode ? getCronExpression(scheduleNode) : manifest.cronExpression
    const currentTimezone = scheduleNode ? getTimezone(scheduleNode) : manifest.timezone
    const currentShellCommand = executeNode ? getShellCommand(executeNode) : undefined

    print.header(`Editing workflow: ${manifest.name}`)
    print.newline()

    // Determine what to edit
    const hasShellCommand = !!executeNode
    
    let newName = options.name
    let newCron = options.cron
    let newTimezone = options.timezone
    let newShellCommand = options.shellCommand

    // If no options provided, show interactive menu
    if (!newName && !newCron && !newTimezone && !newShellCommand) {
      // Loop until user selects "Done"
      while (true) {
        const editChoices = [
          { title: `✏️  Name: ${manifest.name}`, value: 'name' },
          { title: `⏰ Cron: ${currentCron}`, value: 'cron' },
          { title: `🌍 Timezone: ${currentTimezone}`, value: 'timezone' },
          ...(hasShellCommand ? [{ title: `💻 Shell: ${currentShellCommand?.substring(0, 50)}${(currentShellCommand?.length || 0) > 50 ? '...' : ''}`, value: 'shell' }] : []),
          { title: '✅ Done - Save changes', value: 'done' }
        ]

        const { field } = await prompts({
          type: 'select',
          name: 'field',
          message: 'Select field to edit:',
          choices: editChoices
        }, {
          onCancel: () => {
            print.warning('Cancelled')
            process.exit(0)
          }
        })

        if (field === 'done' || !field) {
          break
        }

        if (field === 'name') {
          const { value } = await prompts({
            type: 'text',
            name: 'value',
            message: 'New workflow name:',
            initial: manifest.name,
            validate: (v: string) => v.trim().length > 0 || 'Name is required'
          })
          if (value) newName = value
        } else if (field === 'cron') {
          const { cronType } = await prompts({
            type: 'select',
            name: 'cronType',
            message: 'New cron schedule:',
            choices: [
              { title: `Keep current (${currentCron})`, value: currentCron },
              ...CRON_PRESETS.map(p => ({
                title: `${p.name} (${p.expression})`,
                value: p.expression,
                description: p.description
              })),
              { title: 'Custom expression', value: 'custom' }
            ]
          })

          if (cronType === 'custom') {
            const { customCron } = await prompts({
              type: 'text',
              name: 'customCron',
              message: 'Custom cron expression:',
              initial: currentCron,
              validate: (value: string) => {
                const result = parseCron(value)
                return result.isValid || `Invalid cron: ${result.error}`
              }
            })
            if (customCron) newCron = customCron
          } else if (cronType) {
            newCron = cronType
          }
        } else if (field === 'timezone') {
          const { value } = await prompts({
            type: 'autocomplete',
            name: 'value',
            message: 'New timezone:',
            choices: getTimezoneOptions().map(tz => ({ title: tz, value: tz })),
            initial: getTimezoneOptions().indexOf(currentTimezone)
          })
          if (value) newTimezone = value
        } else if (field === 'shell') {
          const { value } = await prompts({
            type: 'text',
            name: 'value',
            message: 'New shell command:',
            initial: currentShellCommand,
            validate: (v: string) => v.trim().length > 0 || 'Command is required'
          })
          if (value) newShellCommand = value
        }
      }
    }

    // Apply changes
    let changed = false

    // Update name
    if (newName && newName !== manifest.name) {
      manifest.name = newName
      workflow.name = newName
      changed = true
      print.success(`Name updated: ${newName}`)
    }

    // Update cron expression
    if (newCron && newCron !== currentCron) {
      manifest.cronExpression = newCron
      if (scheduleNode && scheduleNode.parameters) {
        const rule = scheduleNode.parameters['rule'] as { interval: Array<{ field: string; expression: string }> }
        if (rule?.interval?.[0]) {
          rule.interval[0].expression = newCron
        }
      }
      changed = true
      print.success(`Cron expression updated: ${newCron}`)
    }

    // Update timezone
    if (newTimezone && newTimezone !== currentTimezone) {
      manifest.timezone = newTimezone
      if (scheduleNode && scheduleNode.parameters) {
        const opts = scheduleNode.parameters['options'] as { timezone: string }
        if (opts) {
          opts.timezone = newTimezone
        }
      }
      changed = true
      print.success(`Timezone updated: ${newTimezone}`)
    }

    // Update shell command
    if (newShellCommand && executeNode && newShellCommand !== currentShellCommand) {
      if (executeNode.parameters) {
        executeNode.parameters['command'] = newShellCommand
      }
      changed = true
      print.success(`Shell command updated: ${newShellCommand}`)
    }

    if (!changed) {
      print.info('No changes made')
      return
    }

    // Save updated files
    manifest.updatedAt = new Date().toISOString()
    await writeJson(workflowPath, workflow)
    await saveManifest(manifest, basePath)

    print.newline()
    print.success('Workflow updated successfully!')
    print.newline()

    if (manifest.lastDeployedWorkflowId) {
      print.warning('Note: Changes are local only. Run deploy to update the remote workflow:')
      print.info(`  cron8n cron deploy ${slug}`)
    }
  } catch (error) {
    handleError(error)
  }
}

export function createCronEditCommand(): Command {
  return new Command('edit')
    .description('Edit an existing workflow')
    .argument('<slug>', 'Workflow slug to edit')
    .option('--name <name>', 'New workflow name')
    .option('--cron <expression>', 'New cron expression')
    .option('--timezone <tz>', 'New timezone')
    .option('--shell-command <command>', 'New shell command (for shell-command workflows)')
    .action(editAction)
}
