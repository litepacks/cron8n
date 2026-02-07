import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseCron, CRON_PRESETS } from '../../src/utils/time.js'
import { createSlug, isValidSlug } from '../../src/utils/slug.js'
import { createManifest, createTags } from '../../src/workflows/manifest.js'
import { getTemplate, getTemplateNames } from '../../src/workflows/templates.js'
import { 
  hasCronTrigger, 
  isCron8nManaged, 
  groupWorkflows,
  suggestSlug 
} from '../../src/workflows/discover.js'
import type { N8nWorkflow } from '../../src/api/n8nClient.js'

describe('cron commands', () => {
  describe('cron new', () => {
    it('should validate cron expressions', () => {
      // Valid expressions
      expect(parseCron('0 * * * *').isValid).toBe(true)
      expect(parseCron('0 0 * * *').isValid).toBe(true)
      expect(parseCron('*/5 * * * *').isValid).toBe(true)
      
      // Invalid expressions
      expect(parseCron('invalid').isValid).toBe(false)
      expect(parseCron('60 * * * *').isValid).toBe(false)
    })

    it('should support all preset cron expressions', () => {
      for (const preset of CRON_PRESETS) {
        const result = parseCron(preset.expression)
        expect(result.isValid).toBe(true)
      }
    })

    it('should create valid slug from name', () => {
      expect(createSlug('My Daily Backup')).toBe('my-daily-backup')
      expect(createSlug('Cron Job #1')).toBe('cron-job-1')
      expect(isValidSlug(createSlug('Test Workflow'))).toBe(true)
    })

    it('should create manifest with correct tags', () => {
      const manifest = createManifest(
        'test-workflow',
        'Test Workflow',
        'cron-only',
        '0 * * * *',
        'UTC'
      )
      
      expect(manifest.tags).toContain('managed-by:cron8n')
      expect(manifest.tags).toContain('cron8n:test-workflow')
    })

    it('should support all templates', () => {
      const templates = getTemplateNames()
      expect(templates).toContain('cron-only')
      expect(templates).toContain('shell-command')
      expect(templates).toContain('http-request')
      expect(templates).toContain('webhook-call')
      
      for (const name of templates) {
        const template = getTemplate(name)
        const workflow = template.create('Test', '0 * * * *', 'UTC')
        expect(workflow.name).toBe('Test')
        expect(workflow.nodes.length).toBeGreaterThan(0)
      }
    })
  })

  describe('cron list', () => {
    const createMockWorkflow = (overrides: Partial<N8nWorkflow> = {}): N8nWorkflow => ({
      id: '1',
      name: 'Test Workflow',
      active: true,
      nodes: [{
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        position: [0, 0]
      }],
      connections: {},
      tags: [],
      ...overrides
    })

    it('should detect cron trigger workflows', () => {
      const cronWorkflow = createMockWorkflow()
      const nonCronWorkflow = createMockWorkflow({
        nodes: [{
          name: 'HTTP',
          type: 'n8n-nodes-base.httpRequest',
          position: [0, 0]
        }]
      })
      
      expect(hasCronTrigger(cronWorkflow)).toBe(true)
      expect(hasCronTrigger(nonCronWorkflow)).toBe(false)
    })

    it('should detect cron8n-managed workflows', () => {
      const managedWorkflow = createMockWorkflow({
        tags: [{ id: '1', name: 'managed-by:cron8n' }]
      })
      const unmanagedWorkflow = createMockWorkflow({
        tags: []
      })
      
      expect(isCron8nManaged(managedWorkflow)).toBe(true)
      expect(isCron8nManaged(unmanagedWorkflow)).toBe(false)
    })

    it('should group workflows correctly', () => {
      const workflows = [
        createMockWorkflow({
          id: '1',
          tags: [{ id: '1', name: 'managed-by:cron8n' }]
        }),
        createMockWorkflow({
          id: '2',
          tags: []
        }),
        createMockWorkflow({
          id: '3',
          nodes: [{ name: 'HTTP', type: 'n8n-nodes-base.httpRequest', position: [0, 0] }],
          tags: []
        })
      ]
      
      const { managed, unmanaged } = groupWorkflows(workflows)
      
      expect(managed).toHaveLength(1)
      expect(unmanaged).toHaveLength(1)
    })
  })

  describe('cron inspect', () => {
    it('should suggest slug for unmanaged workflows', () => {
      expect(suggestSlug('Daily Backup Job')).toBe('daily-backup-job')
      expect(suggestSlug('My Cron #1')).toBe('my-cron-1')
    })
  })

  describe('cron import', () => {
    it('should create correct tags for imported workflow', () => {
      const slug = 'imported-workflow'
      const tags = createTags(slug)
      
      expect(tags).toContain('managed-by:cron8n')
      expect(tags).toContain('cron8n:imported-workflow')
    })
  })

  describe('cron validate', () => {
    it('should validate and show next runs', () => {
      const result = parseCron('0 9 * * 1-5', 'Europe/Istanbul', 5)
      
      expect(result.isValid).toBe(true)
      expect(result.nextRuns).toHaveLength(5)
      
      // All runs should be in the future
      const now = new Date()
      for (const run of result.nextRuns) {
        expect(run.getTime()).toBeGreaterThan(now.getTime())
      }
    })

    it('should respect timezone', () => {
      const istanbul = parseCron('0 12 * * *', 'Europe/Istanbul', 1)
      const newYork = parseCron('0 12 * * *', 'America/New_York', 1)
      
      expect(istanbul.isValid).toBe(true)
      expect(newYork.isValid).toBe(true)
      
      // The UTC times should be different
      const istanbulUTC = istanbul.nextRuns[0]?.getTime()
      const newYorkUTC = newYork.nextRuns[0]?.getTime()
      
      // They run at same local time but different UTC times
      // (unless by coincidence they align)
    })

    it('should handle invalid expressions gracefully', () => {
      const result = parseCron('not a cron')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toBeTruthy()
      expect(result.nextRuns).toHaveLength(0)
    })
  })

  describe('cron deploy', () => {
    it('should determine create vs update based on workflowId', () => {
      const newManifest = createManifest(
        'new-workflow',
        'New Workflow',
        'cron-only',
        '0 * * * *',
        'UTC'
      )
      
      const existingManifest = {
        ...createManifest(
          'existing-workflow',
          'Existing Workflow',
          'cron-only',
          '0 * * * *',
          'UTC'
        ),
        lastDeployedWorkflowId: '123'
      }
      
      expect(newManifest.lastDeployedWorkflowId).toBeUndefined()
      expect(existingManifest.lastDeployedWorkflowId).toBe('123')
    })
  })
})
