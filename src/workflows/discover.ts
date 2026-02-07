import type { N8nWorkflow, N8nNode } from '../api/n8nClient.js'

/**
 * Cron node type identifiers used in n8n
 */
const CRON_NODE_TYPES = [
  'n8n-nodes-base.cron',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.schedule'
]

/**
 * cron8n management tag prefix
 */
const CRON8N_MANAGED_TAG = 'managed-by:cron8n'
const CRON8N_SLUG_TAG_PREFIX = 'cron8n:'

export interface CronNodeInfo {
  nodeName: string
  nodeType: string
  cronExpression?: string
  timezone?: string
}

export interface WorkflowCronInfo {
  workflowId: string
  workflowName: string
  active: boolean
  cronNodes: CronNodeInfo[]
  isManaged: boolean
  managedSlug?: string
  tags: string[]
}

/**
 * Checks if a node is a cron/schedule trigger node
 */
export function isCronNode(node: N8nNode): boolean {
  return CRON_NODE_TYPES.some(type => 
    node.type.toLowerCase().includes(type.toLowerCase()) ||
    type.toLowerCase().includes(node.type.toLowerCase())
  )
}

/**
 * Extracts cron expression from a node's parameters
 */
export function extractCronExpression(node: N8nNode): string | undefined {
  const params = node.parameters

  if (!params) return undefined

  // Handle scheduleTrigger node format
  if (params['rule'] && typeof params['rule'] === 'object') {
    const rule = params['rule'] as { interval?: Array<{ field?: string; expression?: string }> }
    const interval = rule.interval?.[0]
    if (interval?.field === 'cronExpression' && interval.expression) {
      return interval.expression
    }
  }

  // Handle older cron node format
  if (params['cronExpression'] && typeof params['cronExpression'] === 'string') {
    return params['cronExpression']
  }

  // Handle trigger times format
  if (params['triggerTimes'] && typeof params['triggerTimes'] === 'object') {
    const triggerTimes = params['triggerTimes'] as { item?: Array<{ mode?: string; cronExpression?: string }> }
    const item = triggerTimes.item?.[0]
    if (item?.cronExpression) {
      return item.cronExpression
    }
  }

  return undefined
}

/**
 * Extracts timezone from a node's parameters
 */
export function extractTimezone(node: N8nNode): string | undefined {
  const params = node.parameters

  if (!params) return undefined

  // Handle options.timezone
  if (params['options'] && typeof params['options'] === 'object') {
    const options = params['options'] as { timezone?: string }
    if (options.timezone) {
      return options.timezone
    }
  }

  // Handle direct timezone parameter
  if (params['timezone'] && typeof params['timezone'] === 'string') {
    return params['timezone']
  }

  return undefined
}

/**
 * Gets cron node information from a workflow
 */
export function getCronNodes(workflow: N8nWorkflow): CronNodeInfo[] {
  return workflow.nodes
    .filter(isCronNode)
    .map(node => ({
      nodeName: node.name,
      nodeType: node.type,
      cronExpression: extractCronExpression(node),
      timezone: extractTimezone(node)
    }))
}

/**
 * Checks if a workflow has any cron trigger nodes
 */
export function hasCronTrigger(workflow: N8nWorkflow): boolean {
  return workflow.nodes.some(isCronNode)
}

/**
 * Checks if a workflow is managed by cron8n
 */
export function isCron8nManaged(workflow: N8nWorkflow): boolean {
  return workflow.tags?.some(tag => tag.name === CRON8N_MANAGED_TAG) ?? false
}

/**
 * Gets the cron8n slug from workflow tags
 */
export function getCron8nSlug(workflow: N8nWorkflow): string | undefined {
  const slugTag = workflow.tags?.find(tag => 
    tag.name.startsWith(CRON8N_SLUG_TAG_PREFIX)
  )
  return slugTag?.name.replace(CRON8N_SLUG_TAG_PREFIX, '')
}

/**
 * Analyzes a workflow for cron information
 */
export function analyzeWorkflow(workflow: N8nWorkflow): WorkflowCronInfo {
  const cronNodes = getCronNodes(workflow)
  const isManaged = isCron8nManaged(workflow)
  const managedSlug = isManaged ? getCron8nSlug(workflow) : undefined

  return {
    workflowId: workflow.id ?? '',
    workflowName: workflow.name,
    active: workflow.active ?? false,
    cronNodes,
    isManaged,
    managedSlug,
    tags: workflow.tags?.map(t => t.name) ?? []
  }
}

/**
 * Filters workflows to only those with cron triggers
 */
export function filterCronWorkflows(workflows: N8nWorkflow[]): N8nWorkflow[] {
  return workflows.filter(hasCronTrigger)
}

/**
 * Separates workflows into managed and unmanaged groups
 */
export function groupWorkflows(workflows: N8nWorkflow[]): {
  managed: WorkflowCronInfo[]
  unmanaged: WorkflowCronInfo[]
} {
  const cronWorkflows = filterCronWorkflows(workflows)
  const analyzed = cronWorkflows.map(analyzeWorkflow)

  return {
    managed: analyzed.filter(w => w.isManaged),
    unmanaged: analyzed.filter(w => !w.isManaged)
  }
}

/**
 * Suggests a slug for an unmanaged workflow
 */
export function suggestSlug(workflowName: string): string {
  return workflowName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}
