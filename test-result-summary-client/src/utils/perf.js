
export const getBenchmarkMetricProps = async (benchmarkName) => {
    let parserProps = await fetch( `/api/getBenchmarkMetricProps?benchmarkName=${benchmarkName}`, {
            method: 'get'
        }
    );
    parserProps = await parserProps.json();
    return parserProps;
}