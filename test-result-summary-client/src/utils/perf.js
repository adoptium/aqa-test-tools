
export const getParserProps = async () => {
    let parserProps = await fetch( `/api/getParserProps`, {
            method: 'get'
        }
    );
    parserProps = await parserProps.json();
    return parserProps;  
}

export function getMetricProps(parserProps,benchmarkName,benchmarkVariant,curMetric) {
    let metricProps ="";
    let benchmarkMetricRouter = parserProps['benchmarkMetricRouter'];
    let benchmarkMetric = parserProps['benchmarkMetric'];
    try {
        metricProps = benchmarkMetric[benchmarkMetricRouter[benchmarkName][benchmarkVariant]]["metrics"][curMetric];
    } catch (benchmarkInfoErr) {
        metricProps = "";
    }
    return metricProps;
}