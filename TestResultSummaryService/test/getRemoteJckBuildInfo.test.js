const assert = require('node:assert/strict');
const { test } = require('node:test');

let consoleOutput = '';
const logStreamPath = require.resolve('../LogStream');
require.cache[logStreamPath] = {
    id: logStreamPath,
    filename: logStreamPath,
    loaded: true,
    exports: class LogStream {
        async next() {
            return consoleOutput;
        }
    },
};

const getRemoteJckBuildInfo = require('../routes/getRemoteJckBuildInfo');

test('matches remote JCK results to targets when jobs finish out of order', async () => {
    consoleOutput = [
        'Triggering dev.jck on x86-64_mac with JDK 17',
        'Triggering special.jck on x86-64_mac with JDK 17',
        'Remote build URL: https://example.com/job/dev/1/',
        'Remote build URL: https://example.com/job/special/1/',
        'Remote job jdk17 : jdk-17.0.21+8_adopt : weekly : x86-64_mac Target: special.jck Status: SUCCESS',
        'Remote job jdk17 : jdk-17.0.21+8_adopt : weekly : x86-64_mac Target: dev.jck Status: FAILURE',
    ].join('\n');

    let results;
    await getRemoteJckBuildInfo(
        {
            query: {
                url: 'https://example.com',
                buildName: 'AQA_Test_Pipeline_JCK',
                buildNum: '1',
            },
        },
        {
            send: (response) => {
                results = response;
            },
        }
    );

    assert.deepEqual(
        results.map(({ target, buildResult }) => ({ target, buildResult })),
        [
            { target: 'dev', buildResult: 'FAILURE' },
            { target: 'special', buildResult: 'SUCCESS' },
        ]
    );
});

test('falls back to trigger order for status lines without an explicit target', async () => {
    consoleOutput = [
        'Triggering dev.jck on x86-64_linux with JDK 21',
        'Triggering special.jck on x86-64_linux with JDK 21',
        'Remote job jdk21 : x86-64_linux Status: FAILURE',
        'Remote job jdk21 : x86-64_linux Status: SUCCESS',
    ].join('\n');

    let results;
    await getRemoteJckBuildInfo(
        {
            query: {
                url: 'https://example.com',
                buildName: 'AQA_Test_Pipeline_JCK',
                buildNum: '1',
            },
        },
        {
            send: (response) => {
                results = response;
            },
        }
    );

    assert.deepEqual(
        results.map(({ target, buildResult }) => ({ target, buildResult })),
        [
            { target: 'dev', buildResult: 'FAILURE' },
            { target: 'special', buildResult: 'SUCCESS' },
        ]
    );
});
