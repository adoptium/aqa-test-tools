import { Divider } from 'antd';
import MetricsTable from './MetricsTable';
import { getParams } from '../utils/query';

function MetricsDetails() {
    const { testId, baselineId, benchmarkName } = getParams(location.search);
    return (
        <div>
            <MetricsTable
                type="test"
                id={testId}
                benchmarkName={benchmarkName}
            />
            <Divider />
            <MetricsTable
                type="baseline"
                id={baselineId}
                benchmarkName={benchmarkName}
            />
        </div>
    );
}
export default MetricsDetails;
