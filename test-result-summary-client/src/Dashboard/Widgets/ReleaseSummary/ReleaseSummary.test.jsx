import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ReleaseSummary from './ReleaseSummary';

// Jest 27 (CRA) cannot resolve react-router's package exports map
jest.mock(
    'react-router-dom',
    () => ({ Link: ({ children }) => <a>{children}</a> }),
    {
        virtual: true,
    }
);
jest.mock('../../../utils/Utils', () => ({
    ...jest.requireActual('../../../utils/Utils'),
    fetchData: jest.fn(),
}));
const { fetchData } = require('../../../utils/Utils');

const b = (buildName, buildResult = 'SUCCESS', extra = {}) => ({
    _id: buildName,
    buildName,
    buildResult,
    status: 'Done',
    buildNum: 1,
    buildUrl: `http://jenkins/${buildName}`,
    timestamp: 1,
    ...extra,
});

const T = (p, r) => b(`Test_openjdk21_hs_sanity.functional_${p}`, r);

const routes = {
    '/api/getTopLevelBuildNames?type=Build': [
        { _id: { url: 'http://j', buildName: 'release-openjdk21-pipeline' } },
        { _id: { url: 'http://j', buildName: 'openjdk21-pipeline' } },
    ],
    '/api/getTopLevelBuildNames?type=Test': [],
    '/api/getBuildHistory': [
        b('release-openjdk21-pipeline', 'SUCCESS', { _id: 'p1', buildNum: 7 }),
    ],
    '/api/getData': [
        b('release-openjdk21-pipeline', 'SUCCESS', {
            _id: 'p1',
            buildNum: 7,
            timestamp: Date.parse('2026-11-01T00:00:00Z'),
            buildParams: [
                { name: 'overridePublishName', value: 'jdk-21.0.5+11' },
            ],
        }),
    ],
    '^(jdk[0-9]{1,2}|jdk-|Build_)': [
        b('jdk21u-linux-x64-temurin'),
        b('jdk21u-mac-x64-temurin'),
        b('jdk21u-linux-aarch64-temurin'),
    ],
    '^(Test|Perf)_openjdk.*': [
        T('x86-64_linux'),
        T('x86-64_mac'),
        T('aarch64_linux', 'FAILURE'),
    ],
    '(create_installer|sign_installer)': [b('create_installer_mac')],
    '^AQA_Test_Pipeline_JCK$': [],
    '/api/getTemurinLinuxInstallerBuilds?tag=jdk-21.0.5+11': {
        builds: [
            b('create_installer_linux', 'SUCCESS', {
                buildNum: 3,
                buildParams: [
                    { name: 'TAG', value: 'jdk-21.0.5+11' },
                    {
                        name: 'ARTIFACTS_TO_COPY',
                        value: 'build/linux/x64/jdk/hotspot/*.tar.gz',
                    },
                ],
            }),
        ],
    },
    '/api/getTemurinDockerTags': {
        count: 1,
        tags: [{ name: '21.0.5_11-jdk-noble', platforms: ['linux/amd64'] }],
    },
};

let notesResponse;
// aqa-tests issues returned by the GitHub issues API, or null when it fails
let aqaIssues;

const aqaIssue = (number, title, extra = {}) => ({
    number,
    title,
    html_url: `https://github.com/adoptium/aqa-tests/issues/${number}`,
    state: 'open',
    body: '',
    ...extra,
});

// jdk21u commits by tag: the -ga tag, and an _adopt tag that merges it
const githubCommits = {
    'jdk-21.0.13.1-ga': { sha: 'ga131', parents: [{ sha: 'x' }] },
    'jdk-21.0.13.1+1_adopt': {
        sha: 'merge131',
        html_url: 'https://github.com/adoptium/jdk21u/commit/merge131',
        parents: [{ sha: 'rel' }, { sha: 'ga131' }],
    },
    'jdk-21.0.12+7_adopt': {
        sha: 'merge12',
        parents: [{ sha: 'rel' }, { sha: 'ga12' }],
    },
};

const planCommit = (sha, date) => ({
    sha,
    html_url: `https://github.com/adoptium/mirror-scripts/commit/${sha}`,
    commit: { committer: { date } },
});

// the issues are cached for 5 minutes, so every test moves the clock forward
const realNow = Date.now();
let clock = 0;

beforeEach(() => {
    clock += 60 * 60 * 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow + clock);
    aqaIssues = [];
    notesResponse = {
        status: 200,
        ok: true,
        json: async () => ({ release_notes: [{ id: 'JDK-1' }] }),
    };
    global.IS_REACT_ACT_ENVIRONMENT = true;
    fetchData.mockImplementation(async (url) => {
        const key = Object.keys(routes).find((k) =>
            decodeURIComponent(url).includes(k)
        );
        return key ? routes[key] : [];
    });
    global.fetch = jest.fn(async (url) => {
        if (url.includes('/info/release_notes/')) {
            return notesResponse;
        }
        if (url.includes('repos/adoptium/aqa-tests/issues')) {
            return aqaIssues
                ? { status: 200, ok: true, json: async () => aqaIssues }
                : { status: 403, ok: false, json: async () => ({}) };
        }
        const commitRef = /repos\/adoptium\/jdk21u\/commits\/(.+)$/.exec(url);
        if (commitRef) {
            const commit = githubCommits[decodeURIComponent(commitRef[1])];
            return commit
                ? { status: 200, ok: true, json: async () => commit }
                : { status: 422, ok: false, json: async () => ({}) };
        }
        if (url.includes('/mirror-scripts/commits')) {
            return {
                status: 200,
                ok: true,
                json: async () => [
                    // committed after the pipeline started, must be ignored
                    planCommit('newer', '2026-12-01T00:00:00Z'),
                    planCommit('abcdef1234', '2026-10-19T00:00:00Z'),
                ],
            };
        }
        if (url.includes('/newer/releasePlan.cfg')) {
            throw new Error('revision after the pipeline start was requested');
        }
        if (url.includes('/abcdef1234/releasePlan.cfg')) {
            return {
                status: 200,
                ok: true,
                text: async () => 'jdk21uGA="jdk-21.0.13.1-ga"\n',
            };
        }
        return {
            status: 200,
            ok: true,
            json: async () => ({
                binaries: [
                    { architecture: 'x64', os: 'linux', jvm_impl: 'hotspot' },
                    {
                        architecture: 'x64',
                        os: 'mac',
                        jvm_impl: 'hotspot',
                        installer: {},
                    },
                ],
            }),
        };
    });
});

const flush = () => act(() => new Promise((r) => setTimeout(r, 20)));

test('renders summary for the selected pipeline', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = jest.fn();

    await act(async () => {
        root.render(
            <ReleaseSummary
                pipelineSelected="p1"
                pipelineLabel="release-openjdk21-pipeline #7"
                onChange={onChange}
            />
        );
    });
    await flush();
    await flush();

    const text = container.textContent;
    expect(text).toContain('Release: jdk-21.0.5+11');
    expect(text).toContain('Platforms Published (2)');
    const order = [
        'Platforms In Progress',
        'Platforms Requiring Triage',
        'Platforms Ready to Publish',
        'Platforms Published',
    ].map((h) => text.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain('Building source tag: jdk-21.0.13.1-ga');
    expect(text).toContain('planned in releasePlan.cfg abcdef1');
    expect(
        container.querySelector('a[href$="/commit/abcdef1234"]')
    ).not.toBeNull();
    expect(text).toContain('Remaining activities');
    expect(text).toContain('Triage the failures on 1 platform(s)');
    expect(text.indexOf('Remaining activities')).toBeGreaterThan(
        text.indexOf('Release Notes')
    );
    expect(text).toContain('Release Notes');
    expect(text).toContain('1 item(s)');
    expect(
        container.querySelector(
            'a[href*="release-notes?version=jdk-21.0.5%2B11"]'
        )
    ).not.toBeNull();
    expect(text).toContain('Platforms Ready to Publish (0)');
    expect(text).toContain('Platforms Requiring Triage (1)');
    expect(text).toContain('67% published');
    expect(text).toContain('3 platforms in this pipeline run');
    expect(text).toContain('Installers');
    expect(text).toContain('Containers');
    expect(text).toContain('linux/amd64');
    expect(text).toContain('Linux packages (RPM / DEB / APK)');
    expect(
        container.querySelector(
            'a[href="http://jenkins/create_installer_linux"]'
        ).textContent
    ).toBe('x64 Linux');
    // pipeline dropdown only lists release pipelines
    expect(
        fetchData.mock.calls.some(([u]) => u.includes('getBuildHistory'))
    ).toBe(true);

    await act(async () => root.unmount());
});

const originalParams = routes['/api/getData'][0].buildParams;
afterEach(() => {
    routes['/api/getData'][0].buildParams = originalParams;
});

const renderWithTag = async (scmReference) => {
    const parent = routes['/api/getData'][0];
    parent.buildParams = [
        { name: 'overridePublishName', value: 'jdk-21.0.5+11' },
        { name: 'scmReference', value: scmReference },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <ReleaseSummary pipelineSelected="p1" onChange={jest.fn()} />
        );
    });
    await flush();
    await flush();
    return { container, root };
};

test('verifies the source tag against the planned -ga tag by commit', async () => {
    const { container, root } = await renderWithTag('jdk-21.0.13.1+1_adopt');
    const text = container.textContent;
    expect(text).toContain('Building source tag: jdk-21.0.13.1+1_adopt');
    expect(text).toContain('Matches planned jdk-21.0.13.1-ga');
    expect(text).toContain('commit merge13 is a merge of jdk-21.0.13.1-ga');
    expect(text).toContain('releasePlan.cfg abcdef1');
    await act(async () => root.unmount());
});

test('warns when the source tag is not the planned tag', async () => {
    const { container, root } = await renderWithTag('jdk-21.0.12+7_adopt');
    const text = container.textContent;
    expect(text).toContain('Does not match planned jdk-21.0.13.1-ga');
    expect(text).not.toContain('Matches planned');
    await act(async () => root.unmount());
});

test('reports a source tag that does not exist', async () => {
    const { container, root } = await renderWithTag('jdk-21.0.99-ga');
    expect(container.textContent).toContain('Tag not found in adoptium/jdk21u');
    await act(async () => root.unmount());
});

test('reports release notes as not published on 404', async () => {
    notesResponse = { status: 404, ok: false, json: async () => ({}) };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <ReleaseSummary pipelineSelected="p1" onChange={jest.fn()} />
        );
    });
    await flush();
    await flush();
    const text = container.textContent;
    expect(text).toMatch(/Release Notes\s*Not published/);
    await act(async () => root.unmount());
});

test('shows a prompt when nothing is selected', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(<ReleaseSummary onChange={jest.fn()} />);
    });
    await flush();
    expect(container.textContent).toContain(
        'Select a release pipeline to see its summary'
    );
    await act(async () => root.unmount());
});

const renderSelected = async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <ReleaseSummary pipelineSelected="p1" onChange={jest.fn()} />
        );
    });
    await flush();
    await flush();
    return { container, root };
};

const parentIssue = aqaIssue(
    100,
    'November 2026 Release AQAvit Activities - JDK21',
    {
        body: 'Pipeline URL: https://ci.adoptium.net/job/build-scripts/job/release-openjdk21-pipeline/7/\nVersion: JDK21',
    }
);

test('a closed triage issue moves the platform to ready to publish', async () => {
    aqaIssues = [
        parentIssue,
        aqaIssue(
            101,
            'Triage Automated Tests for November 2026 JDK21 - aarch64_linux',
            { state: 'closed' }
        ),
    ];
    const { container, root } = await renderSelected();
    const text = container.textContent;
    expect(text).toContain('Platforms Requiring Triage (0)');
    expect(text).toContain('Platforms Ready to Publish (1)');
    expect(text).toContain('1/1 triage issue(s) closed');
    expect(
        container.querySelector('a[href$="/aqa-tests/issues/100"]')
    ).not.toBeNull();
    await act(async () => root.unmount());
});

test('an open triage issue keeps the platform in triage', async () => {
    aqaIssues = [
        parentIssue,
        aqaIssue(
            101,
            'Triage Automated Tests for November 2026 JDK21 - aarch64_linux'
        ),
    ];
    const { container, root } = await renderSelected();
    const text = container.textContent;
    expect(text).toContain('Platforms Requiring Triage (1)');
    expect(text).toContain('0/1 triage issue(s) closed');
    expect(text).toContain('aarch64 Linux (issue #101)');
    await act(async () => root.unmount());
});

test('reports when there is no aqa-tests release issue', async () => {
    const { container, root } = await renderSelected();
    expect(container.textContent).toContain(
        'no aqa-tests release issue found for this pipeline'
    );
    expect(container.textContent).toContain('Platforms Requiring Triage (1)');
    await act(async () => root.unmount());
});

test('still renders when the aqa-tests issues cannot be read', async () => {
    aqaIssues = null;
    const { container, root } = await renderSelected();
    const text = container.textContent;
    expect(text).toContain('aqa-tests issues unavailable');
    expect(text).toContain('Platforms Published (2)');
    await act(async () => root.unmount());
});

test('the refresh button reloads the release and the GitHub issues', async () => {
    aqaIssues = [
        parentIssue,
        aqaIssue(
            101,
            'Triage Automated Tests for November 2026 JDK21 - aarch64_linux'
        ),
    ];
    const { container, root } = await renderSelected();
    expect(container.textContent).toContain('Platforms Requiring Triage (1)');
    const issueCalls = () =>
        global.fetch.mock.calls.filter(([u]) =>
            u.includes('repos/adoptium/aqa-tests/issues')
        ).length;
    expect(issueCalls()).toBe(1);

    // the triage issue is closed on GitHub
    aqaIssues = [
        parentIssue,
        aqaIssue(
            101,
            'Triage Automated Tests for November 2026 JDK21 - aarch64_linux',
            { state: 'closed' }
        ),
    ];
    await act(async () => {
        container.querySelector('button[aria-label="Refresh"]').click();
    });
    await flush();
    await flush();
    expect(issueCalls()).toBe(2);
    expect(container.textContent).toContain('Platforms Requiring Triage (0)');
    expect(container.textContent).toContain('Platforms Ready to Publish (1)');
    await act(async () => root.unmount());
});

test('the refresh button is disabled without a pipeline', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(<ReleaseSummary onChange={jest.fn()} />);
    });
    await flush();
    expect(
        container.querySelector('button[aria-label="Refresh"]').disabled
    ).toBe(true);
    await act(async () => root.unmount());
});

const renderVersion = async (version) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(<ReleaseSummary version={version} onChange={jest.fn()} />);
    });
    await flush();
    return { container, root };
};

test('lists only the pipelines of the tab version', async () => {
    const { root } = await renderVersion('21');
    const historyCalls = () =>
        fetchData.mock.calls.filter(([u]) => u.includes('getBuildHistory'));
    expect(historyCalls().length).toBe(1);
    expect(historyCalls()[0][0]).toContain('release-openjdk21-pipeline');
    await act(async () => root.unmount());

    fetchData.mockClear();
    const other = await renderVersion('17');
    expect(historyCalls().length).toBe(0);
    await act(async () => other.root.unmount());
});

test('lists the pipelines of every version without a version', async () => {
    const { root } = await renderVersion(undefined);
    expect(
        fetchData.mock.calls.filter(([u]) => u.includes('getBuildHistory'))
            .length
    ).toBe(1);
    await act(async () => root.unmount());
});

describe('TCK results', () => {
    const tests = routes['^(Test|Perf)_openjdk.*'];
    const originalTests = [...tests];
    const jckKey = '^AQA_Test_Pipeline_JCK$';
    const remoteKey = '/api/getRemoteJckBuildInfo';

    afterEach(() => {
        tests.splice(0, tests.length, ...originalTests);
        routes[jckKey] = [];
        delete routes[remoteKey];
    });

    // every AQA build passes, so only the TCK decides aarch64 Linux
    const setUp = (remote) => {
        tests.splice(0, tests.length, T('x86-64_linux'), T('x86-64_mac'));
        tests.push(T('aarch64_linux'));
        routes[jckKey] = [
            b('AQA_Test_Pipeline_JCK', 'SUCCESS', { buildNum: 3 }),
        ];
        routes[remoteKey] = remote;
    };
    const jck = (target, buildResult) => ({
        target,
        platform: 'aarch64_linux',
        jdkVersion: '21',
        buildResult,
        remoteUrl: `http://remote/${target}`,
    });
    const all = ['sanity', 'extended', 'special', 'dev'];

    test('is ready when every required TCK target passed', async () => {
        setUp(all.map((t) => jck(t, 'SUCCESS')));
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain(
            'Platforms Ready to Publish (1)'
        );
        expect(container.textContent).toContain(
            'Platforms Requiring Triage (0)'
        );
        await act(async () => root.unmount());
    });

    test('needs triage when a TCK target has no status', async () => {
        setUp(all.map((t) => jck(t, t === 'dev' ? null : 'SUCCESS')));
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain(
            'Platforms Requiring Triage (1)'
        );
        expect(container.textContent).toContain(
            'Platforms Ready to Publish (0)'
        );
        await act(async () => root.unmount());
    });

    test('needs triage when the TCK status cannot be read', async () => {
        setUp({ error: 'Error: remote Jenkins is not reachable' });
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain(
            'Platforms Requiring Triage (1)'
        );
        await act(async () => root.unmount());
    });
});

describe('failures reading data', () => {
    const failing = (fragment) => {
        const original = fetchData.getMockImplementation();
        fetchData.mockImplementation(async (url) =>
            decodeURIComponent(url).includes(fragment)
                ? undefined
                : original(url)
        );
    };

    test('a failed JDK build query is an error, not an empty pipeline', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        failing('^(jdk[0-9]{1,2}|jdk-|Build_)');
        const { container, root } = await renderSelected();
        const text = container.textContent;
        expect(text).toContain('Failed to load release information');
        expect(text).not.toContain('The release is complete');
        expect(text).not.toContain('Platforms Published');
        await act(async () => root.unmount());
    });

    test('a failed AQA build query is an error, not an empty pipeline', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        failing('^(Test|Perf)_openjdk.*');
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain(
            'Failed to load release information'
        );
        expect(container.textContent).not.toContain('The release is complete');
        await act(async () => root.unmount());
    });

    test('a failed installer query does not stop the summary', async () => {
        failing('(create_installer|sign_installer)');
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain('Platforms Published (2)');
        await act(async () => root.unmount());
    });

    test('release notes that cannot be read need a manual check', async () => {
        notesResponse = { status: 500, ok: false, json: async () => ({}) };
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain(
            'Check the release notes manually'
        );
        await act(async () => root.unmount());
    });
});

describe('source tag lookups', () => {
    test('a tag that does not exist yet is looked up again on refresh', async () => {
        const parent = routes['/api/getData'][0];
        parent.buildParams = [
            { name: 'overridePublishName', value: 'jdk-21.0.5+11' },
            { name: 'scmReference', value: 'jdk-21.0.14+1_adopt' },
        ];
        const lookups = () =>
            global.fetch.mock.calls.filter(([u]) =>
                u.includes('jdk21u/commits/jdk-21.0.14%2B1_adopt')
            ).length;
        const { container, root } = await renderSelected();
        expect(container.textContent).toContain(
            'Tag not found in adoptium/jdk21u'
        );
        expect(lookups()).toBe(1);

        // the tag is created on GitHub
        githubCommits['jdk-21.0.14+1_adopt'] = {
            sha: 'merge14',
            parents: [{ sha: 'rel' }, { sha: 'ga131' }],
        };
        try {
            await act(async () => {
                container.querySelector('button[aria-label="Refresh"]').click();
            });
            await flush();
            await flush();
            expect(lookups()).toBe(2);
            expect(container.textContent).not.toContain('Tag not found');
            expect(container.textContent).toContain('Matches planned');

            // a tag that was found is not requested again
            await act(async () => {
                container.querySelector('button[aria-label="Refresh"]').click();
            });
            await flush();
            await flush();
            expect(lookups()).toBe(2);
        } finally {
            delete githubCommits['jdk-21.0.14+1_adopt'];
        }
        await act(async () => root.unmount());
    });
});
