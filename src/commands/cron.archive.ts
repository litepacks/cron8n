import { Command } from 'commander'
import prompts from 'prompts'
import { print } from '../utils/print.js'
import { handleError, FileError } from '../utils/errors.js'
import { 
  exists, 
  writeFile, 
  getCwd, 
  join, 
  ensureDir,
  moveFile
} from '../utils/fs.js'
import { 
  loadManifest, 
  getWorkflowPath, 
  getManifestPath,
  getWorkflowsDir
} from '../workflows/manifest.js'
import { getClient } from '../api/n8nClient.js'
import { removeRegistryEntry } from '../config/registry.js'
import { getISOTimestamp } from '../utils/time.js'

interface ArchiveOptions {
  deleteRemote?: boolean
  keepLocal?: boolean
  force?: boolean
}

async function archiveAction(slug: string, options: ArchiveOptions): Promise<void> {
  try {
    const basePath = getCwd()
    const workflowPath = getWorkflowPath(slug, basePath)
    const manifestPath = getManifestPath(slug, basePath)

    // Check if manifest exists
    if (!(await exists(manifestPath))) {
      throw new FileError(
        `Manifest not found for slug: ${slug}`,
        `Make sure the workflow exists in ./workflows/${slug}.cron8n.json`
      )
    }

    // Load manifest
    const manifest = await loadManifest(slug, basePath)

    print.header(`Archiving: ${manifest.name}`)
    print.keyValue('Slug', slug)

    // Confirm if not forced
    if (!options.force) {
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to archive this workflow?',
        initial: false
      })

      if (!confirm) {
        print.warning('Archive cancelled')
        return
      }
    }

    const client = await getClient()

    // Handle remote workflow
    if (manifest.lastDeployedWorkflowId) {
      print.info('Processing remote workflow...')

      try {
        if (options.deleteRemote) {
          // Delete from n8n
          print.info('Deleting workflow from n8n...')
          await client.deleteWorkflow(manifest.lastDeployedWorkflowId)
          print.success('Workflow deleted from n8n')
        } else {
          // Just deactivate
          print.info('Deactivating workflow in n8n...')
          await client.deactivateWorkflow(manifest.lastDeployedWorkflowId)
          print.success('Workflow deactivated in n8n')
        }
      } catch (error) {
        print.warning('Could not modify remote workflow (may already be deleted)')
      }
    }

    // Handle local files
    if (!options.keepLocal) {
      const archiveDir = join(getWorkflowsDir(basePath), 'archived')
      await ensureDir(archiveDir)

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const archiveWorkflowPath = join(archiveDir, `${slug}.${timestamp}.json`)
      const archiveManifestPath = join(archiveDir, `${slug}.${timestamp}.cron8n.json`)

      // Move workflow file
      if (await exists(workflowPath)) {
        await moveFile(workflowPath, archiveWorkflowPath)
        print.info(`Moved workflow to: ${archiveWorkflowPath}`)
      }

      // Update manifest with archive info and move
      const archivedManifest = {
        ...manifest,
        archivedAt: getISOTimestamp(),
        archivedFrom: manifestPath
      }
      await writeFile(archiveManifestPath, JSON.stringify(archivedManifest, null, 2))
      
      // Delete original manifest after creating archive
      if (await exists(manifestPath)) {
        const { deleteFile } = await import('../utils/fs.js')
        await deleteFile(manifestPath)
      }
      print.info(`Moved manifest to: ${archiveManifestPath}`)

      // Remove from registry
      await removeRegistryEntry(slug, basePath)
      print.info('Removed from registry')
    }

    print.newline()
    print.success('Workflow archived successfully!')

    // Summary
    print.newline()
    print.header('Archive Summary')
    print.keyValue('Slug', slug)
    print.keyValue('Name', manifest.name)
    print.keyValue('Remote', options.deleteRemote ? 'Deleted' : 'Deactivated')
    print.keyValue('Local', options.keepLocal ? 'Kept' : 'Archived')
  } catch (error) {
    handleError(error)
  }
}

export function createCronArchiveCommand(): Command {
  return new Command('archive')
    .description('Archive a workflow (deactivate and move to archived folder)')
    .argument('<slug>', 'Workflow slug to archive')
    .option('--delete-remote', 'Delete workflow from n8n instead of just deactivating')
    .option('--keep-local', 'Keep local files in place (only affect remote)')
    .option('--force', 'Skip confirmation prompt')
    .action(archiveAction)
}
