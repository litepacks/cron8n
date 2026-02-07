import type { N8nNode, N8nWorkflow } from '../api/n8nClient.js'

export type TemplateName = 'cron-only' | 'shell-command' | 'http-request' | 'webhook-call'

export interface TemplateOptions {
  shellCommand?: string
  httpUrl?: string
  httpMethod?: string
  webhookUrl?: string
}

export interface TemplateConfig {
  name: string
  description: string
  create: (workflowName: string, cronExpression: string, timezone: string, options?: TemplateOptions) => N8nWorkflow
}

/**
 * Creates a Cron/Schedule Trigger node
 */
function createCronNode(cronExpression: string, timezone: string): N8nNode {
  return {
    id: 'cron-trigger',
    name: 'Schedule Trigger',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [250, 300],
    parameters: {
      rule: {
        interval: [
          {
            field: 'cronExpression',
            expression: cronExpression
          }
        ]
      },
      options: {
        timezone
      }
    }
  }
}

/**
 * Creates an HTTP Request node
 */
function createHttpRequestNode(): N8nNode {
  return {
    id: 'http-request',
    name: 'HTTP Request',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [500, 300],
    parameters: {
      method: 'GET',
      url: 'https://api.example.com/endpoint',
      options: {}
    }
  }
}

/**
 * Creates a Webhook node for calling external webhooks
 */
function createWebhookCallNode(): N8nNode {
  return {
    id: 'webhook-call',
    name: 'Webhook Call',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [500, 300],
    parameters: {
      method: 'POST',
      url: 'https://example.com/webhook',
      sendBody: true,
      bodyParameters: {
        parameters: [
          {
            name: 'event',
            value: 'cron_triggered'
          },
          {
            name: 'timestamp',
            value: '={{ $now.toISO() }}'
          }
        ]
      },
      options: {}
    }
  }
}

/**
 * Creates a No Operation node (for cron-only template)
 */
function createNoOpNode(): N8nNode {
  return {
    id: 'no-op',
    name: 'No Operation',
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    position: [500, 300],
    parameters: {}
  }
}

/**
 * Creates an Execute Command node for running shell commands
 */
function createExecuteCommandNode(command?: string): N8nNode {
  return {
    id: 'execute-command',
    name: 'Execute Command',
    type: 'n8n-nodes-base.executeCommand',
    typeVersion: 1,
    position: [500, 300],
    parameters: {
      command: command || 'echo "Hello from cron8n! Time: $(date)"'
    }
  }
}

/**
 * Available workflow templates
 */
export const TEMPLATES: Record<TemplateName, TemplateConfig> = {
  'cron-only': {
    name: 'Cron Only',
    description: 'A simple workflow with just a cron trigger (useful as a starting point)',
    create: (workflowName, cronExpression, timezone) => ({
      name: workflowName,
      active: false,
      nodes: [
        createCronNode(cronExpression, timezone),
        createNoOpNode()
      ],
      connections: {
        'Schedule Trigger': {
          main: [
            [{ node: 'No Operation', type: 'main', index: 0 }]
          ]
        }
      },
      settings: {
        executionOrder: 'v1'
      }
    })
  },

  'shell-command': {
    name: 'Shell Command',
    description: 'Cron trigger that executes a shell command on the n8n server',
    create: (workflowName, cronExpression, timezone, options) => ({
      name: workflowName,
      active: false,
      nodes: [
        createCronNode(cronExpression, timezone),
        createExecuteCommandNode(options?.shellCommand)
      ],
      connections: {
        'Schedule Trigger': {
          main: [
            [{ node: 'Execute Command', type: 'main', index: 0 }]
          ]
        }
      },
      settings: {
        executionOrder: 'v1'
      }
    })
  },

  'http-request': {
    name: 'HTTP Request',
    description: 'Cron trigger with an HTTP request (call an API on schedule)',
    create: (workflowName, cronExpression, timezone) => ({
      name: workflowName,
      active: false,
      nodes: [
        createCronNode(cronExpression, timezone),
        createHttpRequestNode()
      ],
      connections: {
        'Schedule Trigger': {
          main: [
            [{ node: 'HTTP Request', type: 'main', index: 0 }]
          ]
        }
      },
      settings: {
        executionOrder: 'v1'
      }
    })
  },

  'webhook-call': {
    name: 'Webhook Call',
    description: 'Cron trigger that calls an external webhook',
    create: (workflowName, cronExpression, timezone) => ({
      name: workflowName,
      active: false,
      nodes: [
        createCronNode(cronExpression, timezone),
        createWebhookCallNode()
      ],
      connections: {
        'Schedule Trigger': {
          main: [
            [{ node: 'Webhook Call', type: 'main', index: 0 }]
          ]
        }
      },
      settings: {
        executionOrder: 'v1'
      }
    })
  }
}

/**
 * Gets a template by name
 */
export function getTemplate(name: TemplateName): TemplateConfig {
  return TEMPLATES[name]
}

/**
 * Gets all available template names
 */
export function getTemplateNames(): TemplateName[] {
  return Object.keys(TEMPLATES) as TemplateName[]
}

/**
 * Gets template choices for prompts
 */
export function getTemplateChoices(): Array<{ title: string; value: TemplateName; description: string }> {
  return Object.entries(TEMPLATES).map(([key, config]) => ({
    title: config.name,
    value: key as TemplateName,
    description: config.description
  }))
}
