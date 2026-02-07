import { request } from 'undici'
import { z } from 'zod'
import { requireAuth, getAuthHeader, type AuthCredentials } from '../config/store.js'
import { ApiError } from '../utils/errors.js'

// n8n API Types
const N8nTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export type N8nTag = z.infer<typeof N8nTagSchema>

const N8nNodeSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  typeVersion: z.number().optional(),
  position: z.array(z.number()),
  parameters: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional()
})

export type N8nNode = z.infer<typeof N8nNodeSchema>

const N8nWorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  active: z.boolean().optional(),
  nodes: z.array(N8nNodeSchema),
  connections: z.record(z.unknown()),
  settings: z.record(z.unknown()).optional(),
  staticData: z.unknown().optional(),
  tags: z.array(N8nTagSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export type N8nWorkflow = z.infer<typeof N8nWorkflowSchema>

const WorkflowListResponseSchema = z.object({
  data: z.array(N8nWorkflowSchema),
  nextCursor: z.string().nullable().optional()
})

const TagListResponseSchema = z.object({
  data: z.array(N8nTagSchema)
})

export interface ListWorkflowsOptions {
  active?: boolean
  tags?: string[]
  limit?: number
  cursor?: string
}

export interface CreateWorkflowOptions {
  name: string
  nodes: N8nNode[]
  connections: Record<string, unknown>
  settings?: Record<string, unknown>
  active?: boolean
}

export interface UpdateWorkflowOptions extends Partial<CreateWorkflowOptions> {
  id: string
}

class N8nClient {
  private auth: AuthCredentials

  constructor(auth: AuthCredentials) {
    this.auth = auth
  }

  private get baseUrl(): string {
    return this.auth.baseUrl.replace(/\/$/, '')
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getAuthHeader(this.auth)
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`

    try {
      const response = await request(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined
      })

      const responseBody = await response.body.text()

      if (response.statusCode >= 400) {
        let errorMessage = `API request failed with status ${response.statusCode}`
        try {
          const errorData = JSON.parse(responseBody) as { message?: string }
          if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch {
          // Use default error message
        }
        throw new ApiError(errorMessage, response.statusCode)
      }

      if (!responseBody) {
        return {} as T
      }

      return JSON.parse(responseBody) as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error instanceof Error) {
        throw new ApiError(`Request failed: ${error.message}`)
      }
      throw new ApiError('An unexpected error occurred')
    }
  }

  /**
   * Tests the connection to n8n
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request('GET', '/workflows?limit=1')
      return true
    } catch {
      return false
    }
  }

  /**
   * Lists all workflows with optional filtering
   */
  async listWorkflows(options: ListWorkflowsOptions = {}): Promise<N8nWorkflow[]> {
    const workflows: N8nWorkflow[] = []
    let cursor: string | undefined = options.cursor

    do {
      const params = new URLSearchParams()
      if (options.limit) params.set('limit', String(options.limit))
      if (cursor) params.set('cursor', cursor)
      if (options.active !== undefined) params.set('active', String(options.active))
      if (options.tags?.length) {
        for (const tag of options.tags) {
          params.append('tags', tag)
        }
      }

      const query = params.toString()
      const path = `/workflows${query ? `?${query}` : ''}`

      const response = await this.request<z.infer<typeof WorkflowListResponseSchema>>('GET', path)
      const parsed = WorkflowListResponseSchema.parse(response)

      workflows.push(...parsed.data)
      cursor = parsed.nextCursor ?? undefined

      // If limit was specified, don't paginate
      if (options.limit) break
    } while (cursor)

    return workflows
  }

  /**
   * Gets a single workflow by ID
   */
  async getWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.request<N8nWorkflow>('GET', `/workflows/${id}`)
    return N8nWorkflowSchema.parse(response)
  }

  /**
   * Creates a new workflow
   * Note: active field is read-only on create, workflow must be activated separately
   */
  async createWorkflow(options: CreateWorkflowOptions): Promise<N8nWorkflow> {
    const response = await this.request<N8nWorkflow>('POST', '/workflows', {
      name: options.name,
      nodes: options.nodes,
      connections: options.connections,
      settings: options.settings ?? {}
    })
    return N8nWorkflowSchema.parse(response)
  }

  /**
   * Updates an existing workflow
   */
  async updateWorkflow(options: UpdateWorkflowOptions): Promise<N8nWorkflow> {
    const { id, ...updates } = options
    const response = await this.request<N8nWorkflow>('PUT', `/workflows/${id}`, updates)
    return N8nWorkflowSchema.parse(response)
  }

  /**
   * Deletes a workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.request('DELETE', `/workflows/${id}`)
  }

  /**
   * Activates a workflow
   */
  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.request<N8nWorkflow>('POST', `/workflows/${id}/activate`)
    return N8nWorkflowSchema.parse(response)
  }

  /**
   * Deactivates a workflow
   */
  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.request<N8nWorkflow>('POST', `/workflows/${id}/deactivate`)
    return N8nWorkflowSchema.parse(response)
  }

  /**
   * Lists all tags
   */
  async listTags(): Promise<N8nTag[]> {
    const response = await this.request<z.infer<typeof TagListResponseSchema>>('GET', '/tags')
    const parsed = TagListResponseSchema.parse(response)
    return parsed.data
  }

  /**
   * Creates a new tag
   */
  async createTag(name: string): Promise<N8nTag> {
    const response = await this.request<N8nTag>('POST', '/tags', { name })
    return N8nTagSchema.parse(response)
  }

  /**
   * Gets or creates a tag by name
   */
  async getOrCreateTag(name: string): Promise<N8nTag> {
    const tags = await this.listTags()
    const existingTag = tags.find(t => t.name === name)
    if (existingTag) return existingTag
    return this.createTag(name)
  }

  /**
   * Updates workflow tags
   */
  async setWorkflowTags(workflowId: string, tagIds: string[]): Promise<void> {
    // n8n API expects array of objects with id property
    const tagObjects = tagIds.map(id => ({ id }))
    await this.request('PUT', `/workflows/${workflowId}/tags`, tagObjects)
  }

  /**
   * Adds tags to a workflow (ensures they exist first)
   */
  async addTagsToWorkflow(workflowId: string, tagNames: string[]): Promise<void> {
    const tagIds: string[] = []
    for (const name of tagNames) {
      const tag = await this.getOrCreateTag(name)
      tagIds.push(tag.id)
    }

    // Get existing tags
    const workflow = await this.getWorkflow(workflowId)
    const existingTagIds = workflow.tags?.map(t => t.id) ?? []

    // Merge and set all tags
    const allTagIds = [...new Set([...existingTagIds, ...tagIds])]
    await this.setWorkflowTags(workflowId, allTagIds)
  }
}

/**
 * Creates a new n8n API client with provided auth
 */
export function createClient(auth: AuthCredentials): N8nClient {
  return new N8nClient(auth)
}

/**
 * Gets the default client using stored auth
 */
export async function getClient(): Promise<N8nClient> {
  const auth = await requireAuth()
  return new N8nClient(auth)
}
