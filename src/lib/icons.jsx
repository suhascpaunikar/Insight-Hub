/* ==========================================================================
   icons.jsx — the icon set, on Kumo's own icon dependency.

   The vanilla build carried 67 hand-inlined SVG paths because it had nothing
   to import them from. Kumo's peer dependency is `@phosphor-icons/react` and
   its own components draw from it, so the console now draws from the same set
   — a Phosphor caret inside our button and a Phosphor caret inside Kumo's
   Select are now literally the same glyph.

   The names are the vanilla build's, unchanged, so every call site ported
   one-for-one: `icon('rocket')` became `<Icon name="rocket" />`.
   ========================================================================== */
import {
  Plus, MagnifyingGlass, Check, X, Lock, WarningCircle, Warning, Info,
  ArrowLeft, ArrowRight, CaretLeft, CaretRight, CaretDoubleLeft, CaretDoubleRight,
  CaretUpDown, CaretDown, CaretUp, FloppyDisk, RocketLaunch, Copy, CopySimple,
  Columns, ArrowsDownUp, Megaphone, ChartBar, Users, Layout, Database, Sparkle,
  Robot, Gear, SidebarSimple, Buildings, GridFour, Question, Stack, Pause, Play,
  Stop, PencilSimple, DownloadSimple, UploadSimple, FileText, ArrowClockwise,
  HandWaving, PaperPlaneTilt, Trash, Circle, DotsThree, ArrowCounterClockwise,
  Eye, Funnel, Target, Clock, Image, ThumbsUp, Star, ListBullets, TextT,
  ArrowSquareOut, GitBranch, Ticket, CaretRight as Chevron, Envelope, BookOpen,
  Bell, ShieldCheck, Gauge, Key, DeviceMobile, Smiley,
} from '@phosphor-icons/react';

const SET = {
  plus: Plus, search: MagnifyingGlass, check: Check, x: X, lock: Lock,
  alert: WarningCircle, warn: Warning, info: Info,
  left: ArrowLeft, right: ArrowRight, chevLeft: CaretLeft, chevRight: CaretRight,
  first: CaretDoubleLeft, last: CaretDoubleRight, updown: CaretUpDown,
  down: CaretDown, up: CaretUp, save: FloppyDisk, rocket: RocketLaunch,
  copy: Copy, clone: CopySimple, columns: Columns, sort: ArrowsDownUp,
  megaphone: Megaphone, chart: ChartBar, users: Users, layout: Layout,
  database: Database, sparkles: Sparkle, bot: Robot, settings: Gear,
  panelClose: SidebarSimple, panelOpen: SidebarSimple, building: Buildings,
  grid: GridFour, help: Question, layers: Stack, pause: Pause, play: Play,
  stop: Stop, pencil: PencilSimple, download: DownloadSimple, upload: UploadSimple,
  fileText: FileText, refresh: ArrowClockwise, hand: HandWaving, send: PaperPlaneTilt,
  trash: Trash, dot: Circle, ellipsis: DotsThree, undo: ArrowCounterClockwise,
  eye: Eye, filter: Funnel, target: Target, clock: Clock, image: Image,
  thumbs: ThumbsUp, star: Star, list: ListBullets, type: TextT,
  external: ArrowSquareOut, gitBranch: GitBranch, ticket: Ticket,
  chevron: Chevron, mail: Envelope, book: BookOpen, bell: Bell,
  shield: ShieldCheck, gauge: Gauge, key: Key, phone: DeviceMobile, smile: Smiley,
};

/**
 * `size` defaults to 16 — Kumo's own icon size inside a base control, so an
 * icon of ours sitting next to one of Kumo's lines up without adjustment.
 * The rail's collapsed strip and the empty state pass their own.
 */
export function Icon({ name, size = 16, weight = 'regular', ...rest }) {
  const Glyph = SET[name];
  if (!Glyph) return null;
  return <Glyph size={size} weight={weight} aria-hidden="true" {...rest} />;
}

export const hasIcon = (name) => Boolean(SET[name]);
export const ICON_NAMES = Object.keys(SET);
