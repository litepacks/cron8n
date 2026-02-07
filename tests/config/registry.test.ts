import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  getRegistryDir, 
  getRegistryPath,
  loadRegistry,
  saveRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
  getAllEntries,
  getEntriesByProject,
  getEntry,
  getEntryByWorkflowId,
  type RegistryEntry
} from '../../src/config/registry.js'
import { exists } from '../../src/utils/fs.js'
import { promises as fs } from 'node:fs'

describe('registry', () => {
  const testEntry: Omit<RegistryEntry, 'lastSyncedAt'> = {
    slug: 'test-workflow',
    projectPath: '/tmp/test-project',
    manifestPath: '/tmp/test-project/workflows/test-workflow.cron8n.json',
    workflowId: '123'
  }

  // Store original registry for restoration
  let originalRegistry: string | null = null
  const registryPath = getRegistryPath()

  beforeEach(async () => {
    // Backup original registry if it exists
    if (await exists(registryPath)) {
      originalRegistry = await fs.readFile(registryPath, 'utf-8')
    }
    // Clear registry for test
    await saveRegistry({ workflows: [] })
  })

  afterEach(async () => {
    // Restore original registry
    if (originalRegistry) {
      await fs.writeFile(registryPath, originalRegistry)
    } else {
      // Clear test data
      await saveRegistry({ workflows: [] })
    }
  })

  describe('getRegistryDir and getRegistryPath', () => {
    it('should return paths in home directory', () => {
      const dir = getRegistryDir()
      const path = getRegistryPath()
      
      expect(dir).toContain('.cron8n')
      expect(path).toContain('.cron8n')
      expect(path).toContain('registry.json')
    })
  })

  describe('loadRegistry and saveRegistry', () => {
    it('should load empty registry when none exists', async () => {
      await saveRegistry({ workflows: [] })
      const registry = await loadRegistry()
      
      expect(registry.workflows).toEqual([])
    })

    it('should save and load registry', async () => {
      const testRegistry = {
        workflows: [{ ...testEntry, lastSyncedAt: '2026-02-07T10:00:00Z' }]
      }
      
      await saveRegistry(testRegistry)
      const loaded = await loadRegistry()
      
      expect(loaded.workflows).toHaveLength(1)
      expect(loaded.workflows[0]?.slug).toBe('test-workflow')
    })
  })

  describe('upsertRegistryEntry', () => {
    it('should add new entry', async () => {
      await upsertRegistryEntry(testEntry)
      
      const entries = await getAllEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0]?.slug).toBe('test-workflow')
      expect(entries[0]?.lastSyncedAt).toBeTruthy()
    })

    it('should update existing entry', async () => {
      await upsertRegistryEntry(testEntry)
      
      await upsertRegistryEntry({
        ...testEntry,
        workflowId: '456'
      })
      
      const entries = await getAllEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0]?.workflowId).toBe('456')
    })
  })

  describe('removeRegistryEntry', () => {
    it('should remove entry', async () => {
      await upsertRegistryEntry(testEntry)
      expect(await getAllEntries()).toHaveLength(1)
      
      const removed = await removeRegistryEntry(testEntry.slug, testEntry.projectPath)
      expect(removed).toBe(true)
      expect(await getAllEntries()).toHaveLength(0)
    })

    it('should return false if entry not found', async () => {
      const removed = await removeRegistryEntry('nonexistent', '/path')
      expect(removed).toBe(false)
    })
  })

  describe('getEntriesByProject', () => {
    it('should filter by project path', async () => {
      await upsertRegistryEntry(testEntry)
      await upsertRegistryEntry({
        slug: 'other-workflow',
        projectPath: '/tmp/other-project',
        manifestPath: '/tmp/other-project/workflows/other.cron8n.json'
      })
      
      const entries = await getEntriesByProject('/tmp/test-project')
      expect(entries).toHaveLength(1)
      expect(entries[0]?.slug).toBe('test-workflow')
    })
  })

  describe('getEntry', () => {
    it('should find entry by slug and project', async () => {
      await upsertRegistryEntry(testEntry)
      
      const entry = await getEntry('test-workflow', '/tmp/test-project')
      expect(entry).toBeDefined()
      expect(entry?.slug).toBe('test-workflow')
    })

    it('should return undefined if not found', async () => {
      const entry = await getEntry('nonexistent', '/path')
      expect(entry).toBeUndefined()
    })
  })

  describe('getEntryByWorkflowId', () => {
    it('should find entry by workflow ID', async () => {
      await upsertRegistryEntry(testEntry)
      
      const entry = await getEntryByWorkflowId('123')
      expect(entry).toBeDefined()
      expect(entry?.slug).toBe('test-workflow')
    })

    it('should return undefined if not found', async () => {
      const entry = await getEntryByWorkflowId('nonexistent')
      expect(entry).toBeUndefined()
    })
  })
})
