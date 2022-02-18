const { query } = require('winston');
const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    let { type, AQAvitCert } = req.query;
    const db = new TestResultsDB();

    let query = {};
    query.parentId = { $exists: false };
    query.type = type;
    if (AQAvitCert) {
        query.AQAvitCert = AQAvitCert;
    }
    let result = await db.aggregate([
        {
            $match: query,
        },
        {
            $group: {
                _id: {
                    url: '$url',
                    buildName: '$buildName',
                },
            },
        },
        {
            $sort: { _id: 1 },
        },
    ]);
    res.send(result);
};
