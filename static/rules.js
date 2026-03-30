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

    escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    renderRulesMarkup(text) {
        if (!text) return "";
        const escaped = this.escapeHtml(text);
        const withColors = escaped.replace(/\[color=(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\]([\s\S]*?)\[\/color\]/g, (match, color, content) => {
            return `<span style="color:${color};">${content}</span>`;
        });
        return withColors.replace(/\n/g, '<br>');
    },

    render() {
        const container = document.getElementById("rulesContent");
        if (!container) return;

        const isAdmin = AuthManager.isAdmin();

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

        if (this.rulesText) {
            container.innerHTML = `<div class="rules-text">${this.renderRulesMarkup(this.rulesText)}</div>`;
        } else {
            container.innerHTML = '<div class="video-empty">No rules have been set yet.</div>';
        }

        if (isAdmin) {
            container.innerHTML += `<button class="btn btn-sm btn-secondary" onclick="RulesManager.showEditor()" style="width:auto;display:inline-block;margin-top:15px;">Edit Rules</button>`;
        }
    },

    showEditor() {
        const container = document.getElementById("rulesContent");
        container.innerHTML = `
            <div class="video-form rules-editor-shell">
                <h4>Edit Community Rules</h4>
                <div class="rules-editor-toolbar">
                    <div class="rules-toolbar-group">
                        <span class="rules-toolbar-label">Color selected text</span>
                        <input type="color" id="rulesColorPicker" class="rules-color-input" value="#ffd100">
                        <button class="btn btn-sm btn-secondary" style="width:auto;display:inline-block;" onclick="RulesManager.applySelectedColor()">Apply Color</button>
                        <button class="btn btn-sm btn-secondary" style="width:auto;display:inline-block;" onclick="RulesManager.clearSelectedColor()">Clear Color</button>
                    </div>
                </div>
                <div class="form-group"><label for="rulesEditor">Rules Content</label>
                    <textarea id="rulesEditor"></textarea></div>
                <div class="rules-editor-help">Highlight text in the editor, pick a color, then use Apply Color. Colored text saves with the rules and only the editor shows these color controls.</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-success" onclick="RulesManager.saveRules()">Save Rules</button>
                    <button class="btn btn-sm btn-secondary" onclick="RulesManager.render()">Cancel</button>
                </div>
            </div>
        `;
        document.getElementById("rulesEditor").value = this.rulesText;
    },

    applySelectedColor() {
        const textarea = document.getElementById("rulesEditor");
        const color = document.getElementById("rulesColorPicker")?.value || "#ffd100";
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
            UI.toast("Highlight the text you want to color first", "error");
            return;
        }

        const selected = textarea.value.slice(start, end);
        const wrapped = `[color=${color}]${selected}[/color]`;
        textarea.setRangeText(wrapped, start, end, "end");
        textarea.focus();
    },

    clearSelectedColor() {
        const textarea = document.getElementById("rulesEditor");
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
            UI.toast("Highlight colored text to clear it", "error");
            return;
        }

        const selected = textarea.value.slice(start, end);
        const cleaned = selected
            .replace(/\[color=(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\]/g, "")
            .replace(/\[\/color\]/g, "");
        textarea.setRangeText(cleaned, start, end, "end");
        textarea.focus();
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
