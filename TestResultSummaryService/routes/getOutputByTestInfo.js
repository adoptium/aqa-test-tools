const { TestResultsDB, OutputDB, ObjectID } = require('../Database');
const { removeTimestamp } = require('./utils/removeTimestamp');
const { applyDeepSmithMatch } = require('./utils/applyDeepSmithMatch');

module.exports = async (req, res) => {
    const {
        url,
        buildName,
        buildNum,
        testName,
        removeTimestampFlag,
        applyDeepSmithMatchFlag,
    } = req.query;
    const testResultsDB = new TestResultsDB();
    const outputDB = new OutputDB();
    const data = await testResultsDB.aggregate([
        {
            $match: {
                url: url,
                buildName: buildName,
                buildNum: parseInt(buildNum, 10),
            },
        },
        { $unwind: '$tests' },
        {
            $match: {
                'tests.testName': testName,
            },
        },
        {
            $project: {
                tests: 1,
            },
        },
    ]);
    if (data[0]) {
        let result = await outputDB
            .getData({ _id: new ObjectID(data[0].tests.testOutputId) })
            .toArray();
        try {
            if (removeTimestampFlag === 'true') {
                result[0].output = removeTimestamp(result[0].output);
            }
            if (applyDeepSmithMatchFlag === 'true') {
                result[0].output = applyDeepSmithMatch(result[0].output);
            }
            res.send({
                output: result[0].output,
            });
        } catch (error) {
            res.send({ error });
        }
    } else {
        res.json({ output: undefined });
    }
};
