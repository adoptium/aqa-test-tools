const { TestResultsDB } = require('../Database');

/**
 * getReleaseSummary returns health metrics for major JDK releases
 *
 * @route GET /api/getReleaseSummary
 * @group Release - Operations about releases
 * @return {object} - releaseSummary - map of jdk versions to their health stats
 */

module.exports = async (req, res) => {
    try {
        const testResultsDB = new TestResultsDB();

        // We want to aggregate health across recent builds for each major JDK version
        const aggregateQuery = [
            {
                // Only look at builds from the last 7 days to keep dashboard relevant
                $match: {
                    timestamp: { $gt: Date.now() - 7 * 24 * 60 * 60 * 1000 },
                    // Focus on actual test/perf jobs
                    buildName: { $regex: /^(Test|Perf)_openjdk/ },
                },
            },
            {
                // Extract JDK version from buildName (e.g., Test_openjdk11_... -> 11)
                $addFields: {
                    jdkVersionMatch: {
                        $regexFind: {
                            input: '$buildName',
                            regex: /openjdk(\d+)/,
                        },
                    },
                },
            },
            {
                $addFields: {
                    jdkVersion: '$jdkVersionMatch.captures',
                },
            },
            {
                // Flatten the captures array to get the actual version string
                $unwind: '$jdkVersion',
            },
            {
                // Group by JDK version and build result
                $group: {
                    _id: {
                        jdkVersion: '$jdkVersion',
                        result: '$buildResult',
                    },
                    count: { $sum: 1 },
                },
            },
            {
                // Reshape to make it easier for the frontend
                $group: {
                    _id: '$_id.jdkVersion',
                    results: {
                        $push: {
                            result: '$_id.result',
                            count: '$count',
                        },
                    },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ];

        const result = await testResultsDB.aggregate(aggregateQuery);

        // Transform the array into a more convenient object format
        const summary = {};
        result.forEach((item) => {
            const stats = {
                SUCCESS: 0,
                FAILURE: 0,
                UNSTABLE: 0,
                ABORTED: 0,
                total: 0,
            };
            item.results.forEach((res) => {
                const r = res.result || 'UNKNOWN';
                stats[r] = res.count;
                stats.total += res.count;
            });
            summary[item._id] = stats;
        });

        res.send(summary);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};
