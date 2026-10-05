const SUPABASE_URL = 'https://lvdbmnkezmdofyllusob.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SfzyGGmjT4ZkbfSAxbjvJg_qH1aImPQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentVideoIndex = 0;
let videos = [];

// Sample fallback videos if no DB content
const SAMPLE_VIDEOS = [
  {
    id: '1',
    username: 'poppyplaytime',
    caption: 'The great work continues. You have peace in this work.',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    likes: 2458,
    comments: 159,
    bookmarks: 557,
    shares: 52,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=huggy'
  },
  {
    id: '2',
    username: 'gamingpro',
    caption: 'New high score 🔥 #gaming',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    likes: 1203,
    comments: 87,
    bookmarks: 210,
    shares: 34,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gamer'
  },
  {
    id: '3',
    username: 'naturevibes',
    caption: 'Sunset hits different 🌅',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    likes: 8920,
    comments: 412,
    bookmarks: 1800,
    shares: 290,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nature'
  }
];

// DOM
const authScreen = document.getElementById('auth-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');
const videoFeed = document.getElementById('video-feed');
const createModal = document.getElementById('create-modal');

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-form').classList.add('active');
    authError.textContent = '';
  });
});

// Auth
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authError.textContent = error.message;
    return;
  }
  await onAuthSuccess(data.user);
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  if (username.length < 3) {
    authError.textContent = 'Username must be at least 3 characters';
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });

  if (error) {
    authError.textContent = error.message;
    return;
  }

  // Create profile row
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      username,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: 'New to TikTok',
      following: 0,
      followers: 0,
      likes: 0
    });
  }

  authError.textContent = 'Check your email to confirm, or just log in if confirmation is disabled.';
  // Auto switch to login
  document.querySelector('[data-tab="login"]').click();
});

async function onAuthSuccess(user) {
  currentUser = user;
  authScreen.classList.remove('active');
  app.classList.add('active');

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile) {
    document.getElementById('profile-username').textContent = '@' + (profile.username || 'user');
    document.getElementById('profile-avatar').src = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;
    document.getElementById('profile-bio').textContent = profile.bio || 'he/him · Repost master';
    document.getElementById('following-count').textContent = profile.following || 0;
    document.getElementById('followers-count').textContent = profile.followers || 0;
    document.getElementById('likes-count').textContent = profile.likes || 0;
  } else {
    // Create default profile
    const username = user.user_metadata?.username || user.email.split('@')[0];
    await supabase.from('profiles').upsert({
      id: user.id,
      username,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: 'New to TikTok',
      following: 0,
      followers: 0,
      likes: 0
    });
    document.getElementById('profile-username').textContent = '@' + username;
  }

  await loadVideos();
  loadInbox();
  loadUserVideos();
}

// Check session on load
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await onAuthSuccess(session.user);
  }
})();

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentUser = null;
  app.classList.remove('active');
  authScreen.classList.add('active');
});

// Navigation
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (page === 'feed') document.getElementById('feed-screen').classList.add('active');
    else if (page === 'inbox') document.getElementById('inbox-screen').classList.add('active');
    else if (page === 'profile') document.getElementById('profile-screen').classList.add('active');
    else if (page === 'friends') {
      // simple redirect to feed for now
      document.getElementById('feed-screen').classList.add('active');
      document.querySelector('[data-page="feed"]').classList.add('active');
    }
  });
});

// Create button
document.querySelector('.create-btn').addEventListener('click', () => {
  createModal.classList.add('active');
});
document.getElementById('close-modal').addEventListener('click', () => {
  createModal.classList.remove('active');
});

document.getElementById('post-video-btn').addEventListener('click', async () => {
  const caption = document.getElementById('new-caption').value.trim();
  const videoUrl = document.getElementById('new-video-url').value.trim();
  if (!caption || !videoUrl) {
    alert('Please fill caption and video URL');
    return;
  }

  const { error } = await supabase.from('videos').insert({
    user_id: currentUser.id,
    caption,
    video_url: videoUrl,
    likes: 0,
    comments: 0,
    bookmarks: 0,
    shares: 0
  });

  if (error) {
    alert('Error posting: ' + error.message + '\n\nMake sure the videos table exists (see README).');
    return;
  }

  createModal.classList.remove('active');
  document.getElementById('new-caption').value = '';
  document.getElementById('new-video-url').value = '';
  await loadVideos();
  loadUserVideos();
  alert('Posted!');
});

// Load videos
async function loadVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('*, profiles(username, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    videos = SAMPLE_VIDEOS;
  } else {
    videos = data.map(v => ({
      id: v.id,
      username: v.profiles?.username || 'user',
      caption: v.caption,
      video_url: v.video_url,
      likes: v.likes || 0,
      comments: v.comments || 0,
      bookmarks: v.bookmarks || 0,
      shares: v.shares || 0,
      avatar: v.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${v.user_id}`
    }));
  }

  renderFeed();
}

function renderFeed() {
  videoFeed.innerHTML = '';
  videos.forEach((v, i) => {
    const div = document.createElement('div');
    div.className = 'video-item' + (i === 0 ? ' active' : '');
    div.dataset.index = i;

    if (v.video_url && (v.video_url.includes('.mp4') || v.video_url.includes('video'))) {
      div.innerHTML = `<video src="${v.video_url}" loop muted playsinline></video>`;
    } else {
      div.innerHTML = `<div class="placeholder">🎬</div>`;
    }
    videoFeed.appendChild(div);
  });

  currentVideoIndex = 0;
  updateSideActions();
  playCurrent();
}

function updateSideActions() {
  const v = videos[currentVideoIndex];
  if (!v) return;
  document.getElementById('like-count').textContent = formatCount(v.likes);
  document.getElementById('comment-count').textContent = formatCount(v.comments);
  document.getElementById('bookmark-count').textContent = formatCount(v.bookmarks);
  document.getElementById('share-count').textContent = formatCount(v.shares);
  document.getElementById('video-username').textContent = '@' + v.username;
  document.getElementById('video-caption').textContent = v.caption;
  document.getElementById('creator-avatar').querySelector('img').src = v.avatar;
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
}

function playCurrent() {
  document.querySelectorAll('.video-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentVideoIndex);
    const vid = el.querySelector('video');
    if (vid) {
      if (i === currentVideoIndex) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }
  });
  updateSideActions();
}

// Swipe / scroll between videos
let touchStartY = 0;
videoFeed.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

videoFeed.addEventListener('touchend', e => {
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (dy < -50 && currentVideoIndex < videos.length - 1) {
    currentVideoIndex++;
    playCurrent();
  } else if (dy > 50 && currentVideoIndex > 0) {
    currentVideoIndex--;
    playCurrent();
  }
}, { passive: true });

// Click actions
document.querySelectorAll('.action').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const v = videos[currentVideoIndex];
    if (!v) return;
    if (action === 'like') {
      v.likes++;
      document.getElementById('like-count').textContent = formatCount(v.likes);
      // optionally persist
      if (v.id && !isNaN(v.id)) {
        supabase.from('videos').update({ likes: v.likes }).eq('id', v.id);
      }
    }
  });
});

// Inbox mock
function loadInbox() {
  const list = document.getElementById('inbox-list');
  list.innerHTML = `
    <div class="inbox-item">
      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=act">
      <div class="info">
        <div class="name">Activity & new followers</div>
        <div class="msg">liked a photo you reposted.</div>
      </div>
      <span class="badge-count">16</span>
    </div>
    <div class="inbox-item">
      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=shop">
      <div class="info">
        <div class="name">TikTok Shop</div>
        <div class="msg">NUBWO DIRECT: ✨ Everyone...</div>
      </div>
      <span class="time">20m</span>
    </div>
    <div class="inbox-item">
      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=friend1">
      <div class="info">
        <div class="name">Friend1</div>
        <div class="msg">Active now</div>
      </div>
    </div>
  `;
  document.getElementById('inbox-badge').textContent = '21';
  document.getElementById('inbox-badge').classList.add('show');
}

// User videos
async function loadUserVideos() {
  if (!currentUser) return;
  const grid = document.getElementById('user-videos');
  const { data } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  grid.innerHTML = '';
  if (!data || data.length === 0) {
    grid.innerHTML = '<div class="thumb">No videos yet</div>';
    return;
  }
  data.forEach(v => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (v.video_url) {
      thumb.innerHTML = `<video src="${v.video_url}" muted></video>`;
    } else {
      thumb.textContent = '🎬';
    }
    grid.appendChild(thumb);
  });
}
