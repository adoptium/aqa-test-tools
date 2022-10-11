const { query } = require('winston');
const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    let { buildNameRegex, machineRegex } = req.query;
    const db = new TestResultsDB();

    let query = {};
    if (buildNameRegex) {
        query.buildName = { $regex: buildNameRegex };
    }
    if (machineRegex) {
        query.machine = { $regex: machineRegex };
    }

    let result = await db.aggregate([
        {
            $match: query,
        },
        {
            $project: {
                buildName: '$buildName',
                machine: '$machine',
                passRate: {
                    $concat: [
                        { $substr: ['$testSummary.passed', 0, -1] },
                        '/',
                        { $substr: ['$testSummary.executed', 0, -1] },
                    ],
                },
            },
        },
    ]);
    res.send(result);
};
