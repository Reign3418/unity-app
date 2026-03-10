class CalendarService {
    constructor() {
        this.calendarId = localStorage.getItem('google_calendar_id') || '';
        this.apiKey = localStorage.getItem('google_calendar_api_key') || '';
        this.baseUrl = 'https://content.googleapis.com/calendar/v3/calendars/';
    }

    updateConfig(calendarId, apiKey) {
        this.calendarId = calendarId;
        this.apiKey = apiKey;
        localStorage.setItem('google_calendar_id', calendarId);
        localStorage.setItem('google_calendar_api_key', apiKey);
    }

    isConfigured() {
        return this.calendarId && this.apiKey;
    }

    async fetchUpcomingEvents() {
        if (!this.isConfigured()) {
            throw new Error('Google Calendar is not configured. Please add your credentials in Settings.');
        }

        try {
            // ISO 8601 format for Google API
            const timeMin = new Date().toISOString();

            // Construct the API URL
            // Encode the calendar ID since it usually contains an '@' symbol
            const url = `${this.baseUrl}${encodeURIComponent(this.calendarId)}/events?key=${this.apiKey}&timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=50`;

            const response = await fetch(url);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Calendar fetch failed:", errorData);
                throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this._parseEvents(data.items || []);
        } catch (error) {
            console.error("Error in CalendarService.fetchUpcomingEvents:", error);
            throw error;
        }
    }

    _parseEvents(items) {
        return items.map(item => {
            // Google events can be 'date' (all day) or 'dateTime' (specific time)
            const startStr = item.start.dateTime || item.start.date;
            const endStr = item.end.dateTime || item.end.date;

            const startDate = new Date(startStr);
            const endDate = new Date(endStr);
            const isAllDay = !item.start.dateTime;

            return {
                id: item.id,
                title: item.summary || 'Untitled Event',
                description: item.description || '',
                location: item.location || '',
                htmlLink: item.htmlLink, // Link to view on Google Calendar
                startDate: startDate,
                endDate: endDate,
                isAllDay: isAllDay,
                timestamp: startDate.getTime() // Useful for custom sorting if needed
            };
        });
    }

    /**
     * Generates a webcal:// URL that triggers iOS / Mac Calendar subscription
     */
    getAppleSubscribeLink() {
        if (!this.calendarId) return '#';
        // Google provides a secret iCal format link. 
        // For public calendars, it follows this structure:
        const cleanId = this.calendarId.replace('@', '%40');
        const icsUrl = `calendar.google.com/calendar/ical/${cleanId}/public/basic.ics`;
        return `webcal://${icsUrl}`;
    }

    /**
     * Generates a link to add the public calendar to a user's personal Google Calendar
     */
    getGoogleSubscribeLink() {
        if (!this.calendarId) return '#';
        const cleanId = encodeURIComponent(this.calendarId);
        return `https://calendar.google.com/calendar/render?cid=${cleanId}`;
    }
}

window.CalendarService = CalendarService;
