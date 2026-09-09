import {
  Award, Brain, Gavel, Scale, Mic, Star, Crown, Gem, Shield, HeartHandshake,
  Ticket, Sparkles, Megaphone, GraduationCap, Briefcase, HandHeart, Users,
  UserCheck, Flame, Music, Camera, PenTool, Wrench, MapPin, Handshake,
  Rocket, Trophy, BadgeCheck, Headphones, Coffee, Lightbulb, Compass,
  Flag, Heart, Key, Leaf, LifeBuoy, Palette, Puzzle, Radio, Ribbon,
  Speaker, Sprout, Sun, Target, Verified, Wand2, Zap, Bookmark, Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Curated set an organizer picks from for a title's icon (icon_kind = 'lucide').
// Keys are the lucide "kebab" names stored in verification_tag_types.icon.
export const TAG_ICONS: Record<string, LucideIcon> = {
  award: Award,
  brain: Brain,
  gavel: Gavel,
  scale: Scale,
  mic: Mic,
  star: Star,
  crown: Crown,
  gem: Gem,
  shield: Shield,
  'heart-handshake': HeartHandshake,
  ticket: Ticket,
  sparkles: Sparkles,
  megaphone: Megaphone,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  'hand-heart': HandHeart,
  users: Users,
  'user-check': UserCheck,
  flame: Flame,
  music: Music,
  camera: Camera,
  'pen-tool': PenTool,
  wrench: Wrench,
  'map-pin': MapPin,
  handshake: Handshake,
  rocket: Rocket,
  trophy: Trophy,
  'badge-check': BadgeCheck,
  headphones: Headphones,
  coffee: Coffee,
  lightbulb: Lightbulb,
  compass: Compass,
  flag: Flag,
  heart: Heart,
  key: Key,
  leaf: Leaf,
  'life-buoy': LifeBuoy,
  palette: Palette,
  puzzle: Puzzle,
  radio: Radio,
  ribbon: Ribbon,
  speaker: Speaker,
  sprout: Sprout,
  sun: Sun,
  target: Target,
  verified: Verified,
  'wand-2': Wand2,
  zap: Zap,
  bookmark: Bookmark,
  'building-2': Building2,
};

export const TAG_ICON_CHOICES: readonly string[] = Object.keys(TAG_ICONS).filter(
  (n) => n !== 'award',
);

export function resolveTagIcon(name: string): LucideIcon {
  return TAG_ICONS[name] ?? Award;
}
