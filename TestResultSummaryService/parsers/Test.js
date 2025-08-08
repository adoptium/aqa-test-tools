const Parser = require('./Parser');
const regexRunningTest = /Running test (.*?) \.\.\.\r?/;
const testSeparator = /===============================================\r?/;
const regexFinishTime = /^(.*?) Finish Time\: .* Epoch Time \(ms\)\: (\d+).*/;
const regexStartTime = /^(.*?) Start Time\: .* Epoch Time \(ms\)\: (\d+).*/;
const TestBenchmarkParser = require(`./TestBenchmarkParser`);
const ExternalTestParser = require(`./ExternalTestParser`);

const Utils = require(`./Utils`);

class Test extends Parser {
    static canParse(buildName, output) {
        if (output) {
            if (buildName.indexOf('Test-') === 0) {
                return true;
            } else {
                return output.includes('Running test ');
            }
        } else {
            return false;
        }
    }

    async parse(output) {
        const tests = await this.extract(output);
        const { javaVersion, jdkDate, sdkResource } =
            this.exactJavaVersion(output);
        tests.javaVersion = javaVersion;
        tests.jdkDate = jdkDate;
        tests.sdkResource = sdkResource;
        tests.machine = this.extractMachineInfo(output);
        const tkgTestSummary = this.extractTestSummary(output);

        // Use test summary from TKG as default. If not, use test summary from TRSS.
        if (tkgTestSummary) {
            tests.testSummary = tkgTestSummary;
        }
        tests.startBy = this.extractStartedBy(output);
        tests.artifactory = this.extractArtifact(output);
        tests.rerunLink = this.extractRerunLink(output);
        tests.rerunFailedLink = this.extractRerunFailedLink(output);
        tests.versions = this.extractSha(output);
        return tests;
    }

    async extract(str) {
        const preTest = 'Pre Test';
        const postTest = 'Post Test';
        let m,
            testStr,
            testName,
            testResult,
            startTime,
            finishTime,
            testResultRegex;
        let results = [];
        let total = 0,
            executed = 0,
            passed = 0,
            failed = 0,
            skipped = 0,
            disabled = 0;
        const readline = require('readline');
        const stream = require('stream');
        let buf = Buffer.from(str);
        let bufferStream = new stream.PassThrough();
        bufferStream.end(buf);
        let rl = readline.createInterface({
            input: bufferStream,
        });

        let nonTestStr = '';
        let preTestDone = false;
        let postTestDone = false;
        let testStartLine = -1;
        let lineCounter = 0;
        for await (const line of rl) {
            lineCounter++;
            if ((m = line.match(testSeparator)) !== null) {
                testStartLine = lineCounter;
            } else if (
                lineCounter === testStartLine + 1 &&
                (m = line.match(regexRunningTest)) !== null
            ) {
                if (!preTestDone) {
                    results.push({
                        testName: preTest,
                        testOutput: nonTestStr,
                        testResult: 'PASSED',
                        testData: null,
                    });
                    nonTestStr = '';
                    preTestDone = true;
                }

                testStr = '';
                testName = m[1];
                testResultRegex = new RegExp(testName + '_(.*)\r?');
            }
            if ((m = line.match(regexStartTime)) !== null) {
                startTime = m[1].includes(testName) && m[2] > 0 ? m[2] : null;
            }
            if (testResultRegex && (m = testResultRegex.exec(line)) !== null) {
                testResult = m[1];
            }
            if (testName) {
                testStr += line + '\n';
                if ((m = line.match(regexFinishTime)) !== null) {
                    finishTime =
                        m[1].includes(testName) && m[2] > 0 ? m[2] : null;

                    results.push({
                        testName,
                        testOutput: testStr,
                        testResult,
                        testData: null,
                        duration:
                            startTime &&
                            finishTime &&
                            finishTime - startTime > 0
                                ? finishTime - startTime
                                : null,
                        startTime: parseInt(startTime),
                    });
                    if (testResult == 'FAILED') {
                        executed++;
                        failed++;
                    } else if (testResult == 'PASSED') {
                        executed++;
                        passed++;
                    } else if (testResult == 'DISABLED') {
                        disabled++;
                    } else if (testResult == 'SKIPPED') {
                        skipped++;
                    }
                    total++;

                    // reset values
                    testName = null;
                    testStr = null;
                    nonTestStr = '';
                    testResult = '';
                }
            } else {
                if (!preTestDone || !postTestDone) {
                    nonTestStr += line + '\n';
                }
            }
        }

        if (testStr) {
            // test has been executed but not completed
            results.push({
                testName,
                testOutput: testStr,
                testResult: 'FAILED',
                testData: null,
                startTime,
            });
            executed++;
            failed++;
            total++;
        } else if (!results || results.length === 0) {
            // No test has been executed after reading all test output.
            results.push({
                testName: preTest,
                testOutput: str,
                testResult: 'FAILED',
                testData: null,
            });
        } else if (!postTestDone) {
            results.push({
                testName: postTest,
                testOutput: nonTestStr,
                testResult: nonTestStr.match(
                    /Finished: (SUCCESS|UNSTABLE|ABORTED)/
                )
                    ? 'PASSED'
                    : 'FAILED',
                testData: null,
            });
        }

        let buildResult = null;
        const isPerf = results.some((res) =>
            TestBenchmarkParser.canParse(res.testName)
        );
        if (isPerf) {
            results = TestBenchmarkParser.parsePerf(results);
            buildResult = Utils.perfBuildResult(results);
        }

        const isExternal = ExternalTestParser.canParse(this.buildName);
        if (isExternal) {
            results = new ExternalTestParser().parseExternal(results);
        }

        return {
            tests: results,
            ...(buildResult && { buildResult }),
            type: isPerf ? 'Perf' : 'Test',
            // test summary from TRSS extract()
            testSummary: {
                total,
                executed,
                passed,
                failed,
                disabled,
                skipped,
                data: 'TRSS',
            },
        };
    }
}

module.exports = Test;
