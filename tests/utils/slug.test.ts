import { describe, it, expect } from 'vitest'
import { createSlug, createUniqueSlug, isValidSlug, generateSlug } from '../../src/utils/slug.js'

describe('slug utilities', () => {
  describe('createSlug', () => {
    it('should convert to lowercase', () => {
      expect(createSlug('Hello World')).toBe('hello-world')
    })

    it('should replace spaces with hyphens', () => {
      expect(createSlug('my workflow name')).toBe('my-workflow-name')
    })

    it('should replace underscores with hyphens', () => {
      expect(createSlug('my_workflow_name')).toBe('my-workflow-name')
    })

    it('should remove special characters', () => {
      expect(createSlug('hello@world!')).toBe('helloworld')
    })

    it('should handle multiple spaces', () => {
      expect(createSlug('hello   world')).toBe('hello-world')
    })

    it('should trim leading and trailing hyphens', () => {
      expect(createSlug(' hello world ')).toBe('hello-world')
    })

    it('should handle empty string', () => {
      expect(createSlug('')).toBe('')
    })

    it('should handle complex names', () => {
      expect(createSlug('My Cron Job #1 (daily)')).toBe('my-cron-job-1-daily')
    })
  })

  describe('createUniqueSlug', () => {
    it('should create a slug with unique ID suffix', () => {
      const slug = createUniqueSlug('My Workflow')
      expect(slug).toMatch(/^my-workflow-[a-zA-Z0-9_-]+$/)
    })

    it('should create different slugs each time', () => {
      const slug1 = createUniqueSlug('Test')
      const slug2 = createUniqueSlug('Test')
      expect(slug1).not.toBe(slug2)
    })
  })

  describe('isValidSlug', () => {
    it('should return true for valid slugs', () => {
      expect(isValidSlug('my-workflow')).toBe(true)
      expect(isValidSlug('workflow123')).toBe(true)
      expect(isValidSlug('my-workflow-123')).toBe(true)
    })

    it('should return false for invalid slugs', () => {
      expect(isValidSlug('My Workflow')).toBe(false)
      expect(isValidSlug('my_workflow')).toBe(false)
      expect(isValidSlug('my--workflow')).toBe(false)
      expect(isValidSlug('-my-workflow')).toBe(false)
      expect(isValidSlug('my-workflow-')).toBe(false)
      expect(isValidSlug('')).toBe(false)
    })
  })

  describe('generateSlug', () => {
    it('should generate a slug with default length', () => {
      const slug = generateSlug()
      expect(slug).toHaveLength(12)
    })

    it('should generate a slug with custom length', () => {
      const slug = generateSlug(8)
      expect(slug).toHaveLength(8)
    })

    it('should generate lowercase slugs', () => {
      const slug = generateSlug()
      expect(slug).toBe(slug.toLowerCase())
    })
  })
})
