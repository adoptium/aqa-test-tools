const { TestResultsDB } = require('../Database');

/**
 * getTestByVersionInfo returns the latest test builds with matched version
 *
 * @route GET /api/getTestByVersionInfo
 * @group Test - Operations about test
 * @param {string} regex.query - Optional. Required. regex to match against java -version output
 * The program will query all tests that contain this name.
 * @param {string} platform.query - Optional. Test platform - eg: x86-64_linux
 * @param {number} jdkVersion.query - Optional. JDK version - eg: 8, 11
 * @param {string} impl.query - Optional. JDK impl - eg: j9, hs
 * @param {string} level.query - Optional. Test level - eg: sanity, extended, special
 * @param {string} group.query - Optional. Test group - eg: functional, system, openjdk, perf, external
 * @param {string} buildResult.query - Optional. The result of the build (i.e., SUCCESS, UNSTABLE, FAILURE)
 * Default is SUCCESS
 * @return {object} - testLists - array of testLists which contains matched tests with average test duration
 */

module.exports = async (req, res) => {
    const { regex, platform, jdkVersion, impl, level, group, buildResult } =
        req.query;
    if (regex) {
        let buildNameRegex = `^Test.*`;
        if (jdkVersion)
            buildNameRegex = `${buildNameRegex}_openjdk${jdkVersion}.*`;
        if (impl) buildNameRegex = `${buildNameRegex}${impl}_.*`;
        if (level) buildNameRegex = `${buildNameRegex}${level}..*`;
        if (group) buildNameRegex = `${buildNameRegex}${group}_.*`;
        if (platform) buildNameRegex = `${buildNameRegex}${platform}.*`;
        const buildResultRegex = buildResult || 'SUCCESS';
        const matchQuery = {};
        matchQuery.buildName = { $regex: buildNameRegex };
        matchQuery.buildResult = { $regex: buildResultRegex };
        matchQuery.javaVersion = { $regex: regex };
        const aggregateQuery = [
            { $match: matchQuery },
            {
                $group: {
                    _id: '$buildName',
                    buildNum: { $last: '$buildNum' },
                    buildUrl: { $last: '$buildUrl' },
                    javaVersion: { $last: '$javaVersion' },
                    timestamp: { $last: '$timestamp' },
                },
            },
            {
                $project: {
                    buildName: 1,
                    buildNum: 1,
                    buildUrl: 1,
                    javaVersion: 1,
                    timestamp: 1,
                },
            },
            { $sort: { timestamp: -1 } },
        ];
        const testResultsDB = new TestResultsDB();
        const result = await testResultsDB.aggregate(aggregateQuery);
        res.send(result);
    } else {
        res.send({
            error: 'Please provide regex to match against java -version output',
        });
    }
};
