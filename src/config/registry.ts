import { z } from 'zod'
import { join } from 'pathe'
import { getHomeDir, readJson, writeJson, exists, ensureDir } from '../utils/fs.js'
import { getISOTimestamp } from '../utils/time.js'

const RegistryEntrySchema = z.object({
  slug: z.string(),
  projectPath: z.string(),
  manifestPath: z.string(),
  workflowId: z.string().optional(),
  lastSyncedAt: z.string().optional()
})

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>

const RegistrySchema = z.object({
  workflows: z.array(RegistryEntrySchema)
})

export type Registry = z.infer<typeof RegistrySchema>

const REGISTRY_DIR = join(getHomeDir(), '.cron8n')
const REGISTRY_FILE = join(REGISTRY_DIR, 'registry.json')

/**
 * Gets the registry directory path
 */
export function getRegistryDir(): string {
  return REGISTRY_DIR
}

/**
 * Gets the registry file path
 */
export function getRegistryPath(): string {
  return REGISTRY_FILE
}

/**
 * Loads the registry from disk
 */
export async function loadRegistry(): Promise<Registry> {
  if (!(await exists(REGISTRY_FILE))) {
    return { workflows: [] }
  }

  try {
    const data = await readJson<unknown>(REGISTRY_FILE)
    return RegistrySchema.parse(data)
  } catch {
    // If registry is corrupted, start fresh
    return { workflows: [] }
  }
}

/**
 * Saves the registry to disk
 */
export async function saveRegistry(registry: Registry): Promise<void> {
  await ensureDir(REGISTRY_DIR)
  await writeJson(REGISTRY_FILE, registry)
}

/**
 * Adds or updates a workflow entry in the registry
 */
export async function upsertRegistryEntry(entry: Omit<RegistryEntry, 'lastSyncedAt'>): Promise<void> {
  const registry = await loadRegistry()
  
  const existingIndex = registry.workflows.findIndex(
    w => w.slug === entry.slug && w.projectPath === entry.projectPath
  )

  const newEntry: RegistryEntry = {
    ...entry,
    lastSyncedAt: getISOTimestamp()
  }

  if (existingIndex >= 0) {
    registry.workflows[existingIndex] = newEntry
  } else {
    registry.workflows.push(newEntry)
  }

  await saveRegistry(registry)
}

/**
 * Updates the workflow ID for an entry
 */
export async function updateWorkflowId(
  slug: string,
  projectPath: string,
  workflowId: string
): Promise<void> {
  const registry = await loadRegistry()
  
  const entry = registry.workflows.find(
    w => w.slug === slug && w.projectPath === projectPath
  )

  if (entry) {
    entry.workflowId = workflowId
    entry.lastSyncedAt = getISOTimestamp()
    await saveRegistry(registry)
  }
}

/**
 * Removes a workflow entry from the registry
 */
export async function removeRegistryEntry(slug: string, projectPath: string): Promise<boolean> {
  const registry = await loadRegistry()
  
  const initialLength = registry.workflows.length
  registry.workflows = registry.workflows.filter(
    w => !(w.slug === slug && w.projectPath === projectPath)
  )

  if (registry.workflows.length < initialLength) {
    await saveRegistry(registry)
    return true
  }

  return false
}

/**
 * Gets all registry entries
 */
export async function getAllEntries(): Promise<RegistryEntry[]> {
  const registry = await loadRegistry()
  return registry.workflows
}

/**
 * Gets entries for a specific project
 */
export async function getEntriesByProject(projectPath: string): Promise<RegistryEntry[]> {
  const registry = await loadRegistry()
  return registry.workflows.filter(w => w.projectPath === projectPath)
}

/**
 * Gets an entry by slug and project path
 */
export async function getEntry(slug: string, projectPath: string): Promise<RegistryEntry | undefined> {
  const registry = await loadRegistry()
  return registry.workflows.find(
    w => w.slug === slug && w.projectPath === projectPath
  )
}

/**
 * Gets an entry by workflow ID
 */
export async function getEntryByWorkflowId(workflowId: string): Promise<RegistryEntry | undefined> {
  const registry = await loadRegistry()
  return registry.workflows.find(w => w.workflowId === workflowId)
}
