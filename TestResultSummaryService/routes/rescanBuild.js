const { TestResultsDB, ObjectID } = require('../Database');
const {
    deleteBuildsAndChildrenByFields,
} = require('./deleteBuildsAndChildrenByFields');
/*
 * rescanBuild API updates status field to NotDone based on _id.
 */
module.exports = async (req, res) => {
    const { _id } = req.query;
    try {
        if (_id) {
            const db = new TestResultsDB();
            const options = { upsert: true };
            const criteria = { _id: new ObjectID(_id) };
            // delete all child builds if any
            const deleteChildrenOnly = true;
            await deleteBuildsAndChildrenByFields(criteria, deleteChildrenOnly);
            // set build status
            const result = await db.update(
                criteria,
                { $set: { status: 'NotDone' } },
                options
            );
            res.send(result);
        } else {
            res.json({
                error: 'Please provide _id',
            });
        }
    } catch (err) {
        res.send({ result: err.toString() });
    }
};
