import { describe, it, expect, afterEach } from 'vitest'
import {
  saveAuth,
  getAuth,
  clearAuth,
  isAuthenticated,
  getAuthHeader,
  type AuthCredentials
} from '../../src/config/store.js'

describe('config store', () => {
  const testCredentials: AuthCredentials = {
    baseUrl: 'https://n8n.example.com',
    authMode: 'apiKey',
    secret: 'test-api-key-12345'
  }

  // Clean up after each test
  afterEach(async () => {
    await clearAuth()
  })

  describe('saveAuth and getAuth', () => {
    it('should save and retrieve auth credentials', async () => {
      await saveAuth(testCredentials)
      
      const auth = await getAuth()
      expect(auth).not.toBeNull()
      expect(auth?.baseUrl).toBe(testCredentials.baseUrl)
      expect(auth?.authMode).toBe(testCredentials.authMode)
      expect(auth?.secret).toBe(testCredentials.secret)
    })

    it('should return null if not authenticated', async () => {
      const auth = await getAuth()
      expect(auth).toBeNull()
    })
  })

  describe('clearAuth', () => {
    it('should clear all auth credentials', async () => {
      await saveAuth(testCredentials)
      expect(await getAuth()).not.toBeNull()
      
      await clearAuth()
      expect(await getAuth()).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when authenticated', async () => {
      await saveAuth(testCredentials)
      expect(await isAuthenticated()).toBe(true)
    })

    it('should return false when not authenticated', async () => {
      expect(await isAuthenticated()).toBe(false)
    })
  })

  describe('getAuthHeader', () => {
    it('should return API key header for apiKey mode', () => {
      const credentials: AuthCredentials = {
        baseUrl: 'https://n8n.example.com',
        authMode: 'apiKey',
        secret: 'my-api-key'
      }

      const headers = getAuthHeader(credentials)
      expect(headers['X-N8N-API-KEY']).toBe('my-api-key')
      expect(headers['Authorization']).toBeUndefined()
    })

    it('should return Bearer token header for bearerToken mode', () => {
      const credentials: AuthCredentials = {
        baseUrl: 'https://n8n.example.com',
        authMode: 'bearerToken',
        secret: 'my-token'
      }

      const headers = getAuthHeader(credentials)
      expect(headers['Authorization']).toBe('Bearer my-token')
      expect(headers['X-N8N-API-KEY']).toBeUndefined()
    })
  })
})
