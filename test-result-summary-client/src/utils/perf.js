
export const getParserProps = async () => {
    let parserProps = await fetch( `/api/getParserProps`, {
            method: 'get'
        }
    );
    parserProps = await parserProps.json();
    return parserProps;  
}

export function getMetricProps(parserProps,benchmarkName,curMetric) {
    let benchmarkMetric = parserProps['benchmarkMetric'];
    try {
        for(let key of Object.keys(benchmarkMetric)){
            if(benchmarkName.includes(key)){
                return benchmarkMetric[key]["metrics"][curMetric]
            }
        }
    } catch (benchmarkInfoErr) {
        return "";
    }
}