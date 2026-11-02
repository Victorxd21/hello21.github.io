# Game Hub

A web arcade and game discovery portal built with **React 18**, **TypeScript**, **Tailwind CSS**, and **Vite**.

## Features

- **30+ Playable Games**: Explore and play 2D and 3D titles across action, racing, survival horror, multiplayer, physics, strategy, and retro categories.
- **Embedded Player & Modal Previews**: Play games directly within an embedded modal player or open full screen in new tabs.
- **Interactive 2D Rigid-Body Physics**: Header banner with physics cubes that collide, bounce, and can be flung with mouse and touch.
- **Seasonal & Time-of-Day Atmosphere**: Real-time atmospheric themes (Halloween, Winter, Spring, Summer, Autumn, Christmas) with weather particles (snow, cherry petals, fireflies, bats, leaves).
- **AI Game Guide**: Smart recommendation engine to match players with games based on preferences and mood.
- **3D Matrix Void**: Retro neon first-person terminal chamber powered by Three.js (press `` ` `` anytime to enter).
- **Options & Customization**: Cursor trail, party mode wiggles, sound effects, click confetti, FPS counter, and visual effects toggles.
- **What's New & Community Feedback**: Up-to-date release notes, bug reporting, and game request forms.

## Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + UI Kit design tokens
- **3D Graphics**: Three.js
- **Audio**: Web Audio API procedural synthesis

## Getting Started

```bash
npm install
npm run dev
```

The application runs on `http://localhost:3000`.

## GitHub Pages Deployment

This repository is configured to build and deploy to GitHub Pages without a white screen error:

1. **Option A: GitHub Actions (Recommended & Automatic)**
   - Go to your repository on GitHub: **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, choose **GitHub Actions**.
   - Push your code to `main` or `master`. The included `.github/workflows/deploy.yml` workflow will automatically compile Vite, run tests, and publish the site.

2. **Option B: Deploy from Branch (Root `/`)**
   - If your repository is set to **Deploy from a branch** -> `main` / `master` -> `/ (root)`, the root `index.html` has a built-in static loader that automatically loads the pre-compiled production bundle in `dist/assets/`, preventing the uncompiled TypeScript white screen.
   - Run `npm run build` before committing if you use this method so `dist/` is always up to date.

