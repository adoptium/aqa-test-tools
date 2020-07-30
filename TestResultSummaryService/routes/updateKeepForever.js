const { TestResultsDB, ObjectID } = require('../Database');

/*
* updateKeepForever API updates keepForever based on _id
*/
module.exports = async (req, res) => {
    const { _id, keepForever } = req.query;
    if (_id && keepForever) {
        const keepForeverVal = (keepForever === 'true');
        const db = new TestResultsDB();
        const criteria = { _id: new ObjectID(_id) };
        await db.update(criteria, { $set: { keepForever: keepForeverVal } }, { upsert: false });
        res.send({ error: false });
    } else {
        res.json({ error: true });
    }
}