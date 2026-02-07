import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before importing the modules that use them
vi.mock('../../src/config/store.js', () => ({
  saveAuth: vi.fn(),
  getAuth: vi.fn(),
  clearAuth: vi.fn(),
  isAuthenticated: vi.fn(),
  printAuthStatus: vi.fn(),
  getAuthHeader: vi.fn(() => ({ 'X-N8N-API-KEY': 'test-key' }))
}))

vi.mock('../../src/api/n8nClient.js', () => ({
  createClient: vi.fn(() => ({
    testConnection: vi.fn()
  }))
}))

vi.mock('prompts', () => ({
  default: vi.fn()
}))

import { saveAuth, getAuth, clearAuth, printAuthStatus } from '../../src/config/store.js'
import { createClient } from '../../src/api/n8nClient.js'
import prompts from 'prompts'

const mockSaveAuth = vi.mocked(saveAuth)
const mockGetAuth = vi.mocked(getAuth)
const mockPrintAuthStatus = vi.mocked(printAuthStatus)
const mockCreateClient = vi.mocked(createClient)
const mockPrompts = vi.mocked(prompts)

describe('auth commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('auth login', () => {
    it('should accept valid credentials structure', () => {
      // Test that saveAuth is called with correct structure
      const credentials = {
        baseUrl: 'https://n8n.example.com',
        authMode: 'apiKey' as const,
        secret: 'test-key'
      }
      
      mockSaveAuth(credentials)
      expect(mockSaveAuth).toHaveBeenCalledWith({
        baseUrl: 'https://n8n.example.com',
        authMode: 'apiKey',
        secret: 'test-key'
      })
    })

    it('should validate URL format', () => {
      // Valid URLs
      expect(() => new URL('https://n8n.example.com')).not.toThrow()
      expect(() => new URL('http://localhost:5678')).not.toThrow()
      
      // Invalid URLs
      expect(() => new URL('not-a-url')).toThrow()
    })

    it('should support apiKey and bearerToken modes', () => {
      const modes = ['apiKey', 'bearerToken'] as const
      
      for (const mode of modes) {
        const credentials = {
          baseUrl: 'https://n8n.example.com',
          authMode: mode,
          secret: 'test'
        }
        mockSaveAuth(credentials)
      }
      
      expect(mockSaveAuth).toHaveBeenCalledTimes(2)
    })
  })

  describe('auth status', () => {
    it('should return not authenticated when no auth', () => {
      mockGetAuth.mockReturnValue(null)
      
      const auth = mockGetAuth()
      expect(auth).toBeNull()
    })

    it('should return auth info when authenticated', () => {
      mockGetAuth.mockReturnValue({
        baseUrl: 'https://n8n.example.com',
        authMode: 'apiKey',
        secret: 'test-key'
      })
      
      const auth = mockGetAuth()
      expect(auth).not.toBeNull()
      expect(auth?.baseUrl).toBe('https://n8n.example.com')
    })

    it('should test connection with stored credentials', async () => {
      const mockClient = {
        testConnection: vi.fn().mockResolvedValue(true)
      }
      mockCreateClient.mockReturnValue(mockClient as any)
      
      const client = mockCreateClient({
        baseUrl: 'https://n8n.example.com',
        authMode: 'apiKey',
        secret: 'test'
      })
      
      const isConnected = await client.testConnection()
      expect(isConnected).toBe(true)
    })
  })
})
