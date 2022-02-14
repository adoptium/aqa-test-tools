const fs = require('fs');
module.exports = async (req, res) => {
    const content = fs.readFileSync(__dirname + '/../DashboardBuildInfo.json');
    const jsonContent = JSON.parse(content);
    res.send(jsonContent);
};
