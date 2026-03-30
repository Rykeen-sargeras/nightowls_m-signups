// ============================================
// RULES — Community rules tab with admin editor
// ============================================
const RulesManager = {
    rulesText: "",
    banner: "",
    loaded: false,

    async loadIfNeeded() {
        if (!this.loaded) {
            try {
                const rulesData = await API.getContent("rules");
                this.rulesText = rulesData.value || "";
                const bannerData = await API.getContent("rules_banner");
                this.banner = bannerData.value || "";
                this.loaded = true;
            } catch (e) {
                Admin.log("Rules load error: " + e.message);
            }
        }
        this.render();
    },

    render() {
        const container = document.getElementById("rulesContent");
        if (!container) return;

        const isAdmin = AuthManager.isAdmin();

        // Banner
        const bannerArea = document.getElementById("rulesBannerArea");
        if (bannerArea) {
            if (this.banner) {
                bannerArea.innerHTML = `<img src="${this.banner}" class="community-custom-banner" alt="Rules Banner">`;
            } else {
                bannerArea.innerHTML = "";
            }
            if (isAdmin) {
                bannerArea.innerHTML += `<div class="banner-upload-bar"><label for="rulesBannerUpload" class="btn btn-sm btn-secondary" style="width:auto;display:inline-block;cursor:pointer;">Upload Banner</label><input type="file" id="rulesBannerUpload" accept="image/*" style="display:none;" onchange="RulesManager.uploadBanner(this)"></div>`;
            }
        }

        // Rules content
        if (this.rulesText) {
            container.innerHTML = `<div class="rules-text">${this.rulesText.replace(/\n/g, '<br>')}</div>`;
        } else {
            container.innerHTML = '<div class="video-empty">No rules have been set yet.</div>';
        }

        // Admin edit button
        if (isAdmin) {
            container.innerHTML += `<button class="btn btn-sm btn-secondary" onclick="RulesManager.showEditor()" style="width:auto;display:inline-block;margin-top:15px;">Edit Rules</button>`;
        }
    },

    showEditor() {
        const container = document.getElementById("rulesContent");
        container.innerHTML = `
            <div class="video-form">
                <h4>Edit Community Rules</h4>
                <div class="form-group"><label for="rulesEditor">Rules Content (use line breaks for formatting)</label>
                    <textarea id="rulesEditor"></textarea></div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-success" onclick="RulesManager.saveRules()">Save Rules</button>
                    <button class="btn btn-sm btn-secondary" onclick="RulesManager.render()">Cancel</button>
                </div>
            </div>
        `;
        document.getElementById("rulesEditor").value = this.rulesText;
    },

    async saveRules() {
        const text = document.getElementById("rulesEditor").value;
        try {
            await API.updateContent("rules", text);
            this.rulesText = text;
            UI.toast("Rules saved");
            this.render();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async uploadBanner(input) {
        if (!input.files || !input.files[0]) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await API.updateContent("rules_banner", e.target.result);
                this.banner = e.target.result;
                this.render();
                UI.toast("Rules banner updated");
            } catch (err) {
                UI.toast(err.message, "error");
            }
        };
        reader.readAsDataURL(input.files[0]);
    },
};
