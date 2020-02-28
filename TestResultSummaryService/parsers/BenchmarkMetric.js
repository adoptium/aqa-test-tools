const math = require('mathjs');
// TODO : Find a library function for geometric mean
function geomean(inputArray){ 
    let result = math.prod(inputArray);
    result = math.nthRoot(result, inputArray.length);
    return result;
}
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
*    {  //  metrics object with following properties.
*       name of metric : { //individual metric 
*           regex: Regex with capture group: value for the specific metric
*           higherbetter: variable to dettermine if its better to have higher value
*           units: unit of measurement
*           (Optional) funcName: storing a function that will run on the current set of metric values.
*                                Metrics such as JITCPU total in LibertyThroughput and geomean_GCA in CryptoBB require aggregate function to be applied. 
*                                e.g JIT CPU total values are collected as [ 0,0,300,200,20 ] but we display 520 as the JITCPU total  
*
*        }, and more metrics in same format...
*    }
* Note: All the Regex is specific to Jenkins. Higherbetter/units are used for both Jenkins & Perffarm
*/
const BenchmarkMetricRegex = {
    DayTrader30: {
        outerRegex: /<run runNo="\d*" runType="measure"([\s\S\n]*)/,
        metrics: {
            "Adjusted Single Server Memory": {
                //Example: <metric type="Adjusted Single Server Memory">\n<data machine="sevenup10G" units="KB">1286449</data>
                regex:/<metric type="Adjusted Single Server Memory">[\s\S\n]*?units="KB">(\d*\.?\d*)<\/data>/,
                higherbetter: false,
                units: "kb",
            },
            "CPU Util pct": {
                //we only keep track of first CPUutil
                //Example: <metric type="CPU Utilization">\n<data machine="sevenup10G" units="%" cv="0.0">14.0</data>/n<data machine="bottas10G" units="%" cv="2.9951475130430323">15.3</data>
                regex:/<metric type="CPU Utilization">[\s\S\n]*?cv="\d*\.?\d*">(\d*\.?\d*)<\/data>[\s\S\n]<data machine/,
                higherbetter: false,
                units: "%",
            },
            "Throughput": {
                //Example: <metric type="throughput">\n<data machine="bottas10G" units="req/sec">533.592</data>
                regex:/<metric type="throughput"[\s\S\n]*? units="req\/sec">(\d*\.?\d*)<\/data>/,
                higherbetter: true,
                units: "req/sec",
            }
        }
    },
    DayTrader: {
        outerRegex: /<run runNo="\d*" runType="measure"([\s\S\n]*)/,
        metrics: {
            "Throughput":{
                //Example: <metric type="throughput">\n<data machine="lance10G" units="req/sec">63.4</data>
                regex: /<metric type="throughput">[\s\S\n]*?(\d*\.?\d*)<\/data>/,
                higherbetter: true,
                units: "ops/s",
            },  
            "Adjusted Single Server Memory":{
                //Example: Footprint (kb)=589444
                regex: /Footprint \(kb\)=(\d*\.?\d*)/,
                higherbetter: false,
                units: "kb",
            },
            "CPU Util pct":{
                //Example: <data machine="wehrlein10G" units="%" cv="1.0064976672229644">15.139217146458863</data>
                regex: /<metric type="CPU Utilization">[\s\S\n]*?<\/data>[\s\S\n]*?<data[\s\S\n]*?>(\d*\.?\d*)*/,
                higherbetter: false,
                units: "%",  
            },
            "JIT CPU total ms":{
                //Example: #PERF:  Time spent in compilation thread =22323 ms 
                //JITCPUtotal is sum of all JIT CPU usage use values in verbose logs
                regex: /#PERF[\s\S\n]*?compilation thread =(\d*\.?\d*)[\s\S\n]*?/,
                higherbetter: false,
                units: "%",
                funcName: math.sum,
            },
        }
    },
    LibertyStartup: {
        outerRegex: /Warm run \d*([\s\S\n]*)/,
        metrics: { 
            "Footprint in kb":{
                //Example: Footprint (kb)=168940
                regex: /Footprint \(kb\)=(\d*\.?\d*)/,
                higherbetter: false,
                units: "kb",
            },
            "Startup time in ms":{
                //Example: Startup time: 7828
                regex: /Startup time: (\d*\.?\d*)/,
                higherbetter: false,
                units: "ms",
            },
        }
    },
    bumbleBench: {
        metrics: {
            "Score":{
                //Example: ArrayListSortComparatorBench score: 2757481.000000 (2.757M 1483.0%)
                regex: /ArrayListSort[\s\S\n]*? score: ?(\d*\.?\d*)/,
                higherbetter: true,
                units: "iterations/batch",
            },
            "Uncertainty":{
                //Example: uncertainty:   0.8%
                regex:/uncertainty:[\[ ]{3,}]?(\d*\.?\d*)/,
                higherbetter: false,
                units: "%",
            },
        }
    },
    IdleMicrobenchmark: {
        metrics: {
            "ACTIVE MAX":{
                regex: /ACTIVE MAX:\s?(\d+.?\d+)/,
                higherbetter: true,
                units: "req/sec"
            },            
        }
    },
    ILOG_WODM: {
        metrics: {
            "Global Throughput":{
                //Example: Global Throughput (TPS) for run = 7413.726308633243
                regex: /Global Throughput[\s\S\n]*?= ?(\d*\.?\d*)/,
                higherbetter: true,
                units: "req/sec"
            },            
        }
    },
    SPECjbb2015: {
        metrics: {
            "max_jOPS":{
                //Example: RUN RESULT: hbIR (max attempted) = 47675, hbIR (settled) = 44200, max-jOPS = 41954, critical-jOPS = 15735
                regex: /RUN RESULT:[\s\S\n]*?max-jOPS\s?=\s?(\d*\.?\d*)[\s\S\n]*?critical-jOPS\s?=\s?\d*\.?\d*[\s\S\n]*?\n/,
                higherbetter: true,
                units:"jOPS", 
            },
            "critical_jOPS":{
                //same line as above different capture point
                regex: /RUN RESULT:[\s\S\n]*?max-jOPS\s?=\s?\d*\.?\d*[\s\S\n]*?critical-jOPS\s?=\s?(\d*\.?\d*)[\s\S\n]*?\n/,
                higherbetter: true,
                units:"jOPS",
            }
        }
    },
    AcmeAirNodejs: {
        metrics: {
            "Throughput":{
                //Example: Throughput: 3554.1
                regex: /Throughput: (\d*\.?\d*)/,
                higherbetter: true,
                units: "ops/s"
            }
        }
    },
    WebSphereFootprint: {
        metrics: {
            "Adjusted Single Server Memory": {
                //Example: <metric type="Adjusted Single Server Memory">\n<data serverName="DayTrader30" machine="mathis10G" units="KB">344130</data>
                regex:/<metric type="Adjusted Single Server Memory">[\s\S\n]*?units="KB">(\d*\.?\d*)<\/data>/,
                higherbetter: false,
                units: "kb",
            }
        }
    },
    WebSphereStartup: {
        metrics: {
            "Startup time in ms": {
                //Example: <metric type="time">\n<data machine="poisonivy10G" units="ms">15496</data>
                regex:/<metric type="time"[\s\S\n]*? units="ms">(\d*\.?\d*)<\/data>/,
                higherbetter: false,
                units: "ms",
            }
        }
    },
    SOABENCH: {
        outerRegex:/<run runNo="\d*" runType="measure"([\s\S\n]*)/,
        metrics: {
            "Throughput": {
                //Example: <metric type="throughput">\n<data machine="schumi10G" units="req/sec">6425.683</data>\n</metric>
                regex:/<metric type="throughput"[\s\S\n]*? units="req\/sec">(\d*\.?\d*)<\/data>/,
                higherbetter: true,
                units: "req/sec"
            }
        }
    },
    Crypto: {
        metrics: {
            "geomean_GCM": {
                //Example: gcm-128-encrypt-NoPadding,16,IBMJCE,0.146262MB,sevenup.hursley.ibm.com,,1 
                regex:/gcm-128[\s\S\n]*?IBMJCE,(\d*\.?\d*)MB/,
                higherbetter: true,
                units: "ops/sec",
                funcName: geomean,
            },
            "geomean_CBC": {
                //Example:cbc-128-encrypt_stream-NoPadding,16,IBMJCE,113MB,sevenup,,1
                regex:/cbc-128[\s\S\n]*?IBMJCE,(\d*\.?\d*)MB/,
                higherbetter: true,
                units: "ops/sec",
                funcName: geomean,
            },
            "geomean_SHA": {
                //Example:sha256,16,IBMJCE,29.8134MB,sevenup,,1
                regex:/sha[\s\S\n]*?IBMJCE,(\d*\.?\d*)MB/,
                higherbetter: true,
                units: "ops/sec",
                funcName: geomean,
            },
            "geomean_EC": {
                //Example:ecdh-secp192r1,,IBMJCE,5.9e-05MB,sevenup,,1
                regex:/ecd[\s\S\n]*?IBMJCE,(\d*\.?\d*e?-?\d*)MB/,
                higherbetter: true,
                units: "ops/sec",
                funcName: geomean,
            },
            "geomean_RSA": {
                //Example:rsa-2048-Sign,36,IBMJCE,0.000165MB,sevenup,,1
                regex:/rsa[\s\S\n]*?IBMJCE,(\d*\.?\d*)MB/,
                higherbetter: true,
                units: "ops/sec",
                funcName: geomean,
            },
            "geomean_HMAC": {
                //Example:HmacSHA256-16,16,IBMJCE,7.05653MB,sevenup,,1
                regex:/HmacSHA[\s\S\n]*?IBMJCE,(\d*\.?\d*)MB/,
                higherbetter: true,
                units: "ops/sec",
                funcName: geomean,
            }
        }
    }
}

module.exports = BenchmarkMetricRegex;