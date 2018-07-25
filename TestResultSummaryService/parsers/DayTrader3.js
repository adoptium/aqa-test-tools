const BenchmarkParser = require( './BenchmarkParser' );
const testName = "Daily-Liberty-DayTrader3";

class DayTrader3 extends BenchmarkParser {

    static canParse( buildName, output ) {
        return (buildName.includes( testName ) || super.getBenchmarkName(output) === "LibertyDayTrader3");
    }

    parse( output ) {
        return this.benchmarkParse("LibertyDayTrader3", output);
    }
}

module.exports = DayTrader3;