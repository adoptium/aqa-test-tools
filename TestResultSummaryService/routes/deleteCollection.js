const { TestResultsDB, OutputDB } = require('../Database');
module.exports = async (req, res) => {
    await new TestResultsDB().dropCollection();
    await new OutputDB().dropCollection();
    res.json({});
};
