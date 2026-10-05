const SUPABASE_URL = 'https://lvdbmnkezmdofyllusob.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SfzyGGmjT4ZkbfSAxbjvJg_qH1aImPQ';

function dbg(msg, type='info') {
  const log = document.getElementById('debug-log');
  if (!log) return;
  const el = document.createElement('div');
  el.className = 'log-' + type;
  el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}
window.onerror = (m,_,l) => { dbg('ERR: '+m+' L'+l, 'error'); return false; };
document.getElementById('clear-debug')?.addEventListener('click', () => document.getElementById('debug-log').innerHTML = '');

let sb;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); dbg('Supabase OK'); }
catch(e) { dbg(e.message, 'error'); }

let currentUser=null, currentProfile=null, viewingProfile=null;
let videos=[], currentVideoIndex=0, selectedFile=null, selectedAvatar=null;
let myLikes=new Set(), myBookmarks=new Set(), myFollows=new Set();
let profileVideosCache=[];

function setPfp(el, name, url) {
  if (!el) return;
  if (url) { el.innerHTML = '<img src="'+url+'" alt="">'; el.style.background='transparent'; }
  else {
    const letter = (name||'?')[0].toUpperCase();
    const colors = ['#fe2c55','#25f4ee','#7c3aed','#f59e0b','#10b981','#3b82f6'];
    el.innerHTML = letter;
    el.style.background = colors[letter.charCodeAt(0)%colors.length];
  }
}
function pfpHTML(name, url, sizeClass='') {
  if (url) return '<img src="'+url+'" class="pfp '+sizeClass+'" alt="">';
  const letter = (name||'?')[0].toUpperCase();
  const colors = ['#fe2c55','#25f4ee','#7c3aed','#f59e0b','#10b981','#3b82f6'];
  const c = colors[letter.charCodeAt(0)%colors.length];
  return '<div class="pfp '+sizeClass+'" style="background:'+c+'">'+letter+'</div>';
}
function formatCount(n) {
  if (!n) return '0';
  if (n>=1e6) return (n/1e6).toFixed(1)+'M';
  if (n>=1e3) return (n/1e3).toFixed(1)+'K';
  return ''+n;
}

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab+'-form').classList.add('active');
  document.getElementById('auth-error').textContent='';
}));

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  dbg('Login '+email);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById('auth-error').textContent=error.message; dbg(error.message,'error'); return; }
  await onAuth(data.user);
});

document.getElementById('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  if (username.length<3) { document.getElementById('auth-error').textContent='Username min 3 chars'; return; }
  dbg('Signup '+username);
  const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ username, name } } });
  if (error) { document.getElementById('auth-error').textContent=error.message; dbg(error.message,'error'); return; }
  if (data.user) {
    await sb.from('profiles').upsert({ id:data.user.id, username, name, bio:'', following:0, followers:0, likes:0 });
  }
  document.getElementById('auth-error').textContent='Account created! Log in.';
  document.querySelector('[data-tab=login]').click();
});

async function onAuth(user) {
  currentUser = user;
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app').classList.add('active');
  dbg('Logged in '+user.email);

  let { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    const username = user.user_metadata?.username || user.email.split('@')[0];
    const name = user.user_metadata?.name || username;
    await sb.from('profiles').upsert({ id:user.id, username, name, bio:'', following:0, followers:0, likes:0 });
    profile = { id:user.id, username, name, bio:'', following:0, followers:0, likes:0 };
  }
  currentProfile = profile;
  viewingProfile = null;
  showOwnProfile();
  await loadMyInteractions();
  await loadVideos();
  loadUserVideos(user.id);
}

async function loadMyInteractions() {
  if (!currentUser) return;
  try {
    const { data: likes } = await sb.from('video_likes').select('video_id').eq('user_id', currentUser.id);
    myLikes = new Set((likes||[]).map(x=>x.video_id));
    const { data: bms } = await sb.from('video_bookmarks').select('video_id').eq('user_id', currentUser.id);
    myBookmarks = new Set((bms||[]).map(x=>x.video_id));
    const { data: follows } = await sb.from('follows').select('following_id').eq('follower_id', currentUser.id);
    myFollows = new Set((follows||[]).map(x=>x.following_id));
  } catch(e) { dbg('interactions: '+e.message, 'warn'); }
}

function showOwnProfile() {
  viewingProfile = null;
  document.getElementById('back-from-profile').style.display = 'none';
  document.getElementById('logout-btn').style.display = '';
  document.getElementById('edit-profile-btn').style.display = '';
  document.getElementById('follow-btn').style.display = 'none';
  updateProfileUI(currentProfile);
  loadUserVideos(currentUser.id);
}

function updateProfileUI(p) {
  if (!p) return;
  document.getElementById('profile-username').textContent = '@'+(p.username||'user');
  document.getElementById('profile-name').textContent = p.name || '';
  document.getElementById('profile-bio').textContent = p.bio || '';
  document.getElementById('following-count').textContent = p.following||0;
  document.getElementById('followers-count').textContent = p.followers||0;
  document.getElementById('likes-count').textContent = p.likes||0;
  setPfp(document.getElementById('profile-pfp'), p.username, p.avatar_url);
}

(async()=>{
  if (!sb) return;
  const { data:{ session } } = await sb.auth.getSession();
  if (session) await onAuth(session.user);
})();

document.getElementById('logout-btn').addEventListener('click', async()=>{
  await sb.auth.signOut();
  currentUser=null; currentProfile=null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
});

document.querySelectorAll('.nav-btn[data-page]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const page = btn.dataset.page;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    if (page==='feed') { document.getElementById('feed-screen').classList.add('active'); loadVideos(); }
    else if (page==='inbox') document.getElementById('inbox-screen').classList.add('active');
    else if (page==='profile') { document.getElementById('profile-screen').classList.add('active'); showOwnProfile(); }
    else if (page==='friends') {
      document.getElementById('feed-screen').classList.add('active');
      document.querySelector('[data-page=feed]').classList.add('active');
    }
  });
});

// Create
document.querySelector('.create-btn').addEventListener('click', ()=>document.getElementById('create-modal').classList.add('active'));
document.getElementById('close-modal').addEventListener('click', ()=>{
  document.getElementById('create-modal').classList.remove('active');
  selectedFile=null; document.getElementById('file-label-text').textContent='Choose video file';
});
document.getElementById('new-video-file').addEventListener('change', e=>{
  selectedFile=e.target.files[0]||null;
  document.getElementById('file-label-text').textContent=selectedFile?selectedFile.name:'Choose video file';
});
document.getElementById('post-video-btn').addEventListener('click', async()=>{
  const caption=document.getElementById('new-caption').value.trim();
  if (!caption||!selectedFile) { alert('Caption + video required'); return; }
  const btn=document.getElementById('post-video-btn');
  btn.textContent='Uploading...'; btn.disabled=true;
  try {
    const ext=selectedFile.name.split('.').pop()||'mp4';
    const path=currentUser.id+'/'+Date.now()+'.'+ext;
    const { error:upErr }=await sb.storage.from('videos').upload(path, selectedFile, { contentType:selectedFile.type });
    if (upErr) throw upErr;
    const { data:urlData }=sb.storage.from('videos').getPublicUrl(path);
    const { error:insErr }=await sb.from('videos').insert({
      user_id:currentUser.id, caption, video_url:urlData.publicUrl, likes:0, comments:0, bookmarks:0, shares:0
    });
    if (insErr) throw insErr;
    document.getElementById('create-modal').classList.remove('active');
    document.getElementById('new-caption').value='';
    selectedFile=null; document.getElementById('file-label-text').textContent='Choose video file';
    await loadVideos(); loadUserVideos(currentUser.id);
    dbg('Posted');
  } catch(err) { dbg(err.message,'error'); alert(err.message); }
  btn.textContent='Post'; btn.disabled=false;
});

// Edit profile
document.getElementById('edit-profile-btn').addEventListener('click', ()=>{
  document.getElementById('edit-name').value=currentProfile?.name||'';
  document.getElementById('edit-username').value=currentProfile?.username||'';
  document.getElementById('edit-bio').value=currentProfile?.bio||'';
  setPfp(document.getElementById('edit-pfp-preview'), currentProfile?.username, currentProfile?.avatar_url);
  selectedAvatar=null;
  document.getElementById('edit-modal').classList.add('active');
});
document.getElementById('close-edit-modal').addEventListener('click', ()=>document.getElementById('edit-modal').classList.remove('active'));
document.getElementById('edit-avatar-file').addEventListener('change', e=>{
  selectedAvatar=e.target.files[0]||null;
  if (selectedAvatar) {
    const url=URL.createObjectURL(selectedAvatar);
    document.getElementById('edit-pfp-preview').innerHTML='<img src="'+url+'" alt="">';
  }
});
document.getElementById('save-profile-btn').addEventListener('click', async()=>{
  const name=document.getElementById('edit-name').value.trim();
  const username=document.getElementById('edit-username').value.trim();
  const bio=document.getElementById('edit-bio').value.trim();
  if (!username||username.length<3) { alert('Username min 3 chars'); return; }
  let avatar_url=currentProfile?.avatar_url||null;
  if (selectedAvatar) {
    const ext=selectedAvatar.name.split('.').pop()||'jpg';
    const path=currentUser.id+'/avatar.'+ext;
    await sb.storage.from('videos').upload(path, selectedAvatar, { contentType:selectedAvatar.type, upsert:true });
    const { data }=sb.storage.from('videos').getPublicUrl(path);
    avatar_url=data.publicUrl+'?t='+Date.now();
  }
  const { error }=await sb.from('profiles').update({ name, username, bio, avatar_url }).eq('id', currentUser.id);
  if (error) { alert(error.message); return; }
  currentProfile={...currentProfile, name, username, bio, avatar_url};
  updateProfileUI(currentProfile);
  document.getElementById('edit-modal').classList.remove('active');
  dbg('Profile saved');
});

// FIXED: Load videos without relying on FK join
async function loadVideos() {
  dbg('Loading feed...');
  const { data, error } = await sb.from('videos').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) {
    dbg('Feed error: '+error.message, 'error');
    videos = [];
    renderFeed();
    return;
  }
  if (!data || !data.length) {
    dbg('No videos in DB');
    videos = [];
    renderFeed();
    return;
  }
  dbg('Got '+data.length+' videos');

  // Fetch profiles for those user_ids
  const userIds = [...new Set(data.map(v => v.user_id).filter(Boolean))];
  let profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id,username,name,avatar_url').in('id', userIds);
    (profiles||[]).forEach(p => { profileMap[p.id] = p; });
  }

  videos = data.map(v => {
    const p = profileMap[v.user_id] || {};
    return {
      id: v.id,
      user_id: v.user_id,
      username: p.username || 'user',
      name: p.name || '',
      avatar_url: p.avatar_url || null,
      caption: v.caption || '',
      video_url: v.video_url,
      likes: v.likes || 0,
      comments: v.comments || 0,
      bookmarks: v.bookmarks || 0,
      shares: v.shares || 0
    };
  });
  renderFeed();
}

function renderFeed() {
  const feed = document.getElementById('video-feed');
  feed.innerHTML = '';
  if (!videos.length) {
    feed.innerHTML = '<div class="no-videos">No videos available<br><small>Tap + to post</small></div>';
    return;
  }
  videos.forEach((v, i) => {
    const div = document.createElement('div');
    div.className = 'video-item' + (i === 0 ? ' active' : '');
    if (v.video_url) {
      div.innerHTML = '<video src="'+v.video_url+'" loop muted playsinline></video>';
    } else {
      div.innerHTML = '<div class="no-videos">No video</div>';
    }
    feed.appendChild(div);
  });
  currentVideoIndex = 0;
  updateSide();
  playCurrent();
}

function updateSide() {
  const v = videos[currentVideoIndex];
  if (!v) return;
  document.getElementById('like-count').textContent = formatCount(v.likes);
  document.getElementById('comment-count').textContent = formatCount(v.comments);
  document.getElementById('bookmark-count').textContent = formatCount(v.bookmarks);
  document.getElementById('share-count').textContent = formatCount(v.shares);
  document.getElementById('video-username').textContent = '@' + v.username;
  document.getElementById('video-caption').textContent = v.caption;
  setPfp(document.getElementById('creator-pfp'), v.username, v.avatar_url);

  const likeBtn = document.querySelector('[data-action=like]');
  const bmBtn = document.querySelector('[data-action=bookmark]');
  if (likeBtn) likeBtn.classList.toggle('active', myLikes.has(v.id));
  if (bmBtn) bmBtn.classList.toggle('active', myBookmarks.has(v.id));

  const plus = document.getElementById('follow-plus');
  if (v.user_id === currentUser?.id) plus.style.display = 'none';
  else { plus.style.display = ''; plus.textContent = myFollows.has(v.user_id) ? '\u2713' : '+'; }
}

function playCurrent() {
  document.querySelectorAll('.video-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentVideoIndex);
    const vid = el.querySelector('video');
    if (vid) {
      if (i === currentVideoIndex) vid.play().catch(() => {});
      else vid.pause();
    }
  });
  updateSide();
}

let touchY = 0;
document.getElementById('video-feed').addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
document.getElementById('video-feed').addEventListener('touchend', e => {
  const dy = e.changedTouches[0].clientY - touchY;
  if (dy < -50 && currentVideoIndex < videos.length - 1) { currentVideoIndex++; playCurrent(); }
  else if (dy > 50 && currentVideoIndex > 0) { currentVideoIndex--; playCurrent(); }
}, { passive: true });

// Actions
document.querySelectorAll('.action').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const v = videos[currentVideoIndex];
    if (!v || !v.id || !currentUser) return;

    if (action === 'like') {
      if (myLikes.has(v.id)) {
        myLikes.delete(v.id); v.likes = Math.max(0, v.likes - 1);
        await sb.from('video_likes').delete().eq('user_id', currentUser.id).eq('video_id', v.id);
      } else {
        myLikes.add(v.id); v.likes++;
        await sb.from('video_likes').upsert({ user_id: currentUser.id, video_id: v.id });
      }
      await sb.from('videos').update({ likes: v.likes }).eq('id', v.id);
      updateSide();
    } else if (action === 'bookmark') {
      if (myBookmarks.has(v.id)) {
        myBookmarks.delete(v.id); v.bookmarks = Math.max(0, v.bookmarks - 1);
        await sb.from('video_bookmarks').delete().eq('user_id', currentUser.id).eq('video_id', v.id);
      } else {
        myBookmarks.add(v.id); v.bookmarks++;
        await sb.from('video_bookmarks').upsert({ user_id: currentUser.id, video_id: v.id });
      }
      await sb.from('videos').update({ bookmarks: v.bookmarks }).eq('id', v.id);
      updateSide();
    } else if (action === 'share') {
      v.shares++;
      await sb.from('videos').update({ shares: v.shares }).eq('id', v.id);
      updateSide();
      if (navigator.share) navigator.share({ title: v.caption, url: v.video_url }).catch(() => {});
    } else if (action === 'comment') {
      openComments(v);
    }
  });
});

document.getElementById('creator-avatar-btn').addEventListener('click', () => {
  const v = videos[currentVideoIndex];
  if (v) openUserProfile(v.user_id);
});
document.getElementById('video-username').addEventListener('click', () => {
  const v = videos[currentVideoIndex];
  if (v) openUserProfile(v.user_id);
});
document.getElementById('follow-plus').addEventListener('click', async e => {
  e.stopPropagation();
  const v = videos[currentVideoIndex];
  if (!v || v.user_id === currentUser.id) return;
  await toggleFollow(v.user_id);
  updateSide();
});

async function toggleFollow(userId) {
  if (myFollows.has(userId)) {
    myFollows.delete(userId);
    await sb.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId);
  } else {
    myFollows.add(userId);
    await sb.from('follows').upsert({ follower_id: currentUser.id, following_id: userId });
  }
}

async function openUserProfile(userId) {
  if (userId === currentUser.id) {
    document.querySelector('[data-page=profile]').click();
    return;
  }
  const { data: p } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (!p) return;
  viewingProfile = p;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
  document.getElementById('profile-screen').classList.add('active');
  document.getElementById('back-from-profile').style.display = '';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('edit-profile-btn').style.display = 'none';
  const fb = document.getElementById('follow-btn');
  fb.style.display = '';
  fb.textContent = myFollows.has(userId) ? 'Following' : 'Follow';
  fb.classList.toggle('following', myFollows.has(userId));
  updateProfileUI(p);
  loadUserVideos(userId);
}

document.getElementById('back-from-profile').addEventListener('click', () => {
  document.querySelector('[data-page=feed]').click();
});

document.getElementById('follow-btn').addEventListener('click', async () => {
  if (!viewingProfile) return;
  await toggleFollow(viewingProfile.id);
  const fb = document.getElementById('follow-btn');
  fb.textContent = myFollows.has(viewingProfile.id) ? 'Following' : 'Follow';
  fb.classList.toggle('following', myFollows.has(viewingProfile.id));
});

// Comments
function openComments(v) {
  document.getElementById('comments-sheet').classList.add('open');
  document.getElementById('sheet-backdrop').classList.add('active');
  document.getElementById('comments-sheet').dataset.videoId = v.id;
  loadComments(v.id);
}
function closeComments() {
  document.getElementById('comments-sheet').classList.remove('open');
  document.getElementById('sheet-backdrop').classList.remove('active');
}
document.getElementById('close-comments').addEventListener('click', closeComments);
document.getElementById('sheet-backdrop').addEventListener('click', closeComments);

async function loadComments(videoId) {
  const list = document.getElementById('comments-list');
  list.innerHTML = 'Loading...';
  const { data } = await sb.from('comments').select('*').eq('video_id', videoId).order('created_at', { ascending: true });
  list.innerHTML = '';
  if (!data || !data.length) { list.innerHTML = '<div class="empty-msg">No comments yet</div>'; return; }

  const uids = [...new Set(data.map(c => c.user_id))];
  let pmap = {};
  if (uids.length) {
    const { data: ps } = await sb.from('profiles').select('id,username,avatar_url').in('id', uids);
    (ps||[]).forEach(p => { pmap[p.id] = p; });
  }

  data.forEach(c => {
    const p = pmap[c.user_id] || {};
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML =
      '<div data-uid="'+c.user_id+'">'+pfpHTML(p.username, p.avatar_url, 'sm')+'</div>' +
      '<div class="comment-body">' +
        '<div class="comment-user" data-uid="'+c.user_id+'">@'+(p.username||'user')+'</div>' +
        '<div class="comment-text">'+c.text+'</div>' +
        '<div class="comment-meta"><span class="reply-btn" data-cid="'+c.id+'">Reply</span></div>' +
        '<div class="reply-box" id="reply-'+c.id+'">' +
          '<input placeholder="Reply..."><button data-cid="'+c.id+'">Post</button>' +
        '</div>' +
      '</div>';
    list.appendChild(div);
  });

  list.querySelectorAll('[data-uid]').forEach(el => {
    el.addEventListener('click', () => openUserProfile(el.dataset.uid));
  });
  list.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('reply-'+btn.dataset.cid)?.classList.toggle('open');
    });
  });
  list.querySelectorAll('.reply-box button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = btn.parentElement.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      await sb.from('comments').insert({ video_id: videoId, user_id: currentUser.id, text: '\u21B3 '+text, parent_id: btn.dataset.cid });
      input.value = '';
      const v = videos.find(x => x.id === videoId);
      if (v) { v.comments++; await sb.from('videos').update({ comments: v.comments }).eq('id', videoId); updateSide(); }
      loadComments(videoId);
    });
  });
}

document.getElementById('send-comment').addEventListener('click', async () => {
  const text = document.getElementById('new-comment').value.trim();
  const videoId = document.getElementById('comments-sheet').dataset.videoId;
  if (!text || !videoId) return;
  const { error } = await sb.from('comments').insert({ video_id: videoId, user_id: currentUser.id, text });
  if (error) { alert(error.message); return; }
  document.getElementById('new-comment').value = '';
  const v = videos.find(x => x.id === videoId);
  if (v) { v.comments++; await sb.from('videos').update({ comments: v.comments }).eq('id', videoId); updateSide(); }
  loadComments(videoId);
});

// Profile videos — click to play, long-press / delete button for own videos
async function loadUserVideos(userId) {
  const grid = document.getElementById('user-videos');
  const { data } = await sb.from('videos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  profileVideosCache = data || [];
  grid.innerHTML = '';
  if (!data || !data.length) {
    grid.innerHTML = '<div class="thumb">No videos yet</div>';
    return;
  }
  const isOwn = userId === currentUser?.id;
  data.forEach((v, idx) => {
    const t = document.createElement('div');
    t.className = 'thumb';
    t.style.position = 'relative';
    t.style.cursor = 'pointer';
    if (v.video_url) {
      t.innerHTML = '<video src="'+v.video_url+'" muted></video>';
    }
    if (isOwn) {
      const del = document.createElement('button');
      del.textContent = 'X';
      del.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,.7);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:11px;z-index:2;';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this video?')) return;
        await sb.from('videos').delete().eq('id', v.id);
        dbg('Deleted video '+v.id);
        loadUserVideos(userId);
        loadVideos();
      });
      t.appendChild(del);
    }
    t.addEventListener('click', () => {
      // Open this video on the For You feed
      playProfileVideo(v);
    });
    grid.appendChild(t);
  });
}

async function playProfileVideo(v) {
  // Make sure this video is in the feed list, then jump to it
  let idx = videos.findIndex(x => x.id === v.id);
  if (idx < 0) {
    // Fetch profile info and prepend
    const { data: p } = await sb.from('profiles').select('username,name,avatar_url').eq('id', v.user_id).single();
    videos.unshift({
      id: v.id, user_id: v.user_id,
      username: p?.username || 'user', name: p?.name || '',
      avatar_url: p?.avatar_url || null,
      caption: v.caption || '', video_url: v.video_url,
      likes: v.likes || 0, comments: v.comments || 0,
      bookmarks: v.bookmarks || 0, shares: v.shares || 0
    });
    idx = 0;
    renderFeed();
  }
  currentVideoIndex = idx;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
  document.getElementById('feed-screen').classList.add('active');
  document.querySelector('[data-page=feed]').classList.add('active');
  playCurrent();
}
