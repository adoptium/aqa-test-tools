const { TestResultsDB, OutputDB, ObjectID } = require('../Database');
const { removeTimestamp } = require('./utils/removeTimestamp');
const { applyDeepSmithMatch } = require('./utils/applyDeepSmithMatch');
const { removeAnsiCode } = require('../Utils');

module.exports = async (req, res) => {
    const { id, removeTimestampFlag, applyDeepSmithMatchFlag } = req.query;
    const outputDB = new OutputDB();
    const result = await outputDB.getData({ _id: new ObjectID(id) }).toArray();
    try {
        if (removeTimestampFlag === 'true') {
            result[0].output = removeTimestamp(result[0].output);
        }
        if (applyDeepSmithMatchFlag === 'true') {
            result[0].output = applyDeepSmithMatch(result[0].output);
        }
        res.send({
            output: removeAnsiCode(result[0].output),
        });
    } catch (error) {
        res.send({ error });
    }
};
