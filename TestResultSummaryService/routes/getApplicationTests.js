const { ApplicationTestsDB } = require('../Database');

module.exports = async (req, res) => {
    const appDB = new ApplicationTestsDB();
    const result = await appDB.getData({}).toArray();
    res.send(result);
};
