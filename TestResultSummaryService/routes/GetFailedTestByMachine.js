const { TestResultsDB } = require('../Database');

module.exports = async (req, res) => {
    try {
        const { buildId } = req.query;

        if (!buildId) {
            return res.status(400).send({ error: 'buildId is required' });
        }

        const db = new TestResultsDB();

        // Fetch the build's tests and machine
        const buildData = await db.getSpecificData(
            { _id: buildId },
            { tests: 1, machine: 1 }
        );

        if (!buildData || buildData.length === 0) {
            return res.status(404).send({ error: 'Build not found' });
        }

        // Map to store machine and failed test count
        const failedTestsByMachine = {};

        const { tests, machine } = buildData[0];
        if (tests && Array.isArray(tests)) {
            for (const test of tests) {
                if (test.testResult === 'FAILED') {
                    failedTestsByMachine[machine] =
                        (failedTestsByMachine[machine] || 0) + 1;
                }
            }
        }

        res.send(failedTestsByMachine);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
};