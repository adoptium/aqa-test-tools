const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const { testName, buildNames, beforeTimestamp } = req.query;
    const db = new TestResultsDB();
    let query = {};
    if (buildNames) {
        const buildNameArray = buildNames.split(',');
        const rootBuildIds = [];
        await Promise.all(
            buildNameArray.map(async (buildName) => {
                const buildData = await db.getData({ buildName }).toArray();
                buildData.forEach((build) => {
                    rootBuildIds.push(new ObjectID(build._id));
                });
            })
        );
        query.rootBuildId = { $in: rootBuildIds };
    }
    if (beforeTimestamp) {
        query.timestamp = { $lt: parseInt(beforeTimestamp) };
    }
    const history = await db.aggregate([
        {
            $match: query,
        },
        { $unwind: '$tests' },
        {
            $match: {
                'tests.testName': testName,
            },
        },
        {
            $project: {
                parentId: 1,
                buildName: 1,
                buildNum: 1,
                machine: 1,
                buildUrl: 1,
                tests: 1,
                timestamp: 1,
                javaVersion: 1,
            },
        },
        { $sort: { timestamp: -1 } },
    ]);

    res.send(history);
};
