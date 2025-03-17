import React, { useEffect, useState } from 'react';
import { Table, Typography } from 'antd';
import { DeleteTwoTone } from '@ant-design/icons';
import { fetchData } from '../utils/Utils';
import BenchmarkMath from 'utils/BenchmarkMathCalculation';
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
    useEffect(() => {
        const updateData = async () => {
            let results;
            if (id) {
                results = await fetchData(`/api/getData?_id=${id}`);
            }
            if (results && results[0]) {
                results = results[0].aggregateInfo;

                const fliteredData = Object.values(results).find(
                    (item) =>
                        benchmarkName === item.benchmarkName &&
                        item.buildName.includes(type)
                );

                const [firstMetric] = fliteredData.metrics;
                const rawValues = firstMetric.rawValues.map((_, i) => {
                    return fliteredData.metrics.map((metric, j) => {
                        return {
                            metricName: metric.name,
                            value: metric.rawValues[i],
                            i,
                        };
                    });
                });

                setData(rawValues);
            }
        };
        updateData();
    }, []);

    const handleDelete = (record) => {
        const newData = data.filter((item) => item !== record);
        setData(newData);
    };
    // const uniqueTitle = [...new Set(data.map((item) => item.metricName))];
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        ...(data[0]?.map(({ metricName }, i) => {
            return {
                title: metricName,
                key: metricName,
                render: (_, record, obj) => {
                    return <div>{record[i].value}</div>;
                },
            };
        }) ?? []),
        {
            title: 'Remove',
            dataIndex: 'remove',
            key: 'remove',
            render: (_, record, obj) => {
                return data.length >= 1 ? (
                    <DeleteTwoTone
                        onClick={() => handleDelete(record)}
                        type="primary"
                        style={{
                            marginBottom: 16,
                        }}
                    />
                ) : null;
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
            <Table
                bordered
                dataSource={data}
                columns={columns}
                pagination={{ defaultPageSize: 50 }}
                summary={(pageData) => {
                    if (!pageData.length) return null;

                    const pivot = zip(...pageData);

                    const stats = pivot.map((p) => {
                        const mean = math.mean(p.map(({ value }) => value));
                        const max = math.max(p.map(({ value }) => value));
                        const min = math.min(p.map(({ value }) => value));
                        const median = math.median(p.map(({ value }) => value));
                        const std = math
                            .std(p.map(({ value }) => value))
                            .toFixed(2);
                        const CI = BenchmarkMath.confidence_interval(
                            p.map(({ value }) => value)
                        ).toFixed(3);
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
