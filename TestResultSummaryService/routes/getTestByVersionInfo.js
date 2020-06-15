const { TestResultsDB } = require('../Database');

/**
 * getTestByVersionInfo returns the latest test builds with matched version
 * 
 * @param {string} regex required. regex to match against java -version output
 * @param {string} platform Optional. Test platform (i.e., x86-64_linux)
 * @param {number} jdkVersion Optional. JDK version (i.e., 8, 11, etc)
 * @param {string} impl Optional. JDK impl (i.e., j9, hs, etc)
 * @param {string} level Optional. Test level (i.e., sanity, extended, special)
 * @param {string} group Optional. Test group (i.e., functional, system, openjdk, perf, etc)
 * @param {string} buildResult Optional. The result of the build (i.e., SUCCESS, UNSTABLE, FAILURE)
 * Default is SUCCESS
 * @return {object}
 */

module.exports = async (req, res) => {
    const { regex, platform, jdkVersion, impl, level, group, buildResult } = req.query;
    if (regex) {
        let buildNameRegex = `^Test.*`;
        if (jdkVersion) buildNameRegex = `${buildNameRegex}_openjdk${jdkVersion}.*`;
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
                    _id: "$buildName",
                    buildNum: { $last: '$buildNum' },
                    buildUrl: { $last: '$buildUrl' },
                    javaVersion: { $last: '$javaVersion' },
                    timestamp: { $last: '$timestamp' },
                }
            },
            {
                $project: {
                    buildName: 1,
                    buildNum: 1,
                    buildUrl: 1,
                    javaVersion: 1,
                    timestamp: 1,
                }
            },
            { $sort: { 'timestamp': -1 } },

        ];
        const testResultsDB = new TestResultsDB();
        const result = await testResultsDB.aggregate(aggregateQuery);
        res.send(result);
    } else {
        res.send({
            error: "Please provide regex to match against java -version output"
        });
    }

}