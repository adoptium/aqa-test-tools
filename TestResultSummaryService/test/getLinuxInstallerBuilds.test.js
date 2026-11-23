const assert = require('node:assert/strict');
const { test } = require('node:test');

let requested = null;
let gotResponse = null;
const gotPath = require.resolve('got');
require.cache[gotPath] = {
    id: gotPath,
    filename: gotPath,
    loaded: true,
    exports: async (url, options) => {
        requested = { url, options };
        if (gotResponse instanceof Error) throw gotResponse;
        return { body: gotResponse };
    },
};

const getLinuxInstallerBuilds = require('../routes/getLinuxInstallerBuilds');

const run = async (query) => {
    let result;
    await getLinuxInstallerBuilds(
        { query },
        {
            send: (response) => {
                result = response;
            },
        }
    );
    return result;
};

const jenkinsBuild = (number, result, tag, building = false) => ({
    number,
    url: `https://jenkins/job/create_installer_linux/${number}/`,
    result,
    building,
    timestamp: number,
    actions: [
        {},
        {
            parameters: [
                { name: 'TAG', value: tag },
                { name: 'ARTIFACTS_TO_COPY', value: 'a/linux/x64/b' },
                { name: 'SKIP_DEBIAN', value: 'false' },
            ],
        },
    ],
});

test('requires a tag', async () => {
    const result = await run({});
    assert.match(result.error, /tag/);
});

test('queries the Jenkins job API', async () => {
    gotResponse = { builds: [] };
    await run({ tag: 'jdk-21.0.5+11' });
    assert.equal(
        requested.url,
        'https://ci.adoptium.net/job/build-scripts/job/release/job/create_installer_linux/api/json'
    );
    assert.match(requested.options.searchParams.tree, /parameters/);
});

test('returns only runs for the tag, with only the relevant params', async () => {
    gotResponse = {
        builds: [
            jenkinsBuild(9, 'FAILURE', 'jdk-21.0.6+7'),
            jenkinsBuild(8, 'SUCCESS', 'jdk-21.0.5+11'),
            jenkinsBuild(7, null, 'jdk-21.0.5+11', true),
            { number: 1, actions: [{}] },
        ],
    };
    const result = await run({ tag: 'jdk-21.0.5+11' });

    assert.deepEqual(
        result.builds.map((b) => [b.buildNum, b.buildResult, b.status]),
        [
            [8, 'SUCCESS', 'Done'],
            [7, null, 'NotDone'],
        ]
    );
    assert.deepEqual(
        result.builds[0].buildParams.map((p) => p.name),
        ['TAG', 'ARTIFACTS_TO_COPY']
    );
});

test('returns an error object when Jenkins fails', async () => {
    gotResponse = new Error('boom');
    const result = await run({ tag: 'jdk-21.0.5+11' });
    assert.match(result.error, /boom/);
});
