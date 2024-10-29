export default class PerffarmRunJSON {
    constructor(parsedCSV) {
        this.parsedCSV = parsedCSV;
        this.parsedVariants = [];
        this.headingColumn = parsedCSV[0];
    }

    init(callback) {
        let variantIndex = [];
        let curVariantObject;
        let curMetricObject;
        let indexOfFirstMetric;
        let indexOfMean = null;
        let indexOfCI = null;

        // Find the indexes of the variant separators
        for (let j = 0; j < this.parsedCSV.length; j++) {
            // Each variant is separated by a 1 element array
            if (this.parsedCSV[j].length === 1) {
                variantIndex.push(j);

                // The excel file is separated into two portions, the upper showing the detailed
                // benchmark results (which is needed) and the bottom showing a comparison if any.
                // The separation point is either:
                //      two back to back arrays with length 1 OR
                //      an array of length 1 followed by an array of length 2
                if (
                    this.parsedCSV[j + 1].length === 1 ||
                    this.parsedCSV[j + 1].length === 2
                ) {
                    break;
                }
            }
        }

        for (let k = 0; k < variantIndex.length - 1; k++) {
            curVariantObject = {
                runID: this.parsedCSV[variantIndex[k] + 1][
                    this.headingColumn.indexOf('RunID')
                ],
                product:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('Product')
                    ],
                runDate:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('Date')
                    ],
                jvmBuild:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('JVM Build')
                    ],
                j9vmLevel:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('J9VM level')
                    ],
                jitLevel:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('JIT level')
                    ],
                gcLevel:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('GC level')
                    ],
                j9clLevel:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('J9CL level')
                    ],
                jclLevel:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('JCL level')
                    ],
                orbLevel:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('ORB level')
                    ],
                benchmark:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('Benchmark')
                    ],
                variant:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('Variant')
                    ],
                machine:
                    this.parsedCSV[variantIndex[k] + 1][
                        this.headingColumn.indexOf('Machine')
                    ],
                metrics: [],
            };

            // Metrics column position is right after the "Job ID" column
            if (this.parsedCSV[variantIndex[k] + 1].indexOf('Job ID') === -1) {
                continue;
            }
            indexOfFirstMetric =
                this.parsedCSV[variantIndex[k] + 1].indexOf('Job ID') + 1;

            // Get Mean and CI row indices. Both are in the column before the first metric
            for (
                let n = variantIndex[k + 1] - 1;
                n < variantIndex[k + 1];
                n--
            ) {
                if (this.parsedCSV[n][indexOfFirstMetric - 1] === 'means') {
                    indexOfMean = n;
                    if (indexOfCI !== null) {
                        break;
                    }
                } else if (
                    this.parsedCSV[n][indexOfFirstMetric - 1] ===
                    'confidence_interval'
                ) {
                    indexOfCI = n;
                    if (indexOfMean !== null) {
                        break;
                    }
                }
            }

            // Mean and confidence interval rows could not be found
            if (indexOfMean === null || indexOfCI === null) {
                continue;
            }

            for (
                let m = indexOfFirstMetric;
                m < this.parsedCSV[variantIndex[k] + 1].length;
                m++
            ) {
                //Jenkins result object has format of {name:*** value: {mean:***,ci:***}}
                //value:{} is used to reduce duplicate code in perfCompare by matching the result object of perffarm to jenkins result object
                curMetricObject = { value: {} };
                curMetricObject['name'] =
                    this.parsedCSV[variantIndex[k] + 1][m];
                // Mean is always 6 indices above the next variant separator
                curMetricObject['value']['mean'] =
                    this.parsedCSV[indexOfMean][m];

                // Confidence Interval is always 4 indices above the next variant separator
                try {
                    curMetricObject['value']['CI'] =
                        this.parsedCSV[indexOfCI][m];
                } catch (e) {
                    curMetricObject['value']['CI'] = null;
                }

                curVariantObject.metrics.push(curMetricObject);
            }

            this.parsedVariants.push(curVariantObject);
            indexOfMean = null;
            indexOfCI = null;
        }
        callback.bind(this)();
    }
}
