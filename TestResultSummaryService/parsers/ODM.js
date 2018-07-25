const BenchmarkParser = require( './BenchmarkParser' );
const testName = `Daily-ODM`;

class ODM extends BenchmarkParser {
    static canParse( buildName, output ) {
       return (buildName.includes( testName ) || super.getBenchmarkName(output) === "ILOG_WODM");
    }

    parse( output ) {
        return this.benchmarkParse("ILOG_WODM", output);
    }
}

module.exports = ODM;