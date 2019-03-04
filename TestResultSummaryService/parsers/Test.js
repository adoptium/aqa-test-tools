const Parser = require( './Parser' );
const regex = /.*?===============================================\r?\n.*?Running test (.*?) \.\.\.\r?\n.*?===============================================\r?\n.*?([\S\s]*?\1 Start Time\: .* Epoch Time \(ms\)\: (.*)[\s\S]*?\1_(.*?)\r?\n[\S\s]*?\1 Finish Time\: .* Epoch Time \(ms\)\: (.*))\r?\n/g;

class TestExtractor {
    extract( str ) {
        const results = [];
        let m;
        regex.lastIndex = 0;
        while ( ( m = regex.exec( str ) ) !== null ) {
            // testResult can be PASSED/FAILED/SKIPPED
            const testResult = m[4] === "PASSED" || m[4] === "SKIPPED";
            results.push( {
                testName: m[1],
                testOutput: m[2],
                testResult: m[4],
                testData: null,
                duration: (parseInt(m[5]) - parseInt(m[3])),
                startTime: parseInt(m[3])
            } );
        }
        //if failed before test execution, store the output
        if ( results.length === 0 ) {
            results.push( {
                testName: "makefile generation and test compilation",
                testOutput: str,
                testResult: "FAILED",
                testData: null
            } );
        }
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