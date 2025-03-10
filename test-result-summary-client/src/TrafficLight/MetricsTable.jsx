import React, { useEffect, useState } from 'react';
import { Table, Typography } from 'antd';
import { DeleteTwoTone } from '@ant-design/icons';
import { fetchData } from '../utils/Utils';
import BenchmarkMath from 'utils/BenchmarkMathCalculation';
import { max, min, std, mean, median } from 'mathjs';

const { Text } = Typography;

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

                const rawValues = fliteredData.metrics
                    .map((metric) => {
                        return metric.rawValues.map((value, i) => {
                            return {
                                metricName: metric.name,
                                value,
                                i,
                            };
                        });
                    })
                    .flat();
                setData(rawValues);
            }
        };
        updateData();
    }, []);

    const handleDelete = (record) => {
        const newData = data.filter((item) => item.i !== record.i);
        setData(newData);
    };
    const uniqueTitle = [...new Set(data.map((item) => item.metricName))];
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        ...uniqueTitle.map((title, i) => {
            return {
                title,
                key: title + i,
                render: (_, record, obj) => {
                    return <div>{record.value}</div>;
                },
            };
        }),
        {
            title: 'Remove',
            dataIndex: 'remove',
            key: 'remove',
            render: (_, record, obj) =>
                data.length >= 1 ? (
                    <DeleteTwoTone
                        onClick={() => handleDelete(record)}
                        type="primary"
                        style={{
                            marginBottom: 16,
                        }}
                    />
                ) : null,
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
                summary={(pageData) => {
                    if (!pageData.length) return null;

                    const meanVal = mean(pageData.map(({ value }) => value));
                    const maxVal = max(pageData.map(({ value }) => value));
                    const minVal = min(pageData.map(({ value }) => value));
                    const medianVal = median(
                        pageData.map(({ value }) => value)
                    );
                    const stdVal = std(
                        pageData.map(({ value }) => value)
                    ).toFixed(2);
                    const CI = BenchmarkMath.confidence_interval(
                        pageData.map(({ value }) => value)
                    ).toFixed(3);
                    return (
                        <Table.Summary>
                            <Table.Summary.Row>
                                <Table.Summary.Cell>Mean</Table.Summary.Cell>
                                <Table.Summary.Cell>
                                    <b>{meanVal}</b>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row>
                                <Table.Summary.Cell>Max</Table.Summary.Cell>
                                <Table.Summary.Cell>
                                    <b>{maxVal}</b>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row>
                                <Table.Summary.Cell>Min</Table.Summary.Cell>
                                <Table.Summary.Cell>
                                    <b>{minVal}</b>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row>
                                <Table.Summary.Cell>Median</Table.Summary.Cell>
                                <Table.Summary.Cell>
                                    <b>{medianVal}</b>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row>
                                <Table.Summary.Cell>STD</Table.Summary.Cell>
                                <Table.Summary.Cell>
                                    <b>{stdVal}</b>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row>
                                <Table.Summary.Cell>CI</Table.Summary.Cell>
                                <Table.Summary.Cell>
                                    <b>{CI}</b>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        </Table.Summary>
                    );
                }}
            />
        </div>
    );
};
export default MetricsTable;
