// kbot Shell Completions — bash, zsh, fish tab-completion scripts
//
// Usage:
//   $ kbot completions bash >> ~/.bashrc
//   $ kbot completions zsh >> ~/.zshrc
//   $ kbot completions fish > ~/.config/fish/completions/kbot.fish

// ── Completion data ──

const SUBCOMMANDS = [
  'auth',
  'byok',
  'local',
  'ollama',
  'kbot-local',
  'serve',
  'ide',
  'agents',
  'doctor',
  'update',
  'pull',
  'cloud',
  'watch',
  'voice',
  'export',
  'plugins',
  'completions',
] as const

const IDE_SUBCOMMANDS = ['mcp', 'acp', 'status'] as const

const GLOBAL_OPTIONS = [
  '--agent',
  '--model',
  '--stream',
  '--pipe',
  '--json',
  '--quiet',
  '--yes',
  '--resume',
  '--computer-use',
  '--thinking',
  '--thinking-budget',
  '--self-eval',
  '--architect',
  '--safe',
  '--strict',
  '--help',
  '--version',
] as const

const GLOBAL_SHORT_OPTIONS = [
  '-a',
  '-m',
  '-s',
  '-p',
  '-y',
  '-q',
  '-t',
  '-h',
] as const

// REPL slash commands — not used for shell completions (these are typed
// inside the interactive REPL, not on the shell command line), but kept
// here as a reference for the full command surface.
const _SLASH_COMMANDS = [
  '/help',
  '/save',
  '/resume',
  '/clear',
  '/agent',
  '/model',
  '/plan',
  '/evolve',
  '/quit',
  '/exit',
  '/context',
  '/memory',
  '/learn',
  '/stats',
  '/remember',
  '/compact',
  '/sessions',
  '/delete-session',
  '/train',
  '/thinking',
  '/self-eval',
  '/health',
  '/providers',
  '/map-elites',
  '/confidence',
  '/skills',
  '/effort',
  '/handoff',
  '/blackboard',
  '/trust',
  '/checkpoint',
  '/anticipate',
  '/identity',
  '/hypothesize',
  '/counterfactual',
  '/strategy',
  '/drives',
  '/motivation',
  '/architect',
  '/graph',
  '/worktree',
  '/permission',
  '/plugins',
  '/dashboard',
  '/build',
  '/local',
  '/ollama',
  '/kbot-local',
  '/models',
  '/provider',
  '/mimic',
  '/watch',
  '/voice',
  '/export',
  '/test',
  '/rate-limit',
  '/matrix',
  '/tutorial',
] as const
void _SLASH_COMMANDS

const AGENT_NAMES = [
  'kernel',
  'researcher',
  'coder',
  'writer',
  'analyst',
  'aesthete',
  'guardian',
  'curator',
  'strategist',
  'creative',
  'developer',
  'hacker',
  'operator',
  'dreamer',
  'physicist',
  'mathematician',
  'chemist',
  'biologist',
  'economist',
  'linguist',
  'historian',
  'philosopher',
  'psychologist',
  'engineer',
  'medic',
  'legal',
  'data',
  'security',
  'devops',
  'educator',
  'musician',
  'session',
  'scholar',
  'auditor',
  'benchmarker',
] as const

// ── Generators ──

function generateBash(): string {
  const subcommands = SUBCOMMANDS.join(' ')
  const ideSubcommands = IDE_SUBCOMMANDS.join(' ')
  const globalOptions = [...GLOBAL_OPTIONS, ...GLOBAL_SHORT_OPTIONS].join(' ')
  const agents = AGENT_NAMES.join(' ')

  return `# kbot shell completions for bash
# Add to ~/.bashrc:  eval "$(kbot completions bash)"

_kbot_completions() {
  local cur prev words cword
  _init_completion || return

  local subcommands="${subcommands}"
  local global_opts="${globalOptions}"
  local agents="${agents}"
  local ide_subcommands="${ideSubcommands}"

  # Complete subcommands and options at top level
  if [[ \${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${subcommands} \${global_opts}" -- "\${cur}") )
    return
  fi

  # Context-sensitive completion
  case "\${prev}" in
    --agent|-a)
      COMPREPLY=( $(compgen -W "\${agents}" -- "\${cur}") )
      return
      ;;
    --model|-m)
      COMPREPLY=( $(compgen -W "auto sonnet haiku opus gpt-4o gpt-4o-mini gemini-pro" -- "\${cur}") )
      return
      ;;
    --resume)
      # No completion for session IDs — user-specific
      return
      ;;
    --thinking-budget)
      COMPREPLY=( $(compgen -W "5000 10000 20000 50000" -- "\${cur}") )
      return
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return
      ;;
    ide)
      COMPREPLY=( $(compgen -W "\${ide_subcommands}" -- "\${cur}") )
      return
      ;;
    status)
      COMPREPLY=( $(compgen -W "--json" -- "\${cur}") )
      return
      ;;
    agents)
      COMPREPLY=( $(compgen -W "\${agents}" -- "\${cur}") )
      return
      ;;
    plugins)
      COMPREPLY=( $(compgen -W "list search install uninstall update" -- "\${cur}") )
      return
      ;;
    cloud)
      COMPREPLY=( $(compgen -W "--token --off --status --push --pull" -- "\${cur}") )
      return
      ;;
    local|ollama)
      COMPREPLY=( $(compgen -W "--model --list --off" -- "\${cur}") )
      return
      ;;
    serve)
      COMPREPLY=( $(compgen -W "--port --token --computer-use" -- "\${cur}") )
      return
      ;;
    export)
      COMPREPLY=( $(compgen -W "--format --output" -- "\${cur}") )
      return
      ;;
    --format|-f)
      COMPREPLY=( $(compgen -W "md json html" -- "\${cur}") )
      return
      ;;
  esac

  # After first word, offer options
  COMPREPLY=( $(compgen -W "\${global_opts}" -- "\${cur}") )
}

complete -F _kbot_completions kbot
`
}

function generateZsh(): string {
  const subcommands = SUBCOMMANDS.map(s => `'${s}'`).join(' ')
  const agents = AGENT_NAMES.map(a => `'${a}'`).join(' ')

  return `# kbot shell completions for zsh
# Add to ~/.zshrc:  eval "$(kbot completions zsh)"

_kbot() {
  local -a subcommands global_opts agents ide_subcommands

  subcommands=(
    'auth:Configure your LLM API key'
    'byok:Bring Your Own Key'
    'local:Use local AI models'
    'ollama:Alias for local'
    'kbot-local:Use kbot Local gateway'
    'serve:Start HTTP server'
    'ide:Start IDE protocol server'
    'agents:List available agents'
    'doctor:Diagnose your setup'
    'update:Update kbot'
    'pull:Download Ollama models'
    'cloud:Cloud sync settings'
    'watch:Watch files for changes'
    'voice:Start voice mode'
    'export:Export a session'
    'plugins:Manage plugins'
    'completions:Generate shell completions'
  )

  agents=(${agents})

  global_opts=(
    '(-a --agent)'{-a,--agent}'[Force a specific agent]:agent:(${AGENT_NAMES.join(' ')})'
    '(-m --model)'{-m,--model}'[Override AI model]:model:(auto sonnet haiku opus gpt-4o gpt-4o-mini gemini-pro)'
    '(-s --stream)'{-s,--stream}'[Stream the response]'
    '(-p --pipe)'{-p,--pipe}'[Pipe mode for scripting]'
    '--json[JSON output for scripting]'
    '(-y --yes)'{-y,--yes}'[Skip confirmation prompts]'
    '(-q --quiet)'{-q,--quiet}'[Minimal output]'
    '--resume[Resume a saved session]'
    '--computer-use[Enable computer use tools]'
    '(-t --thinking)'{-t,--thinking}'[Show AI reasoning steps]'
    '--thinking-budget[Thinking token budget]:budget:(5000 10000 20000 50000)'
    '--self-eval[Enable self-evaluation loop]'
    '--architect[Architect mode]'
    '--safe[Confirm destructive operations]'
    '--strict[Confirm ALL operations]'
    '(-h --help)'{-h,--help}'[Display help]'
    '(-V --version)'{-V,--version}'[Display version]'
  )

  _arguments -C \\
    $global_opts \\
    '1: :->cmd' \\
    '*:: :->args'

  case $state in
    cmd)
      _describe 'command' subcommands
      ;;
    args)
      case $words[1] in
        completions)
          _values 'shell' bash zsh fish
          ;;
        ide)
          local -a ide_cmds
          ide_cmds=(
            'mcp:Start MCP server for VS Code, Cursor, Windsurf, Zed'
            'acp:Start ACP server for JetBrains IDEs'
            'status:Show IDE bridge status'
          )
          _describe 'ide command' ide_cmds
          ;;
        agents)
          _values 'agent' $agents
          ;;
        plugins)
          _values 'action' list search install uninstall update
          ;;
        cloud)
          _arguments \\
            '--token[Set cloud sync token]:token:' \\
            '--off[Disable cloud sync]' \\
            '--status[Show sync status]' \\
            '--push[Force push to cloud]' \\
            '--pull[Force pull from cloud]'
          ;;
        local|ollama)
          _arguments \\
            '--model[Set default local model]:model:' \\
            '--list[List available models]' \\
            '--off[Disable local mode]'
          ;;
        serve)
          _arguments \\
            '(-p --port)'{-p,--port}'[Port to listen on]:port:' \\
            '--token[Auth token]:token:' \\
            '--computer-use[Enable computer use tools]'
          ;;
        export)
          _arguments \\
            '(-f --format)'{-f,--format}'[Output format]:format:(md json html)' \\
            '(-o --output)'{-o,--output}'[Output file path]:file:_files'
          ;;
        pull)
          _arguments \\
            '--model[Pull a specific model]:model:'
          ;;
        auth|byok)
          _arguments \\
            '--off[Disable provider]'
          ;;
        kbot-local)
          _arguments \\
            '--token[Gateway auth token]:token:' \\
            '--off[Disable kbot Local]'
          ;;
        watch)
          _arguments \\
            '(-e --extensions)'{-e,--extensions}'[File extensions]:extensions:' \\
            '--no-analyze[Disable analysis]'
          ;;
        voice)
          _arguments \\
            '(-v --voice)'{-v,--voice}'[TTS voice name]:voice:' \\
            '(-r --rate)'{-r,--rate}'[Speech rate (wpm)]:rate:'
          ;;
      esac
      ;;
  esac
}

compdef _kbot kbot
`
}

function generateFish(): string {
  const lines: string[] = [
    '# kbot shell completions for fish',
    '# Save to: ~/.config/fish/completions/kbot.fish',
    '',
    '# Disable file completions by default',
    'complete -c kbot -f',
    '',
    '# Subcommands',
  ]

  const subcommandDescs: Record<string, string> = {
    auth: 'Configure your LLM API key',
    byok: 'Bring Your Own Key',
    local: 'Use local AI models',
    ollama: 'Alias for local',
    'kbot-local': 'Use kbot Local gateway',
    serve: 'Start HTTP server',
    ide: 'Start IDE protocol server',
    agents: 'List available agents',
    doctor: 'Diagnose your setup',
    update: 'Update kbot',
    pull: 'Download Ollama models',
    cloud: 'Cloud sync settings',
    watch: 'Watch files for changes',
    voice: 'Start voice mode',
    export: 'Export a session',
    plugins: 'Manage plugins',
    completions: 'Generate shell completions',
  }

  for (const [cmd, desc] of Object.entries(subcommandDescs)) {
    lines.push(`complete -c kbot -n '__fish_use_subcommand' -a '${cmd}' -d '${desc}'`)
  }

  lines.push('')
  lines.push('# Global options')

  const optionDescs: Array<{ short?: string; long: string; desc: string; arg?: string }> = [
    { short: 'a', long: 'agent', desc: 'Force a specific agent', arg: 'agent' },
    { short: 'm', long: 'model', desc: 'Override AI model', arg: 'model' },
    { short: 's', long: 'stream', desc: 'Stream the response' },
    { short: 'p', long: 'pipe', desc: 'Pipe mode for scripting' },
    { long: 'json', desc: 'JSON output for scripting' },
    { short: 'y', long: 'yes', desc: 'Skip confirmation prompts' },
    { short: 'q', long: 'quiet', desc: 'Minimal output' },
    { long: 'resume', desc: 'Resume a saved session' },
    { long: 'computer-use', desc: 'Enable computer use tools' },
    { short: 't', long: 'thinking', desc: 'Show AI reasoning steps' },
    { long: 'thinking-budget', desc: 'Thinking token budget', arg: 'tokens' },
    { long: 'self-eval', desc: 'Enable self-evaluation loop' },
    { long: 'architect', desc: 'Architect mode' },
    { long: 'safe', desc: 'Confirm destructive operations' },
    { long: 'strict', desc: 'Confirm ALL operations' },
  ]

  for (const opt of optionDescs) {
    let parts = `complete -c kbot -l '${opt.long}'`
    if (opt.short) parts += ` -s '${opt.short}'`
    parts += ` -d '${opt.desc}'`
    if (opt.arg) parts += ` -r`
    lines.push(parts)
  }

  lines.push('')
  lines.push('# Agent names for --agent')
  for (const agent of AGENT_NAMES) {
    lines.push(`complete -c kbot -n '__fish_seen_argument -l agent -s a' -a '${agent}'`)
  }

  lines.push('')
  lines.push('# Model names for --model')
  const models = ['auto', 'sonnet', 'haiku', 'opus', 'gpt-4o', 'gpt-4o-mini', 'gemini-pro']
  for (const model of models) {
    lines.push(`complete -c kbot -n '__fish_seen_argument -l model -s m' -a '${model}'`)
  }

  lines.push('')
  lines.push('# completions subcommand')
  for (const shell of ['bash', 'zsh', 'fish']) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from completions' -a '${shell}' -d '${shell} completions'`)
  }

  lines.push('')
  lines.push('# ide subcommands')
  const ideDescs: Record<string, string> = {
    mcp: 'Start MCP server for VS Code, Cursor, Windsurf, Zed',
    acp: 'Start ACP server for JetBrains IDEs',
    status: 'Show IDE bridge status',
  }
  for (const [cmd, desc] of Object.entries(ideDescs)) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from ide' -a '${cmd}' -d '${desc}'`)
  }

  lines.push('')
  lines.push('# ide status options')
  lines.push(`complete -c kbot -n '__fish_seen_subcommand_from status; and __fish_seen_subcommand_from ide' -l 'json' -d 'Output as JSON'`)

  lines.push('')
  lines.push('# agents subcommand — complete with agent names')
  for (const agent of AGENT_NAMES) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from agents' -a '${agent}'`)
  }

  lines.push('')
  lines.push('# plugins subcommand')
  for (const action of ['list', 'search', 'install', 'uninstall', 'update']) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from plugins' -a '${action}' -d '${action} plugins'`)
  }

  lines.push('')
  lines.push('# cloud subcommand options')
  for (const [opt, desc] of Object.entries({
    '--token': 'Set cloud sync token',
    '--off': 'Disable cloud sync',
    '--status': 'Show sync status',
    '--push': 'Force push to cloud',
    '--pull': 'Force pull from cloud',
  })) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from cloud' -l '${opt.slice(2)}' -d '${desc}'`)
  }

  lines.push('')
  lines.push('# local/ollama subcommand options')
  for (const [opt, desc] of Object.entries({
    '--model': 'Set default local model',
    '--list': 'List available models',
    '--off': 'Disable local mode',
  })) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from local ollama' -l '${opt.slice(2)}' -d '${desc}'`)
  }

  lines.push('')
  lines.push('# serve subcommand options')
  for (const [opt, desc] of Object.entries({
    '--port': 'Port to listen on',
    '--token': 'Auth token',
    '--computer-use': 'Enable computer use tools',
  })) {
    lines.push(`complete -c kbot -n '__fish_seen_subcommand_from serve' -l '${opt.slice(2)}' -d '${desc}'`)
  }

  lines.push('')
  lines.push('# export subcommand options')
  lines.push(`complete -c kbot -n '__fish_seen_subcommand_from export' -l 'format' -s 'f' -d 'Output format' -ra 'md json html'`)
  lines.push(`complete -c kbot -n '__fish_seen_subcommand_from export' -l 'output' -s 'o' -d 'Output file path' -rF`)

  lines.push('')

  return lines.join('\n')
}

// ── Public API ──

export function generateCompletions(shell: 'bash' | 'zsh' | 'fish'): string {
  switch (shell) {
    case 'bash':
      return generateBash()
    case 'zsh':
      return generateZsh()
    case 'fish':
      return generateFish()
    default:
      throw new Error(`Unsupported shell: ${shell}. Use bash, zsh, or fish.`)
  }
}
