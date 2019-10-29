const Parser = require('./Parser');
const regexRunningTest = /.*?Running test (.*?) \.\.\.\r?/;
const regexFinishTime = /.*?Finish Time\: .* Epoch Time \(ms\)\: (.*).*/;
const regexStartTime = /.*?Start Time\: .* Epoch Time \(ms\)\: (.*).*/;

class Test extends Parser {
    static canParse(buildName, output) {
        if (buildName.indexOf("Test-") === 0) {
            return true;
        } else {
            return output.includes("Running test ");
        }
    }
    async parse(output) {
        const tests = await this.extract(output);
        tests.machine = this.extractMachineInfo(output);
        tests.testSummary = this.extractTestSummary(output);
        tests.startBy = this.extractStartedBy(output);
        tests.artifactory = this.extractArtifact(output);
        return tests;
    }

    async extract(str) {
        const preTest = "Pre Test";
        const postTest = "Post Test";
        let m, testStr, testName, testResult, startTime, finishTime, testResultRegex;
        const results = [];
        const readline = require('readline');
        const stream = require('stream');
        let buf = new Buffer(str);
        let bufferStream = new stream.PassThrough();
        bufferStream.end(buf);
        let rl = readline.createInterface({
            input: bufferStream,
        });

        let nonTestStr = "";
        let preTestDone = false;
        let postTestDone = false;
        for await (const line of rl) {
            if ((m = line.match(regexRunningTest)) !== null) {
                if (!preTestDone) {
                    results.push({
                        testName: preTest,
                        testOutput: nonTestStr,
                        testResult: "PASSED",
                        testData: null
                    });
                    nonTestStr = "";
                    preTestDone = true;
                }

                testStr = "";
                testName = m[1];
                testResultRegex = new RegExp(testName + "_(.*)\r?");
            }
            if ((m = line.match(regexStartTime)) !== null) {
                startTime = m[1];
            }
            if (testResultRegex && ((m = testResultRegex.exec(line)) !== null)) {
                testResult = m[1];
            }
            if (testName) {
                testStr += line + "\n";
                if ((m = line.match(regexFinishTime)) !== null) {

                    finishTime = m[1];
                    results.push({
                        testName,
                        testOutput: testStr,
                        testResult,
                        testData: null,
                        duration: finishTime - startTime,
                        startTime
                    });
                    testName = null;
                    testStr = null;
                    nonTestStr = "";
                }
            } else {
                if (!preTestDone || !postTestDone) {
                    nonTestStr += line + "\n";
                }
            }
        }

        if (testStr) {
            // test has been executed but not completed
            results.push({
                testName,
                testOutput: testStr,
                testResult: "FAILED",
                testData: null,
                startTime
            });
        } else if (!results || results.length === 0) {
            // No test has been executed after reading all test output. 
            results.push({
                testName: preTest,
                testOutput: str,
                testResult: "FAILED",
                testData: null
            });
        } else if (!postTestDone) {
            results.push({
                testName: postTest,
                testOutput: nonTestStr,
                testResult: nonTestStr.match(/Finished: (SUCCESS|UNSTABLE|ABORTED)/) ? "PASSED" : "FAILED",
                testData: null
            });
        }
        return {
            tests: results,
            type: "Test"
        };
    }
}

module.exports = Test;