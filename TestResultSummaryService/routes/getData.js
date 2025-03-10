const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const query = { ...req.query };
    if (query.buildNum) query.buildNum = parseInt(query.buildNum, 10);
    if (query._id) query._id = new ObjectID(query._id);

    if (query.parentId) query.parentId = new ObjectID(query.parentId);
    const db = new TestResultsDB();
    const result = await db.getData({ _id: new ObjectID(query._id) }).toArray();
    res.send(result);
};
