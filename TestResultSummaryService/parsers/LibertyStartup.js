const BenchmarkParser = require( './BenchmarkParser' );
const testName = "Daily-Liberty-Startup";

class LibertyStartup extends BenchmarkParser {

    static canParse( buildName, output ) {
        return (buildName.includes( testName ) || super.getBenchmarkName(output) === "LibertyStartup");
    }

    parse( output ) {
        return this.benchmarkParse("LibertyStartup", output);
    }
}

module.exports = LibertyStartup;