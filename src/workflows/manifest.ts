import { z } from 'zod'
import { join } from 'pathe'
import { readJson, writeJson, exists, getCwd, resolvePath } from '../utils/fs.js'
import { getISOTimestamp } from '../utils/time.js'
import type { TemplateName } from './templates.js'

export const ManifestSchema = z.object({
  slug: z.string(),
  name: z.string(),
  createdAt: z.string(),
  template: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  tags: z.array(z.string()),
  lastDeployedWorkflowId: z.string().optional(),
  lastDeployedAt: z.string().optional()
})

export type Manifest = z.infer<typeof ManifestSchema>

const WORKFLOWS_DIR = 'workflows'

/**
 * Gets the workflows directory path
 */
export function getWorkflowsDir(basePath?: string): string {
  return join(basePath ?? getCwd(), WORKFLOWS_DIR)
}

/**
 * Gets the workflow JSON file path
 */
export function getWorkflowPath(slug: string, basePath?: string): string {
  return join(getWorkflowsDir(basePath), `${slug}.json`)
}

/**
 * Gets the manifest file path
 */
export function getManifestPath(slug: string, basePath?: string): string {
  return join(getWorkflowsDir(basePath), `${slug}.cron8n.json`)
}

/**
 * Creates cron8n tags for a workflow
 */
export function createTags(slug: string): string[] {
  return ['managed-by:cron8n', `cron8n:${slug}`]
}

/**
 * Creates a new manifest
 */
export function createManifest(
  slug: string,
  name: string,
  template: TemplateName,
  cronExpression: string,
  timezone: string
): Manifest {
  return {
    slug,
    name,
    createdAt: getISOTimestamp(),
    template,
    cronExpression,
    timezone,
    tags: createTags(slug)
  }
}

/**
 * Loads a manifest from disk
 */
export async function loadManifest(slug: string, basePath?: string): Promise<Manifest> {
  const manifestPath = getManifestPath(slug, basePath)
  const data = await readJson<unknown>(manifestPath)
  return ManifestSchema.parse(data)
}

/**
 * Saves a manifest to disk
 */
export async function saveManifest(manifest: Manifest, basePath?: string): Promise<void> {
  const manifestPath = getManifestPath(manifest.slug, basePath)
  await writeJson(manifestPath, manifest)
}

/**
 * Updates manifest with deployment info
 */
export async function updateManifestDeployment(
  slug: string,
  workflowId: string,
  basePath?: string
): Promise<Manifest> {
  const manifest = await loadManifest(slug, basePath)
  manifest.lastDeployedWorkflowId = workflowId
  manifest.lastDeployedAt = getISOTimestamp()
  await saveManifest(manifest, basePath)
  return manifest
}

/**
 * Checks if a manifest exists
 */
export async function manifestExists(slug: string, basePath?: string): Promise<boolean> {
  const manifestPath = getManifestPath(slug, basePath)
  return exists(manifestPath)
}

/**
 * Lists all manifest files in the workflows directory
 */
export async function listManifests(basePath?: string): Promise<string[]> {
  const workflowsDir = getWorkflowsDir(basePath)
  
  if (!(await exists(workflowsDir))) {
    return []
  }

  const { listFilesByExtension } = await import('../utils/fs.js')
  const files = await listFilesByExtension(workflowsDir, '.json')
  
  // Filter to only .cron8n.json files and extract slugs
  return files
    .filter(f => f.endsWith('.cron8n.json'))
    .map(f => f.replace('.cron8n.json', ''))
}

/**
 * Loads all manifests from the workflows directory
 */
export async function loadAllManifests(basePath?: string): Promise<Manifest[]> {
  const slugs = await listManifests(basePath)
  const manifests: Manifest[] = []

  for (const slug of slugs) {
    try {
      const manifest = await loadManifest(slug, basePath)
      manifests.push(manifest)
    } catch {
      // Skip invalid manifests
    }
  }

  return manifests
}

/**
 * Resolves a slug or path to a manifest
 */
export async function resolveManifest(slugOrPath: string): Promise<{ manifest: Manifest; basePath: string }> {
  // Check if it's a path
  if (slugOrPath.includes('/') || slugOrPath.includes('\\')) {
    const resolvedPath = resolvePath(slugOrPath)
    
    // If it's a .cron8n.json file
    if (resolvedPath.endsWith('.cron8n.json')) {
      const data = await readJson<unknown>(resolvedPath)
      const manifest = ManifestSchema.parse(data)
      const basePath = join(resolvedPath, '..', '..')
      return { manifest, basePath }
    }
    
    // If it's a workflow JSON file
    if (resolvedPath.endsWith('.json')) {
      const slug = resolvedPath.replace(/\.json$/, '').split('/').pop()!
      const basePath = join(resolvedPath, '..', '..')
      const manifest = await loadManifest(slug, basePath)
      return { manifest, basePath }
    }
  }

  // Treat as slug
  const manifest = await loadManifest(slugOrPath)
  return { manifest, basePath: getCwd() }
}
