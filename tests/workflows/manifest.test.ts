import { describe, it, expect } from 'vitest'
import {
  createManifest,
  createTags,
  getWorkflowsDir,
  getWorkflowPath,
  getManifestPath,
  ManifestSchema
} from '../../src/workflows/manifest.js'

describe('manifest utilities', () => {
  describe('createTags', () => {
    it('should create management tags', () => {
      const tags = createTags('my-workflow')
      expect(tags).toHaveLength(2)
      expect(tags).toContain('managed-by:cron8n')
      expect(tags).toContain('cron8n:my-workflow')
    })
  })

  describe('createManifest', () => {
    it('should create manifest with all fields', () => {
      const manifest = createManifest(
        'my-workflow',
        'My Workflow',
        'cron-only',
        '0 * * * *',
        'Europe/Istanbul'
      )

      expect(manifest.slug).toBe('my-workflow')
      expect(manifest.name).toBe('My Workflow')
      expect(manifest.template).toBe('cron-only')
      expect(manifest.cronExpression).toBe('0 * * * *')
      expect(manifest.timezone).toBe('Europe/Istanbul')
      expect(manifest.tags).toEqual(['managed-by:cron8n', 'cron8n:my-workflow'])
      expect(manifest.createdAt).toBeTruthy()
      expect(manifest.lastDeployedWorkflowId).toBeUndefined()
      expect(manifest.lastDeployedAt).toBeUndefined()
    })

    it('should be valid according to schema', () => {
      const manifest = createManifest(
        'test',
        'Test Workflow',
        'http-request',
        '0 0 * * *',
        'UTC'
      )

      const result = ManifestSchema.safeParse(manifest)
      expect(result.success).toBe(true)
    })
  })

  describe('getWorkflowsDir', () => {
    it('should return workflows subdirectory', () => {
      const dir = getWorkflowsDir('/home/user/project')
      expect(dir).toBe('/home/user/project/workflows')
    })

    it('should use cwd if no base path provided', () => {
      const dir = getWorkflowsDir()
      expect(dir).toContain('workflows')
    })
  })

  describe('getWorkflowPath', () => {
    it('should return correct workflow file path', () => {
      const path = getWorkflowPath('my-workflow', '/home/user/project')
      expect(path).toBe('/home/user/project/workflows/my-workflow.json')
    })
  })

  describe('getManifestPath', () => {
    it('should return correct manifest file path', () => {
      const path = getManifestPath('my-workflow', '/home/user/project')
      expect(path).toBe('/home/user/project/workflows/my-workflow.cron8n.json')
    })
  })

  describe('ManifestSchema', () => {
    it('should validate complete manifest', () => {
      const validManifest = {
        slug: 'test',
        name: 'Test Workflow',
        createdAt: '2026-02-07T10:00:00Z',
        template: 'cron-only',
        cronExpression: '0 * * * *',
        timezone: 'UTC',
        tags: ['managed-by:cron8n'],
        lastDeployedWorkflowId: '123',
        lastDeployedAt: '2026-02-07T12:00:00Z'
      }

      const result = ManifestSchema.safeParse(validManifest)
      expect(result.success).toBe(true)
    })

    it('should validate manifest without optional fields', () => {
      const minimalManifest = {
        slug: 'test',
        name: 'Test',
        createdAt: '2026-02-07T10:00:00Z',
        template: 'cron-only',
        cronExpression: '0 * * * *',
        timezone: 'UTC',
        tags: []
      }

      const result = ManifestSchema.safeParse(minimalManifest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid manifest', () => {
      const invalidManifest = {
        slug: 'test'
        // missing required fields
      }

      const result = ManifestSchema.safeParse(invalidManifest)
      expect(result.success).toBe(false)
    })
  })
})
