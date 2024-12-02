const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const query = { ...req.query };
    if (query.parentId) query.parentId = new ObjectID(query.parentId);
    const db = new TestResultsDB();
    const result = await db.getData(query).toArray();
    res.send(result);
};
