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
 * @param {number} numMachines Optional. The number of testLists the tests will be divided into.
 * Default value is 1
 * @param {number} limit Optional. The number of matched builds the program will query.
 * Default value is 500
 * @return {object} 
 * testListTime: array of bucket execution time
 * testLists: array of testLists which contains matched tests with average test duration
 */

module.exports = async (req, res) => {
    const { numMachines = 1 } = req.query;
    const db = new TestResultsDB();
    const result = await db.getAvgDuration(req.query);

    if (!result) {
        res.send(result);
    } else {
        const testLists = Array(parseInt(numMachines));
        const testListTime = Array(parseInt(numMachines)).fill(0);
        for (let i = 0; i < numMachines; i++) {
            testLists[i] = [];
        }

        for (let r of result) {
            let bucketWithLeastWork = 0;
            let leastWork = testListTime[0];
            for (let i = 0; i < numMachines; i++) {
                if (testListTime[i] < leastWork) {
                    leastWork = testListTime[i];
                    bucketWithLeastWork = i;
                }
            }
            testLists[bucketWithLeastWork].push(r);
            testListTime[bucketWithLeastWork] += r.avgDuration;
        }
        res.send({ testListTime, testLists });
    }
}
