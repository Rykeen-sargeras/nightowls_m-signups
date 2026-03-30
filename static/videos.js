const VideoManager = {
    data: { raid: [], mythicplus: [] }, activeCategory: "raid", loaded: false, expandedId: null,
    async load() { this.data = await API.fetchVideos(); this.loaded = true; },
    async loadIfNeeded() { if (!this.loaded) await this.load(); this.render(); document.getElementById("videoAdminBar").style.display = AuthManager.isAdmin() ? "block" : "none"; },
    switchCategory(cat) { this.activeCategory = cat; document.getElementById("subtabRaid").classList.toggle("active", cat === "raid"); document.getElementById("subtabMythicplus").classList.toggle("active", cat === "mythicplus"); this.render(); },
    render() {
        const grid = document.getElementById("videoGrid"); const videos = this.data[this.activeCategory] || [];
        if (!videos.length) { grid.innerHTML = `<div class="video-empty">No videos yet.</div>`; return; }
        grid.innerHTML = "";
        videos.forEach(v => {
            const thumbId = this._extractYoutubeId(v.youtube_url);
            const thumbUrl = thumbId ? `https://img.youtube.com/vi/${thumbId}/mqdefault.jpg` : "";
            const card = document.createElement("div"); card.className = "video-card"; card.onclick = () => this.expand(v);
            card.innerHTML = `<div class="video-thumb" style="background-image:url('${thumbUrl}')"><div class="video-play-icon">&#9654;</div></div><div class="video-card-info"><div class="video-card-title">${v.boss_name}</div><div class="video-card-desc">${(v.description || "").substring(0,60)}</div></div>`;
            grid.appendChild(card);
        });
    },
    expand(video) {
        const container = document.getElementById("videoExpanded");
        const youtubeId = this._extractYoutubeId(video.youtube_url);
        const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "";
        container.style.display = "block";
        container.innerHTML = `<div class="video-expanded-inner"><div class="video-expanded-header"><h4>${video.boss_name}</h4><div class="video-expanded-actions"><button class="video-close-btn" onclick="VideoManager.collapse()">&times;</button></div></div>${embedUrl ? `<div class="video-expanded-player"><iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe></div>` : ''}${video.description ? `<div class="video-expanded-desc">${video.description}</div>` : ''}</div>`;
        container.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    collapse() { document.getElementById("videoExpanded").style.display = "none"; },
    _extractYoutubeId(url) { const match = (url || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/); return match ? match[1] : null; },
};
