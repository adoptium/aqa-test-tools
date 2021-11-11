const { TestResultsDB, ObjectID } = require('../Database');
const Tap = require('../parsers/Tap');
const Parsers = require( `../parsers/` );

/**
 * @route POST /api/postTapFiles
 * @group Test - Operations about test
 * @param {string} url Optional.
 * @param {string} status Optional.
 * @return {string}  {passed, failed, disabled, skipped, executed, total}
 */

module.exports = async (req, res) => {
  const zip = '/users/amanda/Documents/test/TEST.zip';
  const path = require('path');
  const tapParser = Parsers["Tap"];
  console.log(tapParser.canParse(zip));
  tapParser.parse(zip);
  res.send("HM");
} 