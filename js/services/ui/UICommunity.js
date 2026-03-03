class UICommunity {
    constructor() {
        this.sub = null;

        // Initialize Dedicated Community Hub Firebase App
        this.hubApp = null;
        this.hubDb = null;
        try {
            const existingApp = firebase.apps.find(app => app.name === "CommunityHub");
            if (!existingApp) {
                this.hubApp = firebase.initializeApp({
                    databaseURL: "https://communityhub-ac1f1-default-rtdb.firebaseio.com/"
                }, "CommunityHub");
            } else {
                this.hubApp = existingApp;
            }
            this.hubDb = this.hubApp.database();
            console.log("Community Hub connected to global dedicated server.");
        } catch (e) {
            console.error("Community Hub DB Init Error:", e);
        }

        // Cache DOM Elements
        this.boardContainer = document.getElementById('communityFeedContainer');
        this.emptyState = document.getElementById('communityEmptyState');
        this.submitBtn = document.getElementById('communitySubmitBtn');
        this.statusMsg = document.getElementById('communitySubmitStatus');

        this.typeSelect = document.getElementById('communityType');
        this.nameInput = document.getElementById('communityName');
        this.messageInput = document.getElementById('communityMessage');
        this.charCount = document.getElementById('communityCharCount');

        // Color Profiles for Card Badges
        this.typeStyles = {
            'Idea': { color: 'var(--warning-color)', bg: 'rgba(245, 158, 11, 0.15)', icon: '💡' },
            'Bug': { color: 'var(--danger-color)', bg: 'rgba(239, 68, 68, 0.15)', icon: '🐛' },
            'Review': { color: 'var(--success-color)', bg: 'rgba(16, 185, 129, 0.15)', icon: '⭐' },
            'Question': { color: 'var(--accent-primary)', bg: 'rgba(99, 102, 241, 0.15)', icon: '❓' }
        };
    }

    init() {
        if (!this.boardContainer) return; // Tab not in DOM

        this.bindEvents();
        this.subscribeToFeed();
    }

    bindEvents() {
        // Character counter
        this.messageInput.addEventListener('input', () => {
            this.charCount.textContent = this.messageInput.value.length;
        });

        // Submit Button
        this.submitBtn.addEventListener('click', async () => {
            const type = this.typeSelect.value;
            const name = this.nameInput.value.trim();
            const message = this.messageInput.value.trim();

            if (!name) {
                this.showStatus('Please enter your name or kingdom.', 'var(--danger-color)');
                return;
            }
            if (!message) {
                this.showStatus('Please write a message.', 'var(--danger-color)');
                return;
            }

            this.submitBtn.disabled = true;
            this.submitBtn.style.opacity = '0.5';
            this.showStatus('Posting...', 'var(--text-secondary)');

            try {
                await this.submitFeedback({
                    type,
                    name,
                    message
                });

                this.showStatus('Posted successfully! 🎉', 'var(--success-color)');
                this.messageInput.value = '';
                this.charCount.textContent = '0';

                // Clear success message after 3 seconds
                setTimeout(() => {
                    this.showStatus('', 'transparent');
                }, 3000);

            } catch (err) {
                this.showStatus('Error: ' + err.message, 'var(--danger-color)');
            } finally {
                this.submitBtn.disabled = false;
                this.submitBtn.style.opacity = '1';
            }
        });
    }

    showStatus(msg, color) {
        this.statusMsg.textContent = msg;
        this.statusMsg.style.color = color;
    }

    subscribeToFeed() {
        if (this.emptyState) {
            this.emptyState.textContent = 'Listening for community activity...';
        }

        // The callback fires once for every existing post, and then again for any new ones
        this.sub = this.listenToFeedback((post) => {
            if (this.emptyState) {
                this.emptyState.remove();
                this.emptyState = null;
            }
            this.renderCard(post);
        });

        if (!this.sub && this.emptyState) {
            this.emptyState.textContent = 'Not connected to Community Database.';
            this.emptyState.style.color = 'var(--danger-color)';
        }
    }

    // ------------------------------------------------------------------------
    // DATABASE METHODS
    // ------------------------------------------------------------------------
    async submitFeedback(postData) {
        if (!this.hubDb) throw new Error("Community Hub database not initialized.");
        const newPostRef = this.hubDb.ref('community_feedback').push();
        await newPostRef.set({
            ...postData,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        return true;
    }

    listenToFeedback(callback) {
        if (!this.hubDb) return null;
        const feedbackRef = this.hubDb.ref('community_feedback').orderByChild('timestamp').limitToLast(100);
        const listener = feedbackRef.on('child_added', (snapshot) => {
            const val = snapshot.val();
            const key = snapshot.key;
            callback({ id: key, ...val });
        });
        return () => {
            feedbackRef.off('child_added', listener);
        };
    }

    renderCard(post) {
        const style = this.typeStyles[post.type] || this.typeStyles['Question'];

        // Format Time
        const dateObj = new Date(post.timestamp);
        const timeString = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            + ' a las ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        card.style.cssText = `
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-top: 3px solid ${style.color};
            border-radius: 0.75rem;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 10px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            animation: fadeIn 0.4s ease;
            break-inside: avoid;
        `;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <span style="background: ${style.bg}; color: ${style.color}; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                    ${style.icon} ${post.type}
                </span>
                <span style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap;">${timeString}</span>
            </div>
            
            <p style="font-size: 0.95rem; color: var(--text-primary); margin: 0; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap;">
                ${this.escapeHTML(post.message)}
            </p>
            
            <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                <span style="background: rgba(255,255,255,0.1); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">👤</span>
                ${this.escapeHTML(post.name)}
            </div>
        `;

        // We use prepend so newest messages appear at the top.
        this.boardContainer.prepend(card);
    }

    // Basic XSS protection before rendering user strings
    escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }
}

window.UICommunity = UICommunity;
