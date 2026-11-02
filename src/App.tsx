import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, Season, TimeOfDay, HubOptions, DockTab } from './types/game';
import { INITIAL_GAMES, INITIAL_ANNOUNCEMENTS, CHANGELOGS } from './data/gamesData';
import { CubeCanvas } from './components/CubeCanvas';
import { SeasonWeatherFX } from './components/SeasonWeatherFX';
import { MatrixVoid } from './components/MatrixVoid';
import { GameDetailModal } from './components/GameDetailModal';
import { GameGuideModal } from './components/GameGuideModal';
import { WhatsNewModal } from './components/WhatsNewModal';
import { FeedbackModal } from './components/FeedbackModal';
import { AboutModal } from './components/AboutModal';
import { OptionsPanel } from './components/OptionsPanel';
import { DockNavigation } from './components/DockNavigation';
import { FeaturedHero } from './components/FeaturedHero';
import { CursorTrail } from './components/CursorTrail';
import { Confetti } from './components/Confetti';
import { IntroLoader } from './components/IntroLoader';
import { playUiSound } from './utils/audio';
import {
  Search,
  RefreshCw,
  Settings,
  Sparkles,
  Eye,
  Play,
  ChevronDown,
  Clock,
  Compass,
  ArrowUpDown,
  X,
  Target,
  ArrowRight
} from 'lucide-react';

function getNaturalSeason(): Season {
  const now = new Date();
  const mo = now.getMonth() + 1;
  const dy = now.getDate();
  if (mo === 10) return 'halloween';
  if (mo === 12 && dy >= 20) return 'christmas';
  if (mo === 12 || mo === 1 || mo === 2) return 'winter';
  if (mo >= 3 && mo <= 5) return 'spring';
  if (mo >= 6 && mo <= 8) return 'summer';
  if (mo === 9) return 'autumn';
  return 'default';
}

function getNaturalTimeOfDay(): TimeOfDay {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 12) return 'morning';
  if (hr >= 12 && hr < 17) return 'afternoon';
  if (hr >= 17 && hr < 21) return 'sunset';
  return 'night';
}

export default function App() {
  // Intro Loader State
  const [hasLoadedIntro, setHasLoadedIntro] = useState(false);
  const mainTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [targetTitleRect, setTargetTitleRect] = useState<DOMRect | null>(null);

  // Measure main title bounding rect once mounted for smooth intro animation
  useEffect(() => {
    const measure = () => {
      if (mainTitleRef.current) {
        setTargetTitleRect(mainTitleRef.current.getBoundingClientRect());
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Games & Real Views State (Strictly real play counts; starting at 0, no fake numbers)
  const [games, setGames] = useState<Game[]>(() => {
    // Purge legacy storage keys from earlier runs or original repo that held fake numbers
    try {
      localStorage.removeItem('hub_game_views_v1');
      localStorage.removeItem('hub_game_views');
      localStorage.removeItem('hub_game_views_v2');
      localStorage.removeItem('hub_cached_games_v2');
    } catch {}

    try {
      const stored = localStorage.getItem('hub_actual_plays_real_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        return INITIAL_GAMES.map((g) => ({
          ...g,
          views: (parsed && typeof parsed[g.id] === 'number') ? parsed[g.id] : 0
        }));
      }
    } catch {}
    return INITIAL_GAMES.map((g) => ({ ...g, views: 0 }));
  });

  // Hub Options
  const [options, setOptions] = useState<HubOptions>(() => {
    const defaults: HubOptions = {
      trail: false,
      party: false,
      confetti: true,
      sound: true,
      fx: true,
      grid: true,
      cubes: true,
      parallax: true,
      motion: false,
      fps: false,
      hideDead: false,
      forceOk: false,
      hideBanners: false,
      season: 'auto',
      timeOfDay: 'auto'
    };
    try {
      const stored = localStorage.getItem('hub_opts_v1');
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch {}
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem('hub_opts_v1', JSON.stringify(options));
    } catch {}
  }, [options]);

  // Compute active season & time of day
  const effectiveSeason = options.season === 'auto' ? getNaturalSeason() : options.season;
  const effectiveTimeOfDay = options.timeOfDay === 'auto' ? getNaturalTimeOfDay() : options.timeOfDay;

  useEffect(() => {
    const b = document.body;
    [
      'season-halloween',
      'season-winter',
      'season-spring',
      'season-summer',
      'season-autumn',
      'season-christmas',
      'season-default'
    ].forEach((cls) => b.classList.remove(cls));
    b.classList.add(`season-${effectiveSeason}`);
  }, [effectiveSeason]);

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Search, Filtering, and Jump-to-Game Highlight
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'plays' | 'title' | 'newest'>('plays');
  const [catMineOpen, setCatMineOpen] = useState(true);
  const [catOtherOpen, setCatOtherOpen] = useState(true);
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null);

  // Modals & Navigation
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [activeDockTab, setActiveDockTab] = useState<DockTab>('library');

  // Confetti trigger
  const [confettiTrigger, setConfettiTrigger] = useState<{ ts: number; x: number; y: number } | null>(null);

  // Shake cubes ref
  const shakeCubesRef = useRef<(() => void) | null>(null);

  // FPS meter
  const [fps, setFps] = useState(60);
  useEffect(() => {
    if (!options.fps) return;
    let frames = 0;
    let lastTime = performance.now();
    let id: number;

    const measure = (now: number) => {
      frames++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      id = requestAnimationFrame(measure);
    };
    id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [options.fps]);

  // Global Keyboard Shortcuts (Press ` for Matrix Void, Esc to close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        setIsMatrixOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSelectedGame(null);
        setIsGuideOpen(false);
        setIsWhatsNewOpen(false);
        setIsFeedbackOpen(false);
        setIsAboutOpen(false);
        setIsOptionsOpen(false);
        setIsMatrixOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Increment view / play count (real user plays only)
  const handleRecordPlay = (gameId: string) => {
    setGames((prev) => {
      const next = prev.map((g) => (g.id === gameId ? { ...g, views: g.views + 1 } : g));
      try {
        const viewMap: Record<string, number> = {};
        next.forEach((g) => {
          viewMap[g.id] = g.views;
        });
        localStorage.setItem('hub_actual_plays_real_v2', JSON.stringify(viewMap));
      } catch {}
      return next;
    });
  };

  // Open game modal with confetti
  const handleSelectGame = (game: Game, e?: React.MouseEvent) => {
    if (options.confetti) {
      setConfettiTrigger({
        ts: Date.now(),
        x: e ? e.clientX : window.innerWidth / 2,
        y: e ? e.clientY : window.innerHeight / 2
      });
    }
    if (options.sound) playUiSound('pop');
    setSelectedGame(game);
  };

  // Jump to specific game card from search line
  const handleJumpToGame = (game: Game) => {
    if (options.sound) playUiSound('click');

    // Ensure category is open
    if (game.notByMe) {
      setCatOtherOpen(true);
    } else {
      setCatMineOpen(true);
    }

    // Scroll after DOM update
    setTimeout(() => {
      const el = document.getElementById(`game-card-${game.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedGameId(game.id);
        setTimeout(() => setHighlightedGameId(null), 2600);
      }
    }, 60);
  };

  // Dock navigation handler
  const handleDockTab = (tab: DockTab) => {
    setActiveDockTab(tab);
    if (tab === 'library') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'guide') {
      setIsGuideOpen(true);
    } else if (tab === 'whatsnew') {
      setIsWhatsNewOpen(true);
    } else if (tab === 'feedback') {
      setIsFeedbackOpen(true);
    } else if (tab === 'about') {
      setIsAboutOpen(true);
    } else if (tab === 'logs') {
      setIsWhatsNewOpen(true);
    }
  };

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>(['all']);
    games.forEach((g) => g.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [games]);

  // Filter and sort games
  const { mineGames, otherGames, searchMatchedGames } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matches = (g: Game) => {
      if (q && !g.name.toLowerCase().includes(q) && !(g.folder || '').toLowerCase().includes(q)) {
        return false;
      }
      if (activeTag !== 'all' && !g.tags.includes(activeTag)) {
        return false;
      }
      return true;
    };

    const sorter = (a: Game, b: Game) => {
      if (sortBy === 'plays') return b.views - a.views;
      if (sortBy === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      return a.name.localeCompare(b.name);
    };

    const lineMatches = q
      ? games.filter((g) => g.name.toLowerCase().includes(q) || (g.folder || '').toLowerCase().includes(q))
      : [];

    return {
      mineGames: games.filter((g) => !g.notByMe && matches(g)).sort(sorter),
      otherGames: games.filter((g) => g.notByMe && matches(g)).sort(sorter),
      searchMatchedGames: lineMatches
    };
  }, [games, searchQuery, activeTag, sortBy]);

  // Top 5 featured games for hero carousel
  const featuredGames = useMemo(() => {
    return [...games].slice(0, 5);
  }, [games]);

  const seasonNames: Record<Season, string> = {
    halloween: '🎃 Halloween',
    winter: '❄️ Winter',
    spring: '🌸 Spring',
    summer: '☀️ Summer',
    autumn: '🍂 Autumn',
    christmas: '🎄 Christmas',
    default: '🌌 Hub Arcadium',
    auto: 'Auto'
  };

  const timeNames: Record<TimeOfDay, string> = {
    morning: '🌅 Dawn',
    afternoon: '☀️ Daylight',
    sunset: '🌇 Dusk',
    night: '🌙 Midnight',
    auto: 'Auto'
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 pb-24 ${options.party ? 'body-party' : ''}`}>
      {/* Cinematic Intro Loader with rotating GH and text smooth glide */}
      {!hasLoadedIntro && (
        <IntroLoader
          onComplete={() => setHasLoadedIntro(true)}
          targetRect={targetTitleRect}
        />
      )}

      {/* Background Falling Gravity Cubes Canvas (continuous tumbling in background) */}
      <CubeCanvas
        season={effectiveSeason}
        enabled={options.cubes}
        onFlingRef={shakeCubesRef}
      />

      {/* Background Ambient Layers & Prettier Auroras */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden pretty-aurora-bg">
        <div
          className="bg-ambient-orb w-[550px] sm:w-[650px] h-[550px] sm:h-[650px] -top-36 -left-36 bg-cyan-500/20 animate-aurora"
          style={{ transform: options.parallax ? 'translateY(10px)' : 'none' }}
        />
        <div
          className="bg-ambient-orb w-[500px] sm:w-[600px] h-[500px] sm:h-[600px] top-1/4 -right-36 bg-purple-500/20 animate-aurora"
          style={{ transform: options.parallax ? 'translateY(-20px)' : 'none', animationDelay: '-3.5s' }}
        />
        <div
          className="bg-ambient-orb w-[480px] sm:w-[580px] h-[480px] sm:h-[580px] bottom-10 left-1/3 bg-blue-500/15 animate-aurora"
          style={{ transform: options.parallax ? 'translateY(15px)' : 'none', animationDelay: '-7s' }}
        />
        {options.grid && <div className="absolute inset-0 retro-grid opacity-25" />}
      </div>

      {/* Atmospheric Weather Particles */}
      <SeasonWeatherFX
        season={effectiveSeason}
        timeOfDay={effectiveTimeOfDay}
        enabled={options.fx}
      />

      {/* Cursor Trail FX */}
      <CursorTrail enabled={options.trail} />

      {/* Confetti Burst */}
      <Confetti
        triggerTimestamp={confettiTrigger?.ts || null}
        originX={confettiTrigger?.x}
        originY={confettiTrigger?.y}
      />

      {/* FPS Meter */}
      {options.fps && (
        <div className="fixed top-16 left-4 z-50 px-2.5 py-1 rounded-lg bg-black/75 border border-cyan-500/40 font-mono text-xs text-cyan-400 pointer-events-none shadow-md">
          {fps} FPS
        </div>
      )}

      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="h-14 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo with dynamic animated color shifting and floating */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl gh-logo-animated flex items-center justify-center font-black text-slate-950 text-xs sm:text-sm shadow-md cursor-pointer select-none">
              GH
            </div>
            <span className="font-extrabold text-white text-sm sm:text-base tracking-tight hidden md:inline">
              Game Hub
            </span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 30+ games..."
              className="w-full h-9 pl-9 pr-8 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                if (options.sound) playUiSound('click');
                setSearchQuery('');
                setActiveTag('all');
              }}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title="Reset Filters / Refresh Library"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (options.sound) playUiSound('click');
                setIsOptionsOpen(true);
              }}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title="Settings & Atmosphere Options"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Search Jump Line: Appears below search bar when searching */}
        {searchQuery.trim().length > 0 && (
          <div className="px-3 sm:px-6 py-2 bg-slate-900/95 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none animate-fadeIn">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span className="hidden sm:inline">Jump to:</span>
            </span>

            {searchMatchedGames.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No matching games found for "{searchQuery}"</span>
            ) : (
              searchMatchedGames.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleJumpToGame(g)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm group"
                >
                  <span className="text-sm">{g.icon}</span>
                  <span className="truncate max-w-[130px]">{g.name}</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400 group-hover:text-slate-950 transition-colors" />
                </button>
              ))
            )}
          </div>
        )}
      </header>

      {/* Main Container with cool appearing animation */}
      <main className={`relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-5 pb-12 space-y-7 transition-all duration-700 ${hasLoadedIntro ? 'page-appear' : 'opacity-0 translate-y-6'}`}>
        {/* Arcade Title & Live Status Badges */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>The Arcade is Open</span>
            </div>
            {/* Main title referenced by IntroLoader for smooth flight landing transition */}
            <h1
              ref={mainTitleRef}
              className={`text-3xl sm:text-5xl font-black text-white tracking-tight transition-opacity duration-500 ${
                !hasLoadedIntro ? 'opacity-0' : 'opacity-100'
              }`}
            >
              Game Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Pick a game. Jump in. Find your next favorite.
            </p>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-300">
            <span className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 flex items-center gap-1.5 text-purple-300">
              <span>{seasonNames[effectiveSeason]}</span>
              <span>·</span>
              <span>{timeNames[effectiveTimeOfDay]}</span>
            </span>
            {currentTime && (
              <span className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 flex items-center gap-1.5 text-slate-400 hidden sm:inline-flex">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>{currentTime}</span>
              </span>
            )}
          </div>
        </div>

        {/* Featured Game Spotlight Hero */}
        <FeaturedHero
          featuredGames={featuredGames}
          onSelectGame={handleSelectGame}
          soundEnabled={options.sound}
        />

        {/* Tag Pills & Sort Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Tag Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    if (options.sound) playUiSound('click');
                    setActiveTag(t);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeTag === t
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="plays">Most Played</option>
                <option value="title">Title (A-Z)</option>
                <option value="newest">Recently Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Games Library Category: Curated Games */}
        <section className="space-y-3.5">
          <button
            onClick={() => setCatMineOpen((prev) => !prev)}
            className="w-full flex items-center justify-between py-1 text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={`w-4 h-4 text-cyan-400 transition-transform duration-200 ${
                  catMineOpen ? '' : '-rotate-90'
                }`}
              />
              <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                Arcade Collection
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-cyan-400">
                {mineGames.length}
              </span>
            </div>
          </button>

          {catMineOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5 animate-fadeIn">
              {mineGames.map((g) => {
                const isHighlighted = highlightedGameId === g.id;

                return (
                  <div
                    key={g.id}
                    id={`game-card-${g.id}`}
                    onClick={(e) => handleSelectGame(g, e)}
                    className={`group relative p-3 sm:p-4 rounded-2xl bg-slate-900/85 hover:bg-slate-800/90 border border-slate-800/80 hover:border-cyan-500/50 shadow-lg hover:shadow-cyan-500/10 cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                      isHighlighted ? 'highlight-jump' : ''
                    } ${options.party ? 'party-wiggle' : 'hover:-translate-y-1'}`}
                  >
                    {/* Card Badges */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <span className="text-2xl sm:text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                        {g.icon}
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        {g.isNew && (
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-400 text-slate-950 font-extrabold text-[9px] uppercase tracking-wider">
                            New
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5 text-cyan-400" />
                          <span>{g.views === 1 ? '1 play' : `${g.views} plays`}</span>
                        </span>
                      </div>
                    </div>

                    {/* Title & Path */}
                    <div className="space-y-0.5 sm:space-y-1">
                      <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                        {g.name}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-500 truncate">
                        {g.folder ? `games/${g.folder}` : `games/${g.file}`}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-[10px] font-medium text-slate-400 capitalize truncate max-w-[70px]">
                        {g.tags[0] || 'arcade'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 group-hover:bg-cyan-500 text-cyan-400 group-hover:text-slate-950 font-bold text-[10px] sm:text-[11px] transition-colors flex items-center gap-1">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Play</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Games Library Category: Community Games */}
        {otherGames.length > 0 && (
          <section className="space-y-3.5 pt-3 border-t border-slate-900">
            <button
              onClick={() => setCatOtherOpen((prev) => !prev)}
              className="w-full flex items-center justify-between py-1 text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={`w-4 h-4 text-purple-400 transition-transform duration-200 ${
                    catOtherOpen ? '' : '-rotate-90'
                  }`}
                />
                <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                  Community Games
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-purple-400">
                  {otherGames.length}
                </span>
              </div>
            </button>

            {catOtherOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5 animate-fadeIn">
                {otherGames.map((g) => {
                  const isHighlighted = highlightedGameId === g.id;

                  return (
                    <div
                      key={g.id}
                      id={`game-card-${g.id}`}
                      onClick={(e) => handleSelectGame(g, e)}
                      className={`group relative p-3 sm:p-4 rounded-2xl bg-slate-900/85 hover:bg-slate-800/90 border border-slate-800/80 hover:border-purple-500/50 shadow-lg hover:shadow-purple-500/10 cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                        isHighlighted ? 'highlight-jump' : ''
                      } ${options.party ? 'party-wiggle' : 'hover:-translate-y-1'}`}
                    >
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="text-2xl sm:text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                          {g.icon}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5 text-purple-400" />
                          <span>{g.views === 1 ? '1 play' : `${g.views} plays`}</span>
                        </span>
                      </div>

                      <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                          {g.name}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-500 truncate">
                          {g.folder ? `games/${g.folder}` : `games/${g.file}`}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-medium text-slate-400 capitalize">
                          {g.tags[0] || 'arcade'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500 text-purple-400 group-hover:text-slate-950 font-bold text-[10px] sm:text-[11px] transition-colors flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Play</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Bottom Dock Navigation */}
      <DockNavigation
        activeTab={activeDockTab}
        onSelectTab={handleDockTab}
        hasNewAnnouncements={true}
        soundEnabled={options.sound}
      />

      {/* Modals */}
      <GameDetailModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        onRecordPlay={handleRecordPlay}
        soundEnabled={options.sound}
      />

      <GameGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        games={games}
        onSelectGame={(g) => {
          setIsGuideOpen(false);
          handleSelectGame(g);
        }}
        soundEnabled={options.sound}
      />

      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        onClose={() => setIsWhatsNewOpen(false)}
        announcements={INITIAL_ANNOUNCEMENTS}
        changelogs={CHANGELOGS}
        soundEnabled={options.sound}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        soundEnabled={options.sound}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onOpenMatrix={() => setIsMatrixOpen(true)}
        soundEnabled={options.sound}
      />

      <OptionsPanel
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        options={options}
        setOptions={setOptions}
        onShakeCubes={() => {
          if (shakeCubesRef.current) shakeCubesRef.current();
        }}
        onResetOptions={() => {
          const defaults: HubOptions = {
            trail: false,
            party: false,
            confetti: true,
            sound: true,
            fx: true,
            grid: true,
            cubes: true,
            parallax: true,
            motion: false,
            fps: false,
            hideDead: false,
            forceOk: false,
            hideBanners: false,
            season: 'auto',
            timeOfDay: 'auto'
          };
          setOptions(defaults);
        }}
      />

      {/* 3D Matrix Infinite Void Chamber */}
      <MatrixVoid
        isOpen={isMatrixOpen}
        onClose={() => setIsMatrixOpen(false)}
      />
    </div>
  );
}
