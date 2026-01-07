# Unity - Kingdom vs Kingdom Performance Analysis

Welcome to **Unity**, a tool designed to analyze Rise of Kingdoms stats, calculate DKP (Dragon Kill Points), and visualize player performance.

## 1. Upload Scans
This is your starting point.
- **Start Scan**: Upload the scan file taken *before* KvK (or the period you are analyzing).
- **End Scan**: Upload the scan file taken *after* KvK.
- **Supported Formats**: `.xlsx` or `.csv`.

> **Note**: The tool matches players by ID. If a player changes their name, they will still be tracked correctly.

## 2. Prekvk Analysis
This tab gives you a "raw" look at the data from the **End Scan**. It helps you understand the composition of the kingdom before applying any DKP formulas.
- **Kingdom Analysis**: Total power, T4/T5 kills, and deads for the whole kingdom.
- **Alliance Analysis**: Breakdown of stats by Alliance Tag.
- **Governor Profiles**: A list of the top governors sorted by power.

## 3. All Kingdom DKP Results
This is the "Leaderboard" for kingdoms.
- It compares multiple kingdoms (if you upload files for more than one) side-by-side.
- **KVK DKP**: The calculated score based on your configuration settings.

---

## 4. Kingdom Specific Tabs
Once you upload data, a new tab will appear for your kingdom (e.g., "Kingdom 1234"). Inside, you have several sub-tabs:

### A. Overview
A searchable table of every governor's raw stats (Power, Kills, Deads) from the End Scan.

### B. Scatter (Performance Plot)
This graph plots **Power** (X-axis) vs **Kill Points** (Y-axis) to categorize players.
- **Heroes (High KP, Low Deads)**: High performers who managed to get kills efficiently.
- **Warriors (High KP, High Deads)**: The fighters who sacrificed troops for the kingdom.
- **Feeders (Low KP, High Deads)**: Players who took heavy losses but didn't get many kills (likely city rallies or defense).
- **Slackers (Low KP, Low Deads)**: Low activity players.

### C. Power Efficiency
This chart answers: *"Did this player pull their weight?"*
- **X-Axis**: Starting Power.
- **Y-Axis**: DKP Score % (How close they came to their target).
- **Bubble Size**: Amount of Dead Troops.

**Zones:**
- 🟢 **Overperformers (>100%)**: Exceeded their DKP target.
- 🟡 **Meeting Expectations (80-100%)**: Did their job.
- 🔴 **Underperformers (<80%)**: Did not meet the requirements for their power level.

### D. Roster Analysis (Fortune Teller)
This looks at **Lifetime Statistics** (from the Start Scan) to predict player behavior.
- It helps you spot "farmers" (high power, low lifetime kills) vs "fighters" before KvK even starts.

### E. Configuration
Here you define the rules for DKP calculation.
- **Deads Multiplier**: Points given per dead troop.
- **T4/T5 Points**: Points given per kill.
- **KP/Power Divisor**: How much power determines the target KP.
- **T5 Mix Ratio**: The expected ratio of T5 kills for high-power players.

### F. Results
The final calculated report.
- Shows **Target KP** vs **Actual KP**.
- Shows **Target Deads** vs **Actual Deads**.
- **Bonus/Punishment**: A final score indicating if the player met their quota.
- **Export CSV**: Download this table to Excel/Google Sheets.
