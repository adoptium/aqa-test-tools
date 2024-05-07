const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const testResultsDB = new TestResultsDB();
    const data = await testResultsDB.aggregate([
        { $group: { _id: '$tests.testName' } },
        { $unwind: '$_id' },
        { $group: { _id: '$_id' } },
        { $sort: { _id: 1 } },
    ]);
    testNames = data.map(({ _id }) => _id);

    res.send(testNames);
};
