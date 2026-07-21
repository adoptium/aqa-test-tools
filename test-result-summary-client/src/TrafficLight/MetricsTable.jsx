import React, { useEffect, useState } from 'react';
import { Table, Typography, Switch } from 'antd';
import { DeleteTwoTone } from '@ant-design/icons';
import { fetchData } from '../utils/Utils';
import BenchmarkMath from '../utils/BenchmarkMathCalculation';
import * as math from 'mathjs';
import { zip } from 'lodash';

const { Text } = Typography;

const SummaryRow = ({ type, stats }) => {
    return (
        <Table.Summary.Row>
            <Table.Summary.Cell>{type.toUpperCase()}</Table.Summary.Cell>
            {stats.map((s) => (
                <Table.Summary.Cell>
                    <b>{s[type]}</b>
                </Table.Summary.Cell>
            ))}
        </Table.Summary.Row>
    );
};

const MetricsTable = ({ type, id, benchmarkName, metricsName, onDataChange, onStatsChange }) => {
    const [data, setData] = useState([]);
    const [javaVersion, setJavaVersion] = useState([]);
    const [metricIndex, setMetricIndex] = useState(0);
    useEffect(() => {
        const updateData = async () => {
            let results;
            if (id) {
                results = await fetchData(`/api/getData?_id=${id}`);
            }
            if (results && results[0]) {
                const aggregateInfo = results[0].aggregateInfo;
                const fliteredData = Object.values(aggregateInfo).find(
                    (item) =>
                        benchmarkName === item.benchmarkName &&
                        item.buildName.includes(type)
                );

                // Match the metric by name (test and baseline can have different
                // metrics available/ordered -- e.g. baseline may only have
                // Throughput while test has Adjusted Single Server Memory, CPU
                // Util pct, and Throughput). Falls back to position 0 for older
                // links that don't carry a metricsName param.
                let selectedIndex = metricsName
                    ? fliteredData.metrics.findIndex((m) => m.name === metricsName)
                    : -1;
                if (selectedIndex === -1) selectedIndex = 0;
                setMetricIndex(0); // index into displayMetrics below, which is always [0] when filtered

                // When a specific metricsName was requested, show only that one
                // metric's column (matches what the person clicked on in the
                // Traffic Light table). Older links with no metricsName still
                // show every available metric side by side.
                const displayMetrics = metricsName
                    ? [fliteredData.metrics[selectedIndex]]
                    : fliteredData.metrics;

                const firstMetric = displayMetrics[0];
                const disabledIterations = firstMetric?.disabledIterations || [];
                const rawValues = firstMetric.rawValues.map((_, i) => {
                    return {
                        key: i,
                        iteration: i,
                        enabled: !disabledIterations.includes(i),
                        metrics: displayMetrics.map((metric) => {
                            return {
                                metricName: metric.name,
                                value: metric.rawValues[i],
                            };
                        })
                    };
                });
                const grandchildrenData = await fetchData(
                    `/api/getChildBuilds?parentId=${results[0]._id}&buildName=${fliteredData.buildName}`
                );
                let javaVersion = '';
                for (const grandchildData of grandchildrenData) {
                    if (grandchildData.javaVersion) {
                        javaVersion = grandchildData.javaVersion;
                        break;
                    }
                }
                setJavaVersion(javaVersion);
                setData(rawValues);
                if (onDataChange) {
                    onDataChange(rawValues);
                }
            }
        };
        updateData();
    }, [id, benchmarkName, metricsName, type, onDataChange]);
    useEffect(() => {
        if (data.length > 0 && onStatsChange) {
            const enabledData = data.filter(item => item.enabled);

            if (enabledData.length > 0) {
                const pivot = zip(...enabledData.map(d => d.metrics));
                const stats = pivot.map((p) => {
                    const values = p.map(({ value }) => value);
                    const mean = Number(math.mean(values)).toFixed(0);
                    const max = math.max(values);
                    const min = math.min(values);
                    const median = Number(math.median(values)).toFixed(0);
                    const std = Number(math.std(values)).toFixed(2);
                    // State value: plain numeric string (e.g. "38.47") for use in comparisons and further calculations by parent components
                    const CI = Number(BenchmarkMath.confidence_interval(values) * 100).toFixed(2);
                    return { mean, max, min, median, std, CI };
                });
                onStatsChange(stats[metricIndex] || stats[0]); // Send the matched metric's stats to parent
            }
             else {
            onStatsChange(null);
            }
        }
    }, [data, metricIndex, onStatsChange]);


    const handleToggle = (record) => {
        const newData = data.map((item) => {
            if (item.iteration === record.iteration) {
                return { ...item, enabled: !item.enabled };
            }
            return item;
        });
    setData(newData);
    if (onDataChange) {
        onDataChange(newData);
    }

    };

    const columns = [
    {
        title: 'Iteration',
        dataIndex: 'iteration',
        key: 'iteration',
        width: 100,
        render: (iteration) => `Run ${iteration + 1}`,
    },
    ...(data[0]?.metrics.map(({ metricName }, i) => {
        return {
            title: metricName,
            key: metricName,
            render: (_, record) => {
                return (
                    <div
                        style={{
                            opacity: record.enabled ? 1 : 0.4,
                            textDecoration: record.enabled
                                ? 'none'
                                : 'line-through',
                            color: record.enabled ? 'inherit' : '#999',
                        }}
                    >
                        {record.metrics[i].value}
                    </div>
                );
            },
        };
    }) ?? []),
    {
        title: 'Annotate data outliers',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 150,
        fixed: 'right',
        render: (enabled, record) => {
            return (
                <Switch
                    checked={!enabled}
                    onChange={() => handleToggle(record)}
                    checkedChildren={<span>&nbsp;</span>}
                    unCheckedChildren="Exclude data"
                />
            );
        },
    },
];

    return (
        <div>
            <p
                style={{
                    fontSize: 25,
                }}
            >
                {type.toUpperCase()} - {benchmarkName}
            </p>
            <pre>JDK Version: {javaVersion}</pre>
            <div style={{ marginBottom: 12, color: '#665' }}>
            <Text>
                Enabled: <strong>{data.filter(d => d.enabled).length}</strong> / {data.length} iterations
            </Text>
            </div>
            <Table
                bordered
                dataSource={data}
                columns={columns}
                pagination={{ defaultPageSize: 50 }}
                summary={(pageData) => {
                    const enabledData = pageData.filter(item => item.enabled);
                    if (!enabledData.length) return null;
                    const pivot = zip(...enabledData.map(d => d.metrics));

                    const stats = pivot.map((p) => {
                        const values = p.map(({ value }) => value)
                        const mean = Number(
                            math.mean(values)
                        ).toFixed(0);
                        const max = math.max(values);
                        const min = math.min(values);
                        const median = Number(
                            math.median(values)
                        ).toFixed(0);
                        const std = Number(
                            math.std(values)
                        ).toFixed(2);
                        // Display value: formatted as a percent string (e.g. "38.47%") for rendering in the summary row only
                        const CI =
                            Number(
                                BenchmarkMath.confidence_interval(
                                    values
                                ) * 100
                            ).toFixed(2) + '%';
                        return {
                            mean,
                            max,
                            min,
                            median,
                            std,
                            CI,
                        };
                    });

                    return (
                        <Table.Summary>
                            <SummaryRow type="mean" stats={stats} />
                            <SummaryRow type="max" stats={stats} />
                            <SummaryRow type="min" stats={stats} />
                            <SummaryRow type="median" stats={stats} />
                            <SummaryRow type="std" stats={stats} />
                            <SummaryRow type="CI" stats={stats} />
                        </Table.Summary>
                    );
                }}
            />
        </div>
    );
};
export default MetricsTable;
