/**
 * Centralised icon set, re-exported from `lucide-react`.
 *
 * The whole codebase imports from this module under stable local names
 * (HomeIcon, PlayIcon, …) so we can swap the icon library — or override a
 * specific glyph — in one place without touching call sites.
 *
 * Default size is 22 to match the previous in-house SVG set.
 */
import type { ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  ClipboardList,
  Coffee,
  DoorOpen,
  Flame,
  History as HistoryGlyph,
  Home,
  Maximize2,
  Medal,
  Menu,
  Minimize2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCw,
  Settings,
  Share2,
  Lightbulb,
  Shuffle,
  Star,
  MousePointerClick,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  TriangleAlert,
  Undo2,
  UserX,
  Users,
  X,
  Zap,
  type LucideProps,
} from 'lucide-react';
import type { AchievementIconName } from '../../molkky/achievements';

type IconComponent = ComponentType<LucideProps>;

/**
 * Wrap a Lucide icon so the local default size (22) matches the previous
 * hand-rolled SVG set. Calling code can still override with `size={…}`.
 */
function wrap(Comp: IconComponent, displayName: string): IconComponent {
  const Wrapped: IconComponent = props => <Comp size={22} {...props} />;
  Wrapped.displayName = displayName;
  return Wrapped;
}

export const HomeIcon = wrap(Home as IconComponent, 'HomeIcon');
export const PlayIcon = wrap(Play as IconComponent, 'PlayIcon');
export const PauseIcon = wrap(Pause as IconComponent, 'PauseIcon');
export const HistoryIcon = wrap(HistoryGlyph as IconComponent, 'HistoryIcon');
export const ChartIcon = wrap(BarChart3 as IconComponent, 'ChartIcon');
export const UsersIcon = wrap(Users as IconComponent, 'UsersIcon');
export const SettingsIcon = wrap(Settings as IconComponent, 'SettingsIcon');
export const CloseIcon = wrap(X as IconComponent, 'CloseIcon');
export const CheckIcon = wrap(Check as IconComponent, 'CheckIcon');
export const UndoIcon = wrap(Undo2 as IconComponent, 'UndoIcon');
export const PlusIcon = wrap(Plus as IconComponent, 'PlusIcon');
export const TrashIcon = wrap(Trash2 as IconComponent, 'TrashIcon');
export const ArrowLeftIcon = wrap(ArrowLeft as IconComponent, 'ArrowLeftIcon');
export const ArrowRightIcon = wrap(
  ArrowRight as IconComponent,
  'ArrowRightIcon'
);
export const MaximizeIcon = wrap(Maximize2 as IconComponent, 'MaximizeIcon');
export const MinimizeIcon = wrap(Minimize2 as IconComponent, 'MinimizeIcon');
export const TrophyIcon = wrap(Trophy as IconComponent, 'TrophyIcon');
export const ShareIcon = wrap(Share2 as IconComponent, 'ShareIcon');
export const MenuIcon = wrap(Menu as IconComponent, 'MenuIcon');
export const RefreshIcon = wrap(RefreshCw as IconComponent, 'RefreshIcon');
export const RematchIcon = wrap(RotateCw as IconComponent, 'RematchIcon');
export const ClipboardIcon = wrap(
  ClipboardList as IconComponent,
  'ClipboardIcon'
);
export const LiveIcon = wrap(Radio as IconComponent, 'LiveIcon');
export const CameraIcon = wrap(Camera as IconComponent, 'CameraIcon');
export const CoffeeIcon = wrap(Coffee as IconComponent, 'CoffeeIcon');
export const ShuffleIcon = wrap(Shuffle as IconComponent, 'ShuffleIcon');
export const ForfeitIcon = wrap(DoorOpen as IconComponent, 'ForfeitIcon');
export const TargetIcon = wrap(Target as IconComponent, 'TargetIcon');
export const PointerClickIcon = wrap(
  MousePointerClick as IconComponent,
  'PointerClickIcon'
);
export const AlertIcon = wrap(TriangleAlert as IconComponent, 'AlertIcon');
export const UserXIcon = wrap(UserX as IconComponent, 'UserXIcon');
export const LightbulbIcon = wrap(Lightbulb as IconComponent, 'LightbulbIcon');
export const StarIcon = wrap(Star as IconComponent, 'StarIcon');
const FlameIcon = wrap(Flame as IconComponent, 'FlameIcon');
const ZapIcon = wrap(Zap as IconComponent, 'ZapIcon');
const MedalIcon = wrap(Medal as IconComponent, 'MedalIcon');
const TrendingUpIcon = wrap(TrendingUp as IconComponent, 'TrendingUpIcon');

/**
 * Lookup map from an achievement's symbolic icon name (kept React-free
 * in the rules module) to the concrete Lucide component to render. Add
 * a new entry here whenever `AchievementIconName` grows.
 */
const ACHIEVEMENT_ICONS: Record<AchievementIconName, IconComponent> = {
  target: TargetIcon,
  flame: FlameIcon,
  zap: ZapIcon,
  trophy: TrophyIcon,
  medal: MedalIcon,
  'trending-up': TrendingUpIcon,
};

export function getAchievementIcon(name: AchievementIconName): IconComponent {
  return ACHIEVEMENT_ICONS[name];
}
