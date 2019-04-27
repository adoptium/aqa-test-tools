
export default class JenkinsRunJSON {
    constructor(runJSON) {
        this.runJSON = runJSON;
        this.parsedVariants = [];
    }

    init(callback) {

        let parsedVariantsCommon = {};
        let curVariantObject = null;
        let curVariantObjectId = null;

        if (this.runJSON.testInfo[0].aggregateInfo !== undefined) {
            for (let k = 0; k < this.runJSON.testInfo[0].aggregateInfo.length; k++) {
                if (this.runJSON.testInfo[0].aggregateInfo[k].benchmarkName && this.runJSON.testInfo[0].aggregateInfo[k].benchmarkVariant) {
                    curVariantObjectId = this.runJSON.testInfo[0].aggregateInfo[k].benchmarkName + "!@#$%DELIMIT%$#@!" + this.runJSON.testInfo[0].aggregateInfo[k].benchmarkVariant;
                } else {
                    // invalid benchmark name and/or variant. Skipping it.
                    continue;
                }

                // new variant
                if (parsedVariantsCommon[curVariantObjectId] === undefined) {
                    parsedVariantsCommon[curVariantObjectId] = {
                        product: (this.runJSON.testInfo[0].aggregateInfo[k].benchmarkProduct === undefined) ? null : this.runJSON.testInfo[0].aggregateInfo[k].benchmarkProduct,
                        benchmark: (this.runJSON.testInfo[0].aggregateInfo[k].benchmarkName === undefined) ? null : this.runJSON.testInfo[0].aggregateInfo[k].benchmarkName,
                        variant: (this.runJSON.testInfo[0].aggregateInfo[k].benchmarkVariant === undefined) ? null : this.runJSON.testInfo[0].aggregateInfo[k].benchmarkVariant,
                        metrics: (this.runJSON.testInfo[0].aggregateInfo[k].metrics === undefined) ? [] : this.runJSON.testInfo[0].aggregateInfo[k].metrics,
                        testsData: (this.runJSON.testInfo[0].tests === undefined) ? undefined : this.runJSON.testInfo[0].tests[0].testData.metrics
                    };

                // variant already exists
                } else {
                    // loop over the current metrics
                    for (let x = 0; x < this.runJSON.testInfo[0].aggregateInfo[k].metrics.length; x++) {

                        // loop over existing metrics
                        for (let y = 0; y < parsedVariantsCommon[curVariantObjectId].metrics.length; y++) {

                            // matching metric found
                            if (this.runJSON.testInfo[0].aggregateInfo[k].metrics[x].name === parsedVariantsCommon[curVariantObjectId].metrics[y].name) {
                                  this.parsedVariants.push(parsedVariantsCommon[curVariantObjectId].metrics[y].value)
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
                        curVariantObject.metrics[z]["mean"] = curVariantObject.metrics[z].value.mean;
                    } catch(e) {
                        curVariantObject.metrics[z]["mean"] = null;
                    }

                    try {
                        curVariantObject.metrics[z]["ci"] = curVariantObject.metrics[z].value.CI * 100;
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