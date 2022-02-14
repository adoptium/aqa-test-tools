export default class ExtractRelevantJenkinsTestResults {
    constructor(runJSON) {
        this.runJSON = runJSON;
        this.parsedVariants = [];
    }

    init(callback) {
        let parsedVariantsCommon = {};
        let curVariantObjectId = null;
        const { jdkDate, machine, aggregateInfo } = this.runJSON.testInfo[0];
        if (Array.isArray(aggregateInfo) && aggregateInfo.length > 0) {
            for (let {
                benchmarkName,
                benchmarkVariant,
                metrics,
            } of aggregateInfo) {
                if (benchmarkName && benchmarkVariant) {
                    curVariantObjectId =
                        benchmarkName + '!@#$%DELIMIT%$#@!' + benchmarkVariant;
                }
                // new variant
                if (!parsedVariantsCommon[curVariantObjectId]) {
                    parsedVariantsCommon[curVariantObjectId] = {
                        jdkDate,
                        benchmarkName,
                        benchmarkVariant,
                        machine,
                        metrics,
                    };
                    this.parsedVariants.push(
                        parsedVariantsCommon[curVariantObjectId]
                    );
                }
            }
        }
        //pass a function pointer as a callback
        callback.bind(this)();
    }
}
