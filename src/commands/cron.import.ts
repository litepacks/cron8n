import { Command } from 'commander'
import prompts from 'prompts'
import { print } from '../utils/print.js'
import { handleError, ValidationError } from '../utils/errors.js'
import { createSlug, isValidSlug } from '../utils/slug.js'
import { writeJson, getCwd } from '../utils/fs.js'
import { getClient, type N8nWorkflow } from '../api/n8nClient.js'
import { 
  getCronNodes, 
  isCron8nManaged, 
  suggestSlug 
} from '../workflows/discover.js'
import { 
  createManifest, 
  saveManifest, 
  getWorkflowPath,
  getManifestPath,
  manifestExists 
} from '../workflows/manifest.js'
import { upsertRegistryEntry } from '../config/registry.js'

interface ImportOptions {
  slug?: string
  force?: boolean
}

async function importAction(workflowId: string, options: ImportOptions): Promise<void> {
  try {
    const client = await getClient()

    print.info(`Fetching workflow ${workflowId}...`)
    const workflow = await client.getWorkflow(workflowId)

    // Check if already managed
    if (isCron8nManaged(workflow) && !options.force) {
      print.warning('This workflow is already managed by cron8n')
      print.info('Use --force to import anyway')
      return
    }

    // Get cron nodes
    const cronNodes = getCronNodes(workflow)

    if (cronNodes.length === 0) {
      throw new ValidationError(
        'This workflow has no cron trigger nodes',
        'Only workflows with cron/schedule triggers can be imported'
      )
    }

    // Determine slug
    let slug = options.slug ?? suggestSlug(workflow.name)

    // Validate and potentially prompt for new slug
    if (!isValidSlug(slug) || await manifestExists(slug)) {
      const { newSlug } = await prompts({
        type: 'text',
        name: 'newSlug',
        message: 'Enter a slug for this workflow:',
        initial: slug,
        validate: async (value: string) => {
          if (!isValidSlug(value)) {
            return 'Invalid slug format (use lowercase letters, numbers, and hyphens)'
          }
          if (await manifestExists(value) && !options.force) {
            return 'This slug already exists (use --force to overwrite)'
          }
          return true
        }
      })

      if (!newSlug) {
        print.warning('Import cancelled')
        return
      }

      slug = newSlug
    }

    // Extract cron info from the first cron node
    const primaryCron = cronNodes[0]!
    const cronExpression = primaryCron.cronExpression ?? '0 * * * *'
    const timezone = primaryCron.timezone ?? 'Europe/Istanbul'

    // Create manifest
    const manifest = createManifest(
      slug,
      workflow.name,
      'cron-only', // We use cron-only since we're importing existing
      cronExpression,
      timezone
    )

    // Set the deployed workflow ID since it already exists
    manifest.lastDeployedWorkflowId = workflow.id
    manifest.lastDeployedAt = new Date().toISOString()

    // Prepare workflow data for local storage
    const workflowData: N8nWorkflow = {
      name: workflow.name,
      active: workflow.active,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    }

    // Save files
    const basePath = getCwd()
    const workflowPath = getWorkflowPath(slug, basePath)
    const manifestPath = getManifestPath(slug, basePath)

    await writeJson(workflowPath, workflowData)
    await saveManifest(manifest, basePath)

    // Register in central registry
    await upsertRegistryEntry({
      slug,
      projectPath: basePath,
      manifestPath,
      workflowId: workflow.id
    })

    // Output
    print.success('Workflow imported successfully!')
    print.newline()
    print.keyValue('Workflow ID', workflow.id ?? 'N/A')
    print.keyValue('Slug', slug)
    print.keyValue('Name', workflow.name)
    print.keyValue('Cron Expression', cronExpression)
    print.keyValue('Timezone', timezone)

    if (cronNodes.length > 1) {
      print.newline()
      print.warning(`Note: This workflow has ${cronNodes.length} cron triggers. Only the first one was captured in the manifest.`)
    }

    print.newline()
    print.header('Files created')
    print.list([workflowPath, manifestPath])

    print.newline()
    print.info('The workflow will be tagged as cron8n-managed on next deploy')
    print.info(`Deploy with: cron8n cron deploy ${slug}`)
  } catch (error) {
    handleError(error)
  }
}

export function createCronImportCommand(): Command {
  return new Command('import')
    .description('Import an existing workflow from n8n')
    .argument('<workflow-id>', 'The workflow ID to import')
    .option('--slug <slug>', 'Custom slug for the imported workflow')
    .option('--force', 'Overwrite existing files and import even if already managed')
    .action(importAction)
}
