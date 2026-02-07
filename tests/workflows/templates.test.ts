import { describe, it, expect } from 'vitest'
import {
  TEMPLATES,
  getTemplate,
  getTemplateNames,
  getTemplateChoices,
  type TemplateName
} from '../../src/workflows/templates.js'

describe('workflow templates', () => {
  describe('TEMPLATES', () => {
    it('should have four templates', () => {
      const templateNames = Object.keys(TEMPLATES)
      expect(templateNames).toHaveLength(4)
      expect(templateNames).toContain('cron-only')
      expect(templateNames).toContain('shell-command')
      expect(templateNames).toContain('http-request')
      expect(templateNames).toContain('webhook-call')
    })

    it('should have name and description for each template', () => {
      for (const template of Object.values(TEMPLATES)) {
        expect(template.name).toBeTruthy()
        expect(template.description).toBeTruthy()
        expect(typeof template.create).toBe('function')
      }
    })
  })

  describe('getTemplate', () => {
    it('should return template by name', () => {
      const template = getTemplate('cron-only')
      expect(template.name).toBe('Cron Only')
    })
  })

  describe('getTemplateNames', () => {
    it('should return array of template names', () => {
      const names = getTemplateNames()
      expect(Array.isArray(names)).toBe(true)
      expect(names).toContain('cron-only')
      expect(names).toContain('shell-command')
      expect(names).toContain('http-request')
      expect(names).toContain('webhook-call')
    })
  })

  describe('getTemplateChoices', () => {
    it('should return choices for prompts', () => {
      const choices = getTemplateChoices()
      expect(Array.isArray(choices)).toBe(true)
      expect(choices).toHaveLength(4)
      
      for (const choice of choices) {
        expect(choice.title).toBeTruthy()
        expect(choice.value).toBeTruthy()
        expect(choice.description).toBeTruthy()
      }
    })
  })

  describe('template.create', () => {
    const testCases: TemplateName[] = ['cron-only', 'shell-command', 'http-request', 'webhook-call']

    for (const templateName of testCases) {
      describe(`${templateName} template`, () => {
        const template = getTemplate(templateName)
        const workflow = template.create('Test Workflow', '0 * * * *', 'Europe/Istanbul')

        it('should create workflow with correct name', () => {
          expect(workflow.name).toBe('Test Workflow')
        })

        it('should create inactive workflow', () => {
          expect(workflow.active).toBe(false)
        })

        it('should have nodes array', () => {
          expect(Array.isArray(workflow.nodes)).toBe(true)
          expect(workflow.nodes.length).toBeGreaterThan(0)
        })

        it('should have connections object', () => {
          expect(typeof workflow.connections).toBe('object')
        })

        it('should have settings object', () => {
          expect(typeof workflow.settings).toBe('object')
        })

        it('should have schedule trigger node', () => {
          const cronNode = workflow.nodes.find(n => 
            n.type.includes('scheduleTrigger') || n.type.includes('cron')
          )
          expect(cronNode).toBeDefined()
        })

        it('should have correct cron expression in trigger', () => {
          const cronNode = workflow.nodes.find(n => 
            n.type.includes('scheduleTrigger') || n.type.includes('cron')
          )
          const params = cronNode?.parameters as any
          const cronExpression = params?.rule?.interval?.[0]?.expression
          expect(cronExpression).toBe('0 * * * *')
        })

        it('should have correct timezone in trigger', () => {
          const cronNode = workflow.nodes.find(n => 
            n.type.includes('scheduleTrigger') || n.type.includes('cron')
          )
          const params = cronNode?.parameters as any
          const timezone = params?.options?.timezone
          expect(timezone).toBe('Europe/Istanbul')
        })
      })
    }

    it('http-request template should have HTTP Request node', () => {
      const template = getTemplate('http-request')
      const workflow = template.create('Test', '0 * * * *', 'UTC')
      
      const httpNode = workflow.nodes.find(n => n.type.includes('httpRequest'))
      expect(httpNode).toBeDefined()
      expect(httpNode?.name).toBe('HTTP Request')
    })

    it('shell-command template should have Execute Command node', () => {
      const template = getTemplate('shell-command')
      const workflow = template.create('Test', '0 * * * *', 'UTC')
      
      const cmdNode = workflow.nodes.find(n => n.type.includes('executeCommand'))
      expect(cmdNode).toBeDefined()
      expect(cmdNode?.name).toBe('Execute Command')
    })

    it('webhook-call template should have webhook call node', () => {
      const template = getTemplate('webhook-call')
      const workflow = template.create('Test', '0 * * * *', 'UTC')
      
      const webhookNode = workflow.nodes.find(n => n.name === 'Webhook Call')
      expect(webhookNode).toBeDefined()
    })
  })
})
