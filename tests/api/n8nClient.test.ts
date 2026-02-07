import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient, type N8nWorkflow } from '../../src/api/n8nClient.js'
import type { AuthCredentials } from '../../src/config/store.js'

// Mock undici
vi.mock('undici', () => ({
  request: vi.fn()
}))

import { request } from 'undici'

const mockRequest = vi.mocked(request)

describe('n8nClient', () => {
  const testAuth: AuthCredentials = {
    baseUrl: 'https://n8n.example.com',
    authMode: 'apiKey',
    secret: 'test-api-key'
  }

  const mockWorkflow: N8nWorkflow = {
    id: '123',
    name: 'Test Workflow',
    active: true,
    nodes: [],
    connections: {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const setupMockResponse = (data: unknown, statusCode = 200) => {
    mockRequest.mockResolvedValueOnce({
      statusCode,
      body: {
        text: async () => JSON.stringify(data)
      }
    } as any)
  }

  describe('createClient', () => {
    it('should create client with provided auth', () => {
      const client = createClient(testAuth)
      expect(client).toBeDefined()
    })
  })

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      setupMockResponse({ data: [] })
      
      const client = createClient(testAuth)
      const result = await client.testConnection()
      
      expect(result).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/workflows?limit=1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key'
          })
        })
      )
    })

    it('should return false on failed connection', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Connection failed'))
      
      const client = createClient(testAuth)
      const result = await client.testConnection()
      
      expect(result).toBe(false)
    })
  })

  describe('listWorkflows', () => {
    it('should list workflows', async () => {
      setupMockResponse({ data: [mockWorkflow], nextCursor: null })
      
      const client = createClient(testAuth)
      const workflows = await client.listWorkflows()
      
      expect(workflows).toHaveLength(1)
      expect(workflows[0]?.name).toBe('Test Workflow')
    })

    it('should paginate through results', async () => {
      setupMockResponse({ data: [mockWorkflow], nextCursor: 'cursor1' })
      setupMockResponse({ 
        data: [{ ...mockWorkflow, id: '456', name: 'Second Workflow' }], 
        nextCursor: null 
      })
      
      const client = createClient(testAuth)
      const workflows = await client.listWorkflows()
      
      expect(workflows).toHaveLength(2)
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('should respect limit option', async () => {
      setupMockResponse({ data: [mockWorkflow], nextCursor: 'cursor1' })
      
      const client = createClient(testAuth)
      const workflows = await client.listWorkflows({ limit: 1 })
      
      expect(workflows).toHaveLength(1)
      // Should not paginate when limit is set
      expect(mockRequest).toHaveBeenCalledTimes(1)
    })
  })

  describe('getWorkflow', () => {
    it('should get workflow by ID', async () => {
      setupMockResponse(mockWorkflow)
      
      const client = createClient(testAuth)
      const workflow = await client.getWorkflow('123')
      
      expect(workflow.id).toBe('123')
      expect(workflow.name).toBe('Test Workflow')
      expect(mockRequest).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/workflows/123',
        expect.any(Object)
      )
    })
  })

  describe('createWorkflow', () => {
    it('should create workflow', async () => {
      setupMockResponse(mockWorkflow)
      
      const client = createClient(testAuth)
      const workflow = await client.createWorkflow({
        name: 'Test Workflow',
        nodes: [],
        connections: {}
      })
      
      expect(workflow.name).toBe('Test Workflow')
      expect(mockRequest).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/workflows',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test Workflow')
        })
      )
    })
  })

  describe('updateWorkflow', () => {
    it('should update workflow', async () => {
      setupMockResponse({ ...mockWorkflow, name: 'Updated Workflow' })
      
      const client = createClient(testAuth)
      const workflow = await client.updateWorkflow({
        id: '123',
        name: 'Updated Workflow'
      })
      
      expect(workflow.name).toBe('Updated Workflow')
      expect(mockRequest).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/workflows/123',
        expect.objectContaining({
          method: 'PATCH'
        })
      )
    })
  })

  describe('deleteWorkflow', () => {
    it('should delete workflow', async () => {
      setupMockResponse({})
      
      const client = createClient(testAuth)
      await client.deleteWorkflow('123')
      
      expect(mockRequest).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/workflows/123',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })
  })

  describe('activateWorkflow and deactivateWorkflow', () => {
    it('should activate workflow', async () => {
      setupMockResponse({ ...mockWorkflow, active: true })
      
      const client = createClient(testAuth)
      const workflow = await client.activateWorkflow('123')
      
      expect(workflow.active).toBe(true)
    })

    it('should deactivate workflow', async () => {
      setupMockResponse({ ...mockWorkflow, active: false })
      
      const client = createClient(testAuth)
      const workflow = await client.deactivateWorkflow('123')
      
      expect(workflow.active).toBe(false)
    })
  })

  describe('tag operations', () => {
    it('should list tags', async () => {
      setupMockResponse({ data: [{ id: '1', name: 'test-tag' }] })
      
      const client = createClient(testAuth)
      const tags = await client.listTags()
      
      expect(tags).toHaveLength(1)
      expect(tags[0]?.name).toBe('test-tag')
    })

    it('should create tag', async () => {
      setupMockResponse({ id: '1', name: 'new-tag' })
      
      const client = createClient(testAuth)
      const tag = await client.createTag('new-tag')
      
      expect(tag.name).toBe('new-tag')
    })

    it('should get or create existing tag', async () => {
      setupMockResponse({ data: [{ id: '1', name: 'existing-tag' }] })
      
      const client = createClient(testAuth)
      const tag = await client.getOrCreateTag('existing-tag')
      
      expect(tag.name).toBe('existing-tag')
      expect(mockRequest).toHaveBeenCalledTimes(1) // Only list, no create
    })

    it('should create tag if not exists', async () => {
      setupMockResponse({ data: [] }) // No existing tags
      setupMockResponse({ id: '2', name: 'new-tag' }) // Create result
      
      const client = createClient(testAuth)
      const tag = await client.getOrCreateTag('new-tag')
      
      expect(tag.name).toBe('new-tag')
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('auth header', () => {
    it('should use API key header', async () => {
      setupMockResponse({ data: [] })
      
      const client = createClient({
        ...testAuth,
        authMode: 'apiKey'
      })
      await client.listWorkflows({ limit: 1 })
      
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key'
          })
        })
      )
    })

    it('should use Bearer token header', async () => {
      setupMockResponse({ data: [] })
      
      const client = createClient({
        ...testAuth,
        authMode: 'bearerToken',
        secret: 'my-token'
      })
      await client.listWorkflows({ limit: 1 })
      
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer my-token'
          })
        })
      )
    })
  })
})
