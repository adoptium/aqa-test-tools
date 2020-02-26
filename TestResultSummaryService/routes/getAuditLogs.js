const { AuditLogsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    if (req.query.buildNum) req.query.buildNum = parseInt(req.query.buildNum, 10);
    if (req.query.buildId) req.query.buildId = new ObjectID(req.query.buildId);
    const db = new AuditLogsDB();
    const result = await db.aggregate([
        { $match: req.query },
        { $sort: { 'timestamp': 1 } },
    ]);
    res.send(result);
}