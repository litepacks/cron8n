import { Command } from 'commander'
import kleur from 'kleur'
import { print } from '../utils/print.js'
import { handleError, ValidationError } from '../utils/errors.js'
import { getClient } from '../api/n8nClient.js'
import { 
  analyzeWorkflow, 
  getCronNodes, 
  isCron8nManaged, 
  getCron8nSlug,
  suggestSlug 
} from '../workflows/discover.js'
import { parseCron, formatDate } from '../utils/time.js'
import { 
  loadManifest, 
  manifestExists, 
  getWorkflowPath 
} from '../workflows/manifest.js'
import { exists, readJson, getCwd } from '../utils/fs.js'
import type { N8nWorkflow } from '../api/n8nClient.js'

interface InspectOptions {
  json?: boolean
  local?: boolean
}

async function inspectLocalAction(slug: string, options: InspectOptions): Promise<void> {
  const basePath = getCwd()
  
  // Load manifest
  const manifest = await loadManifest(slug, basePath)
  
  // Load workflow file
  const workflowPath = getWorkflowPath(slug, basePath)
  let workflow: N8nWorkflow | null = null
  
  if (await exists(workflowPath)) {
    workflow = await readJson<N8nWorkflow>(workflowPath)
  }

  if (options.json) {
    print.json({
      source: 'local',
      manifest,
      workflow: workflow ? {
        name: workflow.name,
        nodeCount: workflow.nodes.length,
        nodes: workflow.nodes.map(n => ({ name: n.name, type: n.type }))
      } : null
    })
    return
  }

  print.header('Local Workflow Details')
  print.keyValue('Slug', manifest.slug)
  print.keyValue('Name', manifest.name)
  print.keyValue('Template', manifest.template)
  print.keyValue('Created', new Date(manifest.createdAt).toLocaleString())

  print.newline()
  print.header('Cron Configuration')
  print.keyValue('Expression', manifest.cronExpression)
  print.keyValue('Timezone', manifest.timezone)

  // Show next runs
  const cronInfo = parseCron(manifest.cronExpression, manifest.timezone)
  if (cronInfo.isValid) {
    print.newline()
    print.dim('  Next 5 scheduled runs:')
    for (const date of cronInfo.nextRuns) {
      print.dim(`    • ${formatDate(date)}`)
    }
  }

  print.newline()
  print.header('Deployment Status')
  if (manifest.lastDeployedWorkflowId) {
    print.success('Deployed to n8n')
    print.keyValue('Workflow ID', manifest.lastDeployedWorkflowId)
    print.keyValue('Last Deployed', manifest.lastDeployedAt 
      ? new Date(manifest.lastDeployedAt).toLocaleString() 
      : 'N/A')
    print.newline()
    print.info(`View remote: cron8n cron inspect ${manifest.lastDeployedWorkflowId}`)
  } else {
    print.warning('Not deployed yet')
    print.info(`Deploy with: cron8n cron deploy ${slug}`)
  }

  print.newline()
  print.header('Tags')
  print.list(manifest.tags)

  if (workflow) {
    print.newline()
    print.header('Workflow Nodes')
    for (const node of workflow.nodes) {
      print.keyValue(node.name, node.type)
    }
  }
}

async function inspectRemoteAction(workflowId: string, options: InspectOptions): Promise<void> {
  const client = await getClient()

  print.info(`Fetching workflow ${workflowId} from n8n...`)
  const workflow = await client.getWorkflow(workflowId)

  const analysis = analyzeWorkflow(workflow)
  const cronNodes = getCronNodes(workflow)
  const isManaged = isCron8nManaged(workflow)
  const managedSlug = isManaged ? getCron8nSlug(workflow) : undefined

  // JSON output
  if (options.json) {
    const cronDetails = cronNodes.map(node => {
      const cronInfo = node.cronExpression 
        ? parseCron(node.cronExpression, node.timezone)
        : null

      return {
        ...node,
        nextRuns: cronInfo?.nextRuns.map(d => d.toISOString()) ?? []
      }
    })

    print.json({
      source: 'remote',
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      isManaged,
      managedSlug,
      suggestedSlug: isManaged ? undefined : suggestSlug(workflow.name),
      tags: workflow.tags?.map(t => t.name) ?? [],
      cronNodes: cronDetails,
      nodeCount: workflow.nodes.length,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    })
    return
  }

  // Human-readable output
  print.header('Remote Workflow Details')
  print.keyValue('ID', workflow.id ?? 'N/A')
  print.keyValue('Name', workflow.name)
  print.keyValue('Active', workflow.active ? kleur.green('Yes') : kleur.dim('No'))
  print.keyValue('Nodes', String(workflow.nodes.length))

  print.newline()
  print.header('cron8n Status')
  
  if (isManaged) {
    print.success('Managed by cron8n')
    print.keyValue('Slug', managedSlug ?? 'N/A')
  } else {
    print.warning('Not managed by cron8n')
    print.keyValue('Suggested slug', suggestSlug(workflow.name))
    print.info('Import with: cron8n cron import ' + workflow.id)
  }

  print.newline()
  print.header('Tags')
  
  const tags = workflow.tags?.map(t => t.name) ?? []
  if (tags.length === 0) {
    print.dim('  No tags')
  } else {
    print.list(tags)
  }

  print.newline()
  print.header('Cron Trigger Configuration')

  if (cronNodes.length === 0) {
    print.warning('No cron trigger nodes found')
  } else {
    for (const [index, node] of cronNodes.entries()) {
      if (cronNodes.length > 1) {
        print.bold(`\nTrigger ${index + 1}: ${node.nodeName}`)
      }
      
      print.keyValue('Node Name', node.nodeName)
      print.keyValue('Node Type', node.nodeType)
      print.keyValue('Cron Expression', node.cronExpression ?? 'N/A')
      print.keyValue('Timezone', node.timezone ?? 'default')

      if (node.cronExpression) {
        const cronInfo = parseCron(node.cronExpression, node.timezone)
        
        if (cronInfo.isValid) {
          print.newline()
          print.dim('  Next 5 scheduled runs:')
          for (const date of cronInfo.nextRuns) {
            print.dim(`    • ${formatDate(date)}`)
          }
        } else {
          print.error(`Invalid cron expression: ${cronInfo.error}`)
        }
      }
    }
  }

  // Show raw workflow structure summary
  print.newline()
  print.header('Node Summary')
  
  const nodeTypes = workflow.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  for (const [type, count] of Object.entries(nodeTypes)) {
    print.keyValue(type, String(count))
  }
}

async function inspectAction(slugOrId: string, options: InspectOptions): Promise<void> {
  try {
    const basePath = getCwd()
    
    // Check if it's a local slug first
    if (await manifestExists(slugOrId, basePath)) {
      // If --local or no remote deployment, show local
      const manifest = await loadManifest(slugOrId, basePath)
      
      if (options.local || !manifest.lastDeployedWorkflowId) {
        await inspectLocalAction(slugOrId, options)
        return
      }
      
      // Has remote deployment, show remote
      await inspectRemoteAction(manifest.lastDeployedWorkflowId, options)
      return
    }

    // Not a local slug, treat as workflow ID
    if (options.local) {
      throw new ValidationError(
        `Local workflow not found: ${slugOrId}`,
        'Use a valid slug or remove --local flag'
      )
    }

    await inspectRemoteAction(slugOrId, options)
  } catch (error) {
    handleError(error)
  }
}

export function createCronInspectCommand(): Command {
  return new Command('inspect')
    .description('Inspect a workflow (local slug or remote workflow ID)')
    .argument('<slug|workflow-id>', 'Local slug or remote workflow ID')
    .option('--local', 'Show local manifest only (don\'t fetch from n8n)')
    .option('--json', 'Output as JSON')
    .action(inspectAction)
}
