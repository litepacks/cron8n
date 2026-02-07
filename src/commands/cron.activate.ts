import { Command } from 'commander'
import { print } from '../utils/print.js'
import { handleError, ValidationError } from '../utils/errors.js'
import { getClient } from '../api/n8nClient.js'
import { loadManifest, manifestExists } from '../workflows/manifest.js'
import { getCwd } from '../utils/fs.js'

interface ActivateOptions {
  json?: boolean
}

async function activateAction(slugOrId: string, options: ActivateOptions): Promise<void> {
  try {
    const basePath = getCwd()
    let workflowId = slugOrId

    // Check if it's a local slug
    if (await manifestExists(slugOrId, basePath)) {
      const manifest = await loadManifest(slugOrId, basePath)
      
      if (!manifest.lastDeployedWorkflowId) {
        throw new ValidationError(
          `Workflow "${slugOrId}" is not deployed yet`,
          `Deploy first with: cron8n cron deploy ${slugOrId}`
        )
      }
      
      workflowId = manifest.lastDeployedWorkflowId
      print.info(`Activating workflow: ${manifest.name}`)
    } else {
      print.info(`Activating workflow: ${workflowId}`)
    }

    const client = await getClient()
    const workflow = await client.activateWorkflow(workflowId)

    if (options.json) {
      print.json({
        id: workflow.id,
        name: workflow.name,
        active: workflow.active
      })
      return
    }

    print.success(`Workflow "${workflow.name}" activated!`)
    print.keyValue('ID', workflow.id ?? 'N/A')
    print.keyValue('Active', 'Yes')
  } catch (error) {
    handleError(error)
  }
}

export function createCronActivateCommand(): Command {
  return new Command('activate')
    .description('Activate a workflow in n8n')
    .argument('<slug|workflow-id>', 'Local slug or remote workflow ID')
    .option('--json', 'Output as JSON')
    .action(activateAction)
}
