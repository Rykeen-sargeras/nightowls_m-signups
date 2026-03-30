const API = {
    _headers(extra = {}) {
        const headers = { ...extra };
        const token = localStorage.getItem("nightowls_token");
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
    },
    async _json(res, fallback) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.message || fallback);
        return data;
    },
    async checkAdminIp() {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/check-ip`);
        if (!res.ok) return { is_admin: false };
        return await res.json();
    },
    async fetchSpecs() {
        const res = await fetch(`${CONFIG.API_URL}/api/specs`);
        return (await this._json(res, "Failed to load spec data")).classes;
    },
    async fetchRoster() {
        const res = await fetch(`${CONFIG.API_URL}/api/roster`);
        return await this._json(res, "Failed to load roster");
    },
    async signup(username, wowClass, specialization) {
        const res = await fetch(`${CONFIG.API_URL}/api/signup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, wow_class: wowClass, specialization }),
        });
        return await this._json(res, "Signup failed");
    },
    async cancelSignup(username) {
        const res = await fetch(`${CONFIG.API_URL}/api/signup/${encodeURIComponent(username)}`, { method: "DELETE" });
        return await this._json(res, "Cancel failed");
    },
    async adminVerify(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/verify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Verification failed");
    },
    async adminLock(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/lock`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Lock failed");
    },
    async adminUnlock(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/unlock`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Unlock failed");
    },
    async adminArchive(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/archive`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Archive failed");
    },
    async sortGroups(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/groups/sort`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Sort failed");
    },
    async saveGroups(password, groupMap) {
        const res = await fetch(`${CONFIG.API_URL}/api/groups/save`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, groups: groupMap }),
        });
        return await this._json(res, "Save failed");
    },
    async fetchAttendance() {
        const res = await fetch(`${CONFIG.API_URL}/api/attendance`);
        return await this._json(res, "Failed to load attendance");
    },
    async deleteAttendance(password, username) {
        const res = await fetch(`${CONFIG.API_URL}/api/attendance/${encodeURIComponent(username)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Delete failed");
    },
    async fetchVideos() {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/`);
        return await this._json(res, "Failed to load videos");
    },
    async createVideo(password, category, boss_name, description, youtube_url, sort_order) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, category, boss_name, description, youtube_url, sort_order }),
        });
        return await this._json(res, "Create failed");
    },
    async updateVideo(password, videoId, updates) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/${videoId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, ...updates }),
        });
        return await this._json(res, "Update failed");
    },
    async deleteVideo(password, videoId) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/${videoId}`, {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._json(res, "Delete failed");
    },
    async authSignup(email, password) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/signup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        return await this._json(res, "Signup failed");
    },
    async authLogin(email, password) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        return await this._json(res, "Login failed");
    },
    async fetchMe() {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/me`, { headers: this._headers() });
        return await this._json(res, "Not logged in");
    },
    async fetchCommunityMembers() {
        const res = await fetch(`${CONFIG.API_URL}/api/community/`);
        return await this._json(res, "Failed to load community");
    },
    async fetchMyCommunityProfile() {
        const res = await fetch(`${CONFIG.API_URL}/api/community/me`, { headers: this._headers() });
        return await this._json(res, "Failed to load your profile");
    },
    async saveCommunityProfile(formData) {
        const res = await fetch(`${CONFIG.API_URL}/api/community/profile`, {
            method: "POST",
            headers: this._headers(),
            body: formData,
        });
        return await this._json(res, "Failed to save profile");
    },
    async reorderCommunity(seeds) {
        const res = await fetch(`${CONFIG.API_URL}/api/community/reorder`, {
            method: "POST",
            headers: this._headers({ "Content-Type": "application/json" }),
            body: JSON.stringify({ seeds }),
        });
        return await this._json(res, "Failed to save order");
    },
    async fetchRules() {
        const res = await fetch(`${CONFIG.API_URL}/api/rules/`);
        return await this._json(res, "Failed to load rules");
    },
    async saveRules(content) {
        const formData = new FormData();
        formData.append("content", content);
        const res = await fetch(`${CONFIG.API_URL}/api/rules/content`, {
            method: "POST",
            headers: this._headers(),
            body: formData,
        });
        return await this._json(res, "Failed to save rules");
    },
    async uploadBanner(type, file) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch(`${CONFIG.API_URL}/api/rules/banner/${type}`, {
            method: "POST",
            headers: this._headers(),
            body: formData,
        });
        return await this._json(res, "Failed to upload banner");
    },
};
