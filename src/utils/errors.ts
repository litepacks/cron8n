import kleur from 'kleur'

export class Cron8nError extends Error {
  constructor(
    message: string,
    public code: string,
    public hint?: string
  ) {
    super(message)
    this.name = 'Cron8nError'
  }
}

export class AuthError extends Cron8nError {
  constructor(message: string, hint?: string) {
    super(message, 'AUTH_ERROR', hint)
    this.name = 'AuthError'
  }
}

export class ApiError extends Cron8nError {
  constructor(
    message: string,
    public statusCode?: number,
    hint?: string
  ) {
    super(message, 'API_ERROR', hint)
    this.name = 'ApiError'
  }
}

export class ValidationError extends Cron8nError {
  constructor(message: string, hint?: string) {
    super(message, 'VALIDATION_ERROR', hint)
    this.name = 'ValidationError'
  }
}

export class FileError extends Cron8nError {
  constructor(message: string, hint?: string) {
    super(message, 'FILE_ERROR', hint)
    this.name = 'FileError'
  }
}

export function handleError(error: unknown): never {
  if (error instanceof Cron8nError) {
    console.error(kleur.red(`✖ ${error.name}: ${error.message}`))
    if (error.hint) {
      console.error(kleur.yellow(`  Hint: ${error.hint}`))
    }
    process.exit(1)
  }

  if (error instanceof Error) {
    console.error(kleur.red(`✖ Error: ${error.message}`))
    process.exit(1)
  }

  console.error(kleur.red('✖ An unexpected error occurred'))
  process.exit(1)
}

export function assertNever(value: never): never {
  throw new Cron8nError(`Unexpected value: ${value}`, 'ASSERTION_ERROR')
}
