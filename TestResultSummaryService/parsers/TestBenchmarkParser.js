const Parser = require( './Parser' );
const BenchmarkMetricRouter = require( './BenchmarkMetricRouter' );
const BenchmarkMetric = require( './BenchmarkMetric' );
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
        const {benchmarkName, benchmarkVariant} = this.getBenchmarkInfo(testName);
        if (benchmarkName && benchmarkVariant && BenchmarkMetricRouter[benchmarkName]) {
            if (!isNaN (parseInt(benchmarkVariant)) && BenchmarkMetricRouter[benchmarkName]["0"]) {// this works for TKG
                return true;
            } else if (BenchmarkMetricRouter[benchmarkName][benchmarkVariant]) {// this works for PerfNext
                return true;
            } else {
                return false;
            }
        }     
        return false;
    }

    static parsePerf(results) {
        if(Array.isArray(results) && results.length > 0) {
            for(let result of results) {
                if (this.canParse(result.testName)) {
                    let {benchmarkName, benchmarkVariant} = this.getBenchmarkInfo(result.testName);
                    const {testData} = Utils.parseOutput(benchmarkName, benchmarkVariant, result.testOutput);
                    result.benchmarkName = benchmarkName;
                    result.benchmarkVariant = benchmarkVariant;
                    result.testData = testData;
                }
            }
        }
        return results;
    }
}
module.exports = TestBenchmarkParser;