const { TestResultsDB, ObjectID } = require('../Database');

/**
 * compareTestDuration compares latest test duration with its history runs
 * 
 * All params are optional. If none is provided, all platforms/jdkVersions/impls/levels/groups will 
 * be considered.
 * 
 * @param {string} url Required. Jenkins server url (it is used to identify the build).
 * @param {string} rootBuildName Required. The root build that the test is in.
 * @param {string} testName Optional. Test Name (i.e., jdk_math_0, jdk_math, etc). 
 * The program will query all tests that contain this name.
 * @param {string} platform Optional. Test platform (i.e., x86-64_linux)
 * @param {number} jdkVersion Optional. JDK version (i.e., 8, 11, etc)
 * @param {string} impl Optional. JDK impl (i.e., j9, hs, etc)
 * @param {string} level Optional. Test level (i.e., sanity, extended, special)
 * @param {string} group Optional. Test group (i.e., functional, system, openjdk, perf, etc)
 * @param {number} limit Optional. The number of matched root builds the program will query.
 * Default value is 500
 * @param {number} skipBuild Optional. The number of builds to skip. The default is 0.
 * @return {object} 
 * currentAvg: test average execution time in the current/latest build
 * previousAvg: test average execution time in the previous builds
 */

module.exports = async (req, res) => {
    let { url, rootBuildName, limit = 500, skipBuild = 0 } = req.query;

    if (!rootBuildName || !url) {
        res.send({ error: "Please provide rootBuildName and url" });
    }
    if (skipBuild) {
        skipBuild = parseInt(skipBuild, 10);
    }
    const db = new TestResultsDB();

    // get the limited root builds in url and sort them based on timestamp
    let result = await db.aggregate([
        { $match: { "buildName": rootBuildName, url } },
        { $sort: { 'timestamp': -1 } },
        { $limit: parseInt(limit, 10) },
        {
            $project: {
                _id: 1,
                buildName: 1,
                buildNum: 1,
                buildUrl: 1
            }
        }
    ]);

    if (!result || result.length < skipBuild + 1) {
        res.send({ error: `Cannot find the root build: ${rootBuildName} on ${url} with skipBuild = ${skipBuild}` });
    } else {
        const currentRootBuildId = new ObjectID(result[skipBuild]._id);
        const previousRootBuildIds = [];
        for (let i = skipBuild + 1; i < result.length; i++) {
            previousRootBuildIds.push(new ObjectID(result[i]._id));
        }

        const info = req.query;
        info.matchQuery = { rootBuildId: currentRootBuildId };
        const currentAvg = await db.getAvgDuration(info);
        if (!currentAvg) {
            res.send({ error: "Cannot get result for currentAvg" });
        } else {
            info.matchQuery = { rootBuildId: { $in: previousRootBuildIds } };
            const previousAvg = await db.getAvgDuration(info);
            res.send({ currentAvg, previousAvg });
        }
    }
}
