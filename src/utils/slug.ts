import { nanoid } from 'nanoid'

/**
 * Creates a URL-safe slug from a string
 */
export function createSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-')  // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')  // Remove leading/trailing hyphens
}

/**
 * Creates a unique slug by appending a short ID
 */
export function createUniqueSlug(input: string): string {
  const baseSlug = createSlug(input)
  const uniqueId = nanoid(6)
  return `${baseSlug}-${uniqueId}`
}

/**
 * Validates if a string is a valid slug
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

/**
 * Generates a random slug
 */
export function generateSlug(length = 12): string {
  return nanoid(length).toLowerCase()
}
