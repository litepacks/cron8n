/**
 * Filesystem Abstraction Module
 * 
 * This module isolates all native fs and path operations.
 * All file system access in the project should go through this module.
 */

import { promises as nodeFs } from 'node:fs'
import { join, dirname, basename, resolve, extname } from 'pathe'
import { FileError } from './errors.js'

export { join, dirname, basename, resolve, extname }

export interface FileInfo {
  path: string
  name: string
  exists: boolean
}

/**
 * Reads a file and returns its content as string
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await nodeFs.readFile(filePath, 'utf-8')
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new FileError(`File not found: ${filePath}`)
    }
    throw new FileError(`Failed to read file: ${filePath}`)
  }
}

/**
 * Writes content to a file, creating directories if needed
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await ensureDir(dirname(filePath))
    await nodeFs.writeFile(filePath, content, 'utf-8')
  } catch (error) {
    if (error instanceof FileError) throw error
    throw new FileError(`Failed to write file: ${filePath}`)
  }
}

/**
 * Reads and parses a JSON file
 */
export async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath)
  try {
    return JSON.parse(content) as T
  } catch {
    throw new FileError(`Invalid JSON in file: ${filePath}`)
  }
}

/**
 * Writes data as JSON to a file
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  await writeFile(filePath, content)
}

/**
 * Checks if a file or directory exists
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await nodeFs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Creates a directory and all parent directories
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await nodeFs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (isNodeError(error) && error.code !== 'EEXIST') {
      throw new FileError(`Failed to create directory: ${dirPath}`)
    }
  }
}

/**
 * Deletes a file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await nodeFs.unlink(filePath)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      // File doesn't exist, that's fine
      return
    }
    throw new FileError(`Failed to delete file: ${filePath}`)
  }
}

/**
 * Moves a file (copy + delete)
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    await ensureDir(dirname(destPath))
    await nodeFs.rename(sourcePath, destPath)
  } catch (error) {
    // If rename fails (cross-device), try copy + delete
    if (isNodeError(error) && error.code === 'EXDEV') {
      const content = await readFile(sourcePath)
      await writeFile(destPath, content)
      await deleteFile(sourcePath)
      return
    }
    throw new FileError(`Failed to move file: ${sourcePath} -> ${destPath}`)
  }
}

/**
 * Lists files in a directory
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await nodeFs.readdir(dirPath)
    return entries
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return []
    }
    throw new FileError(`Failed to list directory: ${dirPath}`)
  }
}

/**
 * Lists files with a specific extension
 */
export async function listFilesByExtension(
  dirPath: string,
  extension: string
): Promise<string[]> {
  const files = await listFiles(dirPath)
  return files.filter(file => extname(file) === extension)
}

/**
 * Gets the current working directory
 */
export function getCwd(): string {
  return process.cwd()
}

/**
 * Resolves a path relative to cwd
 */
export function resolvePath(...paths: string[]): string {
  return resolve(getCwd(), ...paths)
}

/**
 * Gets the home directory
 */
export function getHomeDir(): string {
  return process.env['HOME'] ?? process.env['USERPROFILE'] ?? '~'
}

/**
 * Type guard for Node.js errors
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
