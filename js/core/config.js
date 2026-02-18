// ==========================================
// 1. CONFIGURATION
// ==========================================
const Config = {
    APP_VERSION: 'v2.1 (Pipeline & Smart Load)',

    // -------------------------------------------------------------------------
    // SECURITY CONFIGURATION
    // To allow "Public Write" (uploads without user login), you MUST provide
    // a Fine-grained Personal Access Token here with 'Contents: Read & Write'.
    // -------------------------------------------------------------------------
    GITHUB_ACCESS_TOKEN: '', // Leave EMPTY. Users must enter their own Token in 'Settings'.
    DEFAULT_KINGDOM_SETTINGS: {
        deadsMultiplier: 0.02,
        deadsWeight: 50,
        kpPowerDivisor: 3,
        t5MixRatio: 0.7,
        kpMultiplier: 1.25,
        t4Points: 10,
        t5Points: 20
    },
    COLUMN_MAPPING: {
        'Governor ID': ['governor id', 'gov id', 'id', 'user id', 'uid', 'character id'],
        'Governor Name': ['governor name', 'gov name', 'name', 'player', 'governor', 'username'],
        'Power': ['power', 'total power', 'pwr'],
        'Troop Power': ['troop power', 'troops', 'troop'],
        'Kill Points': ['kill points', 'kp', 'killpoints', 'kills', 'total kill points'],
        'Deads': ['deads', 'dead', 'deaths', 'dead troops'],
        'T1 Kills': ['t1 kills', 'tier 1 kills', 't1'],
        'T2 Kills': ['t2 kills', 'tier 2 kills', 't2'],
        'T3 Kills': ['t3 kills', 'tier 3 kills', 't3'],
        'T4 Kills': ['t4 kills', 'tier 4 kills', 't4'],
        'T5 Kills': ['t5 kills', 'tier 5 kills', 't5'],
        'Town Hall': ['town hall', 'th', 'al', 'city hall', 'ch'],
        'Alliance Tag': ['alliance', 'tag', 'alliance tag', 'abbr'],
        'Healed': ['healed', 'sev wounded', 'severely wounded', 'heads', 'units healed'],
        'Resources Gathered': ['resources gathered', 'rss gathered', 'gathered', 'resources', 'resource assistance', 'rss assistance', 'rss', 'resource'],
        'Assistance': ['assistance', 'rss assistance', 'resource assistance', 'given', 'rss given', 'resources given'],
        'Troop Power': ['troop power', 'troops power', 'tp'],
        'Commander Power': ['commander power', 'cmd power', 'cmp', 'commander', 'commanderpower', 'command power'],
        'Tech Power': ['tech power', 'technology power', 'tec', 'technology', 'research power', 'techpower', 'technical power'],
        'Building Power': ['building power', 'bld power', 'bld', 'building', 'buildingpower', 'build power'],
        '_kingdom': ['_kingdom', 'kingdom', 'kdm', 'kid', 'server', 'kd', 'origin server', 'current server', 'home kingdom']
    }
};
