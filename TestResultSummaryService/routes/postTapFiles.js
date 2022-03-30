const Parsers = require(`../parsers/`);
const AdmZip = require('adm-zip');
const axios = require('axios');

/**
 * postTapFiles inserts a number of TestResult objects based on the Tap files in the zip
 * @route POST /api/postTapFiles
 * @group Test - Operations about test
 * @param {string} url.query Required. Url to a zip file
 * @return {object}
 * Inserted testResult objects
 */

module.exports = async (req, res) => {
    try {
        const url = req.query.url;
        const tapParser = Parsers['Tap'];

        // TODO: Use got instead of axios
        const { data } = await axios.get(url, {
            responseType: 'arraybuffer',
        });

        const zip = new AdmZip(data);

        const status = await tapParser.parse(zip.getEntries());
        res.send(status);
    } catch (err) {
        res.send({ result: e.toString() });
    }
};
