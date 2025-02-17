const { TestResultsDB } = require('../Database');
const ObjectID = require('mongodb').ObjectID;

module.exports = async (req, res) => {
    const db = new TestResultsDB();
    let results = null;
    let rootBuildId;
    if (req.query.rootBuildId) {
        rootBuildId = new ObjectID(req.query.rootBuildId);
    }
    let query = {
        buildName: {
            $regex: 'Perf_openjdk.*perf_.*(?<!test|baseline)$',
        },
        rootBuildId,
    };
    if (req.query.buildType === 'baseline' || req.query.buildType === 'test') {
        const aggregateInfoBuildNameRegex = `.*_${req.query.buildType}`;
        results = await db.aggregate([
            {
                $match: query,
            },
            // Needed to access values inside array
            { $unwind: '$aggregateInfo' },
            {
                $match: {
                    'aggregateInfo.buildName': {
                        $regex: aggregateInfoBuildNameRegex,
                    },
                },
            },
            {
                $project: {
                    aggregateInfo: 1,
                    buildName: 1,
                },
            },
        ]);
    }
    res.send(results);
};
