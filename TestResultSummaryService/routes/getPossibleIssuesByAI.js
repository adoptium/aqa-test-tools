const got = require('got');
const { OutputDB, ObjectID } = require('../Database');
const { removeTimestamp } = require('./utils/removeTimestamp');
const { removeAnsiCode } = require('../Utils');

/**
 * getDuplicateIssues queries AI API and returns possible git issues
 * @param {string} testName Required. Search text string. i.e., jdk_math
 * @param {string} testOutputId Required. testOutputId.
 * @return {object} possible git issues
 */

module.exports = async (req, res) => {
    try {
        const { testName, testOutputId } = req.query;
        if (testName && testOutputId) {
            const outputDB = new OutputDB();

            const result = await outputDB
                .getData({ _id: new ObjectID(testOutputId) })
                .toArray();
            let output = '';
            if (result && result[0]) {
                output = removeTimestamp(result[0].output);
                output = removeAnsiCode(output);
                // TODO: output should be refined to error and exeception only
            }
            if (output) {
                output += testName + ' ';
                const response = await got.post(
                    'http://9.46.100.175:8080/search',
                    {
                        json: {
                            query: output,
                        },
                        responseType: 'json',
                    }
                );

                if (response && response.body) {
                    res.send(response.body);
                } else {
                    res.send({
                        error: `No response from AI server`,
                    });
                }
            } else {
                res.send({
                    error: `Cannot find ${testName} output by testOutputId ${testOutputId}`,
                });
            }
        } else {
            res.send('expect testName query parameter');
        }
    } catch (error) {
        const rawError = error.response?.data || error.message;
        console.error('Error fetching repos:', rawError);
        res.status(500).json({ error: String(rawError) });
    }
};
