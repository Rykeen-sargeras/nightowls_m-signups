// ============================================
// API — All backend communication
// ============================================
const API = {
    _token: null,

    async _parseResponse(res, fallbackMessage = "Request failed") {
        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (_) {
            data = null;
        }

        if (!res.ok) {
            throw new Error(
                (data && (data.detail || data.message)) ||
                text ||
                fallbackMessage
            );
        }

        return data;
    },

    _headers() {
        const h = { "Content-Type": "application/json" };
        if (this._token) h["Authorization"] = `Bearer ${this._token}`;
        return h;
    },

    setToken(token) { this._token = token; localStorage.setItem("nightowls_token", token); },
    clearToken() { this._token = null; localStorage.removeItem("nightowls_token"); },
    loadToken() { this._token = localStorage.getItem("nightowls_token"); return !!this._token; },

    // --- AUTH ---
    async register(username, password) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/register`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        return await this._parseResponse(res, "Registration failed");
    },
    async login(username, password) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        return await this._parseResponse(res, "Login failed");
    },
    async getMe() {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/me`, { headers: this._headers() });
        if (!res.ok) throw new Error("Not logged in");
        return await res.json();
    },
    async changePassword(newPassword) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/change-password`, {
            method: "POST", headers: this._headers(),
            body: JSON.stringify({ new_password: newPassword }),
        });
        return await this._parseResponse(res, "Change failed");
    },
    async getMemberList(adminPassword) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/members`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admin_password: adminPassword }),
        });
        return await this._parseResponse(res, "Failed to load members");
    },
    async resetMemberPassword(adminPassword, userId) {
        const res = await fetch(`${CONFIG.API_URL}/api/auth/reset-password`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admin_password: adminPassword, user_id: userId }),
        });
        return await this._parseResponse(res, "Reset failed");
    },

    // --- ADMIN ---
    async checkAdminIp() {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/check-ip`);
        if (!res.ok) return { is_admin: false };
        return await res.json();
    },
    async adminVerify(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/verify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Verification failed");
    },
    async adminLock(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/lock`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Lock failed");
    },
    async adminUnlock(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/unlock`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Unlock failed");
    },
    async adminArchive(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/archive`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Archive failed");
    },

    // --- PLAYERS ---
    async fetchSpecs() {
        const res = await fetch(`${CONFIG.API_URL}/api/specs`);
        if (!res.ok) throw new Error("Failed to load spec data");
        return (await res.json()).classes;
    },
    async fetchRoster() {
        const res = await fetch(`${CONFIG.API_URL}/api/roster`);
        if (!res.ok) throw new Error("Failed to load roster");
        return await res.json();
    },
    async signup(username, wowClass, specialization) {
        const res = await fetch(`${CONFIG.API_URL}/api/signup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, wow_class: wowClass, specialization }),
        });
        return await this._parseResponse(res, "Signup failed");
    },
    async cancelSignup(username) {
        const res = await fetch(`${CONFIG.API_URL}/api/signup/${encodeURIComponent(username)}`, { method: "DELETE" });
        return await this._parseResponse(res, "Cancel failed");
    },
    async fetchAttendance() {
        const res = await fetch(`${CONFIG.API_URL}/api/attendance`);
        if (!res.ok) throw new Error("Failed to load attendance");
        return await res.json();
    },
    async deleteAttendance(password, username) {
        const res = await fetch(`${CONFIG.API_URL}/api/attendance/${encodeURIComponent(username)}`, {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Delete failed");
    },

    // --- GROUPS ---
    async sortGroups(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/groups/sort`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Sort failed");
    },
    async saveGroups(password, groupMap) {
        const res = await fetch(`${CONFIG.API_URL}/api/groups/save`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, groups: groupMap }),
        });
        return await this._parseResponse(res, "Save failed");
    },

    // --- VIDEOS ---
    async fetchVideos() {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/`);
        if (!res.ok) throw new Error("Failed to load videos");
        return await res.json();
    },
    async createVideo(password, category, boss_name, description, youtube_url, sort_order) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, category, boss_name, description, youtube_url, sort_order }),
        });
        return await this._parseResponse(res, "Create failed");
    },
    async updateVideo(password, videoId, updates) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/${videoId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, ...updates }),
        });
        return await this._parseResponse(res, "Update failed");
    },
    async deleteVideo(password, videoId) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/${videoId}`, {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        return await this._parseResponse(res, "Delete failed");
    },

    // --- COMMUNITY PROFILES ---
    async fetchProfiles() {
        const res = await fetch(`${CONFIG.API_URL}/api/community/`);
        if (!res.ok) throw new Error("Failed to load profiles");
        return await res.json();
    },
    async createProfile(profileData) {
        const res = await fetch(`${CONFIG.API_URL}/api/community/`, {
            method: "POST", headers: this._headers(),
            body: JSON.stringify(profileData),
        });
        return await this._parseResponse(res, "Create failed");
    },
    async updateProfile(profileData) {
        const res = await fetch(`${CONFIG.API_URL}/api/community/`, {
            method: "PUT", headers: this._headers(),
            body: JSON.stringify(profileData),
        });
        return await this._parseResponse(res, "Update failed");
    },
    async deleteProfile(profileId) {
        const res = await fetch(`${CONFIG.API_URL}/api/community/${profileId}`, {
            method: "DELETE", headers: this._headers(),
        });
        return await this._parseResponse(res, "Delete failed");
    },
    async updateSeed(userId, seed) {
        const res = await fetch(`${CONFIG.API_URL}/api/community/seed`, {
            method: "PUT", headers: this._headers(),
            body: JSON.stringify({ user_id: userId, seed }),
        });
        return await this._parseResponse(res, "Seed update failed");
    },

    // --- SITE CONTENT ---
    async getContent(key) {
        const res = await fetch(`${CONFIG.API_URL}/api/content/${key}`);
        if (!res.ok) return { value: "" };
        return await res.json();
    },
    async updateContent(key, value) {
        const res = await fetch(`${CONFIG.API_URL}/api/content/${key}`, {
            method: "PUT", headers: this._headers(),
            body: JSON.stringify({ value }),
        });
        return await this._parseResponse(res, "Update failed");
    },
};
