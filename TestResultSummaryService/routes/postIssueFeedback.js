const fs = require('fs');
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

async function writeTestOutputToFile(
    testName,
    buildName,
    buildUrl,
    buildNum,
    testOutput
) {
    try {
        const domain = new URL(buildUrl).hostname;
        const fileName = `${testName}_${buildName}_${buildNum}_${domain}.txt`;
        const outputPath = `${__dirname}/../../MachineLearningPrototype/data/JenkinsDataWithFeedback/${fileName}`;

        const fileExists = fs.existsSync(outputPath);

        if (!fileExists) {
            await fs.promises.writeFile(outputPath, testOutput);
        }

        return fileName;
    } catch (error) {
        throw error;
    }
}

async function getRecordIfExists(db, repoName, issueNumber, testId) {
    const records = await db
        .getData({ repoName, issueNumber, testId })
        .toArray();

    if (records.length == 0) {
        return null;
    }

    return records[0];
}

async function insertNewFeedback(db, requestBody) {
    const {
        repoName,
        issueName,
        issueCreator,
        testId,
        testName,
        buildName,
        issueNumber,
        accuracy,
    } = requestBody;

    const { testOutput, buildUrl, buildNum } = await getTestOutput(testId);
    const outputFileName = await writeTestOutputToFile(
        testName,
        buildName,
        buildUrl,
        buildNum,
        testOutput
    );

    const positiveCounter = Number(accuracy === 1);
    const negativeCounter = Number(accuracy === 0);

    await db.populateDB({
        repoName,
        issueName,
        issueCreator,
        issueNumber,
        testName,
        testId,
        testOutput: outputFileName,
        positiveCounter,
        negativeCounter,
    });
}

async function updateFeedback(db, record, accuracy) {
    const options = { upsert: false };
    const criteria = { _id: new ObjectID(record._id) };

    let { positiveCounter, negativeCounter } = record;

    if (accuracy === 0) {
        negativeCounter += 1;
    }

    if (accuracy === 1) {
        positiveCounter += 1;
    }

    await db.update(
        criteria,
        { $set: { positiveCounter, negativeCounter } },
        options
    );
}

module.exports = async (req, res) => {
    try {
        const db = new FeedbackDB();
        const { repoName, testId, issueNumber, accuracy } = req.body;

        const record = await getRecordIfExists(
            db,
            repoName,
            issueNumber,
            testId
        );

        if (!record) {
            await insertNewFeedback(db, req.body);
        } else {
            await updateFeedback(db, record, accuracy);
        }

        res.send({ result: 'Feedback recorded' });
    } catch (error) {
        res.status(500).send({ error: "Couldn't record feedback" });
    }
};
