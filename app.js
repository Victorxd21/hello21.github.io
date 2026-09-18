import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "YOUR_GEMINI_API_KEY_HERE" });

const SUPABASE_URL = 'https://lusowdnrdgyisxosmbyj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c293ZG5yZGd5aXN4b3NtYnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzgxNTYsImV4cCI6MjA5MzE1NDE1Nn0._dd4uYmcdOKk3bBcQRije1jRbKEF7B4rh3WL7d5tIKQ';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let myName = '';
let myAvatarUrl = '';
let isAdmin = false;
let isOwner = false;
let customRole = '';
let currentRoom = 'general';
let isDM = false;
let chatSubscription = null;
let presenceChannel = null;
let typingChannel = null;
let typingTimeout = null;
let activeOnlineUsers = [];
let authMode = 'signin';
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function showAuthError(message) {
    const banner = document.getElementById('authErrorBanner');
    banner.innerText = message;
    banner.classList.add('visible');
}

function clearAuthError() {
    const banner = document.getElementById('authErrorBanner');
    banner.innerText = '';
    banner.classList.remove('visible');
}

function showSettingsError(message) {
    const banner = document.getElementById('settingsErrorBanner');
    banner.innerText = message;
    banner.classList.add('visible');
}

function clearSettingsError() {
    const banner = document.getElementById('settingsErrorBanner');
    banner.innerText = '';
    banner.classList.remove('visible');
}

window.switchAuthMode = function(mode) {
    authMode = mode;
    clearAuthError();
    const signinBtn = document.getElementById('signinTabBtn');
    const signupBtn = document.getElementById('signupTabBtn');
    const avatarSection = document.getElementById('signupAvatarSection');
    const submitBtn = document.getElementById('authSubmitBtn');
    const title = document.getElementById('authTitle');

    signinBtn.classList.remove('active');
    signupBtn.classList.remove('active');

    if (mode === 'signin') {
        signinBtn.classList.add('active');
        avatarSection.classList.add('hidden');
        submitBtn.innerText = 'Sign In';
        title.innerText = 'Welcome Back';
    } else if (mode === 'signup') {
        signupBtn.classList.add('active');
        avatarSection.classList.remove('hidden');
        submitBtn.innerText = 'Create Account';
        title.innerText = 'Create an Account';
    }
}

window.handleAuth = async function() {
    clearAuthError();
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    if (!username || !password) {
        showAuthError('Please fill in both username and password!');
        return;
    }

    try {
        if (authMode === 'signup') {
            const { data: existing } = await supabaseClient.from('profiles').select('*').eq('username', username).single();
            if (existing) {
                showAuthError('Username already taken! Choose another.');
                return;
            }
            const avatarFile = document.getElementById('avatarFileInput').files[0];
            if (avatarFile) {
                myAvatarUrl = await uploadAvatar(avatarFile, username);
            }
            const { error } = await supabaseClient.from('profiles').insert([{ username, password, avatar_url: myAvatarUrl, is_admin: false, is_owner: false, role: '' }]);
            if (error) {
                showAuthError('Sign up failed: ' + error.message);
                return;
            }
            isAdmin = false;
            isOwner = false;
            customRole = '';
            myName = username;
        } else if (authMode === 'signin') {
            const { data, error } = await supabaseClient.from('profiles').select('*').eq('username', username).eq('password', password).single();
            if (error || !data) {
                showAuthError('Invalid username or password!');
                return;
            }
            isAdmin = !!data.is_admin;
            isOwner = !!data.is_owner;
            if (isOwner) isAdmin = true;
            customRole = data.role || '';
            myName = data.username;
            myAvatarUrl = data.avatar_url || '';
        }

        initAppInterface();
    } catch (err) {
        console.error(err);
        showAuthError('Authentication error occurred.');
    }
}

async function uploadAvatar(file, targetName) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${targetName}_${Date.now()}.${fileExt}`;
    const { error } = await supabaseClient.storage.from('chat-files').upload(fileName, file);
    if (error) return '';
    const { data } = supabaseClient.storage.from('chat-files').getPublicUrl(fileName);
    return data.publicUrl;
}

function initAppInterface() {
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');

    updateSidebarUserPill();
    if (isAdmin || isOwner) {
        document.getElementById('adminSidebarPanel').classList.remove('hidden');
        if (isOwner) {
            document.getElementById('panelTitleLabel').innerText = '👑 OWNER CONTROLS';
            document.getElementById('panelTitleLabel').style.color = '#f2ba33';
        }
    }

    loadChannels();
    loadMessagesForRoom();
    subscribeToRoom();
    setupPresence();
    setupTypingChannel();
}

function updateSidebarUserPill() {
    let badgeText = '';
    if (isOwner) badgeText = ' (Owner)';
    else if (isAdmin) badgeText = ' (Admin)';

    document.getElementById('sidebarUserName').innerText = myName + badgeText;
    const avatarContainer = document.getElementById('sidebarUserAvatarContainer');
    const initial = myName.charAt(0).toUpperCase();
    avatarContainer.innerHTML = myAvatarUrl ? `<img src="${myAvatarUrl}" class="sidebar-avatar">` : `<div class="sidebar-avatar">${initial}</div>`;
}

window.toggleSettingsModal = function(show) {
    clearSettingsError();
    const modal = document.getElementById('settingsModal');
    if (show) {
        document.getElementById('settingsUsernameInput').value = myName;
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

window.toggleAdminModal = async function(show) {
    const modal = document.getElementById('adminModal');
    if (show) {
        modal.classList.remove('hidden');
        const { data: profiles } = await supabaseClient.from('profiles').select('username');
        const select = document.getElementById('adminTargetUserSelect');
        select.innerHTML = '<option value="">-- Choose User --</option>';
        if (profiles) {
            profiles.forEach(p => {
                select.innerHTML += `<option value="${p.username}">${p.username}</option>`;
            });
        }
    } else {
        modal.classList.add('hidden');
    }
}

window.loadTargetUserData = async function() {
    const username = document.getElementById('adminTargetUserSelect').value;
    document.getElementById('adminNewUsernameInput').value = username;
    document.getElementById('adminNewPasswordInput').value = '';
    const { data } = await supabaseClient.from('profiles').select('role').eq('username', username).single();
    document.getElementById('adminRoleInput').value = data ? (data.role || '') : '';
}

window.adminSaveUserChanges = async function() {
    const targetUser = document.getElementById('adminTargetUserSelect').value;
    const newUsername = document.getElementById('adminNewUsernameInput').value.trim();
    const newPassword = document.getElementById('adminNewPasswordInput').value;
    const newRole = document.getElementById('adminRoleInput').value.trim();

    if (!targetUser || !newUsername) {
        alert('Please select a user and provide a valid username.');
        return;
    }

    let updateData = { username: newUsername, role: newRole };
    if (newPassword) updateData.password = newPassword;

    const { error } = await supabaseClient.from('profiles').update(updateData).eq('username', targetUser);
    if (error) {
        alert('Failed to update user: ' + error.message);
        return;
    }

    alert('User updated successfully!');
    toggleAdminModal(false);
    loadMessagesForRoom();
}

window.adminDeleteUser = async function() {
    const targetUser = document.getElementById('adminTargetUserSelect').value;
    if (!targetUser) return;
    if (!confirm(`Are you sure you want to delete user profile "${targetUser}"?`)) return;

    await supabaseClient.from('profiles').delete().eq('username', targetUser);
    alert('User deleted.');
    toggleAdminModal(false);
}

window.saveProfileSettings = async function() {
    clearSettingsError();
    const newName = document.getElementById('settingsUsernameInput').value.trim();
    const avatarFile = document.getElementById('settingsAvatarInput').files[0];
    let newAvatarUrl = myAvatarUrl;

    if (!newName) {
        showSettingsError('Username cannot be empty!');
        return;
    }
    if (avatarFile) newAvatarUrl = await uploadAvatar(avatarFile, newName);

    const { error } = await supabaseClient.from('profiles').update({ username: newName, avatar_url: newAvatarUrl }).eq('username', myName);
    if (error) {
        showSettingsError('Failed to update profile: ' + error.message);
        return;
    }

    myName = newName;
    myAvatarUrl = newAvatarUrl;
    updateSidebarUserPill();
    toggleSettingsModal(false);
    loadMessagesForRoom();
}

async function loadChannels() {
    const { data } = await supabaseClient.from('channels').select('*').order('id', { ascending: true });
    if (data) renderPublicChannels(data);
}

function renderPublicChannels(channels) {
    const container = document.getElementById('publicChannelsContainer');
    container.innerHTML = '';
    channels.forEach(ch => {
        const item = document.createElement('div');
        item.className = 'channel-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `channel-btn ${!isDM && ch.name === currentRoom ? 'active' : ''}`;
        btn.innerText = `# ${ch.name}`;
        btn.onclick = () => switchChannel(ch.name, false, btn);
        item.appendChild(btn);

        if (isAdmin || isOwner) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'del-channel-btn';
            delBtn.innerText = '🗑️';
            delBtn.onclick = () => deleteChannel(ch.name);
            item.appendChild(delBtn);
        }
        container.appendChild(item);
    });
}

function renderDMList() {
    const container = document.getElementById('dmChannelsContainer');
    container.innerHTML = '';
    const others = activeOnlineUsers.filter(u => u !== myName);
    
    others.forEach(user => {
        const roomKey = [myName, user].sort().join('_');
        const dmRoomName = `dm_${roomKey}`;
        const item = document.createElement('div');
        item.className = 'channel-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `channel-btn ${isDM && currentRoom === dmRoomName ? 'active' : ''}`;
        btn.innerText = `@ ${user}`;
        btn.onclick = () => switchChannel(dmRoomName, true, btn, user);
        item.appendChild(btn);
        container.appendChild(item);
    });
}

window.createChannel = async function() {
    let name = document.getElementById('newChannelInput').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!name) return;
    await supabaseClient.from('channels').insert([{ name }]);
    document.getElementById('newChannelInput').value = '';
    loadChannels();
}

window.deleteChannel = async function(name) {
    if (name === 'general') {
        alert('Cannot delete general channel!');
        return;
    }
    if (!confirm(`Delete #${name}?`)) return;
    await supabaseClient.from('channels').delete().eq('name', name);
    if (currentRoom === name) switchChannel('general', false, document.querySelector('.channel-btn'));
    loadChannels();
}

function switchChannel(roomName, dmFlag, element, targetUser = '') {
    currentRoom = roomName;
    isDM = dmFlag;
    
    document.getElementById('currentChannelTitle').innerText = isDM ? `Direct Message with @${targetUser}` : `# ${roomName}`;
    document.getElementById('messageInput').placeholder = isDM ? `Message @${targetUser}...` : `Message #${roomName}...`;

    document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
    if (element) element.classList.add('active');

    if (chatSubscription) supabaseClient.removeChannel(chatSubscription);
    if (typingChannel) supabaseClient.removeChannel(typingChannel);

    loadMessagesForRoom();
    subscribeToRoom();
    setupTypingChannel();
}

async function loadMessagesForRoom() {
    const { data } = await supabaseClient.from('messages').select('*').eq('room', currentRoom).order('created_at', { ascending: true });
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';
    
    const { data: profiles } = await supabaseClient.from('profiles').select('*');
    const profileMap = {};
    if (profiles) profiles.forEach(p => profileMap[p.username] = { avatar: p.avatar_url, role: p.role });

    if (data) data.forEach(msg => appendMessageToUI(msg, profileMap[msg.sender]));
    chatBox.scrollTop = chatBox.scrollHeight;
}

function subscribeToRoom() {
    chatSubscription = supabaseClient
        .channel(`room:${currentRoom}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${currentRoom}` }, async payload => {
            const { data: profile } = await supabaseClient.from('profiles').select('avatar_url, role').eq('username', payload.new.sender).single();
            appendMessageToUI(payload.new, profile ? { avatar: profile.avatar_url, role: profile.role } : {});
            const chatBox = document.getElementById('chat-box');
            chatBox.scrollTop = chatBox.scrollHeight;
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
            loadMessagesForRoom(); // Refresh for reactions/edits updates
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
            const el = document.getElementById(`msg-${payload.old.id}`);
            if (el) el.remove();
        })
        .subscribe();
}

window.sendMessage = async function() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    if ((isAdmin || isOwner) && text.startsWith('/announcement ')) {
        const announcementText = text.replace('/announcement ', '');
        await supabaseClient.from('messages').insert([{
            sender: myName,
            message: `📢 ANNOUNCEMENT: ${announcementText}`,
            room: currentRoom,
            is_image: false,
            is_announcement: true,
            reactions: {}
        }]);
        input.value = '';
        return;
    }

    const isImageUrl = /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(text) || text.startsWith('data:image/');
    const isAiCall = text.startsWith('@AI ');
    
    const { error } = await supabaseClient.from('messages').insert([{
        sender: myName,
        message: text,
        room: currentRoom,
        is_image: isImageUrl,
        is_announcement: false,
        reactions: {}
    }]);

    if (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
        return;
    }

    input.value = '';
    if (isAiCall) {
        const prompt = text.replace('@AI ', '');
        triggerAIBotResponse(prompt);
    }
}

async function triggerAIBotResponse(prompt) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const aiReply = response.text || "I couldn't generate a response.";

        await supabaseClient.from('messages').insert([{
            sender: 'AI Bot',
            message: aiReply,
            room: currentRoom,
            is_image: false,
            is_announcement: false,
            reactions: {}
        }]);
    } catch (err) {
        await supabaseClient.from('messages').insert([{
            sender: 'AI Bot',
            message: "Error processing request with Gemini AI.",
            room: currentRoom,
            is_image: false,
            is_announcement: false,
            reactions: {}
        }]);
    }
}

window.sendImageMessage = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const fileName = `img_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabaseClient.storage.from('chat-files').upload(fileName, file);
    if (error) {
        alert('Image upload failed');
        return;
    }
    const { data } = supabaseClient.storage.from('chat-files').getPublicUrl(fileName);

    await supabaseClient.from('messages').insert([{ sender: myName, message: data.publicUrl, room: currentRoom, is_image: true, reactions: {} }]);
    event.target.value = '';
}

// Voice Note Recording
window.toggleVoiceRecording = async function() {
    const btn = document.getElementById('recordVoiceBtn');
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const fileName = `voice_${Date.now()}.webm`;
                const { error } = await supabaseClient.storage.from('chat-files').upload(fileName, audioBlob);
                if (!error) {
                    const { data } = supabaseClient.storage.from('chat-files').getPublicUrl(fileName);
                    await supabaseClient.from('messages').insert([{ sender: myName, message: data.publicUrl, room: currentRoom, is_audio: true, reactions: {} }]);
                }
            };
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
        } catch (e) {
            alert('Microphone access denied or unsupported.');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btn.classList.remove('recording');
    }
}

window.toggleReaction = async function(msgId, emoji) {
    const { data } = await supabaseClient.from('messages').select('reactions').eq('id', msgId).single();
    let reactions = data && data.reactions ? data.reactions : {};
    
    if (!reactions[emoji]) reactions[emoji] = [];
    const index = reactions[emoji].indexOf(myName);
    if (index > -1) {
        reactions[emoji].splice(index, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
        reactions[emoji].push(myName);
    }

    await supabaseClient.from('messages').update({ reactions }).eq('id', msgId);
}

window.handleSearchInput = function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        const text = msg.innerText.toLowerCase();
        if (text.includes(query)) {
            msg.style.display = 'flex';
        } else {
            msg.style.display = 'none';
        }
    });
}

window.deleteMessage = async function(id) {
    await supabaseClient.from('messages').delete().eq('id', id);
}

window.editMessage = async function(id, oldText) {
    const newText = prompt("Edit your message:", oldText);
    if (newText === null || newText.trim() === "" || newText === oldText) return;
    await supabaseClient.from('messages').update({ message: newText, is_edited: true }).eq('id', id);
}

function setupPresence() {
    presenceChannel = supabaseClient.channel('online-users');
    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            let users = [];
            for (let id in state) {
                state[id].forEach(pres => {
                    if (pres.user) users.push(pres.user);
                });
            }
            activeOnlineUsers = [...new Set(users)];
            
            document.getElementById('membersList').innerHTML = `<h4 style="font-size: 12px; color: #949ba4; margin: 0 0 8px 0;">ONLINE — ${activeOnlineUsers.length}</h4>`;
            activeOnlineUsers.forEach(u => {
                const mDiv = document.createElement('div');
                mDiv.className = 'member-item';
                mDiv.innerHTML = `
                    <div class="member-info">
                        <div class="status-dot"></div>
                        <span>${u}</span>
                    </div>
                `;
                document.getElementById('membersList').appendChild(mDiv);
            });
            renderDMList();
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({ user: myName });
            }
        });
}

function setupTypingChannel() {
    typingChannel = supabaseClient.channel(`typing:${currentRoom}`);
    typingChannel
        .on('broadcast', { event: 'typing' }, payload => {
            if (payload.user !== myName) {
                document.getElementById('typingIndicator').innerText = `${payload.user} is typing...`;
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    document.getElementById('typingIndicator').innerText = '';
                }, 2000);
            }
        })
        .subscribe();
}

window.handleTypingInput = function() {
    if (typingChannel) {
        typingChannel.send({ type: 'broadcast', event: 'typing', payload: { user: myName } });
    }
}

window.checkMessageEnter = function(e) { if (e.key === 'Enter') sendMessage(); }
window.checkAuthEnter = function(e) { if (e.key === 'Enter') handleAuth(); }
window.checkChannelEnter = function(e) { if (e.key === 'Enter') createChannel(); }

function appendMessageToUI(data, profileInfo) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = data.is_announcement ? 'message announcement' : 'message';
    div.id = `msg-${data.id}`;

    const isMessageAI = (data.sender === 'AI Bot');
    const editedHtml = data.is_edited ? `<span class="edited-tag">(edited)</span>` : '';
    const canModify = (isAdmin || isOwner || data.sender === myName) && !isMessageAI;
    
    const actionsHtml = canModify ? `
        <div class="msg-actions">
            ${!data.is_image && !data.is_audio ? `<button type="button" class="action-btn" onclick="editMessage(${data.id}, '${data.message.replace(/'/g, "\\'")}')">Edit</button>` : ''}
            <button type="button" class="action-btn" onclick="toggleReaction(${data.id}, '👍')">👍</button>
            <button type="button" class="action-btn" onclick="toggleReaction(${data.id}, '❤️')">❤️</button>
            <button type="button" class="action-btn" onclick="toggleReaction(${data.id}, '🔥')">🔥</button>
            <button type="button" class="action-btn del" onclick="deleteMessage(${data.id})">Delete</button>
        </div>
    ` : `
        <div class="msg-actions">
            <button type="button" class="action-btn" onclick="toggleReaction(${data.id}, '👍')">👍</button>
            <button type="button" class="action-btn" onclick="toggleReaction(${data.id}, '❤️')">❤️</button>
            <button type="button" class="action-btn" onclick="toggleReaction(${data.id}, '🔥')">🔥</button>
        </div>
    `;

    const avatarUrl = profileInfo ? profileInfo.avatar : '';
    const userRole = profileInfo ? profileInfo.role : '';
    const initial = data.sender.charAt(0).toUpperCase();
    const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" class="message-avatar">` : `<div class="message-avatar">${initial}</div>`;
    
    let badge = '';
    if (data.sender === 'AI Bot') badge = '<span class="ai-badge">AI</span>';
    else if (userRole) badge = `<span class="custom-badge">${userRole}</span>`;

    let contentHtml = '';
    if (data.is_image) {
        contentHtml = `<img src="${data.message}" class="message-image" onclick="window.open(this.src)">`;
    } else if (data.is_audio) {
        contentHtml = `<audio controls src="${data.message}" class="audio-player"></audio>`;
    } else {
        const parsedMarkdown = marked.parse(data.message);
        contentHtml = `<div class="message-content"><div class="message-text-content">${parsedMarkdown}</div>${editedHtml}</div>`;
    }

    // Reactions HTML
    let reactionsHtml = '';
    if (data.reactions && Object.keys(data.reactions).length > 0) {
        reactionsHtml = '<div class="reactions-container">';
        for (const [emoji, users] of Object.entries(data.reactions)) {
            const hasReacted = users.includes(myName);
            reactionsHtml += `<div class="reaction-pill" style="${hasReacted ? 'border-color: #5865f2; background: #35373c;' : ''}" onclick="toggleReaction(${data.id}, '${emoji}')">${emoji} ${users.length}</div>`;
        }
        reactionsHtml += '</div>';
    }

    div.innerHTML = `
        ${avatarHtml}
        <div class="message-body">
            <div style="font-size: 14px; font-weight: bold; color: white; display: flex; align-items: center;">
                ${data.sender} ${badge}
            </div>
            ${contentHtml}
            ${reactionsHtml}
        </div>
        ${actionsHtml}
    `;

    chatBox.appendChild(div);
    hljs.highlightAll();
}
