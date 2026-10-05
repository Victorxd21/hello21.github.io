const SUPABASE_URL = 'https://lvdbmnkezmdofyllusob.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SfzyGGmjT4ZkbfSAxbjvJg_qH1aImPQ';

function dbg(msg, type = 'info') {
  const log = document.getElementById('debug-log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'log-' + type;
  line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
window.onerror = (msg, src, line) => { dbg('JS ERROR: ' + msg + ' (line ' + line + ')', 'error'); return false; };
window.addEventListener('unhandledrejection', e => dbg('Promise: ' + (e.reason?.message || e.reason), 'error'));
document.getElementById('clear-debug')?.addEventListener('click', () => { document.getElementById('debug-log').innerHTML = ''; });

dbg('App starting...');
let sb;
try {
  if (!window.supabase) dbg('Supabase lib missing!', 'error');
  else { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); dbg('Supabase OK'); }
} catch (e) { dbg('Client error: ' + e.message, 'error'); }

let currentUser = null, currentProfile = null, currentVideoIndex = 0, videos = [], selectedFile = null;

function letterAvatar(name) {
  const letter = (name || '?')[0].toUpperCase();
  const colors = ['#fe2c55','#25f4ee','#7c3aed','#f59e0b','#10b981','#3b82f6','#ec4899'];
  const color = colors[letter.charCodeAt(0) % colors.length];
  return { letter, color };
}

function setLetterEl(el, name) {
  if (!el) return;
  const { letter, color } = letterAvatar(name);
  el.textContent = letter;
  el.style.background = color;
}

function formatCount(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n || 0;
}

// DOM
const authScreen = document.getElementById('auth-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');
const videoFeed = document.getElementById('video-feed');
const createModal = document.getElementById('create-modal');
const editModal = document.getElementById('edit-modal');
const commentsModal = document.getElementById('comments-modal');

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
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  dbg('Login: ' + email);
  if (!sb) { authError.textContent = 'Supabase not ready'; return; }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { authError.textContent = error.message; dbg(error.message, 'error'); return; }
    dbg('Login success');
    await onAuthSuccess(data.user);
  } catch (err) { authError.textContent = err.message; dbg(err.message, 'error'); }
});

signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  authError.textContent = '';
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  dbg('Signup: ' + username);
  if (username.length < 3) { authError.textContent = 'Username min 3 chars'; return; }
  if (!sb) { authError.textContent = 'Supabase not ready'; return; }
  try {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) { authError.textContent = error.message; dbg(error.message, 'error'); return; }
    dbg('Signup OK: ' + (data.user?.id || 'none'));
    if (data.user) {
      const { error: pe } = await sb.from('profiles').upsert({
        id: data.user.id, username, bio: '', following: 0, followers: 0, likes: 0
      });
      if (pe) dbg('Profile: ' + pe.message, 'warn');
      else dbg('Profile created');
    }
    authError.textContent = 'Account created! Log in now.';
    document.querySelector('[data-tab="login"]').click();
  } catch (err) { authError.textContent = err.message; dbg(err.message, 'error'); }
});

async function onAuthSuccess(user) {
  currentUser = user;
  authScreen.classList.remove('active');
  app.classList.add('active');
  dbg('Logged in: ' + user.email);

  let { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    const username = user.user_metadata?.username || user.email.split('@')[0];
    await sb.from('profiles').upsert({ id: user.id, username, bio: '', following: 0, followers: 0, likes: 0 });
    profile = { username, bio: '', following: 0, followers: 0, likes: 0 };
  }
  currentProfile = profile;
  updateProfileUI(profile);
  await loadVideos();
  loadUserVideos();
}

function updateProfileUI(p) {
  document.getElementById('profile-username').textContent = '@' + (p.username || 'user');
  document.getElementById('profile-bio').textContent = p.bio || '';
  document.getElementById('following-count').textContent = p.following || 0;
  document.getElementById('followers-count').textContent = p.followers || 0;
  document.getElementById('likes-count').textContent = p.likes || 0;
  setLetterEl(document.getElementById('profile-letter'), p.username);
}

(async () => {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { dbg('Session found'); await onAuthSuccess(session.user); }
    else dbg('No session');
  } catch (e) { dbg('Session err: ' + e.message, 'error'); }
})();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  app.classList.remove('active');
  authScreen.classList.add('active');
  dbg('Logged out');
});

// Nav
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
      document.getElementById('feed-screen').classList.add('active');
      document.querySelector('[data-page="feed"]').classList.add('active');
    }
  });
});

// Create video
document.querySelector('.create-btn').addEventListener('click', () => createModal.classList.add('active'));
document.getElementById('close-modal').addEventListener('click', () => { createModal.classList.remove('active'); selectedFile = null; document.getElementById('file-label-text').textContent = 'Choose video file'; });

document.getElementById('new-video-file').addEventListener('change', e => {
  selectedFile = e.target.files[0] || null;
  document.getElementById('file-label-text').textContent = selectedFile ? selectedFile.name : 'Choose video file';
});

document.getElementById('post-video-btn').addEventListener('click', async () => {
  const caption = document.getElementById('new-caption').value.trim();
  if (!caption) { alert('Write a caption'); return; }
  if (!selectedFile) { alert('Choose a video file'); return; }
  if (!currentUser) { alert('Not logged in'); return; }

  dbg('Uploading video...');
  const btn = document.getElementById('post-video-btn');
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  try {
    const ext = selectedFile.name.split('.').pop() || 'mp4';
    const path = currentUser.id + '/' + Date.now() + '.' + ext;
    const { error: upErr } = await sb.storage.from('videos').upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = sb.storage.from('videos').getPublicUrl(path);
    const videoUrl = urlData.publicUrl;
    dbg('Upload OK: ' + videoUrl);

    const { error: insErr } = await sb.from('videos').insert({
      user_id: currentUser.id, caption, video_url: videoUrl, likes: 0, comments: 0, bookmarks: 0, shares: 0
    });
    if (insErr) throw insErr;

    createModal.classList.remove('active');
    document.getElementById('new-caption').value = '';
    selectedFile = null;
    document.getElementById('file-label-text').textContent = 'Choose video file';
    document.getElementById('new-video-file').value = '';
    await loadVideos();
    loadUserVideos();
    dbg('Posted!');
  } catch (err) {
    dbg('Post error: ' + err.message, 'error');
    alert('Error: ' + err.message + '\n\nMake sure Storage bucket "videos" exists and is public. See README.');
  }
  btn.textContent = 'Post';
  btn.disabled = false;
});

// Edit profile
document.getElementById('edit-profile-btn').addEventListener('click', () => {
  document.getElementById('edit-username').value = currentProfile?.username || '';
  document.getElementById('edit-bio').value = currentProfile?.bio || '';
  editModal.classList.add('active');
});
document.getElementById('close-edit-modal').addEventListener('click', () => editModal.classList.remove('active'));

document.getElementById('save-profile-btn').addEventListener('click', async () => {
  const username = document.getElementById('edit-username').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();
  if (!username || username.length < 3) { alert('Username min 3 chars'); return; }
  const { error } = await sb.from('profiles').update({ username, bio }).eq('id', currentUser.id);
  if (error) { alert(error.message); dbg(error.message, 'error'); return; }
  currentProfile = { ...currentProfile, username, bio };
  updateProfileUI(currentProfile);
  editModal.classList.remove('active');
  dbg('Profile saved');
});

// Load videos
async function loadVideos() {
  const { data, error } = await sb.from('videos').select('*, profiles(username)').order('created_at', { ascending: false }).limit(50);
  if (error) { dbg('Load videos: ' + error.message, 'warn'); videos = []; }
  else if (!data || data.length === 0) { videos = []; }
  else {
    videos = data.map(v => ({
      id: v.id,
      user_id: v.user_id,
      username: v.profiles?.username || 'user',
      caption: v.caption || '',
      video_url: v.video_url,
      likes: v.likes || 0,
      comments: v.comments || 0,
      bookmarks: v.bookmarks || 0,
      shares: v.shares || 0
    }));
  }
  renderFeed();
}

function renderFeed() {
  videoFeed.innerHTML = '';
  if (videos.length === 0) {
    videoFeed.innerHTML = '<div class="no-videos">No videos available<br><small>Tap + to post one</small></div>';
    document.getElementById('like-count').textContent = '0';
    document.getElementById('comment-count').textContent = '0';
    document.getElementById('bookmark-count').textContent = '0';
    document.getElementById('share-count').textContent = '0';
    document.getElementById('video-username').textContent = '';
    document.getElementById('video-caption').textContent = '';
    return;
  }
  videos.forEach((v, i) => {
    const div = document.createElement('div');
    div.className = 'video-item' + (i === 0 ? ' active' : '');
    div.dataset.index = i;
    if (v.video_url) div.innerHTML = `<video src="${v.video_url}" loop muted playsinline></video>`;
    else div.innerHTML = '<div class="no-videos">No video</div>';
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
  setLetterEl(document.getElementById('creator-letter'), v.username);
}

function playCurrent() {
  document.querySelectorAll('.video-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentVideoIndex);
    const vid = el.querySelector('video');
    if (vid) { if (i === currentVideoIndex) vid.play().catch(() => {}); else vid.pause(); }
  });
  updateSideActions();
}

let touchStartY = 0;
videoFeed.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
videoFeed.addEventListener('touchend', e => {
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (dy < -50 && currentVideoIndex < videos.length - 1) { currentVideoIndex++; playCurrent(); }
  else if (dy > 50 && currentVideoIndex > 0) { currentVideoIndex--; playCurrent(); }
}, { passive: true });

// Actions: like, bookmark, share, comment
document.querySelectorAll('.action').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const v = videos[currentVideoIndex];
    if (!v || !v.id) return;

    if (action === 'like') {
      v.likes++;
      document.getElementById('like-count').textContent = formatCount(v.likes);
      await sb.from('videos').update({ likes: v.likes }).eq('id', v.id);
    } else if (action === 'bookmark') {
      v.bookmarks++;
      document.getElementById('bookmark-count').textContent = formatCount(v.bookmarks);
      await sb.from('videos').update({ bookmarks: v.bookmarks }).eq('id', v.id);
    } else if (action === 'share') {
      v.shares++;
      document.getElementById('share-count').textContent = formatCount(v.shares);
      await sb.from('videos').update({ shares: v.shares }).eq('id', v.id);
      if (navigator.share) navigator.share({ title: v.caption, url: v.video_url }).catch(() => {});
    } else if (action === 'comment') {
      openComments(v);
    }
  });
});

// Comments
async function openComments(v) {
  commentsModal.classList.add('active');
  const list = document.getElementById('comments-list');
  list.innerHTML = 'Loading...';
  const { data } = await sb.from('comments').select('*, profiles(username)').eq('video_id', v.id).order('created_at', { ascending: true });
  list.innerHTML = '';
  if (!data || data.length === 0) list.innerHTML = '<div style="color:#666;padding:20px;text-align:center">No comments yet</div>';
  else data.forEach(c => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `<span class="c-user">@${c.profiles?.username || 'user'}</span><span class="c-text">${c.text}</span>`;
    list.appendChild(div);
  });
  commentsModal.dataset.videoId = v.id;
}

document.getElementById('close-comments').addEventListener('click', () => commentsModal.classList.remove('active'));

document.getElementById('send-comment').addEventListener('click', async () => {
  const text = document.getElementById('new-comment').value.trim();
  const videoId = commentsModal.dataset.videoId;
  if (!text || !videoId || !currentUser) return;
  const { error } = await sb.from('comments').insert({ video_id: videoId, user_id: currentUser.id, text });
  if (error) { dbg(error.message, 'error'); alert(error.message); return; }
  document.getElementById('new-comment').value = '';
  // bump comment count
  const v = videos.find(x => x.id === videoId);
  if (v) {
    v.comments++;
    document.getElementById('comment-count').textContent = formatCount(v.comments);
    await sb.from('videos').update({ comments: v.comments }).eq('id', videoId);
  }
  openComments(v || { id: videoId });
});

async function loadUserVideos() {
  if (!currentUser) return;
  const grid = document.getElementById('user-videos');
  const { data } = await sb.from('videos').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  grid.innerHTML = '';
  if (!data || data.length === 0) {
    grid.innerHTML = '<div class="thumb">No videos yet</div>';
    return;
  }
  data.forEach(v => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (v.video_url) thumb.innerHTML = `<video src="${v.video_url}" muted></video>`;
    else thumb.textContent = 'No video';
    grid.appendChild(thumb);
  });
}
