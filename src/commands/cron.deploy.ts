import { Command } from 'commander'
import { print } from '../utils/print.js'
import { handleError, ValidationError, FileError } from '../utils/errors.js'
import { readJson, getCwd } from '../utils/fs.js'
import { 
  resolveManifest, 
  updateManifestDeployment, 
  getWorkflowPath,
  createTags
} from '../workflows/manifest.js'
import { getClient, type N8nWorkflow } from '../api/n8nClient.js'
import { updateWorkflowId } from '../config/registry.js'

interface DeployOptions {
  activate?: boolean
  dryRun?: boolean
}

async function deployAction(slugOrPath: string, options: DeployOptions): Promise<void> {
  try {
    // Resolve manifest
    const { manifest, basePath } = await resolveManifest(slugOrPath)

    print.info(`Deploying workflow: ${manifest.name}`)
    print.keyValue('Slug', manifest.slug)

    // Load workflow JSON
    const workflowPath = getWorkflowPath(manifest.slug, basePath)
    let workflowData: N8nWorkflow

    try {
      workflowData = await readJson<N8nWorkflow>(workflowPath)
    } catch {
      throw new FileError(
        `Workflow file not found: ${workflowPath}`,
        'Make sure the workflow JSON file exists'
      )
    }

    // Determine if this is a create or update
    const isUpdate = !!manifest.lastDeployedWorkflowId
    const workflowId = manifest.lastDeployedWorkflowId

    // Dry run mode
    if (options.dryRun) {
      print.header('Dry Run - No changes will be made')
      print.keyValue('Operation', isUpdate ? 'UPDATE' : 'CREATE')
      if (isUpdate) {
        print.keyValue('Workflow ID', workflowId!)
      }
      print.keyValue('Name', workflowData.name)
      print.keyValue('Activate', String(options.activate ?? false))
      print.keyValue('Tags', manifest.tags.join(', '))
      return
    }

    const client = await getClient()

    let deployedWorkflow: N8nWorkflow

    if (isUpdate && workflowId) {
      // Update existing workflow
      print.info('Updating existing workflow...')
      
      deployedWorkflow = await client.updateWorkflow({
        id: workflowId,
        name: workflowData.name,
        nodes: workflowData.nodes,
        connections: workflowData.connections,
        settings: workflowData.settings
      })

      print.success('Workflow updated!')
    } else {
      // Create new workflow
      print.info('Creating new workflow...')
      
      deployedWorkflow = await client.createWorkflow({
        name: workflowData.name,
        nodes: workflowData.nodes,
        connections: workflowData.connections,
        settings: workflowData.settings
      })

      print.success('Workflow created!')
    }

    const finalWorkflowId = deployedWorkflow.id!

    // Add cron8n tags
    print.info('Setting tags...')
    const tags = createTags(manifest.slug)
    await client.addTagsToWorkflow(finalWorkflowId, tags)

    // Activate if requested
    if (options.activate) {
      print.info('Activating workflow...')
      await client.activateWorkflow(finalWorkflowId)
      print.success('Workflow activated!')
    }

    // Update manifest with deployment info
    await updateManifestDeployment(manifest.slug, finalWorkflowId, basePath)

    // Update registry
    await updateWorkflowId(manifest.slug, basePath, finalWorkflowId)

    // Output summary
    print.newline()
    print.header('Deployment Summary')
    print.keyValue('Workflow ID', finalWorkflowId)
    print.keyValue('Name', deployedWorkflow.name)
    print.keyValue('Active', String(deployedWorkflow.active ?? false))
    print.keyValue('Tags', tags.join(', '))
  } catch (error) {
    handleError(error)
  }
}

export function createCronDeployCommand(): Command {
  return new Command('deploy')
    .description('Deploy a workflow to n8n')
    .argument('<slug|path>', 'Workflow slug or path to manifest')
    .option('--activate', 'Activate the workflow after deployment')
    .option('--no-activate', 'Do not activate the workflow')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(deployAction)
}
