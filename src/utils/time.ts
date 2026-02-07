import cronParser from 'cron-parser'
import { ValidationError } from './errors.js'

export interface CronInfo {
  expression: string
  isValid: boolean
  nextRuns: Date[]
  error?: string
}

export interface CronPreset {
  name: string
  expression: string
  description: string
}

export const CRON_PRESETS: CronPreset[] = [
  { name: 'every-minute', expression: '* * * * *', description: 'Every minute' },
  { name: 'hourly', expression: '0 * * * *', description: 'Every hour at minute 0' },
  { name: 'daily', expression: '0 0 * * *', description: 'Every day at midnight' },
  { name: 'weekly', expression: '0 0 * * 0', description: 'Every Sunday at midnight' },
  { name: 'monthly', expression: '0 0 1 * *', description: 'First day of every month at midnight' }
]

/**
 * Validates a cron expression and returns the next run times
 */
export function parseCron(
  expression: string,
  timezone = 'Europe/Istanbul',
  count = 5
): CronInfo {
  try {
    const interval = cronParser.parseExpression(expression, {
      tz: timezone,
      currentDate: new Date()
    })

    const nextRuns: Date[] = []
    for (let i = 0; i < count; i++) {
      nextRuns.push(interval.next().toDate())
    }

    return {
      expression,
      isValid: true,
      nextRuns
    }
  } catch (error) {
    return {
      expression,
      isValid: false,
      nextRuns: [],
      error: error instanceof Error ? error.message : 'Invalid cron expression'
    }
  }
}

/**
 * Validates a cron expression, throws if invalid
 */
export function validateCron(expression: string, timezone = 'Europe/Istanbul'): void {
  const result = parseCron(expression, timezone)
  if (!result.isValid) {
    throw new ValidationError(
      `Invalid cron expression: ${expression}`,
      result.error
    )
  }
}

/**
 * Gets the preset by name
 */
export function getPreset(name: string): CronPreset | undefined {
  return CRON_PRESETS.find(p => p.name === name)
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}

/**
 * Gets ISO timestamp
 */
export function getISOTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Gets common timezone options
 */
export function getTimezoneOptions(): string[] {
  return [
    'Europe/Istanbul',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
    'UTC'
  ]
}
