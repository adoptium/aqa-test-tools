/* Note: The correct value for the metric must always reside in index 1 (capture group) of the regex output array
*  use outerRegex when there are any warmup/cold runs before measure run that you do not wish to include.
* if not familiar with regex look at other benchmarks & use https://regex101.com/ :)
*
* Please follow this convention for regex:
* [\s\S\n] instead of [\s\S] or .
* \d instead of [0-9]
* \. instead of [.]
* To capture a value (decimal or integer): \d*\.?\d* instead of \d+.\d+
*
* Format of each Benchmark
* 	Benchmarkname: {
* 	outerRegex:  Regex with capture group: all text(*) after warmup runs should be used
*  NOTE : Outer regex is optional param should be only used when there are cold runs 
*  that you do not wish to include as result
*  metrics:
*    [  // array of metrics
*        { //individual metric
*            name: name of the metric
*            regex: Regex with capture group: value for the specific metric
*        }, ...
*    ]
*/

const BenchmarkMetricRegex = {
    LibertyDayTrader3: {
    	outerRegex: /<run runNo="\d*" runType="measure"([\s\S\n]*)/,
        metrics: [
            {
                name: "Throughput", //Example: <metric type="throughput">\n<data machine="lance10G" units="req/sec">63.4</data>
                regex: /<metric type="throughput">[\s\S\n]*?(\d*\.?\d*)<\/data>/,
            },
            {
                name: "Footprint in kb", //Example: Footprint (kb)=589444
                regex: /Footprint \(kb\)=(\d*\.?\d*)/,
            }
        ]
    },
    LibertyStartup: {
        outerRegex: /Warm run \d*([\s\S\n]*)/,
        metrics: [ 
            {
                name: "Footprint in kb", //Example: Footprint (kb)=168940
                regex: /Footprint \(kb\)=(\d*\.?\d*)/,
            },
            {
                name: "Startup time in ms", //Example: Startup time: 7828
                regex: /Startup time: (\d*\.?\d*)/,
            }
        ]
    },
    ILOG_WODM: {
        metrics: [
            {
                name: "Global Throughput", //Example: Global Throughput (TPS) for run = 7413.726308633243
                regex: /Global Throughput[\s\S\n]*?= ?(\d*\.?\d*)/,
            }
        ]
    },
    SPECjbb2015: {
        metrics: [
            {
                name: "max_jOPS", //Example: RUN RESULT: hbIR (max attempted) = 47675, hbIR (settled) = 44200, max-jOPS = 41954, critical-jOPS = 15735
                regex: /RUN RESULT:[\s\S\n]*?max-jOPS\s?=\s?(\d*\.?\d*)[\s\S\n]*?critical-jOPS\s?=\s?\d*\.?\d*[\s\S\n]*?\n/,
            },
            {
                name: "critical_jOPS", //same line as above different capture point
                regex: /RUN RESULT:[\s\S\n]*?max-jOPS\s?=\s?\d*\.?\d*[\s\S\n]*?critical-jOPS\s?=\s?(\d*\.?\d*)[\s\S\n]*?\n/,
            }
        ]
    },
    AcmeAirNodejs: {
        metrics: [
            {
                name: "Throughput", //Example: Throughput: 3554.1
                regex: /Throughput: (\d*\.?\d*)/ 
            }
        ]
    }
}

module.exports = BenchmarkMetricRegex;