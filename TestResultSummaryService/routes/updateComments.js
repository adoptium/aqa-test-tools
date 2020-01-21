const { TestResultsDB, ObjectID } = require('../Database');

/*
* updateComments API updates comments field based on _id
*/
module.exports = async (req, res) => {
    const { _id, comments } = req.query;
    if (_id) {
        const db = new TestResultsDB();
        const options = { upsert: false };
        const criteria = { _id: new ObjectID(_id) };
        await db.update(criteria, { $set: { comments } }, options);
        res.send({ error: false });
    } else {
        res.json({ error: true });
    }
}