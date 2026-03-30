const API = {
    async checkAdminIp() {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/check-ip`);
        if (!res.ok) return { is_admin: false };
        return await res.json();
    },
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Signup failed");
        return data;
    },
    async cancelSignup(username) {
        const res = await fetch(`${CONFIG.API_URL}/api/signup/${encodeURIComponent(username)}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Cancel failed");
        return data;
    },
    async adminVerify(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/verify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Verification failed");
        return data;
    },
    async adminLock(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/lock`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Lock failed");
        return data;
    },
    async adminUnlock(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/unlock`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Unlock failed");
        return data;
    },
    async adminArchive(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/admin/archive`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Archive failed");
        return data;
    },
    async sortGroups(password) {
        const res = await fetch(`${CONFIG.API_URL}/api/groups/sort`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Sort failed");
        return data;
    },
    async saveGroups(password, groupMap) {
        const res = await fetch(`${CONFIG.API_URL}/api/groups/save`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, groups: groupMap }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Save failed");
        return data;
    },
    async fetchAttendance() {
        const res = await fetch(`${CONFIG.API_URL}/api/attendance`);
        if (!res.ok) throw new Error("Failed to load attendance");
        return await res.json();
    },
    async deleteAttendance(password, username) {
        const res = await fetch(`${CONFIG.API_URL}/api/attendance/${encodeURIComponent(username)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Delete failed");
        return data;
    },
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Create failed");
        return data;
    },
    async updateVideo(password, videoId, updates) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/${videoId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, ...updates }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Update failed");
        return data;
    },
    async deleteVideo(password, videoId) {
        const res = await fetch(`${CONFIG.API_URL}/api/videos/${videoId}`, {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Delete failed");
        return data;
    },
};
