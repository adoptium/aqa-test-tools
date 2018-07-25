// Note: The correct value for the metric must always reside in indice 1 (second element) of the regex output array

const BenchmarkMetricRegex = {
    LibertyDayTrader3: {
        metrics: [
            {
                name: "Throughput",
                regex: /<run runNo="5" runType="measure">[\s\S]*?<metric type="throughput">\n?[\s\S]*?([0-9]*[.]?[0-9]+)<\/data>/,
                regexRepeat: false
            }
        ]
    },
    LibertyStartup: {
        metrics: [
            {
                name: "Footprint in kb",
                outerRegex: /\sWarm\srun\s0\s([\s\S]*)/,
                regex: /\sFootprint\s\(kb\)=(.*)\s/g,
                regexRepeat: true
            },
            {
                name: "Startup time in ms",
                outerRegex: /\sWarm\srun\s0\s([\s\S]*)/,
                regex: /\sStartup\stime:\s(.*)\s/g,
                regexRepeat: true
            }
        ]
    },
    ILOG_WODM: {
        metrics: [
            {
                name: "Global Throughput",
                regex: /Global Throughput.*?=\s?([0-9]*[.]?[0-9]+)/,
                regexRepeat: false
            }
        ]
    },
    SPECjbb2015: {
        metrics: [
            {
                name: "maxjOPS",
                regex: /RUN RESULT:[\s\S]*?max-jOPS\s?=\s?([0-9]*[.]?[0-9]+)[\s\S]*?critical-jOPS\s?=\s?[0-9]*[.]?[0-9]+[\s\S]*?\n/,
                regexRepeat: false
            },
            {
                name: "criticaljOPS",
                regex: /RUN RESULT:[\s\S]*?max-jOPS\s?=\s?[0-9]*[.]?[0-9]+[\s\S]*?critical-jOPS\s?=\s?([0-9]*[.]?[0-9]+)[\s\S]*?\n/,
                regexRepeat: false
            }
        ]
    }
}

module.exports = BenchmarkMetricRegex;