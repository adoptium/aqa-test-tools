var fs = require('fs').promises;

const {
    FeedbackDB,
    OutputDB,
    ObjectID,
    TestResultsDB,
} = require('../Database');

async function getTestResultData(testId) {
    try {
        const testResultsDB = new TestResultsDB();
        const result = await testResultsDB.getTestById(testId);
        const data = result[0];
        return {
            testOutputId: data.tests.testOutputId,
            buildUrl: data.buildUrl,
            buildNum: data.buildNum,
        };
    } catch (error) {
        throw error;
    }
}

function generateOutputFilename(testName, buildName, buildUrl, buildNum) {
    const domain = new URL(buildUrl).hostname;
    const fileName = `${testName}_${buildName}_${buildNum}_${domain}`;

    return fileName;
}

async function getTestOutput(testId) {
    try {
        const outputDB = new OutputDB();
        const testResultData = await getTestResultData(testId);
        const result = await outputDB
            .getData({ _id: new ObjectID(testResultData.testOutputId) })
            .toArray();
        return {
            ...testResultData,
            testOutput: result[0].output,
        };
    } catch (error) {
        throw error;
    }
}

async function writeTestOutputToFile(testOutput, fileName) {
    try {
        const outputPath = `${__dirname}/../../MachineLearningPrototype/data/JenkinsDataWithFeedback/${fileName}.txt`;
        await fs.writeFile(outputPath, testOutput);
    } catch (error) {
        throw error;
    }
}

module.exports = async (req, res) => {
    try {
        const db = new FeedbackDB();
        const {
            repoName,
            issueName,
            issueCreator,
            testId,
            testName,
            buildName,
            issueNumber,
            accuracy,
        } = req.body;
        const { testOutput, buildUrl, buildNum } = await getTestOutput(testId);
        const outputFileName = generateOutputFilename(
            testName,
            buildName,
            buildUrl,
            buildNum
        );
        await writeTestOutputToFile(testOutput, outputFileName);
        await db.populateDB({
            repoName,
            issueName,
            issueCreator,
            issueNumber,
            testName,
            testId,
            testOutput: outputFileName,
            accuracy,
        });

        res.send({ result: 'Feedback recorded' });
    } catch (error) {
        res.status(500).send({ error: "Couldn't record feedback" });
    }
};
