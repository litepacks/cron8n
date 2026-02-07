import { describe, it, expect } from 'vitest'
import {
  isCronNode,
  extractCronExpression,
  extractTimezone,
  getCronNodes,
  hasCronTrigger,
  isCron8nManaged,
  getCron8nSlug,
  analyzeWorkflow,
  filterCronWorkflows,
  groupWorkflows,
  suggestSlug
} from '../../src/workflows/discover.js'
import type { N8nWorkflow, N8nNode } from '../../src/api/n8nClient.js'

describe('workflow discovery', () => {
  const createCronNode = (overrides?: Partial<N8nNode>): N8nNode => ({
    name: 'Schedule Trigger',
    type: 'n8n-nodes-base.scheduleTrigger',
    position: [250, 300],
    parameters: {
      rule: {
        interval: [
          { field: 'cronExpression', expression: '0 * * * *' }
        ]
      },
      options: {
        timezone: 'Europe/Istanbul'
      }
    },
    ...overrides
  })

  const createWorkflow = (overrides?: Partial<N8nWorkflow>): N8nWorkflow => ({
    id: '123',
    name: 'Test Workflow',
    active: true,
    nodes: [createCronNode()],
    connections: {},
    tags: [],
    ...overrides
  })

  describe('isCronNode', () => {
    it('should detect scheduleTrigger node', () => {
      const node = createCronNode()
      expect(isCronNode(node)).toBe(true)
    })

    it('should detect cron node', () => {
      const node = createCronNode({ type: 'n8n-nodes-base.cron' })
      expect(isCronNode(node)).toBe(true)
    })

    it('should not detect non-cron nodes', () => {
      const node: N8nNode = {
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        position: [250, 300]
      }
      expect(isCronNode(node)).toBe(false)
    })
  })

  describe('extractCronExpression', () => {
    it('should extract from scheduleTrigger format', () => {
      const node = createCronNode()
      expect(extractCronExpression(node)).toBe('0 * * * *')
    })

    it('should extract from direct cronExpression parameter', () => {
      const node = createCronNode({
        parameters: {
          cronExpression: '0 0 * * *'
        }
      })
      expect(extractCronExpression(node)).toBe('0 0 * * *')
    })

    it('should return undefined if no cron expression found', () => {
      const node = createCronNode({ parameters: {} })
      expect(extractCronExpression(node)).toBeUndefined()
    })
  })

  describe('extractTimezone', () => {
    it('should extract timezone from options', () => {
      const node = createCronNode()
      expect(extractTimezone(node)).toBe('Europe/Istanbul')
    })

    it('should return undefined if no timezone', () => {
      const node = createCronNode({ parameters: {} })
      expect(extractTimezone(node)).toBeUndefined()
    })
  })

  describe('getCronNodes', () => {
    it('should return all cron nodes', () => {
      const workflow = createWorkflow({
        nodes: [
          createCronNode({ name: 'Cron 1' }),
          createCronNode({ name: 'Cron 2' }),
          { name: 'HTTP', type: 'n8n-nodes-base.httpRequest', position: [0, 0] }
        ]
      })
      
      const cronNodes = getCronNodes(workflow)
      expect(cronNodes).toHaveLength(2)
      expect(cronNodes[0]?.nodeName).toBe('Cron 1')
      expect(cronNodes[1]?.nodeName).toBe('Cron 2')
    })
  })

  describe('hasCronTrigger', () => {
    it('should return true if workflow has cron trigger', () => {
      const workflow = createWorkflow()
      expect(hasCronTrigger(workflow)).toBe(true)
    })

    it('should return false if workflow has no cron trigger', () => {
      const workflow = createWorkflow({
        nodes: [{ name: 'HTTP', type: 'n8n-nodes-base.httpRequest', position: [0, 0] }]
      })
      expect(hasCronTrigger(workflow)).toBe(false)
    })
  })

  describe('isCron8nManaged', () => {
    it('should return true if workflow has managed tag', () => {
      const workflow = createWorkflow({
        tags: [{ id: '1', name: 'managed-by:cron8n' }]
      })
      expect(isCron8nManaged(workflow)).toBe(true)
    })

    it('should return false if workflow has no managed tag', () => {
      const workflow = createWorkflow({
        tags: [{ id: '1', name: 'other-tag' }]
      })
      expect(isCron8nManaged(workflow)).toBe(false)
    })

    it('should return false if workflow has no tags', () => {
      const workflow = createWorkflow({ tags: undefined })
      expect(isCron8nManaged(workflow)).toBe(false)
    })
  })

  describe('getCron8nSlug', () => {
    it('should extract slug from tag', () => {
      const workflow = createWorkflow({
        tags: [
          { id: '1', name: 'managed-by:cron8n' },
          { id: '2', name: 'cron8n:my-workflow' }
        ]
      })
      expect(getCron8nSlug(workflow)).toBe('my-workflow')
    })

    it('should return undefined if no slug tag', () => {
      const workflow = createWorkflow({
        tags: [{ id: '1', name: 'managed-by:cron8n' }]
      })
      expect(getCron8nSlug(workflow)).toBeUndefined()
    })
  })

  describe('analyzeWorkflow', () => {
    it('should return complete analysis', () => {
      const workflow = createWorkflow({
        tags: [
          { id: '1', name: 'managed-by:cron8n' },
          { id: '2', name: 'cron8n:test-workflow' }
        ]
      })

      const analysis = analyzeWorkflow(workflow)
      
      expect(analysis.workflowId).toBe('123')
      expect(analysis.workflowName).toBe('Test Workflow')
      expect(analysis.active).toBe(true)
      expect(analysis.isManaged).toBe(true)
      expect(analysis.managedSlug).toBe('test-workflow')
      expect(analysis.cronNodes).toHaveLength(1)
      expect(analysis.tags).toContain('managed-by:cron8n')
    })
  })

  describe('filterCronWorkflows', () => {
    it('should filter to only cron workflows', () => {
      const workflows = [
        createWorkflow({ id: '1' }),
        createWorkflow({ 
          id: '2', 
          nodes: [{ name: 'HTTP', type: 'n8n-nodes-base.httpRequest', position: [0, 0] }] 
        }),
        createWorkflow({ id: '3' })
      ]

      const filtered = filterCronWorkflows(workflows)
      expect(filtered).toHaveLength(2)
      expect(filtered.map(w => w.id)).toEqual(['1', '3'])
    })
  })

  describe('groupWorkflows', () => {
    it('should group into managed and unmanaged', () => {
      const workflows = [
        createWorkflow({
          id: '1',
          tags: [{ id: '1', name: 'managed-by:cron8n' }]
        }),
        createWorkflow({ id: '2', tags: [] }),
        createWorkflow({
          id: '3',
          tags: [{ id: '2', name: 'managed-by:cron8n' }]
        })
      ]

      const { managed, unmanaged } = groupWorkflows(workflows)
      
      expect(managed).toHaveLength(2)
      expect(unmanaged).toHaveLength(1)
      expect(unmanaged[0]?.workflowId).toBe('2')
    })
  })

  describe('suggestSlug', () => {
    it('should create slug from workflow name', () => {
      expect(suggestSlug('My Daily Backup')).toBe('my-daily-backup')
      expect(suggestSlug('Cron Job #1')).toBe('cron-job-1')
    })
  })
})
