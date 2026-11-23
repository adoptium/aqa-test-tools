const Defaults = {
    Custom: {
        widgets: [
            {
                type: 'BuildStatus',
                x: 0,
                y: 0,
                settings: {
                    serverSelected: 'AdoptOpenJDK',
                    title: 'https://ci.adoptium.net',
                },
            },
        ],
    },
    Perf: {
        widgets: [
            {
                type: 'Dacapo',
                x: 0,
                y: 0,
                settings: {
                    serverSelected: 'AdoptOpenJDK',
                    buildSelected: 'Test_openjdk8_j9_sanity.perf_x86-64_linux',
                },
            },
        ],
    },
};

// Release tabs are created per JDK version, e.g. Release-21. Each one has a
// ReleaseSummary widget that lists the release pipelines of that version.
const RELEASE_TAB = /^Release-(\d+)$/;

export const releaseTab = (version) => `Release-${version}`;

export const getTabDefaults = (tab) => {
    const m = RELEASE_TAB.exec(tab);
    if (m) {
        return {
            widgets: [
                {
                    type: 'ReleaseSummary',
                    x: 0,
                    y: 0,
                    settings: { version: m[1] },
                },
            ],
        };
    }
    return Defaults[tab];
};

/**
 * The JDK versions that get a release tab, from the Adoptium API
 * (https://api.adoptium.net/v3/info/available_releases): every LTS release
 * and the most recent feature release.
 */
export const releaseVersions = (info) => {
    const versions = [
        ...((info && info.available_lts_releases) || []),
        info && info.most_recent_feature_release,
    ].filter((v) => Number.isInteger(v));
    return [...new Set(versions)].sort((a, b) => a - b);
};

export default Defaults;
