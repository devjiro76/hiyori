/**
 * Safety validation for agent tool execution.
 *
 * Shell commands get extra scrutiny:
 * - BLACKLIST: absolutely never run these
 * - WHITELIST: run without user confirmation
 * - Everything else: requires user confirmation
 */

const SHELL_BLACKLIST: RegExp[] = [
  /rm\s+(-\w*r\w*\s+)?(-\w*f\w*\s+)?(\/|~|\*)/i,   // rm -rf / or ~
  /rm\s+(-\w*f\w*\s+)?(-\w*r\w*\s+)?(\/|~|\*)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\(\)\s*\{/,                              // fork bomb
  />\s*\/dev\/s/i,
  /chmod\s+(-R\s+)?777\s+\//i,
  /sudo\s+(rm|mkfs|dd|chmod|chown)\b/i,
  /shutdown/i,
  /reboot/i,
  /halt\b/i,
  /kill\s+-9\s+-1/i,
  /curl\b.*\|\s*sh/i,                        // pipe to shell
  /wget\b.*\|\s*sh/i,
  /python\b.*-c\s*['"].*import\s+os/i,       // arbitrary python exec
  /launchctl\s+unload/i,
  /diskutil\s+erase/i,
  />\s*\/etc\//i,
]

const SHELL_WHITELIST: RegExp[] = [
  /^ls(\s|$)/,
  /^pwd\s*$/,
  /^date\s*$/,
  /^whoami\s*$/,
  /^echo\s/,
  /^cat\s/,
  /^head\s/,
  /^tail\s/,
  /^wc\s/,
  /^which\s/,
  /^uname\s/,
  /^df\s/,
  /^du\s/,
  /^uptime\s*$/,
  /^sw_vers/,
  /^system_profiler\s/,
  /^defaults\s+read\s/,
  /^open\s/,
  /^pbcopy/,
  /^pbpaste/,
]

export interface ShellValidation {
  allowed: boolean
  needsConfirmation: boolean
  reason?: string
}

export function validateShellCommand(cmd: string): ShellValidation {
  const trimmed = cmd.trim()

  for (const pattern of SHELL_BLACKLIST) {
    if (pattern.test(trimmed)) {
      return { allowed: false, needsConfirmation: false, reason: `Blocked: dangerous command pattern detected` }
    }
  }

  for (const pattern of SHELL_WHITELIST) {
    if (pattern.test(trimmed)) {
      return { allowed: true, needsConfirmation: false }
    }
  }

  // Not blacklisted, not whitelisted => needs confirmation
  return { allowed: true, needsConfirmation: true }
}

export function validateUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}
