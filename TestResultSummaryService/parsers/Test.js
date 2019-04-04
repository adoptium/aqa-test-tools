const Parser = require( './Parser' );
const regexRunningTest = /.*?Running test (.*?) \.\.\.\r?/;
const regexFinishTime = /.*?Finish Time\: .* Epoch Time \(ms\)\: (.*).*/;
const regexStartTime = /.*?Start Time\: .* Epoch Time \(ms\)\: (.*).*/;
const results = [];

class TestExtractor {
    extract ( str ) {
        let m, testStr, testName, testResult, startTime, finishTime, testResultRegex;
        const readline = require('readline');
        const stream = require('stream');
        let buf = new Buffer(str);
        let bufferStream = new stream.PassThrough();
        bufferStream.end(buf);
        let rl = readline.createInterface({
            input: bufferStream,
        });
        rl.on('line', function (line) {
            if ((m = line.match(regexRunningTest)) !== null) {
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
                    results.push( {
                        testName,
                        testOutput: testStr,
                        testResult,
                        testData: null,
                        duration: finishTime - startTime,
                        startTime
                    } );
                    testName = null;
                    testStr = null;
                }
            }
        }).on('close', function() {
            if (testStr) {
                // test has been executed but not completed
                results.push( {
                    testName,
                    testOutput: testStr,
                    testResult: "FAILED",
                    testData: null,
                    startTime
                } );
            } else if (!results || results.length === 0) {
                // No test has been executed after reading all test output. 
                results.push( {
                    testName: "makefile generation and test compilation",
                    testOutput: str,
                    testResult: "FAILED",
                    testData: null
                } );
            }
        })
        return {
            tests: results,
            type: "Test"
        };
    }
}

class Test extends Parser {
    static canParse( buildName, output ) {
        if ( buildName.indexOf( "Test-" ) === 0 ) {
            return true;
        } else {
            return output.includes( "Running test " );
        }
    }
    parse( output ) {
        const tests = new TestExtractor().extract( output );
        tests.machine = this.extractMachineInfo( output );
        tests.testSummary = this.extractTestSummary( output );
        tests.startBy = this.extractStartedBy( output );
        tests.artifactory = this.extractArtifact( output );
        return tests;
    }
}

module.exports = Test;