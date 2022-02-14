const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    const { id } = req.query;
    const testResultsDB = new TestResultsDB();
    const data = await testResultsDB.getTestById(id);
    res.send({
        buildId: data[0]._id,
        artifactory: data[0].artifactory,
        ...data[0].tests,
    });
};
