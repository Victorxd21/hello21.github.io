import { Game, Announcement, ChangelogItem } from '../types/game';

export const INITIAL_GAMES: Game[] = [
  {
    id: 'monochrome',
    name: 'Monochrome',
    folder: 'Monochrome',
    file: 'index.html',
    icon: '⬛',
    tags: ['3d', 'horror', 'story'],
    description:
      'A psychological monochrome 3D survival horror experience. Hide in closets, avoid the creature, listen closely, and find keys to escape.',
    controls: 'WASD to move · Shift to run · Space/L2 to hold breath · E to interact · F for flashlight',
    banner: './game-art/heads/banner.svg',
    photos: [
      './games/Monochrome/Photos/IMG_0860.jpeg',
      './games/Monochrome/Photos/IMG_0889.webp',
      './pics/IMG_0315.jpeg',
      './pics/IMG_0338.jpeg'
    ],
    views: 0
  },
  {
    id: 'fazbear-industry',
    name: 'Fazbear Industry: Decommissioned',
    folder: 'FazBear-industry',
    file: 'index.html',
    icon: '🐻',
    tags: ['action', '3d', 'horror'],
    description:
      'Survive the decommissioned facility. Monitor security feeds, conserve battery, and pulse lights to temporarily stun PROTO-01.',
    controls: 'WASD to move · Shift sprint · E interact · F flashlight · G pulse light · Tab tablet/cameras',
    banner: './game-art/werewolf/banner.svg',
    photos: ['./pics/IMG_0340.jpeg', './pics/IMG_0341.jpeg'],
    views: 0
  },
  {
    id: 'siren-head',
    name: 'Siren Head: The Forest Escape',
    folder: 'Siren Head',
    file: 'index.html',
    icon: '📢',
    tags: ['action', '3d', 'horror'],
    description:
      'A dense atmospheric forest at night. Fix your truck or find an alternate exit while Siren Head stalks the mist.',
    controls: 'WASD walk · Shift sprint · C crouch · Space jump · F flashlight · E interact · M map · I inventory',
    banner: './game-art/heads/banner.svg',
    photos: ['./pics/IMG_0360.jpeg', './pics/IMG_0425.jpeg'],
    views: 0
  },
  {
    id: 'super-mario',
    name: 'Super Mario + Angry Birds',
    folder: 'super-mario',
    file: 'index.html',
    icon: '🍄',
    tags: ['platform', 'physics'],
    description:
      'Classic Super Mario Bros platforming enhanced with real-time Matter.js destructible wooden structures and pig targets.',
    controls: 'Arrow keys to move · X to jump · Z to run · Push and climb wooden physics towers',
    banner: './game-art/cat-game/banner.svg',
    views: 0
  },
  {
    id: 'rocket-league',
    name: 'Rocket League 3D',
    folder: 'rocket-league',
    file: 'index.html',
    icon: '⚽',
    tags: ['sports', '3d', 'multiplayer'],
    description:
      'High-velocity 3D rocket car soccer. Features dynamic ball physics, boosting, jumps, aerial acrobatics, and room lobbies.',
    controls: 'WASD drive · Shift boost · Space jump/flip · R reset · C camera',
    banner: './game-art/royale/banner.svg',
    views: 0
  },
  {
    id: 'race',
    name: 'Race: Open World Horizon',
    folder: 'race',
    file: 'index.html',
    icon: '🏁',
    tags: ['racing', '3d'],
    description:
      'Realistic 3D driving across diverse maps including Forest Highway, Sakura Road, Coastal Vista, and Horizon Island.',
    controls: 'WASD to drive · Space handbrake · Shift boost · C switch camera · R reset car · M change map',
    banner: './game-art/royale/banner.svg',
    photos: ['./pics/IMG_0455.jpeg', './pics/IMG_0457.jpeg'],
    views: 0
  },
  {
    id: 'storm-chaser',
    name: 'Storm Chaser 3D',
    folder: 'storm-chaser',
    file: 'index.html',
    icon: '⛈️',
    tags: ['action', '3d'],
    description:
      'Drive a reinforced chase truck into tornadic supercells, intercept lightning bolts for score multipliers, and manage fuel.',
    controls: 'WASD / Arrows to drive · Touch D-pad supported · Camera toggle in HUD',
    banner: './game-art/storm-chaser/banner.svg',
    views: 0
  },
  {
    id: 'world-explorer',
    name: 'World Explorer',
    folder: 'world-explorer',
    file: 'index.html',
    icon: '🚀',
    tags: ['3d', 'explore'],
    isNew: true,
    description:
      'Piloting a spacecraft around real satellite Earth. Explore cities, mountain ranges, and oceans in true 3D orbital space.',
    controls: 'W/S thrust · A/D yaw · Up/Down pitch · Q/E roll · Space boost · R reset',
    banner: './game-art/live-earth/banner.svg',
    views: 0
  },
  {
    id: 'chess',
    name: 'Chess: Clash & Stockfish',
    folder: 'chess',
    file: 'index.html',
    icon: '♟️',
    tags: ['strategy', 'multiplayer'],
    description:
      'Master chess with Stockfish AI evaluation, tactical puzzle mode, real-time multiplayer, and innovative Clash Elixir Spells.',
    controls: 'Click piece to select square · Click destination · Spell buttons to freeze or rage pieces',
    banner: './game-art/royale/banner.svg',
    views: 0
  },
  {
    id: 'uno',
    name: 'UNO Multiplayer',
    folder: 'uno',
    file: 'index.html',
    icon: '🃏',
    tags: ['card', 'multiplayer'],
    description:
      'Authentic multiplayer UNO table with full rules: Skips, Reverses, Draw Twos, Wild Draw Fours, and calling UNO before your last card.',
    controls: 'Click matching color or number · Click Draw pile if no match · Hit UNO button with 1 card left',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'gartic',
    name: 'Gartic Phone',
    folder: 'gartic',
    file: 'index.html',
    icon: '✏️',
    tags: ['multiplayer', 'draw'],
    description:
      'Write secret sentences, draw what you see, and describe what was drawn. Experience hilarious chain evolutions in the Museum.',
    controls: 'Mouse / stylus to draw · Color palette and brush sizes in toolbar · Keyboard to write descriptions',
    banner: './game-art/garticphone/banner.svg',
    views: 0
  },
  {
    id: 'forsaken-prototype',
    name: 'Forsaken Prototype',
    folder: 'Forsaken-Prototype',
    file: 'index.html',
    icon: '💀',
    tags: ['action', 'horror', '3d'],
    description:
      'Asymmetrical multiplayer survival horror. Survivors fix 5 generators and escape; the Killer builds Malice and hunts them down.',
    controls: 'WASD move · Shift sprint · E interact/repair · Q/F abilities · Space QTE checks',
    banner: './game-art/werewolf/banner.svg',
    views: 0
  },
  {
    id: 'shenanigans',
    name: 'Vessel: Training Grounds 3D',
    folder: 'Shenanigans',
    file: 'index.html',
    icon: '⚔️',
    tags: ['action', '3d'],
    description:
      'High-speed anime martial combat simulator. String together punches, mid-air down slams, uppercuts, and unleash Domain Expansion.',
    controls: 'WASD move · Mouse look · Space double jump · Left Click M1 punch · 1-4 skills · F block · G awaken',
    banner: './game-art/werewolf/banner.svg',
    views: 0
  },
  {
    id: 'fishing',
    name: 'Fishing Open Water',
    folder: 'fishing',
    file: 'index.html',
    icon: '🎣',
    tags: ['3d', 'explore'],
    description:
      'Sail a small boat into open waters, read the nautical chart, cast your fishing line, reel in rare fish, and sell your catch.',
    controls: 'WASD steer boat · Mouse drag look · E interact · F cast & reel line',
    banner: './game-art/live-earth/banner.svg',
    views: 0
  },
  {
    id: 'angry-birds',
    name: 'Angry Birds',
    folder: 'angry-birds',
    file: 'index.html',
    icon: '🐦',
    tags: ['arcade', 'physics'],
    description:
      'Procedural physics demolition. Pull back on the slingshot, adjust trajectory angle and power, and topple pig fortifications.',
    controls: 'Drag mouse / touch from slingshot to aim · Release to fire',
    banner: './game-art/cat-game/banner.svg',
    views: 0
  },
  {
    id: 'blackjack',
    name: 'Blackjack Table',
    folder: 'blackjack',
    file: 'index.html',
    icon: '🂡',
    tags: ['card', 'multiplayer'],
    description:
      'Multiplayer casino table with green felt, chip stacks, dealer AI, Hit, Stand, and Double Down options.',
    controls: 'Buttons on table: Hit, Stand, Double, Deal',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'cat-game',
    name: 'Cat Game',
    folder: 'cat-game',
    file: 'catUP.html',
    icon: '🐱',
    tags: ['fun', 'arcade'],
    description: 'Guide the nimble cat leaping higher and higher across cloud platforms while collecting fish treats.',
    controls: 'Arrow keys / A & D to bounce left and right',
    banner: './game-art/cat-game/banner.svg',
    views: 0
  },
  {
    id: 'voxel-world',
    name: 'Voxel World',
    folder: 'voxel-world',
    file: 'index.html',
    icon: '🧱',
    tags: ['3d', 'multiplayer'],
    description:
      '3D procedural voxel block world. Mine terrain, select building materials from the hotbar, and craft structures.',
    controls: 'WASD move · Mouse look · Left click mine · Right click place · Number keys 1-9 hotbar',
    banner: './game-art/live-earth/banner.svg',
    views: 0
  },
  {
    id: 'walking-game',
    name: 'Walking Game: Alive City',
    folder: 'walking-game',
    file: 'index.html',
    icon: '🚶',
    tags: ['3d', 'explore'],
    description:
      'Step into a living third-person 3D city simulator. Features day-to-night lighting, roaming pedestrians, cars, and parks.',
    controls: 'WASD walk · Mouse look orbit · Shift sprint · C camera angle · Space jump · F sit on benches',
    banner: './game-art/live-earth/banner.svg',
    views: 0
  },
  {
    id: 'determination',
    name: 'Determination',
    folder: 'determination',
    file: 'index.html',
    icon: '❤️',
    tags: ['rpg', 'story'],
    description:
      'Undertale homage featuring overworld exploration and bullet-hell soul dodging battle mechanics against the Training Dummy.',
    controls: 'Arrow keys to move soul in battle box · Z/Enter select · X cancel',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'slither-io',
    name: 'SlitherIO',
    folder: 'slitherIO',
    file: 'index.html',
    icon: '🪱',
    tags: ['arcade', 'multiplayer'],
    description:
      'Slither across the arena, ingest glowing food particles, grow your snake body, and trap competitors into collision.',
    controls: 'Mouse cursor guides direction · Hold left click or Space to boost speed',
    banner: './game-art/slitherIO/banner.svg',
    views: 0
  },
  {
    id: 'snake',
    name: 'Snake Classic',
    folder: null,
    file: 'snake.html',
    icon: '🐍',
    tags: ['arcade', 'classic'],
    description: 'The definitive retro arcade snake experience with smooth 60fps movement and difficulty curves.',
    controls: 'Arrow keys or WASD to navigate',
    banner: './game-art/snake/banner.svg',
    views: 0
  },
  {
    id: 'royale',
    name: 'Royale 2D',
    folder: null,
    file: 'royale.html',
    icon: '👑',
    tags: ['battle', 'action'],
    description: 'Fast-paced top-down battle royale deathmatch. Loot weapons, stay inside the shrinking zone, and be #1.',
    controls: 'WASD move · Mouse aim and shoot',
    banner: './game-art/royale/banner.svg',
    views: 0
  },
  {
    id: 'werewolf',
    name: 'Werewolf Online',
    folder: null,
    file: 'werewolf.html',
    icon: '🐺',
    tags: ['multiplayer', 'party'],
    description: 'Classic party deduction game: Villagers must uncover and vote out the hidden Werewolves before dawn.',
    controls: 'Mouse click / touch to vote and interact with role cards',
    banner: './game-art/werewolf/banner.svg',
    views: 0
  },
  {
    id: 'live-earth',
    name: 'Live Earth 3D',
    folder: 'live-earth',
    file: 'index.html',
    icon: '🌍',
    tags: ['3d', 'explore'],
    description:
      'Interactive geospatial globe featuring real-time flight tracking, weather radar clouds, seismic activity, and city lights.',
    controls: 'Left drag orbit · Right drag tilt · Scroll zoom · Search bar to fly to cities',
    banner: './game-art/live-earth/banner.svg',
    views: 0
  },
  {
    id: 'character-inspector',
    name: 'Cube People 3D',
    folder: 'character-inspector',
    file: 'index.html',
    icon: '🏃',
    tags: ['3d', 'explore'],
    description:
      'Interactive 3D procedural character physics demo with walking animations, sunny dynamic skies, and bouncing ragdoll models.',
    controls: 'Mouse drag orbit · Scroll zoom · Buttons to add/clear people',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'mesh-view',
    name: 'Mesh View',
    folder: 'mesh-view',
    file: 'index.html',
    icon: '🔷',
    tags: ['3d', 'physics'],
    description:
      'A 2D planar creature trapped on the curved surface of 3D polygonal geometries with dual 2D raycast / 3D camera viewpoints.',
    controls: 'Left/Right arrows turn · Up/Down walk along curved 3D mesh surface',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'graph-sounds',
    name: 'Audio-to-Graph Replicator',
    folder: 'GraphSounds',
    file: 'index.html',
    icon: '📈',
    tags: ['utility'],
    description:
      'Upload audio files or enter mathematical expressions like Math.sin(x * 50) to transform mathematical curves into sound synthesis.',
    controls: 'Type mathematical formula · Click Play Math Graph to listen to the waveform',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'tiktok-sim',
    name: 'TikTok Feed Simulator',
    folder: 'TikTok',
    file: 'index.html',
    icon: '📱',
    tags: ['fun', 'utility'],
    description:
      'Faithful recreation of vertical mobile video feeds with interactive likes, comments, bookmarking, and custom profile editing.',
    controls: 'Scroll feed · Tap heart to like · Tap comments to reply',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'gradess',
    name: 'Gradess Student Portal',
    folder: 'gradess',
    file: 'login.html',
    icon: '📚',
    tags: ['utility'],
    description:
      'Student educational portal simulator showcasing report cards, grade averages, attendance tracking, and schedules.',
    controls: 'Enter student credentials or click demo login',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'win-screens',
    name: 'Windows First Logon Animation Explorer',
    folder: 'winScreens',
    file: 'index.html',
    icon: '🪟',
    tags: ['utility', 'fun'],
    description:
      'Interactive emulator and deep technical breakdown of the Windows OOBE FirstLogonAnim system (swiping gestures and color cycling).',
    controls: 'Mouse/touch gesture simulator · Speed and theme controls',
    banner: './game-art/heads/banner.svg',
    views: 0
  },
  {
    id: 'basket-random',
    name: 'Basket Random',
    folder: 'NotByMe',
    file: 'basket-random.html',
    icon: '🏀',
    tags: ['arcade', 'sports'],
    notByMe: true,
    description: 'Wobbly 2-player ragdoll basketball. One button controls jumping and shooting as court conditions randomly alter.',
    controls: 'Up Arrow / W to jump and throw ball',
    banner: './game-art/royale/banner.svg',
    views: 0
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'v7-react',
    title: 'Game Hub v7.0: Modernized React & Vite Architecture',
    date: 'Today',
    version: 'v7.0.0',
    tag: 'Major Update',
    badge: 'NEW',
    content:
      'Game Hub has been rewritten from the ground up as a high-performance React application! Enjoy seamless in-hub gameplay, enhanced rigid-body physics, atmosphere themes, and an AI Game Guide.'
  },
  {
    id: 'matrix-mode',
    title: '3D Matrix Void & First-Person Terminal',
    date: 'Recently',
    version: 'v6.8.0',
    tag: 'Feature',
    content:
      'Press the backtick (`) key anytime to enter the 3D Neon Void terminal. Step into a retro workstation suspended in infinite space.'
  },
  {
    id: 'rigid-physics',
    title: 'Active Rigid-Body 2D Cube Collisions',
    date: 'October 2026',
    version: 'v6.5.0',
    tag: 'Physics',
    content:
      'Background cubes now feature true continuous gravity falling, impulse restitution, rotational velocity, friction, and mouse-flinging physics. Open Options to shake and fling!'
  },
  {
    id: 'featured-showcase',
    title: 'Enhanced Game Showcase & Community Submissions',
    date: 'October 2026',
    version: 'v6.2.0',
    tag: 'Library',
    content:
      'Expanded library with 30+ playable 2D and 3D titles, detailed controls instructions, and in-hub modal iframe player support.'
  }
];

export const CHANGELOGS: ChangelogItem[] = [
  {
    version: '7.0.0',
    date: '2026-11-02',
    title: 'Full React Architecture Rewrite',
    details: [
      'Rewritten as a clean React + TypeScript + Tailwind application',
      'Unified Game Detail and Embedded Modal Player for all 30+ games',
      'Continuous background gravity falling cubes with full interactive flinging',
      'Real play counts tracked without artificial metrics',
      'Cinematic loading transition with rotating GH icon to hero title',
      'Top search quick jump line with instant smooth scroll and highlight',
      'Mobile-optimized touch navigation and responsive layouts'
    ]
  },
  {
    version: '6.8.1',
    date: '2026-10-24',
    title: 'Restored full games grid + 3D Matrix Screen',
    details: [
      '3D infinite void perspective camera zoom',
      'First-person terminal desk with neon grid',
      'Quick shortcut toggle via backtick key'
    ]
  },
  {
    version: '6.8.0',
    date: '2026-10-22',
    title: 'Active 2D rigid-body cube physics + dynamic time themes',
    details: [
      'Active drag and fling rigid-body impulse solver',
      'Seasonal themes: Halloween, Winter, Spring, Summer, Autumn, Christmas',
      'Time-of-day palettes for Dawn, Daylight, Dusk, and Midnight'
    ]
  },
  {
    version: '6.7.1',
    date: '2026-10-21',
    title: 'Persistent game cache + Featured views counter',
    details: [
      'Live view count tracking across all games',
      'Popularity ranking filter in catalog',
      'Category badges for 3D, Horror, Multiplayer, and Racing'
    ]
  }
];
