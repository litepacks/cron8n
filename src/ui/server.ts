import Fastify from 'fastify'
import { join } from 'pathe'
import { print } from '../utils/print.js'
import { 
  listFiles, 
  readJson, 
  writeJson, 
  getCwd, 
  exists,
  ensureDir,
  moveFile
} from '../utils/fs.js'
import { 
  loadManifest, 
  saveManifest, 
  getWorkflowPath, 
  getManifestPath,
  manifestExists,
  createManifest,
  type WorkflowManifest
} from '../workflows/manifest.js'
import { getTemplate, getTemplateNames, type TemplateName, type TemplateOptions } from '../workflows/templates.js'
import { createSlug } from '../utils/slug.js'
import { parseCron, CRON_PRESETS, getTimezoneOptions } from '../utils/time.js'
import { getAuth, saveAuth, clearAuth, type AuthMode } from '../config/store.js'
import { createClient, type N8nWorkflow } from '../api/n8nClient.js'
import { upsertRegistryEntry, removeRegistryEntry } from '../config/registry.js'
import { getHtmlTemplate } from './template.js'

interface WorkflowWithManifest {
  manifest: WorkflowManifest
  workflow: N8nWorkflow
}

export async function startServer(port: number = 3847): Promise<void> {
  const fastify = Fastify({ logger: false })
  const basePath = getCwd()
  const workflowsDir = join(basePath, 'workflows')

  // Ensure workflows directory exists
  await ensureDir(workflowsDir)

  // Serve the HTML UI
  fastify.get('/', async (request, reply) => {
    reply.type('text/html').send(getHtmlTemplate())
  })

  // API: Get auth status
  fastify.get('/api/auth', async () => {
    const auth = await getAuth()
    return { 
      authenticated: !!auth,
      baseUrl: auth?.baseUrl,
      authMode: auth?.authMode
    }
  })

  // API: Save auth credentials
  fastify.post<{
    Body: {
      baseUrl: string
      authMode: AuthMode
      secret: string
    }
  }>('/api/auth', async (request, reply) => {
    const { baseUrl, authMode, secret } = request.body

    // Validate URL
    try {
      new URL(baseUrl)
    } catch {
      reply.status(400)
      return { error: 'Invalid URL format' }
    }

    if (!authMode || !['apiKey', 'bearerToken'].includes(authMode)) {
      reply.status(400)
      return { error: 'Invalid auth mode' }
    }

    if (!secret || secret.trim().length === 0) {
      reply.status(400)
      return { error: 'Secret is required' }
    }

    // Test connection
    const testAuth = { baseUrl: baseUrl.replace(/\/$/, ''), authMode, secret }
    const testClient = createClient(testAuth)
    
    try {
      const isValid = await testClient.testConnection()
      if (!isValid) {
        reply.status(400)
        return { error: 'Connection failed. Check your credentials.' }
      }
    } catch (err) {
      reply.status(400)
      return { error: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
    }

    // Save credentials
    await saveAuth(testAuth)
    
    return { success: true, baseUrl: testAuth.baseUrl }
  })

  // API: Clear auth
  fastify.delete('/api/auth', async () => {
    await clearAuth()
    return { success: true }
  })

  // API: Get all local workflows
  fastify.get('/api/workflows', async () => {
    const workflows: WorkflowWithManifest[] = []
    
    const files = await listFiles(workflowsDir)
    const manifestFiles = files.filter(f => f.endsWith('.cron8n.json'))

    // Get remote workflow statuses if authenticated
    const auth = await getAuth()
    let remoteWorkflows: Map<string, boolean> = new Map()
    
    if (auth) {
      try {
        const client = createClient(auth)
        const remoteList = await client.listWorkflows()
        for (const wf of remoteList) {
          if (wf.id) {
            remoteWorkflows.set(wf.id, wf.active ?? false)
          }
        }
      } catch {
        // Ignore errors, just use local data
      }
    }

    for (const file of manifestFiles) {
      const slug = file.replace('.cron8n.json', '')
      try {
        const manifest = await loadManifest(slug, basePath)
        const workflowPath = getWorkflowPath(slug, basePath)
        
        if (await exists(workflowPath)) {
          const workflow = await readJson<N8nWorkflow>(workflowPath)
          
          // Update active status from remote if available
          if (manifest.lastDeployedWorkflowId && remoteWorkflows.has(manifest.lastDeployedWorkflowId)) {
            workflow.active = remoteWorkflows.get(manifest.lastDeployedWorkflowId)
          }
          
          workflows.push({ manifest, workflow })
        }
      } catch {
        // Skip invalid manifests
      }
    }

    return { workflows }
  })

  // API: Get single workflow
  fastify.get<{ Params: { slug: string } }>('/api/workflows/:slug', async (request, reply) => {
    const { slug } = request.params
    
    if (!(await manifestExists(slug, basePath))) {
      reply.status(404)
      return { error: 'Workflow not found' }
    }

    const manifest = await loadManifest(slug, basePath)
    const workflowPath = getWorkflowPath(slug, basePath)
    const workflow = await readJson<N8nWorkflow>(workflowPath)

    return { manifest, workflow }
  })

  // API: Create new workflow
  fastify.post<{ 
    Body: { 
      name: string
      cronExpression: string
      timezone: string
      template: TemplateName
      shellCommand?: string
    } 
  }>('/api/workflows', async (request, reply) => {
    const { name, cronExpression, timezone, template, shellCommand } = request.body

    // Validate
    const cronInfo = parseCron(cronExpression, timezone)
    if (!cronInfo.isValid) {
      reply.status(400)
      return { error: `Invalid cron: ${cronInfo.error}` }
    }

    // Generate slug
    const slug = createSlug(name)
    
    if (await manifestExists(slug, basePath)) {
      reply.status(400)
      return { error: `Workflow "${slug}" already exists` }
    }

    // Create manifest
    const manifest = createManifest(slug, name, template, cronExpression, timezone)

    // Create workflow from template
    const templateConfig = getTemplate(template)
    const templateOptions: TemplateOptions = {}
    if (shellCommand) {
      templateOptions.shellCommand = shellCommand
    }
    const workflow = templateConfig.create(name, cronExpression, timezone, templateOptions)

    // Save files
    const workflowPath = getWorkflowPath(slug, basePath)
    const manifestPath = getManifestPath(slug, basePath)

    await writeJson(workflowPath, workflow)
    await saveManifest(manifest, basePath)

    // Register
    await upsertRegistryEntry({
      slug,
      projectPath: basePath,
      manifestPath
    })

    return { success: true, slug, manifest, workflow }
  })

  // API: Update workflow
  fastify.put<{ 
    Params: { slug: string }
    Body: { 
      name?: string
      cronExpression?: string
      timezone?: string
      shellCommand?: string
    } 
  }>('/api/workflows/:slug', async (request, reply) => {
    const { slug } = request.params
    const { name, cronExpression, timezone, shellCommand } = request.body

    if (!(await manifestExists(slug, basePath))) {
      reply.status(404)
      return { error: 'Workflow not found' }
    }

    const manifest = await loadManifest(slug, basePath)
    const workflowPath = getWorkflowPath(slug, basePath)
    const workflow = await readJson<N8nWorkflow>(workflowPath)

    // Update name
    if (name) {
      manifest.name = name
      workflow.name = name
    }

    // Update cron
    if (cronExpression) {
      const cronInfo = parseCron(cronExpression, timezone || manifest.timezone)
      if (!cronInfo.isValid) {
        reply.status(400)
        return { error: `Invalid cron: ${cronInfo.error}` }
      }
      manifest.cronExpression = cronExpression
      
      // Update in workflow nodes
      const scheduleNode = workflow.nodes.find(n => 
        n.type === 'n8n-nodes-base.scheduleTrigger' || n.type === 'n8n-nodes-base.cron'
      )
      if (scheduleNode?.parameters) {
        const rule = scheduleNode.parameters['rule'] as { interval: Array<{ expression: string }> }
        if (rule?.interval?.[0]) {
          rule.interval[0].expression = cronExpression
        }
      }
    }

    // Update timezone
    if (timezone) {
      manifest.timezone = timezone
      const scheduleNode = workflow.nodes.find(n => 
        n.type === 'n8n-nodes-base.scheduleTrigger' || n.type === 'n8n-nodes-base.cron'
      )
      if (scheduleNode?.parameters) {
        const opts = scheduleNode.parameters['options'] as { timezone: string }
        if (opts) {
          opts.timezone = timezone
        }
      }
    }

    // Update shell command
    if (shellCommand) {
      const executeNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.executeCommand')
      if (executeNode?.parameters) {
        executeNode.parameters['command'] = shellCommand
      }
    }

    manifest.updatedAt = new Date().toISOString()
    await writeJson(workflowPath, workflow)
    await saveManifest(manifest, basePath)

    return { success: true, manifest, workflow }
  })

  // API: Archive workflow (move to archived folder)
  fastify.delete<{ Params: { slug: string } }>('/api/workflows/:slug', async (request, reply) => {
    const { slug } = request.params

    if (!(await manifestExists(slug, basePath))) {
      reply.status(404)
      return { error: 'Workflow not found' }
    }

    const manifest = await loadManifest(slug, basePath)
    const workflowPath = getWorkflowPath(slug, basePath)
    const manifestPath = getManifestPath(slug, basePath)

    // Deactivate remote workflow if deployed
    if (manifest.lastDeployedWorkflowId) {
      const auth = await getAuth()
      if (auth) {
        try {
          const client = createClient(auth)
          await client.deactivateWorkflow(manifest.lastDeployedWorkflowId)
        } catch {
          // Ignore deactivation errors
        }
      }
    }

    // Create archived folder with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const archivedDir = join(workflowsDir, 'archived')
    await ensureDir(archivedDir)

    // Move files to archived folder
    const archivedWorkflowPath = join(archivedDir, `${slug}.${timestamp}.json`)
    const archivedManifestPath = join(archivedDir, `${slug}.${timestamp}.cron8n.json`)

    await moveFile(workflowPath, archivedWorkflowPath)
    await moveFile(manifestPath, archivedManifestPath)
    
    // Remove from registry
    await removeRegistryEntry(slug, basePath)

    return { success: true, archived: true }
  })

  // API: Deploy workflow
  fastify.post<{ Params: { slug: string } }>('/api/workflows/:slug/deploy', async (request, reply) => {
    const { slug } = request.params

    const auth = await getAuth()
    if (!auth) {
      reply.status(401)
      return { error: 'Not authenticated. Run: cron8n auth login' }
    }

    if (!(await manifestExists(slug, basePath))) {
      reply.status(404)
      return { error: 'Workflow not found' }
    }

    const manifest = await loadManifest(slug, basePath)
    const workflowPath = getWorkflowPath(slug, basePath)
    const workflow = await readJson<N8nWorkflow>(workflowPath)

    const client = createClient(auth)

    let deployedWorkflow: N8nWorkflow

    if (manifest.lastDeployedWorkflowId) {
      // Update existing
      deployedWorkflow = await client.updateWorkflow({
        id: manifest.lastDeployedWorkflowId,
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections as Record<string, unknown>,
        settings: workflow.settings
      })
    } else {
      // Create new
      deployedWorkflow = await client.createWorkflow({
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections as Record<string, unknown>,
        settings: workflow.settings
      })
    }

    // Update manifest
    manifest.lastDeployedWorkflowId = deployedWorkflow.id
    manifest.lastDeployedAt = new Date().toISOString()
    manifest.updatedAt = new Date().toISOString()
    await saveManifest(manifest, basePath)

    return { success: true, workflowId: deployedWorkflow.id, manifest }
  })

  // API: Activate/Deactivate workflow
  fastify.post<{ Params: { slug: string }, Body: { active: boolean } }>('/api/workflows/:slug/activate', async (request, reply) => {
    const { slug } = request.params
    const { active } = request.body

    const auth = await getAuth()
    if (!auth) {
      reply.status(401)
      return { error: 'Not authenticated' }
    }

    if (!(await manifestExists(slug, basePath))) {
      reply.status(404)
      return { error: 'Workflow not found' }
    }

    const manifest = await loadManifest(slug, basePath)
    
    if (!manifest.lastDeployedWorkflowId) {
      reply.status(400)
      return { error: 'Workflow not deployed yet' }
    }

    const client = createClient(auth)
    
    if (active) {
      await client.activateWorkflow(manifest.lastDeployedWorkflowId)
    } else {
      await client.deactivateWorkflow(manifest.lastDeployedWorkflowId)
    }

    return { success: true, active }
  })

  // API: Get templates
  fastify.get('/api/templates', async () => {
    return { 
      templates: getTemplateNames().map(name => ({
        value: name,
        name: getTemplate(name).name,
        description: getTemplate(name).description
      }))
    }
  })

  // API: Get cron presets
  fastify.get('/api/cron-presets', async () => {
    return { presets: CRON_PRESETS }
  })

  // API: Get timezones
  fastify.get('/api/timezones', async () => {
    return { timezones: getTimezoneOptions() }
  })

  // API: Validate cron expression
  fastify.post<{ Body: { expression: string, timezone?: string } }>('/api/validate-cron', async (request) => {
    const { expression, timezone } = request.body
    const result = parseCron(expression, timezone)
    return result
  })

  // Start server
  try {
    await fastify.listen({ port, host: '127.0.0.1' })
    print.success(`UI running at http://localhost:${port}`)
    return
  } catch (err) {
    print.error(`Failed to start server: ${err}`)
    process.exit(1)
  }
}
