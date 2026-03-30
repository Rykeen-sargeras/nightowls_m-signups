const CommunityManager = {
    loaded: false,
    rulesData: null,
    resetLoaded() { this.loaded = false; },
    async loadIfNeeded() { if (!this.loaded) await this.load(); this.render(); },
    async load() {
        const [membersData, myData, rulesData] = await Promise.all([
            API.fetchCommunityMembers(),
            AuthManager.isLoggedIn() ? API.fetchMyCommunityProfile().catch(() => ({ member: null })) : Promise.resolve({ member: null }),
            API.fetchRules(),
        ]);
        this.members = membersData.members || [];
        this.myMember = myData.member;
        this.rulesData = rulesData;
        this.loaded = true;
    },
    render() {
        const banner = document.getElementById("communityBannerWrap");
        banner.innerHTML = this.rulesData?.community_banner ? `<img src="${this.rulesData.community_banner}" alt="Community banner" class="dynamic-banner">` : "";
        const formWrap = document.getElementById("communityFormWrap");
        const adminTools = document.getElementById("communityAdminTools");
        adminTools.style.display = AuthManager.isAdmin() ? "block" : "none";
        adminTools.innerHTML = AuthManager.isAdmin() ? `<div class="inline-admin-tools"><input type="file" id="communityBannerFile" accept="image/*"><button class="btn btn-sm" onclick="CommunityManager.uploadBanner()">Upload Community Banner</button><button class="btn btn-sm btn-secondary" onclick="CommunityManager.saveOrder()">Save Member Order</button></div>` : "";
        if (!AuthManager.isLoggedIn()) {
            formWrap.innerHTML = `<div class="panel-note">Log in to create your community profile.</div>`;
        } else {
            const me = this.myMember || {};
            formWrap.innerHTML = `
                <h3>Get to Know the Community</h3>
                <div class="panel-note warning-note">Please use a unique password for this site; do not reuse your World of Warcraft or other sensitive passwords.</div>
                <div class="form-group"><label>Name</label><input id="cmName" value="${me.name || ''}" maxlength="60"></div>
                <div class="form-row"><div class="form-group"><label>Main Class</label><input id="cmClass" value="${me.main_class || ''}" maxlength="50"></div><div class="form-group"><label>Guild Rank (optional)</label><input id="cmRank" value="${me.guild_rank || ''}" maxlength="80"></div></div>
                <div class="form-group"><label>Bio / Description</label><textarea id="cmBio" ${AuthManager.isAdmin() ? '' : 'maxlength="750"'}>${me.bio || ''}</textarea><div class="small-help">${AuthManager.isAdmin() ? 'Admin account: no bio limit.' : '750 characters max.'}</div></div>
                <div class="form-group"><label>Profile Picture</label><input type="file" id="cmImage" accept="image/*">${me.image_path ? `<div class="small-help">Current image is shown in your card below.</div>` : ''}</div>
                <button class="btn" onclick="CommunityManager.saveProfile()">Save Community Profile</button>`;
        }
        const list = document.getElementById("communityMemberList");
        if (!this.members.length) { list.innerHTML = `<div class="panel-note">No community profiles yet.</div>`; return; }
        list.innerHTML = this.members.map(member => `
            <div class="community-card" data-member-id="${member.id}">
                <div class="community-card-head">
                    ${member.image_path ? `<img src="${member.image_path}" class="community-avatar" alt="${member.name}">` : `<div class="community-avatar community-avatar-placeholder">🦉</div>`}
                    <div><div class="community-name">${member.name}</div><div class="community-meta">${member.main_class}${member.guild_rank ? ` • ${member.guild_rank}` : ''}</div>${AuthManager.isAdmin() ? `<div class="seed-row"><label>Seed</label><input type="number" class="seed-input" value="${member.position_seed}" data-member-id="${member.id}"></div>` : ''}</div>
                </div>
                <div class="community-bio">${(member.bio || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            </div>`).join('');
    },
    async saveProfile() {
        const formData = new FormData();
        formData.append("name", document.getElementById("cmName").value.trim());
        formData.append("main_class", document.getElementById("cmClass").value.trim());
        formData.append("guild_rank", document.getElementById("cmRank").value.trim());
        formData.append("bio", document.getElementById("cmBio").value);
        const file = document.getElementById("cmImage").files[0];
        if (file) formData.append("image", file);
        try {
            await API.saveCommunityProfile(formData);
            UI.toast("Community profile saved");
            this.loaded = false;
            await this.loadIfNeeded();
        } catch (err) { UI.toast(err.message, "error"); }
    },
    async saveOrder() {
        const seeds = Array.from(document.querySelectorAll('.seed-input')).map(input => ({ member_id: parseInt(input.dataset.memberId, 10), position_seed: parseInt(input.value, 10) || 0 }));
        try { await API.reorderCommunity(seeds); UI.toast("Community order saved"); this.loaded = false; await this.loadIfNeeded(); } catch (err) { UI.toast(err.message, "error"); }
    },
    async uploadBanner() {
        const file = document.getElementById('communityBannerFile').files[0];
        if (!file) return UI.toast('Choose a banner image first', 'error');
        try { await API.uploadBanner('community', file); UI.toast('Community banner updated'); this.loaded = false; await this.loadIfNeeded(); } catch (err) { UI.toast(err.message, 'error'); }
    },
};
