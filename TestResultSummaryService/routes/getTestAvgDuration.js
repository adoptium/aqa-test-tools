const { TestResultsDB } = require('../Database');

/**
 * getTestAvgDuration calculates the average test duration from the most recent matched test builds
 * (default limit is 500)
 * 
 * All params are optional. If none is provided, all platforms/jdkVersions/impls/levels/groups will 
 * be considered.
 * 
 * @param {string} testName Optional. Test Name (i.e., jdk_math_0, jdk_math, etc). 
 * The program will query all tests that contain this name.
 * @param {string} platform Optional. Test platform (i.e., x86-64_linux)
 * @param {number} jdkVersion Optional. JDK version (i.e., 8, 11, etc)
 * @param {string} impl Optional. JDK impl (i.e., j9, hs, etc)
 * @param {string} level Optional. Test level (i.e., sanity, extended, special)
 * @param {string} group Optional. Test group (i.e., functional, system, openjdk, perf, etc)
 * @param {number} bucketCount Optional. The number of buckets the tests will be divided into.
 * Default value is 1
 * @param {number} limit Optional. The number of matched builds the program will query.
 * Default value is 500
 * @return {object} 
 * bucketTime: array of bucket execution time
 * buckets: array of buckets which contains matched tests with average test duration
 */

module.exports = async (req, res) => {
    const { testName, platform, jdkVersion, impl, level, group, limit = 500, bucketCount = 1 } = req.query;

    let buildNameRegex = `^Test.*`;
    if (jdkVersion) buildNameRegex = `${buildNameRegex}_openjdk${jdkVersion}.*`;
    if (impl) buildNameRegex = `${buildNameRegex}${impl}_.*`;
    if (level) buildNameRegex = `${buildNameRegex}${level}..*`;
    if (group) buildNameRegex = `${buildNameRegex}${group}_.*`;
    if (platform) buildNameRegex = `${buildNameRegex}${platform}`;

    // the query order in aggregateQuery is important. Please change with caution
    const aggregateQuery = [
        { $match: { "buildName": { $regex: buildNameRegex } } },
        { $sort: { 'timestamp': -1 } },
        { $limit: parseInt(limit, 10) },
        { $unwind: "$tests" }
    ];

    if (testName) {
        let testNameRegex = `.*${testName}.*`;
        const testNameQuery = {
            $match: {
                "tests.testName": { $regex: testNameRegex }
            }
        };
        aggregateQuery.push(testNameQuery);
    }

    const projectQuery = {
        $project: {
            _id: 1,
            buildName: 1,
            buildNum: 1,
            machine: 1,
            buildUrl: 1,
            "tests.testName": 1,
            "tests.duration": 1,
        }
    };

    const groupQuery = {
        $group: {
            _id: "$tests.testName",
            avgDuration: { $avg: "$tests.duration" }
        },
    };

    aggregateQuery.push(projectQuery);
    aggregateQuery.push(groupQuery);
    aggregateQuery.push({ $sort: { 'avgDuration': -1 } });

    const db = new TestResultsDB();
    const result = await db.aggregate(aggregateQuery);

    if (!result) {
        res.send(result);
    } else {
        const buckets = Array(parseInt(bucketCount));
        const bucketTime = Array(parseInt(bucketCount)).fill(0);
        for (let i = 0; i < bucketCount; i++) {
            buckets[i] = [];
        }

        for (let r of result) {
            let bucketWithLeastWork = 0;
            let leastWork = bucketTime[0];
            for (let i = 0; i < bucketCount; i++) {
                if (bucketTime[i] < leastWork) {
                    leastWork = bucketTime[i];
                    bucketWithLeastWork = i;
                }
            }
            buckets[bucketWithLeastWork].push(r);
            bucketTime[bucketWithLeastWork] += r.avgDuration;
        }
        res.send({ bucketTime, buckets });
    }
}
