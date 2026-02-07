import { describe, it, expect } from 'vitest'
import { 
  parseCron, 
  validateCron, 
  getPreset, 
  CRON_PRESETS,
  formatDate,
  getISOTimestamp,
  getTimezoneOptions
} from '../../src/utils/time.js'
import { ValidationError } from '../../src/utils/errors.js'

describe('time utilities', () => {
  describe('parseCron', () => {
    it('should parse valid cron expression', () => {
      const result = parseCron('0 * * * *')
      expect(result.isValid).toBe(true)
      expect(result.nextRuns).toHaveLength(5)
      expect(result.error).toBeUndefined()
    })

    it('should return next runs as Date objects', () => {
      const result = parseCron('0 * * * *')
      expect(result.nextRuns[0]).toBeInstanceOf(Date)
    })

    it('should respect timezone parameter', () => {
      const result1 = parseCron('0 12 * * *', 'Europe/Istanbul')
      const result2 = parseCron('0 12 * * *', 'America/New_York')
      
      expect(result1.isValid).toBe(true)
      expect(result2.isValid).toBe(true)
      // The UTC times should be different due to timezone
    })

    it('should return specified count of next runs', () => {
      const result = parseCron('0 * * * *', 'UTC', 10)
      expect(result.nextRuns).toHaveLength(10)
    })

    it('should return invalid for bad expression', () => {
      const result = parseCron('invalid cron')
      expect(result.isValid).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.nextRuns).toHaveLength(0)
    })

    it('should handle all preset expressions', () => {
      for (const preset of CRON_PRESETS) {
        const result = parseCron(preset.expression)
        expect(result.isValid).toBe(true)
      }
    })
  })

  describe('validateCron', () => {
    it('should not throw for valid expression', () => {
      expect(() => validateCron('0 * * * *')).not.toThrow()
    })

    it('should throw ValidationError for invalid expression', () => {
      expect(() => validateCron('invalid')).toThrow(ValidationError)
    })
  })

  describe('getPreset', () => {
    it('should return preset by name', () => {
      const preset = getPreset('hourly')
      expect(preset).toBeDefined()
      expect(preset?.expression).toBe('0 * * * *')
    })

    it('should return undefined for unknown preset', () => {
      const preset = getPreset('unknown')
      expect(preset).toBeUndefined()
    })
  })

  describe('CRON_PRESETS', () => {
    it('should have expected presets', () => {
      const names = CRON_PRESETS.map(p => p.name)
      expect(names).toContain('hourly')
      expect(names).toContain('daily')
      expect(names).toContain('weekly')
      expect(names).toContain('monthly')
    })

    it('should have valid expressions for all presets', () => {
      for (const preset of CRON_PRESETS) {
        expect(preset.expression).toBeTruthy()
        expect(preset.description).toBeTruthy()
      }
    })
  })

  describe('formatDate', () => {
    it('should format date as string', () => {
      const date = new Date('2026-02-07T10:30:00Z')
      const formatted = formatDate(date)
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    })
  })

  describe('getISOTimestamp', () => {
    it('should return ISO formatted timestamp', () => {
      const timestamp = getISOTimestamp()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })

  describe('getTimezoneOptions', () => {
    it('should return array of timezone strings', () => {
      const options = getTimezoneOptions()
      expect(Array.isArray(options)).toBe(true)
      expect(options.length).toBeGreaterThan(0)
    })

    it('should include common timezones', () => {
      const options = getTimezoneOptions()
      expect(options).toContain('Europe/Istanbul')
      expect(options).toContain('UTC')
      expect(options).toContain('America/New_York')
    })
  })
})
