const Parser = require( './Parser' );
const testName = `JCK`;
const str = `Starting STF JCK tests:`;
class JCK extends Parser {
    static canParse( buildName, output ) {
        return buildName.includes( "JCK-Java" );
    }
    parse( output ) {
        let testOutput = null;
        let m = null;
        let testResult = false;
        if ( output.indexOf( str ) !== -1 ) {
            testOutput = output.substring( output.indexOf( str ) );
            testResult = true;
        }

        const tests = [];

        tests.push( {
            testName,
            testOutput: testResult ? testOutput : output,
            testResult: testResult ? "PASSED" : "FAILED",
            testData: null
        } );
        return {
            tests,
            buildResults: testResult ? "SUCCESS" : "FAILURE",
            machine: this.extractMachineInfo( output ),
            type: "JCK",
            startBy: this.extractStartedBy( output ),
            artifactory: this.extractArtifact( output ),
        };
    }
}

module.exports = JCK;