import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  join, 
  dirname, 
  basename, 
  extname,
  getCwd,
  getHomeDir,
  resolvePath
} from '../../src/utils/fs.js'

describe('fs utilities', () => {
  describe('path utilities (pathe)', () => {
    it('should join paths correctly', () => {
      expect(join('/home', 'user', 'file.txt')).toBe('/home/user/file.txt')
      expect(join('a', 'b', 'c')).toBe('a/b/c')
    })

    it('should get dirname', () => {
      expect(dirname('/home/user/file.txt')).toBe('/home/user')
    })

    it('should get basename', () => {
      expect(basename('/home/user/file.txt')).toBe('file.txt')
    })

    it('should get extname', () => {
      expect(extname('file.txt')).toBe('.txt')
      expect(extname('file.cron8n.json')).toBe('.json')
    })
  })

  describe('getCwd', () => {
    it('should return current working directory', () => {
      const cwd = getCwd()
      expect(typeof cwd).toBe('string')
      expect(cwd.length).toBeGreaterThan(0)
    })
  })

  describe('getHomeDir', () => {
    it('should return home directory', () => {
      const home = getHomeDir()
      expect(typeof home).toBe('string')
      expect(home.length).toBeGreaterThan(0)
    })
  })

  describe('resolvePath', () => {
    it('should resolve relative paths', () => {
      const resolved = resolvePath('test', 'file.txt')
      expect(resolved).toContain('test')
      expect(resolved).toContain('file.txt')
    })

    it('should be absolute path', () => {
      const resolved = resolvePath('test')
      expect(resolved.startsWith('/')).toBe(true)
    })
  })
})
