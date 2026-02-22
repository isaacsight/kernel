// ─── Kernel Icon System ──────────────────────────────────
//
// Thin wrapper over Lucide React icons, preserving the existing
// Icon* API and default sizes while gaining Lucide's tree-shaking,
// maintenance, and 1500+ icon coverage.
//
// Style: 2px stroke, round linecap/join, outlined, currentColor.
// Custom SVGs only for Kernel-specific concepts (brand marks, etc.)

import type { LucideProps } from 'lucide-react'
import {
  Home,
  MessageSquare,
  Flag,
  Sun,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Menu,
  Send,
  Paperclip,
  Plus,
  Square,
  ChevronDown,
  X,
  Share2,
  Download,
  Target,
  Zap,
  Clock,
  Brain,
  BarChart3,
  Eye,
  Crown,
  Settings,
  LogOut,
  Trash2,
  Shield,
  Newspaper,
  Mic,
  MicOff,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  MessageCircle,
  Search,
  Globe,
  Bell,
  Link2,
  Play,
  Pause,
  ArrowRight,
  ChevronUp,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  List,
  Sparkles,
  User,
  Users,
  TrendingUp,
  Activity,
  ShieldCheck,
  ShieldOff,
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  Code,
  Package,
  Image,
  // ─── New AI-specific icons ───
  BrainCircuit,
  Bot,
  Upload,
  Calendar,
  Filter,
  Lock,
  Bookmark,
  Star,
  Database,
  Route,
  Workflow,
} from 'lucide-react'

// ─── Shared Props ─────────────────────────────────────────
interface IconProps {
  size?: number
  className?: string
  style?: React.CSSProperties
  'aria-hidden'?: boolean | 'true' | 'false'
}

/** Convert our IconProps to Lucide's format */
function lucideProps(props: IconProps, defaultSize: number): LucideProps {
  return {
    size: props.size ?? defaultSize,
    className: props.className,
    style: props.style,
    strokeWidth: 2,
    'aria-hidden': props['aria-hidden'],
  }
}

// ─── Tab Bar Icons ──────────────────────────────────────

export function IconHome(props: IconProps) {
  return <Home {...lucideProps(props, 22)} />
}

export function IconChats(props: IconProps) {
  return <MessageSquare {...lucideProps(props, 22)} />
}

export function IconGoals(props: IconProps) {
  return <Flag {...lucideProps(props, 22)} />
}

/** Briefings — Custom document with text + image block */
export function IconBriefings({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  )
}

export function IconMore(props: IconProps) {
  return <MoreHorizontal {...lucideProps(props, 22)} />
}

// ─── Header Icons ───────────────────────────────────────

export function IconMenu(props: IconProps) {
  return <Menu {...lucideProps(props, 18)} />
}

export function IconSun(props: IconProps) {
  return <Sun {...lucideProps(props, 16)} />
}

export function IconMoon(props: IconProps) {
  return <Moon {...lucideProps(props, 16)} />
}

export function IconMoreVertical(props: IconProps) {
  return <MoreVertical {...lucideProps(props, 16)} />
}

// ─── Action Icons ───────────────────────────────────────

export function IconSend(props: IconProps) {
  return <Send {...lucideProps(props, 18)} />
}

export function IconAttach(props: IconProps) {
  return <Paperclip {...lucideProps(props, 18)} />
}

export function IconPlus(props: IconProps) {
  return <Plus {...lucideProps(props, 18)} />
}

export function IconStop(props: IconProps) {
  return <Square {...lucideProps(props, 16)} />
}

export function IconChevronDown(props: IconProps) {
  return <ChevronDown {...lucideProps(props, 18)} />
}

export function IconClose(props: IconProps) {
  return <X {...lucideProps(props, 12)} />
}

// ─── Menu Icons ─────────────────────────────────────────

export function IconShare(props: IconProps) {
  return <Share2 {...lucideProps(props, 16)} />
}

export function IconExport(props: IconProps) {
  return <Download {...lucideProps(props, 16)} />
}

export function IconTarget(props: IconProps) {
  return <Target {...lucideProps(props, 16)} />
}

export function IconZap(props: IconProps) {
  return <Zap {...lucideProps(props, 16)} />
}

export function IconClock(props: IconProps) {
  return <Clock {...lucideProps(props, 16)} />
}

/** Brain — actual brain icon (was previously rendering layers/stacks) */
export function IconBrain(props: IconProps) {
  return <Brain {...lucideProps(props, 16)} />
}

export function IconChart(props: IconProps) {
  return <BarChart3 {...lucideProps(props, 16)} />
}

export function IconEye(props: IconProps) {
  return <Eye {...lucideProps(props, 16)} />
}

export function IconCrown(props: IconProps) {
  return <Crown {...lucideProps(props, 16)} />
}

export function IconSettings(props: IconProps) {
  return <Settings {...lucideProps(props, 16)} />
}

export function IconLogOut(props: IconProps) {
  return <LogOut {...lucideProps(props, 16)} />
}

export function IconTrash(props: IconProps) {
  return <Trash2 {...lucideProps(props, 16)} />
}

export function IconShield(props: IconProps) {
  return <Shield {...lucideProps(props, 12)} />
}

export function IconNewspaper(props: IconProps) {
  return <Newspaper {...lucideProps(props, 16)} />
}

export function IconMic(props: IconProps) {
  return <Mic {...lucideProps(props, 18)} />
}

export function IconMicOff(props: IconProps) {
  return <MicOff {...lucideProps(props, 18)} />
}

export function IconCopy(props: IconProps) {
  return <Copy {...lucideProps(props, 14)} />
}

export function IconCheck(props: IconProps) {
  return <Check {...lucideProps(props, 14)} />
}

export function IconDownload(props: IconProps) {
  return <Download {...lucideProps(props, 14)} />
}

export function IconThumbsUp(props: IconProps) {
  return <ThumbsUp {...lucideProps(props, 14)} />
}

export function IconThumbsDown(props: IconProps) {
  return <ThumbsDown {...lucideProps(props, 14)} />
}

export function IconPencil(props: IconProps) {
  return <Pencil {...lucideProps(props, 14)} />
}

export function IconMessageCircle(props: IconProps) {
  return <MessageCircle {...lucideProps(props, 12)} />
}

// ─── Additional Icons ──────────────────────────────────

export function IconSearch(props: IconProps) {
  return <Search {...lucideProps(props, 16)} />
}

export function IconGlobe(props: IconProps) {
  return <Globe {...lucideProps(props, 16)} />
}

export function IconBell(props: IconProps) {
  return <Bell {...lucideProps(props, 16)} />
}

export function IconLink(props: IconProps) {
  return <Link2 {...lucideProps(props, 16)} />
}

export function IconPlay(props: IconProps) {
  return <Play {...lucideProps(props, 16)} />
}

export function IconPause(props: IconProps) {
  return <Pause {...lucideProps(props, 16)} />
}

export function IconArrowRight(props: IconProps) {
  return <ArrowRight {...lucideProps(props, 16)} />
}

// ─── Extended Icons ────────────────────────────────────

export function IconChevronUp(props: IconProps) {
  return <ChevronUp {...lucideProps(props, 18)} />
}

export function IconChevronRight(props: IconProps) {
  return <ChevronRight {...lucideProps(props, 18)} />
}

export function IconRefresh(props: IconProps) {
  return <RefreshCw {...lucideProps(props, 16)} />
}

export function IconAlertCircle(props: IconProps) {
  return <AlertCircle {...lucideProps(props, 16)} />
}

export function IconArrowLeft(props: IconProps) {
  return <ArrowLeft {...lucideProps(props, 16)} />
}

export function IconList(props: IconProps) {
  return <List {...lucideProps(props, 16)} />
}

export function IconSparkles(props: IconProps) {
  return <Sparkles {...lucideProps(props, 16)} />
}

export function IconUser(props: IconProps) {
  return <User {...lucideProps(props, 16)} />
}

export function IconUsers(props: IconProps) {
  return <Users {...lucideProps(props, 16)} />
}

export function IconTrendingUp(props: IconProps) {
  return <TrendingUp {...lucideProps(props, 16)} />
}

export function IconActivity(props: IconProps) {
  return <Activity {...lucideProps(props, 16)} />
}

export function IconShieldCheck(props: IconProps) {
  return <ShieldCheck {...lucideProps(props, 16)} />
}

export function IconShieldOff(props: IconProps) {
  return <ShieldOff {...lucideProps(props, 16)} />
}

export function IconFileText(props: IconProps) {
  return <FileText {...lucideProps(props, 16)} />
}

export function IconFileCode(props: IconProps) {
  return <FileCode {...lucideProps(props, 16)} />
}

export function IconFileSpreadsheet(props: IconProps) {
  return <FileSpreadsheet {...lucideProps(props, 16)} />
}

export function IconFile(props: IconProps) {
  return <File {...lucideProps(props, 16)} />
}

export function IconCode(props: IconProps) {
  return <Code {...lucideProps(props, 16)} />
}

export function IconPackage(props: IconProps) {
  return <Package {...lucideProps(props, 16)} />
}

export function IconImage(props: IconProps) {
  return <Image {...lucideProps(props, 16)} />
}

// ─── New AI-Specific Icons ─────────────────────────────
// These expand coverage for Kernel's agent system,
// knowledge graph, and portability features.

export function IconBrainCircuit(props: IconProps) {
  return <BrainCircuit {...lucideProps(props, 16)} />
}

export function IconBot(props: IconProps) {
  return <Bot {...lucideProps(props, 16)} />
}

export function IconUpload(props: IconProps) {
  return <Upload {...lucideProps(props, 16)} />
}

export function IconCalendar(props: IconProps) {
  return <Calendar {...lucideProps(props, 16)} />
}

export function IconFilter(props: IconProps) {
  return <Filter {...lucideProps(props, 16)} />
}

export function IconLock(props: IconProps) {
  return <Lock {...lucideProps(props, 16)} />
}

export function IconBookmark(props: IconProps) {
  return <Bookmark {...lucideProps(props, 16)} />
}

export function IconStar(props: IconProps) {
  return <Star {...lucideProps(props, 16)} />
}

export function IconDatabase(props: IconProps) {
  return <Database {...lucideProps(props, 16)} />
}

export function IconRoute(props: IconProps) {
  return <Route {...lucideProps(props, 16)} />
}

export function IconWorkflow(props: IconProps) {
  return <Workflow {...lucideProps(props, 16)} />
}
