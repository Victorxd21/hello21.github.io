export type Season =
  | 'auto'
  | 'default'
  | 'halloween'
  | 'winter'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'christmas';

export type TimeOfDay = 'auto' | 'morning' | 'afternoon' | 'sunset' | 'night';

export interface Game {
  id: string;
  name: string;
  folder: string | null;
  file: string;
  icon: string;
  tags: string[];
  description: string;
  controls?: string;
  notByMe?: boolean;
  isNew?: boolean;
  banner?: string;
  profileSvg?: string;
  photos?: string[];
  views: number;
}

export interface HubOptions {
  trail: boolean;
  party: boolean;
  confetti: boolean;
  sound: boolean;
  fx: boolean;
  grid: boolean;
  cubes: boolean;
  parallax: boolean;
  motion: boolean;
  fps: boolean;
  hideDead: boolean;
  forceOk: boolean;
  hideBanners: boolean;
  season: Season;
  timeOfDay: TimeOfDay;
}

export type DockTab = 'library' | 'guide' | 'whatsnew' | 'feedback' | 'about' | 'logs';

export interface Announcement {
  id: string;
  title: string;
  date: string;
  version: string;
  tag: string;
  content: string;
  badge?: string;
}

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  details: string[];
}
