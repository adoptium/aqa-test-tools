const { TestResultsDB } = require('../Database');
const ObjectID = require('mongodb').ObjectID;

module.exports = async (req, res) => {
    const db = new TestResultsDB();
    let results = null;
    let parentId;
    if (req.query.parentId) {
        parentId = new ObjectID(req.query.parentId);
    }
    let query = {
        parentId,
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
