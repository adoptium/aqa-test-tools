const fs = require('fs').promises;
const DataManager = require('../../DataManager');
module.exports = async (req, res) => {
    const buildName =
        'Test_openjdk17_j9_sanity.functional_aarch64_mac_testList_2';
    let file = 'jobOutput.txt';
    file = `${__dirname}/${file}`;

    try {
        console.log(`Read file ${file}`);
        const output = await fs.readFile(file, {
            encoding: 'utf8',
        });
        const data = await new DataManager().parseOutput(buildName, output);
        res.send(data);
    } catch (err) {
        console.log(err);
    }
};
