import math from 'mathjs';
import BenchmarkMath from './BenchmarkMath';

export default class JenkinsRunJSON {
    constructor(runJSON) {
        this.runJSON = runJSON;
        this.parsedVariants = [];
    }

    init(callback) {

        let parsedVariantsCommon = {};
        let curVariantObject = null;
        let curVariantObjectId = null;

        if (this.runJSON.testInfo[0].tests !== undefined) {
            for (let k = 0; k < this.runJSON.testInfo[0].tests.length; k++) {

                if (this.runJSON.testInfo[0].tests[k].benchmarkName && this.runJSON.testInfo[0].tests[k].benchmarkVariant) {
                    curVariantObjectId = this.runJSON.testInfo[0].tests[k].benchmarkName + "!@#$%DELIMIT%$#@!" + this.runJSON.testInfo[0].tests[k].benchmarkVariant;
                } else {
                    // invalid benchmark name and/or variant. Skipping it.
                    continue;
                }

                // new variant
                if (parsedVariantsCommon[curVariantObjectId] === undefined) {
                    parsedVariantsCommon[curVariantObjectId] = {
                        product: (this.runJSON.testInfo[0].tests[k].benchmarkProduct === undefined) ? null : this.runJSON.testInfo[0].tests[k].benchmarkProduct,
                        result: (this.runJSON.testInfo[0].tests[k].testResult === undefined) ? null : this.runJSON.testInfo[0].tests[k].testResult,
                        benchmark: (this.runJSON.testInfo[0].tests[k].benchmarkName === undefined) ? null : this.runJSON.testInfo[0].tests[k].benchmarkName,
                        variant: (this.runJSON.testInfo[0].tests[k].benchmarkVariant === undefined) ? null : this.runJSON.testInfo[0].tests[k].benchmarkVariant,
                        machine: (this.runJSON.testInfo[0].machine === undefined) ? null : this.runJSON.testInfo[0].machine,
                        metrics: (this.runJSON.testInfo[0].tests[k].testData.metrics === undefined) ? [] : this.runJSON.testInfo[0].tests[k].testData.metrics
                    };

                // variant already exists
                } else {
                    // loop over the current metrics
                    for (let x = 0; x < this.runJSON.testInfo[0].tests[k].testData.metrics.length; x++) {

                        // loop over existing metrics
                        for (let y = 0; y < parsedVariantsCommon[curVariantObjectId].metrics.length; y++) {

                            // matching metric found
                            if (this.runJSON.testInfo[0].tests[k].testData.metrics[x].name === parsedVariantsCommon[curVariantObjectId].metrics[y].name) {

                                // create a metric value array with the existing value as the first element
                                if (! Array.isArray(parsedVariantsCommon[curVariantObjectId].metrics[y].value)) {
                                    parsedVariantsCommon[curVariantObjectId].metrics[y].value = [parsedVariantsCommon[curVariantObjectId].metrics[y].value];
                                }
                                // Concat the metric value arrays
                                parsedVariantsCommon[curVariantObjectId].metrics[y].value = parsedVariantsCommon[curVariantObjectId].metrics[y].value.concat(this.runJSON.testInfo[0].tests[k].testData.metrics[x].value)
                                break;
                            }
                        }
                    }
                }
            }
        }

        for (let commonKey in parsedVariantsCommon) {
            curVariantObject = parsedVariantsCommon[commonKey];

            for (let z = 0; z < curVariantObject.metrics.length; z++) {
                if (Array.isArray(curVariantObject.metrics[z].value)) {
                    try {
                        curVariantObject.metrics[z]["mean"] = math.mean(curVariantObject.metrics[z].value);
                    } catch(e) {
                        curVariantObject.metrics[z]["mean"] = null;
                    }

                    try {
                        curVariantObject.metrics[z]["ci"] = BenchmarkMath.confidence_interval(curVariantObject.metrics[z].value) * 100;
                    } catch(e) {
                        curVariantObject.metrics[z]["ci"] = null;
                    }
                }
            }
            this.parsedVariants.push(curVariantObject);
        }

        callback.bind(this)();
    }
}