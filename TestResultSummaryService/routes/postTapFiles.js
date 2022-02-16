const Tap = require('../parsers/Tap');
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
    const url = req.query.url;
    const tapParser = Parsers['Tap'];

    if (tapParser.canParse(url) == false) {
        res.send({ error: `invalid zipfile: ${url}` });
    } else {
        const { data } = await axios.get(url, {
            responseType: 'arraybuffer',
        });

        const zip = new AdmZip(data);

        const status = await tapParser.parse(zip.getEntries());
        res.send(status);
    }
};
