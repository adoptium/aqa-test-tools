const { TestResultsDB } = require('../Database');

/**
 * getTestAvgDuration calculates the average test duration from the most recent matched test builds
 * (default limit is 200)
 * 
 * @param {string} testName Required
 * @param {string} platform Optional. If not provided, all platforms will be considered.
 * Since some tests maybe skipped/disabled on certain platforms, without setting platform
 * param will likely result:
 * average test duration << test execution duration on a non-skipped platform
 * @param {number} jdkVersion Optional
 * @param {string} impl Optional
 * @param {string} level Optional
 * @param {string} group Optional
 * @param {number} limit Optional. The number of matched builds the program will query.
 * Default value is 200
 * @return {array} All matched tests with average test duration
 */


module.exports = async (req, res) => {
    const { testName, platform, jdkVersion, impl, level, group, limit = 200 } = req.query;
    if (!testName) {
        res.send({ error: `Please provide testName` });
    }
    let buildNameRegex = `^Test.*`;
    if (jdkVersion) buildNameRegex = `${buildNameRegex}_openjdk${jdkVersion}.*`;
    if (impl) buildNameRegex = `${buildNameRegex}${impl}_.*`;
    if (level) buildNameRegex = `${buildNameRegex}${level}..*`;
    if (group) buildNameRegex = `${buildNameRegex}${group}-.*`;
    if (platform) buildNameRegex = `${buildNameRegex}${platform}`;

    let testNameRegex = `.*${testName}.*`;
    const db = new TestResultsDB();
    const result = await db.aggregate([
        { $match: { "buildName": { $regex: buildNameRegex } } },
        { $sort: { 'timestamp': -1 } },
        { $limit: parseInt(limit, 10) },
        { $unwind: "$tests" },
        {
            $match: {
                "tests.testName": { $regex: testNameRegex }
            }
        },
        {
            $project: {
                _id: 1,
                buildName: 1,
                buildNum: 1,
                machine: 1,
                buildUrl: 1,
                "tests.testName": 1,
                "tests.duration": 1,
            }
        },
        {
            $group: {
                _id: "$tests.testName",
                avgDuration: { $avg: "$tests.duration" }
            }
        }
    ]);
    res.send(result);
}