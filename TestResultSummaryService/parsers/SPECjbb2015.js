const BenchmarkParser = require( './BenchmarkParser' );
const testName = `Daily-SPECjbb2015`;

class SPECjbb2015 extends BenchmarkParser {
    static canParse( buildName, output ) {
        return (buildName.includes( testName ) || super.getBenchmarkName(output) === "SPECjbb2015");
    }

    parse( output ) {
        return this.benchmarkParse("SPECjbb2015", output);
    }
}

module.exports = SPECjbb2015;