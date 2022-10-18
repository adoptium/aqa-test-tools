const { TestResultsDB } = require('../Database');
module.exports = async (req, res) => {
    let { buildNameRegex, machineRegex } = req.query;
    const db = new TestResultsDB();

    let query = {};
    if (!machineRegex) {
        res.send({ error: 'Please provide machineRegex' });
    }
    query.machine = { $regex: machineRegex };

    if (buildNameRegex) {
        query.buildName = { $regex: buildNameRegex };
    }

    let result = await db.aggregate([
        {
            $match: query,
        },
        {
            $group: {
                _id: '$buildName',
                machines: {
                    $addToSet: '$machine',
                },
                passes: {
                    $sum: {
                        $cond: {
                            if: { $eq: ['$buildResult', 'SUCCESS'] },
                            then: 1,
                            else: 0,
                        },
                    },
                },
                total: {
                    $sum: 1,
                },
            },
        },
        {
            $project: {
                _id: 0,
                buildName: '$_id',
                machines: '$machines',
                passRate: {
                    $concat: [
                        { $substr: ['$passes', 0, -1] },
                        '/',
                        {
                            $substr: ['$total', 0, -1],
                        },
                    ],
                },
            },
        },
    ]);
    res.send(result);
};
