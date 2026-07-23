// ============================================
// COMMUNITY — "Get to Know the Community" member directory
// ============================================
const CommunityManager = {
    profiles: [],
    loaded: false,
    banner: "",

    async loadIfNeeded() {
        try {
            const data = await API.fetchProfiles();
            this.profiles = data.profiles || [];
            const bannerData = await API.getContent("community_banner");
            this.banner = bannerData.value || "";
            this.loaded = true;
        } catch (e) {
            Admin.log("Community load error: " + e.message);
        }
        this.render();
    },

    render() {
        const container = document.getElementById("communityGrid");
        if (!container) return;

        const isLoggedIn = AuthManager.isLoggedIn();
        const isAdmin = AuthManager.isAdmin();
        const myUserId = AuthManager.currentUser?.id;
        const hasProfile = this.profiles.some(p => p.user_id === myUserId);

        // Admin banner upload
        const bannerArea = document.getElementById("communityBannerArea");
        if (bannerArea) {
            if (this.banner) {
                bannerArea.innerHTML = `<img src="${this.banner}" class="community-custom-banner" alt="Community Banner">`;
            } else {
                bannerArea.innerHTML = "";
            }
            if (isAdmin) {
                bannerArea.innerHTML += `<div class="banner-upload-bar"><label for="communityBannerUpload" class="btn btn-sm btn-secondary" style="width:auto;display:inline-block;cursor:pointer;">Upload Banner</label><input type="file" id="communityBannerUpload" accept="image/*" style="display:none;" onchange="CommunityManager.uploadBanner(this)"></div>`;
            }
        }

        // Create profile button
        const adminBar = document.getElementById("communityAdminBar");
        if (adminBar) {
            adminBar.innerHTML = "";
            if (isLoggedIn && !hasProfile) {
                adminBar.innerHTML = `<button class="btn btn-sm btn-success" onclick="CommunityManager.showProfileForm()" style="width:auto;display:inline-block;">+ Create My Profile</button>`;
            }
        }

        // Render profile cards
        if (this.profiles.length === 0) {
            container.innerHTML = '<div class="video-empty">No community profiles yet. Log in and create yours!</div>';
            return;
        }

        container.innerHTML = "";
        this.profiles.forEach(p => {
            const card = document.createElement("div");
            card.className = "community-card";

            const isOwn = p.user_id === myUserId;
            const classColor = CLASS_COLORS[p.main_class] || "#ccc";

            card.innerHTML = `
                <div class="community-card-header">
                    ${p.profile_image ? `<img src="${p.profile_image}" class="community-avatar" alt="${p.display_name}">` : `<div class="community-avatar-placeholder">${p.display_name.charAt(0).toUpperCase()}</div>`}
                    <div class="community-card-info">
                        <div class="community-card-name">${p.display_name}</div>
                        ${p.main_class ? `<div class="community-card-class" style="color:${classColor}">${p.main_class}</div>` : ''}
                        ${p.guild_rank ? `<div class="community-card-rank">${p.guild_rank}</div>` : ''}
                    </div>
                    <div class="community-card-actions">
                        ${isOwn ? `<button class="video-edit-btn" onclick="CommunityManager.showProfileForm(${p.user_id})" title="Edit">&#9998;</button>` : ''}
                        ${isAdmin ? `<button class="video-delete-btn" onclick="CommunityManager.deleteProfile(${p.id}, '${p.display_name.replace(/'/g, "\\'")}')" title="Delete">&times;</button>` : ''}
                        ${isAdmin ? `<input type="number" class="seed-input" value="${p.seed}" onchange="CommunityManager.updateSeed(${p.user_id}, this.value)" title="Position seed (lower = first)">` : ''}
                    </div>
                </div>
                ${p.bio ? `<div class="community-card-bio">${p.bio}</div>` : ''}
            `;
            container.appendChild(card);
        });
    },

    showProfileForm(editUserId) {
        const existing = editUserId ? this.profiles.find(p => p.user_id === editUserId) : null;
        const isEdit = !!existing;
        const isAdmin = AuthManager.isAdmin();
        const charLimit = isAdmin ? "" : `maxlength="750"`;
        const charNote = isAdmin ? "" : `<span class="char-limit-note">Max 750 characters</span>`;

        const form = document.getElementById("communityProfileForm");
        form.style.display = "block";
        form.innerHTML = `
            <div class="video-form">
                <h4>${isEdit ? "Edit" : "Create"} Profile</h4>
                <div class="form-group"><label for="cpName">Display Name</label>
                    <input type="text" id="cpName" value="${isEdit ? existing.display_name.replace(/"/g, '&quot;') : ''}" placeholder="Your name"></div>
                <div class="form-group"><label for="cpClass">Main Class</label>
                    <select id="cpClass">
                        <option value="">Select Class</option>
                        ${Object.keys(SPEC_DATA).sort().map(c => `<option value="${c}" ${isEdit && existing.main_class === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select></div>
                <div class="form-group"><label for="cpRank">Guild Rank (optional)</label>
                    <input type="text" id="cpRank" value="${isEdit ? (existing.guild_rank || '').replace(/"/g, '&quot;') : ''}" placeholder="e.g. Officer, Raider, Social"></div>
                <div class="form-group"><label for="cpBio">Bio ${charNote}</label>
                    <textarea id="cpBio" ${charLimit}>${isEdit ? (existing.bio || '') : ''}</textarea></div>
                <div class="form-group"><label for="cpImage">Profile Picture</label>
                    <input type="file" id="cpImage" accept="image/*" onchange="CommunityManager._previewImage(this)">
                    <div id="cpImagePreview">${isEdit && existing.profile_image ? `<img src="${existing.profile_image}" class="community-avatar" style="margin-top:8px;">` : ''}</div></div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-success" onclick="CommunityManager.submitProfile(${isEdit})">${isEdit ? "Update" : "Create"}</button>
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('communityProfileForm').style.display='none'">Cancel</button>
                </div>
            </div>
        `;
        form.scrollIntoView({ behavior: "smooth" });
    },

    _previewImage(input) {
        const preview = document.getElementById("cpImagePreview");
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" class="community-avatar" style="margin-top:8px;">`;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    async submitProfile(isEdit) {
        const name = document.getElementById("cpName").value.trim();
        const mainClass = document.getElementById("cpClass").value;
        const rank = document.getElementById("cpRank").value.trim();
        const bio = document.getElementById("cpBio").value;

        if (!name) return UI.toast("Display name is required", "error");

        // Get image as base64
        let imageData = "";
        const fileInput = document.getElementById("cpImage");
        if (fileInput.files && fileInput.files[0]) {
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(fileInput.files[0]);
            });
        }

        const profileData = {
            display_name: name,
            main_class: mainClass,
            guild_rank: rank,
            bio: bio,
        };
        if (imageData) profileData.profile_image = imageData;

        try {
            if (isEdit) {
                await API.updateProfile(profileData);
                UI.toast("Profile updated");
            } else {
                await API.createProfile(profileData);
                UI.toast("Profile created!");
            }
            document.getElementById("communityProfileForm").style.display = "none";
            this.loaded = false;
            await this.loadIfNeeded();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async deleteProfile(profileId, name) {
        if (!confirm(`Delete ${name}'s profile?`)) return;
        try {
            await API.deleteProfile(profileId);
            UI.toast(`Deleted ${name}'s profile`);
            this.loaded = false;
            await this.loadIfNeeded();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async updateSeed(userId, seed) {
        try {
            await API.updateSeed(userId, parseInt(seed));
            UI.toast("Position updated");
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async uploadBanner(input) {
        if (!input.files || !input.files[0]) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await API.updateContent("community_banner", e.target.result);
                this.banner = e.target.result;
                this.render();
                UI.toast("Banner updated");
            } catch (err) {
                UI.toast(err.message, "error");
            }
        };
        reader.readAsDataURL(input.files[0]);
    },
};
