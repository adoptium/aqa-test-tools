const { BuildListDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const query = { ...req.query };
    if (query._id) query._id = new ObjectID(query._id);
    const db = new BuildListDB();
    const result = await db.getData(query).sort({ buildUrl: 1 }).toArray();
    res.send(result);
};
