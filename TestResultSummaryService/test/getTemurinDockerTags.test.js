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

const getTemurinDockerTags = require('../routes/getTemurinDockerTags');

const run = async (query) => {
    let result;
    await getTemurinDockerTags(
        { query },
        {
            send: (response) => {
                result = response;
            },
        }
    );
    return result;
};

test('requires a name', async () => {
    const result = await run({});
    assert.match(result.error, /name/);
});

test('rejects an invalid repo', async () => {
    const result = await run({ name: '21', repo: '../etc/passwd' });
    assert.match(result.error, /invalid repo/);
});

test('maps tags to unique, sorted os/arch platforms', async () => {
    gotResponse = {
        count: 1,
        results: [
            {
                name: '21.0.5_11-jdk-noble',
                last_updated: '2024-10-17T00:00:00Z',
                images: [
                    { os: 'linux', architecture: 'arm64' },
                    { os: 'linux', architecture: 'amd64' },
                    { os: 'linux', architecture: 'amd64' },
                    { os: 'unknown', architecture: 'unknown' },
                ],
            },
        ],
    };
    const result = await run({ name: '21.0.5_11-jdk' });

    assert.equal(
        requested.url,
        'https://hub.docker.com/v2/repositories/library/eclipse-temurin/tags/'
    );
    assert.equal(requested.options.searchParams.name, '21.0.5_11-jdk');
    assert.deepEqual(result, {
        count: 1,
        tags: [
            {
                name: '21.0.5_11-jdk-noble',
                lastUpdated: '2024-10-17T00:00:00Z',
                platforms: ['linux/amd64', 'linux/arm64'],
            },
        ],
    });
});

test('returns an error object when Docker Hub fails', async () => {
    gotResponse = new Error('boom');
    const result = await run({ name: '21.0.5_11-jdk' });
    assert.match(result.error, /boom/);
});
