const Parser = require( './Parser' );
const benchmarkDelimiterRegex = /\*\*\*\*\*\*\*\*\*\* START OF NEW TESTCI BENCHMARK JOB \*\*\*\*\*\*\*\*\*\*[\r\n]/;
const benchmarkNameRegex = /Benchmark Name: (.*) Benchmark Variant: .*[\r\n]/;
const benchmarkVariantRegex = /Benchmark Name: .* Benchmark Variant: (.*)[\r\n]/;
const productResourceRegex = /Product Resource: (.*)[\r\n]/;
const Utils = require('./Utils');

class BenchmarkParser extends Parser {

    // True iff all benchmarks and their corresponding iterations in the given run can be parsed
    static canParse( buildName, output ) {
        return benchmarkDelimiterRegex.test(output);
    }

    // Returns an iterator object which accesses each benchmark iteration from the given output
    static getBenchmarkIterator(output) {
        let index = 1;
        let splitOutput = output.split(benchmarkDelimiterRegex);
        let splitOutputLength = splitOutput.length;
    
        // No delimiter inside the output
        if (!(Array.isArray(splitOutput)) || splitOutputLength === 1) {
            return null;
        }
        return {
            next: function() {
                return index < splitOutputLength ?
                    {value: splitOutput[index++], done: false} :
                    {done: true};
            }
        };
    }

    parse( output ) {

        const benchmarkIterator = BenchmarkParser.getBenchmarkIterator(output);
        let curItr = benchmarkIterator.next();
        let testIndex = 1;
        let buildResult;
        let regexResult = null;
        let sdkResource = null;
        const tests = [];

        // Parse product resource
        if ( ( regexResult = productResourceRegex.exec( output ) ) !== null ) {
            sdkResource = regexResult[1];
        }
        while (curItr.done !== true) {

            let curBenchmarkName = null;
            let curBenchmarkVariant = null;
            let curRegexResult = null;
            let isValid = true;

            // Parse benchmark name
            if ( ( curRegexResult = benchmarkNameRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkName = curRegexResult[1];
            } else {
                isValid = false;
            }
            // Parse benchmark variant
            if ( ( curRegexResult = benchmarkVariantRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkVariant = curRegexResult[1];
            } else {
                isValid = false;
            }
            // Parse test Data
            const benchmarkParserKey = Utils.getBenchmarkParserKey(curBenchmarkName);
            let testData = Utils.parseOutput(benchmarkParserKey, curItr.value);
            if (!testData) {
                isValid = false;
            }
            
            tests.push( {
                testOutput: curItr.value,
                testResult: isValid ? "PASSED" : "FAILED",
                testIndex: testIndex++,
                benchmarkName: curBenchmarkName,
                benchmarkVariant: curBenchmarkVariant,
                testData,                
            } );

            curItr = benchmarkIterator.next();
        }

        buildResult = Utils.perfBuildResult(tests);
        const { javaVersion, jdkDate } = this.exactJavaVersion( output );
        const { nodeVersion, nodeRunDate} = this.exactNodeVersion( output );

        return {
            tests,
            sdkResource,
            jdkDate,
            javaVersion,
            nodeRunDate,
            nodeVersion,
            buildResult,
            machine: this.extractMachineInfo( output ),
            type: "Perf",
            startBy: this.extractStartedBy( output ),
            artifactory: this.extractArtifact( output ),
        };
    }
}
module.exports = BenchmarkParser;