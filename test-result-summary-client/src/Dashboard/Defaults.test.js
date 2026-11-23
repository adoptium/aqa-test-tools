import Defaults, {
    getTabDefaults,
    releaseTab,
    releaseVersions,
} from './Defaults';

describe('release tabs', () => {
    test('releaseVersions lists the LTS versions and the latest feature release', () => {
        expect(
            releaseVersions({
                available_lts_releases: [8, 11, 17, 21, 25],
                most_recent_feature_release: 27,
                most_recent_lts: 25,
            })
        ).toEqual([8, 11, 17, 21, 25, 27]);
    });

    test('releaseVersions does not repeat a version or require the feature release', () => {
        expect(
            releaseVersions({
                available_lts_releases: [21, 25],
                most_recent_feature_release: 25,
            })
        ).toEqual([21, 25]);
        expect(releaseVersions({ available_lts_releases: [17] })).toEqual([17]);
        expect(releaseVersions(null)).toEqual([]);
        expect(releaseVersions({})).toEqual([]);
    });

    test('a release tab has a ReleaseSummary widget for its version', () => {
        expect(getTabDefaults(releaseTab(21))).toEqual({
            widgets: [
                {
                    type: 'ReleaseSummary',
                    x: 0,
                    y: 0,
                    settings: { version: '21' },
                },
            ],
        });
    });

    test('other tabs keep their defaults', () => {
        expect(getTabDefaults('Perf')).toBe(Defaults.Perf);
        expect(getTabDefaults('Custom')).toBe(Defaults.Custom);
        expect(Defaults.Release).toBeUndefined();
    });
});
