const Parser = require( './Parser' );
const BenchmarkMetricRegex = require( './BenchmarkMetricRegex' );
const benchmarkNameRegex = /\sBenchmark\sName:\s(.*)\sBenchmark Variant:\s.*\s/;
const benchmarkVariantRegex = /\sBenchmark\sName:\s.*\sBenchmark Variant:\s(.*)\s/;
const benchmarkProductRegex = /\sBenchmark\sProduct:\s(.*)\s/;
const regexJavaVersion = /(java version[\s\S]*JCL.*\n)/;

class BenchmarkParser extends Parser {

    static getBenchmarkName(output) {
        let curRegexResult = null;

        if ( ( curRegexResult = benchmarkNameRegex.exec( output ) ) !== null ) {
            return curRegexResult[1];
        } else {
            return null;
        }
    }

    static getBenchmarkVariant(output) {
        let curRegexResult = null;

        if ( ( curRegexResult = benchmarkVariantRegex.exec( output ) ) !== null ) {
            return curRegexResult[1];
        } else {
            return null;
        }
    }

    // Returns an iterator object which accesses each benchmark iteration from the given output
    getBenchmarkIterator(output) {
        let index = 0;
        let splitOutput = output.split(/[\*'\s]\s\*\*\*\*\*\*\*\*\*\*\sSTART\sOF\sNEW\sTESTCI\sBENCHMARK\sJOB\s\*\*\*\*\*\*\*\*\*\*/);
        let splitOutputLength = splitOutput.length;
    
        // Skip the chunk of output before the first benchmark job begins
        if ((Array.isArray(splitOutput)) && splitOutputLength !== 1) {
            index = 1;
        }

        return {
            next: function() {
                return index < splitOutputLength ?
                    {value: splitOutput[index++], done: false} :
                    {done: true};
            }
        };
    }

    benchmarkParse( benchmark, output ) {
        
        const benchmarkIterator = this.getBenchmarkIterator(output);
        let curItr = benchmarkIterator.next();
        let itrNum = 1;
        const allMetricRegex = BenchmarkMetricRegex[benchmark]["metrics"];

        let curBenchmarkName;
        let curBenchmarkVariant;
        let curBenchmarkProduct;
        let curMetric;
        let curSearchString;
        let curRegexResult;     
        let curMetricValue;
        let curJavaVersion;
        let curTestData = {};
        let allIterationRegexMatched = true;

        let allRunRegexMatched = true;
        const tests = [];

        while (curItr.done !== true) {

            // Parse benchmark name
            if ( ( curRegexResult = benchmarkNameRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkName = curRegexResult[1];
                // TODO: make sure name is present or else testResult will always equal FAILED
            } else {
                curBenchmarkName = null;
                // allIterationRegexMatched = false;
            }

            // Parse benchmark variant
            if ( ( curRegexResult = benchmarkVariantRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkVariant = curRegexResult[1];
                // TODO: make sure variant is present or else testResult will always equal FAILED
            } else {
                curBenchmarkVariant = null;
                // allIterationRegexMatched = false;
            }

            // Parse benchmark product
            if ( ( curRegexResult = benchmarkProductRegex.exec( curItr.value ) ) !== null ) {
                curBenchmarkProduct = curRegexResult[1];
                // TODO: make sure product is present or else testResult will always equal FAILED
            } else {
                curBenchmarkProduct = null;
                // allIterationRegexMatched = false;
            }

            // Parse metric values
            curTestData["metrics"] = [];
            for ( let i = 0; i < allMetricRegex.length; i++ ) {
                curMetric = allMetricRegex[i].name;
                curSearchString = curItr.value;

                // metric values will be found within the result of the outer regex
                if (allMetricRegex[i].outerRegex !== undefined) {
                    if ( ( curRegexResult = allMetricRegex[i].outerRegex.exec( curSearchString ) ) !== null ) {
                        curSearchString = curRegexResult[1];
                    } else {
                        // No result for outer regex, skip this metric
                        continue;
                    }
                }

                // multiple metric values are present
                if (allMetricRegex[i].regexRepeat === true) {
                    curMetricValue = [];
                    curRegexResult = allMetricRegex[i].regex.exec( curSearchString )

                    while (curRegexResult !== null ) {
                        curMetricValue.push(parseFloat(curRegexResult[1]));
                        curRegexResult = allMetricRegex[i].regex.exec( curSearchString );
                    }

                    // no metric values found
                    if (curMetricValue.length === 0) {
                        curMetricValue = null;
                        allIterationRegexMatched = false;
                    }
                
                // single metric value
                } else {
                    if ( ( curRegexResult = allMetricRegex[i].regex.exec( curSearchString ) ) !== null ) {
                        curMetricValue = [parseFloat(curRegexResult[1])];
                    } else {
                        curMetricValue = null;
                        allIterationRegexMatched = false;
                    }
                }

                curTestData["metrics"].push({name: curMetric, value: curMetricValue})
            }

            // Parse Java version
            if ( ( curRegexResult = regexJavaVersion.exec( curItr.value ) ) !== null ) {
                curJavaVersion = curRegexResult[1];
                // TODO: make sure java version is present or else testResult will always equal FAILED
            } else {
                curJavaVersion = null;
                // allIterationRegexMatched = false;
            }
            curTestData["javaVersion"] = curJavaVersion;

            // Parse JDK build date
            curTestData["jdkBuildDateUnixTime"] = this.convertBuildDateToUnixTime( this.extractJDKBuildDate( output ) );

            tests.push( {
                testOutput: curItr.value,
                testResult: allIterationRegexMatched ? "PASSED" : "FAILED",
                testIteration: itrNum,
                benchmarkName: curBenchmarkName,
                benchmarkVariant: curBenchmarkVariant,
                benchmarkProduct: curBenchmarkProduct,
                testData: curTestData
            } );

            curTestData = {};
            allIterationRegexMatched = true;
            curItr = benchmarkIterator.next();

            itrNum++;
        }

        // Check if a failure exists in any tests
        if (tests.map(x=>x.testResult).indexOf("FAILED") > -1) {
            allRunRegexMatched = false;
        }

        return {
            tests,
            buildResults: allRunRegexMatched ? "SUCCESS" : "FAILURE",
            machine: this.extractMachineInfo( output ),
            type: "Perf",
            startBy: this.extractStartedBy( output ),
            artifactory: this.extractArtifact( output ),
        };
    }
}
module.exports = BenchmarkParser;