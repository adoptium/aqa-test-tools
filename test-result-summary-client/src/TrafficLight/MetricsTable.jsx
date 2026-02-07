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

const MetricsTable = ({ type, id, benchmarkName }) => {
    const [data, setData] = useState([]);
    const [javaVersion, setJavaVersion] = useState([]);
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

                const [firstMetric] = fliteredData.metrics;
                const rawValues = firstMetric.rawValues.map((_, i) => {
                    return {
                        key: i,
                        iteration: i,
                        enabled: true,
                        metrics: fliteredData.metrics.map((metric) => {
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
            }
        };
        updateData();
    }, []);

    const handleToggle = (record) => {
        const newData = data.map((item) => {
            if (item.iteration === record.iteration) {
                return { ...item, enabled: !item.enabled };
            }
            return item;
        });
    setData(newData);
    };

    // const uniqueTitle = [...new Set(data.map((item) => item.metricName))];
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
                    <div style={{ 
                        opacity: record.enabled ? 1 : 0.4,
                        textDecoration: record.enabled ? 'none' : 'line-through',
                        color: record.enabled ? 'inherit' : '#999'
                    }}>
                        {record.metrics[i].value}
                    </div>
                );
            },
        };
    }) ?? []),
    {
        title: 'Annotate Bad Runs',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 150,
        fixed: 'right',
        render: (enabled, record) => {
            return (
                <Switch
                    checked={enabled}
                    onChange={() => handleToggle(record)}
                    checkedChildren="Good run"
                    unCheckedChildren="Bad run"
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
