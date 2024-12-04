const { AuditLogsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const query = { ...req.query };
    if (query.buildNum) query.buildNum = parseInt(query.buildNum, 10);
    if (query.buildId) query.buildId = new ObjectID(query.buildId);
    const db = new AuditLogsDB();
    const result = await db.aggregate([
        { $match: query },
        { $sort: { timestamp: 1 } },
    ]);
    res.send(result);
};
