import kleur from 'kleur'

export const print = {
  success(message: string): void {
    console.log(kleur.green(`✔ ${message}`))
  },

  error(message: string): void {
    console.error(kleur.red(`✖ ${message}`))
  },

  warning(message: string): void {
    console.log(kleur.yellow(`⚠ ${message}`))
  },

  info(message: string): void {
    console.log(kleur.blue(`ℹ ${message}`))
  },

  dim(message: string): void {
    console.log(kleur.dim(message))
  },

  bold(message: string): void {
    console.log(kleur.bold(message))
  },

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2))
  },

  table(headers: string[], rows: string[][]): void {
    const colWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => (row[i] ?? '').length))
      return Math.max(header.length, maxRowWidth)
    })

    const separator = colWidths.map(w => '─'.repeat(w + 2)).join('┼')
    const headerRow = headers.map((h, i) => h.padEnd(colWidths[i] ?? 0)).join(' │ ')

    console.log(kleur.bold(headerRow))
    console.log(kleur.dim(separator))

    for (const row of rows) {
      const formattedRow = row.map((cell, i) => cell.padEnd(colWidths[i] ?? 0)).join(' │ ')
      console.log(formattedRow)
    }
  },

  list(items: string[], bullet = '•'): void {
    for (const item of items) {
      console.log(`  ${kleur.dim(bullet)} ${item}`)
    }
  },

  header(title: string): void {
    console.log()
    console.log(kleur.bold().cyan(title))
    console.log(kleur.dim('─'.repeat(title.length)))
  },

  newline(): void {
    console.log()
  },

  keyValue(key: string, value: string): void {
    console.log(`${kleur.dim(key + ':')} ${value}`)
  },

  mask(value: string, visibleChars = 4): string {
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length)
    }
    return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars)
  }
}
