class UICalendarRenderer {
    constructor() {
        this.containerId = 'calendarEventsContainer';
        this.statusId = 'eventsStatusLoader';

        // Ensure DOM elements exist before binding UI
        this.appleSyncBtn = document.getElementById('syncAppleCalendarBtn');
        this.googleSyncBtn = document.getElementById('syncGoogleCalendarBtn');
        this.refreshBtn = document.getElementById('refreshEventsBtn');

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => {
                this.render();
            });
        }

        if (this.appleSyncBtn) {
            this.appleSyncBtn.addEventListener('click', () => {
                if (window.calendarService && window.calendarService.isConfigured()) {
                    window.location.href = window.calendarService.getAppleSubscribeLink();
                } else {
                    alert("Please ask your Administrator to configure the Google Calendar ID in the Settings tab first.");
                }
            });
        }

        if (this.googleSyncBtn) {
            this.googleSyncBtn.addEventListener('click', () => {
                if (window.calendarService && window.calendarService.isConfigured()) {
                    window.open(window.calendarService.getGoogleSubscribeLink(), '_blank');
                } else {
                    alert("Please ask your Administrator to configure the Google Calendar ID in the Settings tab first.");
                }
            });
        }
    }

    async render() {
        const container = document.getElementById(this.containerId);
        const statusEl = document.getElementById(this.statusId);

        if (!container || !window.calendarService) return;

        if (!window.calendarService.isConfigured()) {
            statusEl.textContent = "Google Calendar is not configured. Add your credentials in Settings.";
            statusEl.style.color = "var(--danger-color)";
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: rgba(255,0,0,0.05); border: 1px dashed var(--danger-color); border-radius: 8px;">
                    <h3 style="color: var(--danger-color); margin-bottom: 10px;">Calendar Sync Not Configured</h3>
                    <p style="color: var(--text-secondary);">Your alliance leadership needs to add their Public Google Calendar ID in the Settings tab before events will appear here.</p>
                </div>
            `;
            return;
        }

        try {
            statusEl.textContent = "Fetching live schedule from Google...";
            statusEl.style.color = "var(--warning-color)";
            container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Loading Calendar Data...</div>`;

            const events = await window.calendarService.fetchUpcomingEvents();

            if (events.length === 0) {
                statusEl.textContent = "Up to date! No upcoming events currently scheduled.";
                statusEl.style.color = "var(--success-color)";
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                        <h3 style="color: var(--text-primary); margin-bottom: 10px;">Your schedule is clear!</h3>
                        <p style="color: var(--text-secondary);">There are no upcoming events in the calendar right now.</p>
                    </div>
                `;
                return;
            }

            // Build the HTML for each event card
            container.innerHTML = events.map(e => this._createEventCardHTML(e)).join('');

            statusEl.textContent = `Showing ${events.length} upcoming event${events.length === 1 ? '' : 's'}. Sync via Apple/Google links above.`;
            statusEl.style.color = "var(--success-color)";
        } catch (error) {
            console.error("Renderer failed fetching events:", error);
            statusEl.textContent = "Error fetching schedule. Check console or verify your API keys.";
            statusEl.style.color = "var(--danger-color)";
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: rgba(255,0,0,0.05); border: 1px dashed var(--danger-color); border-radius: 8px;">
                    <h3 style="color: var(--danger-color); margin-bottom: 10px;">Connection Failed</h3>
                    <p style="color: var(--text-secondary);">${error.message}</p>
                </div>
            `;
        }
    }

    _createEventCardHTML(event) {
        // Format the Date
        const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
        let dateStr = event.startDate.toLocaleDateString(undefined, dateOptions);

        let timeStr = 'All Day';
        if (!event.isAllDay) {
            const timeOptions = { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
            const startTime = event.startDate.toLocaleTimeString(undefined, timeOptions);
            const endTime = event.endDate.toLocaleTimeString(undefined, timeOptions);
            timeStr = `${startTime} - ${endTime}`;
        }

        // Add a pulsing dot for events happening TODAY
        const isToday = event.startDate.toDateString() === new Date().toDateString();
        const pulseBadge = isToday ? '<span class="badge" style="background: var(--accent-primary); color: white; animation: pulse 2s infinite;">Happening Today</span>' : '';

        // Extract any links physically written in the description
        const cleanDesc = this._autoLinkUrls(event.description);

        return `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; cursor: default;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: var(--accent-primary); font-size: 1.25rem;">${event.title}</h3>
                    ${pulseBadge}
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center; color: var(--text-primary); margin-bottom: 5px; font-weight: 500;">
                    <span>📅</span> <span>${dateStr}</span>
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center; color: var(--warning-color); margin-bottom: 15px; font-weight: bold; font-size: 0.95rem;">
                    <span>⏰</span> <span>${timeStr}</span>
                </div>
                
                ${event.location ? `<div style="display: flex; gap: 8px; align-items: center; color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 15px; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 4px;"><span>📍</span> <span>${event.location}</span></div>` : ''}

                <div style="flex-grow: 1; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 20px; white-space: pre-wrap; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                    ${cleanDesc || '<span style="font-style: italic; opacity: 0.5;">No description provided.</span>'}
                </div>

                <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: auto;">
                    ${event.htmlLink ? `<a href="${event.htmlLink}" target="_blank" class="secondary-btn" style="text-decoration: none; font-size: 0.85rem; padding: 8px 12px; background: rgba(59, 130, 246, 0.1); border-color: var(--accent-primary); color: var(--text-primary);">View on G-Calendar ↗</a>` : ''}
                </div>
            </div>
        `;
    }

    _autoLinkUrls(text) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function (url) {
            return `<a href="${url}" target="_blank" style="color: var(--accent-primary); text-decoration: underline;">${url}</a>`;
        });
    }
}

window.UICalendarRenderer = UICalendarRenderer;
