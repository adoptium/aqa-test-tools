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
    const { bucketCount = 1 } = req.query;
    const db = new TestResultsDB();
    const result = await db.getAvgDuration(req.query);

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
