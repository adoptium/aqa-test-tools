const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    let { type } = req.query;
    const db = new TestResultsDB();
    const result = await db.aggregate([
        {
            $match: {
                parentId: { $exists: false },
                type: type
            }
        },
        {
            $group: {
                _id: {
                    url: '$url',
                    buildName: '$buildName'
                },
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);
    res.send(result);
}