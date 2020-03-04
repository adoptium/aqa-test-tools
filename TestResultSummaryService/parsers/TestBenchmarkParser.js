const Parser = require( './Parser' );
const Utils = require( './Utils' );

class TestBenchmarkParser extends Parser {

    static getBenchmarkInfo( testName ) {
        let benchmarkName, benchmarkVariant;

        /* For PerfNext, benchmark name is allowed to have multiple underscores but variant shouldn't have underscores
         * in order for TRSS to parse the job. For TKG, we'll be good since we don't specify variant name anyway.
         */
        if (testName) {
            let index = testName.lastIndexOf("_")
            if(index >= 0){
                benchmarkName = testName.substring(0, index);
                benchmarkVariant = testName.substring(index+1, testName.length);
            }
        }
        return {benchmarkName, benchmarkVariant};
    }

    // True iff all benchmarks and their corresponding iterations in the given run can be parsed
    static canParse( testName ) {
        const benchmarkParserKey = Utils.getBenchmarkParserKey(testName);
        if(benchmarkParserKey) {
            return true;
        }
        return false;
    }

    static parsePerf(results) {
        if(Array.isArray(results) && results.length > 0) {
            for(let result of results) {
                const benchmarkParserKey = Utils.getBenchmarkParserKey(result.testName);
                if(benchmarkParserKey) {
                    let {benchmarkName, benchmarkVariant} = this.getBenchmarkInfo(result.testName);
                    result.benchmarkName = benchmarkName;
                    result.benchmarkVariant = benchmarkVariant;
                    result.testData = Utils.parseOutput(benchmarkParserKey, result.testOutput);;
                }
            }
        }
        return results;
    }
}
module.exports = TestBenchmarkParser;