const { TestResultsDB } = require('../Database');

module.exports = async (req, res) => {
    try {
        const { parentId } = req.query;

        if (!parentId) {
            return res.status(400).send({ error: 'parentId is required' });
        }

        const db = new TestResultsDB();

        // Fetch all tests and their machines for the specified parentId
        const buildData = await db.getSpecificData(
            { parentId: parentId },
            { tests: 1, machine: 1 }
        );

        if (!buildData || buildData.length === 0) {
            return res
                .status(404)
                .send({ error: 'No builds found for the given parentId' });
        }

        // Initialize a map to store machine names and their respective failed test counts
        const failedTestsByMachine = {};

        // Iterate through all builds and process tests
        for (const build of buildData) {
            const { tests, machine } = build;

            if (tests && Array.isArray(tests)) {
                for (const test of tests) {
                    if (test.testResult === 'FAILED') {
                        // Accumulate failure count for the machine
                        failedTestsByMachine[machine] =
                            (failedTestsByMachine[machine] || 0) + 1;
                    }
                }
            }
        }

        // Format the result as an array of dictionaries with "machine" and "failedTest"
        const formattedResult = Object.entries(failedTestsByMachine)
            .map(([machine, failedTests]) => ({
                machine,
                failedTests,
            }))
            .sort((a, b) => b.failedTests - a.failedTests) // Sort in descending order
            .slice(0, 3); // Keep only the top 3 machines

        // Send the formatted result as the response
        res.send(formattedResult);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
};
