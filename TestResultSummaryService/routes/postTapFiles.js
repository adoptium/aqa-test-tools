const Tap = require('../parsers/Tap');
const Parsers = require( `../parsers/` );

/**
 * postTapFiles inserts a number of TestResult objects based on the Tap files in the zip
 * @route POST /api/postTapFiles
 * @group Test - Operations about test
 * @param {string} url.query Required. Url to a zip file
 * @return {object}  
 * Inserted testResult objects
 */

module.exports = async (req, res) => {
  //const zip = req.query.url;
  const zip = '/users/amanda/Documents/test/example_tap.zip';
  const tapParser = Parsers["Tap"];

  if (tapParser.canParse(zip) == false) {
    res.send({ error: `invalid zipfile: ${zip}` })
  } else {
    const status = await tapParser.parse(zip); 
    res.send(status);
  }
} 