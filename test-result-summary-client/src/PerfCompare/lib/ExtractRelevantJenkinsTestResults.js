
export default class ExtractRelevantJenkinsTestResults {
    constructor(runJSON) {
        this.runJSON = runJSON;
        this.parsedVariants = [];
    }

    init(callback) {

        let parsedVariantsCommon = {};
        let curVariantObjectId = null;
        let testInfo = this.runJSON.testInfo[0];
        if (Array.isArray(testInfo.aggregateInfo) && testInfo.aggregateInfo.length > 0) {
            for (let aggregateInfo of testInfo.aggregateInfo) {
                if (aggregateInfo.benchmarkName && aggregateInfo.benchmarkVariant) {
                    curVariantObjectId = aggregateInfo.benchmarkName + "!@#$%DELIMIT%$#@!" + aggregateInfo.benchmarkVariant;
                } else {
                    // invalid benchmark name and/or variant. Skipping it.
                    continue;
                }

                // new variant
                if (parsedVariantsCommon[curVariantObjectId] === undefined) {
                    parsedVariantsCommon[curVariantObjectId] = {
                        product: aggregateInfo.benchmarkProduct,
                        benchmark: aggregateInfo.benchmarkName,
                        variant: aggregateInfo.benchmarkVariant,
                        machine: testInfo.machine,
                        metrics: aggregateInfo.metrics,
                        testsData: (testInfo.tests === undefined) ? undefined : testInfo.tests[0].testData.metrics
                    };
                    this.parsedVariants.push(parsedVariantsCommon[curVariantObjectId]);
                }
            }
        }
        //pass a function pointer as a callback
        callback.bind(this)();
    }
}