// ==========================================
// SERVICE: GITHUB
// ==========================================
class GitHubService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        // Default to public repo if no local config found
        const defaults = { owner: 'reign3418', repo: 'unity-app', token: '' };
        this.config = JSON.parse(localStorage.getItem('unity_gh_config')) || defaults;
        // Ensure defaults are populated if partial config exists (except token)
        if (!this.config.owner) this.config.owner = defaults.owner;
        if (!this.config.repo) this.config.repo = defaults.repo;
    }

    saveConfig(owner, repo, token) {
        this.config = { owner, repo, token };
        localStorage.setItem('unity_gh_config', JSON.stringify(this.config));
        return true;
    }

    getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        if (this.config.token) {
            headers['Authorization'] = `token ${this.config.token}`;
        }
        return headers;
    }

    async uploadFile(path, content, message) {
        if (!this.config.token) throw new Error("GitHub Token not found. Please configure in Settings.");

        const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        // Check if file exists to get SHA (for update)
        let sha = null;
        try {
            const existing = await fetch(url, { headers: this.getHeaders() });
            if (existing.ok) {
                const data = await existing.json();
                sha = data.sha;
            }
        } catch (e) { /* Ignore if not exists */ }

        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))), // Base64 encode
            branch: 'main' // Default branch
        };
        if (sha) body.sha = sha;

        const response = await fetch(url, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Upload failed');
        }
        return await response.json();
    }

    async getFiles(folderPath) {
        // Allow public access: Don't return empty if no token.
        // The fetch request will simply lack the Authorization header.
        const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${folderPath}`;
        const response = await fetch(url, { headers: this.getHeaders() });

        if (!response.ok) {
            if (response.status === 404) {
                // Determine if it's Authentication issue or truly 404
                if (!this.config.token) throw new Error("Folder not found. (If Private Repo, check Settings)");
                throw new Error("Folder not found.");
            }
            const err = await response.json();
            throw new Error(err.message || 'Failed to list files');
        }
        return await response.json();
    }

    async getFileContent(path) {
        const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        const headers = this.getHeaders();
        // Request raw content directly to handle large files and private repos correctly
        headers['Accept'] = 'application/vnd.github.v3.raw';

        console.log(`Fetching RAW content from: ${url}`);
        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errText = await response.text();
            console.error('GitHub Fetch Error:', errText);
            if (response.status === 404) {
                if (!this.config.token) throw new Error('File not found. (Note: Private Repos require a Token in Settings)');
                throw new Error('File not found.');
            }
            throw new Error(`Could not fetch file: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }
}
