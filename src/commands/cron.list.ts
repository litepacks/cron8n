import { Command } from 'commander'
import kleur from 'kleur'
import { print } from '../utils/print.js'
import { handleError } from '../utils/errors.js'
import { getClient } from '../api/n8nClient.js'
import { groupWorkflows, type WorkflowCronInfo } from '../workflows/discover.js'
import { loadAllManifests, getWorkflowsDir, type Manifest } from '../workflows/manifest.js'
import { getCwd, exists, listFiles, join, readJson } from '../utils/fs.js'

interface ListOptions {
  managed?: boolean
  unmanaged?: boolean
  remote?: boolean
  archived?: boolean
  json?: boolean
  all?: boolean
}

interface ArchivedManifest extends Manifest {
  archivedAt?: string
  archivedFrom?: string
}

function formatCronExpressions(cronNodes: WorkflowCronInfo['cronNodes']): string {
  if (cronNodes.length === 0) return 'N/A'
  return cronNodes
    .map(n => n.cronExpression ?? 'N/A')
    .join(', ')
}

function formatTimezone(cronNodes: WorkflowCronInfo['cronNodes']): string {
  if (cronNodes.length === 0) return 'N/A'
  const timezones = [...new Set(cronNodes.map(n => n.timezone).filter(Boolean))]
  return timezones.length > 0 ? timezones.join(', ') : 'default'
}

async function loadArchivedManifests(basePath?: string): Promise<ArchivedManifest[]> {
  const archiveDir = join(getWorkflowsDir(basePath), 'archived')
  
  if (!(await exists(archiveDir))) {
    return []
  }

  const files = await listFiles(archiveDir)
  const manifestFiles = files.filter(f => f.endsWith('.cron8n.json'))
  
  const manifests: ArchivedManifest[] = []
  for (const file of manifestFiles) {
    try {
      const filePath = join(archiveDir, file)
      const data = await readJson<ArchivedManifest>(filePath)
      manifests.push(data)
    } catch {
      // Skip invalid manifests
    }
  }
  
  return manifests
}

async function listLocalAction(options: ListOptions): Promise<void> {
  const basePath = getCwd()
  
  // Load active manifests
  const activeManifests = await loadAllManifests(basePath)
  
  // Load archived manifests if requested
  const archivedManifests = options.archived ? await loadArchivedManifests(basePath) : []

  if (options.json) {
    const output: Record<string, unknown> = {
      active: activeManifests
    }
    if (options.archived) {
      output['archived'] = archivedManifests
    }
    print.json(output)
    return
  }

  // Show active workflows
  if (!options.archived) {
    print.header('Local Workflows')
    
    if (activeManifests.length === 0) {
      print.dim('  No local workflows found')
      print.info('  Create one with: cron8n cron new')
    } else {
      const headers = ['Slug', 'Name', 'Cron', 'Timezone', 'Deployed']
      const rows = activeManifests.map(m => [
        m.slug,
        m.name,
        m.cronExpression,
        m.timezone,
        m.lastDeployedWorkflowId ? kleur.green('✓') : kleur.dim('✗')
      ])
      print.table(headers, rows)
    }
    print.newline()
  }

  // Show archived workflows if requested
  if (options.archived) {
    print.header('Archived Workflows')
    
    if (archivedManifests.length === 0) {
      print.dim('  No archived workflows found')
    } else {
      const headers = ['Slug', 'Name', 'Cron', 'Archived At']
      const rows = archivedManifests.map(m => [
        m.slug,
        m.name,
        m.cronExpression,
        m.archivedAt ? new Date(m.archivedAt).toLocaleString() : '-'
      ])
      print.table(headers, rows)
    }
    print.newline()
  }

  // Summary
  print.header('Summary')
  print.keyValue('Active workflows', String(activeManifests.length))
  if (options.archived) {
    print.keyValue('Archived workflows', String(archivedManifests.length))
  } else {
    // Check if there are archived workflows
    const archived = await loadArchivedManifests(basePath)
    if (archived.length > 0) {
      print.keyValue('Archived workflows', `${archived.length} (use --archived to show)`)
    }
  }
}

async function listRemoteAction(options: ListOptions): Promise<void> {
  const client = await getClient()

  print.info('Fetching workflows from n8n...')
  const workflows = await client.listWorkflows()

  const { managed, unmanaged } = groupWorkflows(workflows)

  // Filter based on options
  let showManaged = true
  let showUnmanaged = true

  if (options.managed && !options.unmanaged) {
    showUnmanaged = false
  } else if (options.unmanaged && !options.managed) {
    showManaged = false
  }

  // JSON output
  if (options.json) {
    const output: Record<string, WorkflowCronInfo[]> = {}
    if (showManaged) output['managed'] = managed
    if (showUnmanaged) output['unmanaged'] = unmanaged
    print.json(output)
    return
  }

  // Human-readable output
  if (showManaged) {
    print.header('Managed by cron8n (Remote)')
    
    if (managed.length === 0) {
      print.dim('  No managed workflows found')
    } else {
      const headers = ['ID', 'Name', 'Slug', 'Active', 'Cron', 'Timezone']
      const rows = managed.map(w => [
        w.workflowId,
        w.workflowName,
        w.managedSlug ?? '-',
        w.active ? kleur.green('✓') : kleur.dim('✗'),
        formatCronExpressions(w.cronNodes),
        formatTimezone(w.cronNodes)
      ])
      print.table(headers, rows)
    }
    print.newline()
  }

  if (showUnmanaged) {
    print.header('Unmanaged cron workflows (Remote)')
    
    if (unmanaged.length === 0) {
      print.dim('  No unmanaged cron workflows found')
    } else {
      const headers = ['ID', 'Name', 'Active', 'Cron', 'Timezone', 'Tags']
      const rows = unmanaged.map(w => [
        w.workflowId,
        w.workflowName,
        w.active ? kleur.green('✓') : kleur.dim('✗'),
        formatCronExpressions(w.cronNodes),
        formatTimezone(w.cronNodes),
        w.tags.slice(0, 3).join(', ') + (w.tags.length > 3 ? '...' : '')
      ])
      print.table(headers, rows)
    }
    print.newline()
  }

  // Summary
  print.header('Summary')
  print.keyValue('Total cron workflows', String(managed.length + unmanaged.length))
  print.keyValue('Managed', String(managed.length))
  print.keyValue('Unmanaged', String(unmanaged.length))

  if (unmanaged.length > 0) {
    print.newline()
    print.info('Tip: Import unmanaged workflows with "cron8n cron import <workflow-id>"')
  }
}

async function listAction(options: ListOptions): Promise<void> {
  try {
    // If --remote, --managed or --unmanaged, show remote workflows
    if (options.remote || options.managed || options.unmanaged) {
      await listRemoteAction(options)
      return
    }

    // Default: show local workflows (and archived if requested)
    await listLocalAction(options)
  } catch (error) {
    handleError(error)
  }
}

export function createCronListCommand(): Command {
  return new Command('list')
    .description('List cron workflows (local by default)')
    .option('--remote', 'Show workflows from n8n server')
    .option('--archived', 'Show archived local workflows')
    .option('--managed', 'Show only cron8n-managed remote workflows (implies --remote)')
    .option('--unmanaged', 'Show only unmanaged remote cron workflows (implies --remote)')
    .option('--json', 'Output as JSON')
    .option('--all', 'Show workflows from all registered projects')
    .action(listAction)
}
