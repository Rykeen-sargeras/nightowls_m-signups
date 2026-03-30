const RulesManager = {
    loaded: false,
    resetLoaded() { this.loaded = false; },
    async loadIfNeeded() { if (!this.loaded) await this.load(); this.render(); },
    async load() { this.data = await API.fetchRules(); this.loaded = true; },
    render() {
        document.getElementById('rulesBannerWrap').innerHTML = this.data.rules_banner ? `<img src="${this.data.rules_banner}" alt="Rules banner" class="dynamic-banner">` : '';
        document.getElementById('rulesDisplay').innerHTML = this.data.content ? this.data.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : '<div class="panel-note">No rules posted yet.</div>';
        const editor = document.getElementById('rulesAdminEditor');
        if (!AuthManager.isAdmin()) { editor.style.display = 'none'; editor.innerHTML = ''; return; }
        editor.style.display = 'block';
        editor.innerHTML = `<h3>Edit Rules</h3><div class="inline-admin-tools"><input type="file" id="rulesBannerFile" accept="image/*"><button class="btn btn-sm" onclick="RulesManager.uploadBanner()">Upload Rules Banner</button></div><div class="form-group"><label>Rules Content</label><textarea id="rulesTextarea">${this.data.content || ''}</textarea></div><button class="btn" onclick="RulesManager.saveRules()">Save Rules</button>`;
    },
    async saveRules() {
        try { await API.saveRules(document.getElementById('rulesTextarea').value); UI.toast('Rules updated'); this.loaded = false; await this.loadIfNeeded(); } catch (err) { UI.toast(err.message, 'error'); }
    },
    async uploadBanner() {
        const file = document.getElementById('rulesBannerFile').files[0];
        if (!file) return UI.toast('Choose a banner image first', 'error');
        try { await API.uploadBanner('rules', file); UI.toast('Rules banner updated'); this.loaded = false; await this.loadIfNeeded(); } catch (err) { UI.toast(err.message, 'error'); }
    },
};
