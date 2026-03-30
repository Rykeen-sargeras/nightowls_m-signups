// ============================================
// VIDEOS — Boss guide videos with card grid
// Viewable by everyone, editable by admin only
// ============================================
const VideoManager = {
    data: { raid: [], mythicplus: [] },
    activeCategory: "raid",
    loaded: false,
    expandedId: null,

    async load() {
        try {
            this.data = await API.fetchVideos();
            this.loaded = true;
        } catch (err) {
            Admin.log("Videos load error: " + err.message);
        }
    },

    async loadIfNeeded() {
        if (!this.loaded) await this.load();
        this.render();
        // Show admin bar if verified
        if (TabManager.adminVerified) {
            document.getElementById("videoAdminBar").style.display = "block";
        }
    },

    switchCategory(cat) {
        this.activeCategory = cat;
        document.getElementById("subtabRaid").classList.toggle("active", cat === "raid");
        document.getElementById("subtabMythicplus").classList.toggle("active", cat === "mythicplus");
        this.expandedId = null;
        document.getElementById("videoExpanded").style.display = "none";
        document.getElementById("videoAddForm").style.display = "none";
        this.render();
    },

    render() {
        const grid = document.getElementById("videoGrid");
        const videos = this.data[this.activeCategory] || [];

        if (videos.length === 0) {
            grid.innerHTML = `<div class="video-empty">No ${this.activeCategory === "raid" ? "Raid" : "Mythic+"} videos yet.${TabManager.adminVerified ? ' Click "+ Add Video" to add one.' : ''}</div>`;
            return;
        }

        grid.innerHTML = "";
        videos.forEach(v => {
            const thumbId = this._extractYoutubeId(v.youtube_url);
            const thumbUrl = thumbId ? `https://img.youtube.com/vi/${thumbId}/mqdefault.jpg` : "";

            const card = document.createElement("div");
            card.className = "video-card";
            card.onclick = () => this.expand(v);

            card.innerHTML = `
                <div class="video-thumb" style="background-image: url('${thumbUrl}')">
                    <div class="video-play-icon">&#9654;</div>
                </div>
                <div class="video-card-info">
                    <div class="video-card-title">${v.boss_name}</div>
                    <div class="video-card-desc">${v.description ? v.description.substring(0, 60) + (v.description.length > 60 ? '...' : '') : ''}</div>
                </div>
                ${TabManager.adminVerified ? `<div class="video-card-actions">
                    <button class="video-edit-btn" onclick="event.stopPropagation(); VideoManager.showEditForm(${v.id})" title="Edit">&#9998;</button>
                    <button class="video-delete-btn" onclick="event.stopPropagation(); VideoManager.deleteVideo(${v.id}, '${v.boss_name.replace(/'/g, "\\'")}')" title="Delete">&times;</button>
                </div>` : ''}
            `;
            grid.appendChild(card);
        });
    },

    expand(video) {
        const container = document.getElementById("videoExpanded");
        const youtubeId = this._extractYoutubeId(video.youtube_url);

        if (this.expandedId === video.id) {
            // Collapse
            container.style.display = "none";
            this.expandedId = null;
            return;
        }

        this.expandedId = video.id;
        container.style.display = "block";

        const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "";
        container.innerHTML = `
            <div class="video-expanded-inner">
                <div class="video-expanded-header">
                    <h4>${video.boss_name}</h4>
                    <div class="video-expanded-actions">
                        ${TabManager.adminVerified ? `
                            <button class="video-edit-btn" onclick="VideoManager.collapse(); VideoManager.showEditForm(${video.id})" title="Edit">&#9998; Edit</button>
                            <button class="video-delete-btn" onclick="VideoManager.deleteVideo(${video.id}, '${video.boss_name.replace(/'/g, "\\'")}')" title="Delete">&times;</button>
                        ` : ''}
                        <button class="video-close-btn" onclick="VideoManager.collapse()">&times;</button>
                    </div>
                </div>
                ${embedUrl ? `<div class="video-expanded-player">
                    <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>` : `<div class="video-expanded-player"><a href="${video.youtube_url}" target="_blank">Watch on YouTube</a></div>`}
                ${video.description ? `<div class="video-expanded-desc">${video.description}</div>` : ''}
            </div>
        `;

        // Scroll to expanded view
        container.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    collapse() {
        document.getElementById("videoExpanded").style.display = "none";
        this.expandedId = null;
    },

    // --- ADMIN FUNCTIONS ---

    showAddForm() {
        const form = document.getElementById("videoAddForm");
        form.style.display = "block";
        form.innerHTML = `
            <div class="video-form">
                <h4>Add New ${this.activeCategory === "raid" ? "Raid" : "Mythic+"} Video</h4>
                <div class="form-group"><label for="vfBoss">Boss / Dungeon Name</label>
                    <input type="text" id="vfBoss" placeholder="e.g. Queen Ansurek"></div>
                <div class="form-group"><label for="vfDesc">Description</label>
                    <textarea id="vfDesc" rows="12" placeholder="Write your full description here.&#10;&#10;Use Enter for line breaks.&#10;&#10;Phase 1:&#10;- Tank boss near the wall&#10;- Dodge the fire circles&#10;&#10;Phase 2:&#10;- Stack for healing&#10;- Use defensives on slam"></textarea></div>
                <div class="form-group"><label for="vfUrl">YouTube URL</label>
                    <input type="text" id="vfUrl" placeholder="https://www.youtube.com/watch?v=..."></div>
                <div class="form-group"><label for="vfOrder">Sort Order (lower = first)</label>
                    <input type="number" id="vfOrder" value="0" min="0"></div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-success" onclick="VideoManager.submitAdd()">Save</button>
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('videoAddForm').style.display='none'">Cancel</button>
                </div>
            </div>
        `;
    },

    showEditForm(videoId) {
        const video = [...this.data.raid, ...this.data.mythicplus].find(v => v.id === videoId);
        if (!video) return;

        const form = document.getElementById("videoAddForm");
        form.style.display = "block";
        form.innerHTML = `
            <div class="video-form">
                <h4>Edit: ${video.boss_name}</h4>
                <div class="form-group"><label for="vfBoss">Boss / Dungeon Name</label>
                    <input type="text" id="vfBoss" value="${video.boss_name.replace(/"/g, '&quot;')}"></div>
                <div class="form-group"><label for="vfDesc">Description</label>
                    <textarea id="vfDesc" rows="12">${(video.description || '').replace(/</g, '&lt;')}</textarea></div>
                <div class="form-group"><label for="vfUrl">YouTube URL</label>
                    <input type="text" id="vfUrl" value="${video.youtube_url}"></div>
                <div class="form-group"><label for="vfOrder">Sort Order</label>
                    <input type="number" id="vfOrder" value="${video.sort_order}" min="0"></div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-success" onclick="VideoManager.submitEdit(${videoId})">Update</button>
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('videoAddForm').style.display='none'">Cancel</button>
                </div>
            </div>
        `;
    },

    async submitAdd() {
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password in admin panel", "error");
        const boss = document.getElementById("vfBoss").value.trim();
        const desc = document.getElementById("vfDesc").value.trim();
        const url = document.getElementById("vfUrl").value.trim();
        const order = parseInt(document.getElementById("vfOrder").value) || 0;

        if (!boss || !url) return UI.toast("Boss name and YouTube URL are required", "error");

        try {
            await API.createVideo(pw, this.activeCategory, boss, desc, url, order);
            UI.toast(`Added "${boss}"`);
            document.getElementById("videoAddForm").style.display = "none";
            await this.load();
            this.render();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async submitEdit(videoId) {
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password in admin panel", "error");

        try {
            await API.updateVideo(pw, videoId, {
                boss_name: document.getElementById("vfBoss").value.trim(),
                description: document.getElementById("vfDesc").value.trim(),
                youtube_url: document.getElementById("vfUrl").value.trim(),
                sort_order: parseInt(document.getElementById("vfOrder").value) || 0,
            });
            UI.toast("Updated");
            document.getElementById("videoAddForm").style.display = "none";
            await this.load();
            this.render();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async deleteVideo(videoId, name) {
        if (!confirm(`Delete "${name}"?`)) return;
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password in admin panel", "error");
        try {
            await API.deleteVideo(pw, videoId);
            UI.toast(`Deleted "${name}"`);
            await this.load();
            this.render();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    _extractYoutubeId(url) {
        if (!url) return null;
        // Handle youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
        let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    },
};
