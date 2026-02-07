import { Command } from 'commander'
import { print } from '../utils/print.js'
import { handleError, ValidationError } from '../utils/errors.js'
import { getClient } from '../api/n8nClient.js'
import { loadManifest, manifestExists } from '../workflows/manifest.js'
import { getCwd } from '../utils/fs.js'

interface DeactivateOptions {
  json?: boolean
}

async function deactivateAction(slugOrId: string, options: DeactivateOptions): Promise<void> {
  try {
    const basePath = getCwd()
    let workflowId = slugOrId

    // Check if it's a local slug
    if (await manifestExists(slugOrId, basePath)) {
      const manifest = await loadManifest(slugOrId, basePath)
      
      if (!manifest.lastDeployedWorkflowId) {
        throw new ValidationError(
          `Workflow "${slugOrId}" is not deployed yet`,
          'Nothing to deactivate'
        )
      }
      
      workflowId = manifest.lastDeployedWorkflowId
      print.info(`Deactivating workflow: ${manifest.name}`)
    } else {
      print.info(`Deactivating workflow: ${workflowId}`)
    }

    const client = await getClient()
    const workflow = await client.deactivateWorkflow(workflowId)

    if (options.json) {
      print.json({
        id: workflow.id,
        name: workflow.name,
        active: workflow.active
      })
      return
    }

    print.success(`Workflow "${workflow.name}" deactivated!`)
    print.keyValue('ID', workflow.id ?? 'N/A')
    print.keyValue('Active', 'No')
  } catch (error) {
    handleError(error)
  }
}

export function createCronDeactivateCommand(): Command {
  return new Command('deactivate')
    .description('Deactivate a workflow in n8n')
    .argument('<slug|workflow-id>', 'Local slug or remote workflow ID')
    .option('--json', 'Output as JSON')
    .action(deactivateAction)
}
