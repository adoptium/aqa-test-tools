import React, { useEffect, useState } from 'react';
import { Table, Space, Select, Tooltip, Divider } from 'antd';
import { Link } from 'react-router-dom';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    MinusCircleOutlined,
    WarningOutlined,
    ProfileTwoTone,
} from '@ant-design/icons';
import { fetchData, getInfoFromBuildName } from '../utils/Utils';
import { params } from '../utils/query';
import { Button } from '../Components/Button';
import _, { first, identity, uniq } from 'lodash';

function TrafficLight() {
    const [testBuild, setTestBuild] = useState();
    const [baselineBuild, setBaselineBuild] = useState();
    const [buildOptions, setBuildOptions] = useState([]);
    const [tableData, settableData] = useState([]);
    const [metricsProps, setMetricsProps] = useState({});

    const iconRed = (
        <CloseCircleOutlined
            style={{ color: 'rgb(255, 85, 0)', fontSize: 23 }}
        />
    );
    const iconGreen = (
        <CheckCircleOutlined
            style={{ color: 'rgb(44, 190, 78)', fontSize: 23 }}
        />
    );
    const iconYellow = (
        <WarningOutlined style={{ color: 'rgb(218, 165, 32)', fontSize: 23 }} />
    );
    const iconGrey = (
        <MinusCircleOutlined
            style={{ color: 'rgb(158, 158, 158)', fontSize: 23 }}
        />
    );

    useEffect(() => {
        fetchDataAndUpdate();
    }, []);

    async function fetchDataAndUpdate() {
        const results = await fetchData(
            `/api/getBuildHistory?buildName=Perf_Pipeline&status=Done&limit=120`
        );
        setBuildOptions(
            results.map((result) => {
                const buildUrl = result.buildUrl;
                const buildId = result._id;
                return { value: buildId, label: buildUrl };
            })
        );
    }

    const handleCompare = async () => {
        let testData = await fetchData(
            `/api/getTrafficLightData?parentId=${testBuild}&buildType=test`
        );
        let baselineData = [];
        // Use aggregateInfo.BuildName Perf_openjdkxxx_test as test build.
        // If the testData and baselineData are from the same build,
        // use aggregateInfo.BuildName Perf_openjdkxxx_baseline as baseline build.
        // Otherwise, use aggregateInfo.BuildName Perf_openjdkxxx_test as baseline build.
        if (baselineBuild === testBuild) {
            baselineData = await fetchData(
                `/api/getTrafficLightData?parentId=${baselineBuild}&buildType=baseline`
            );
        } else {
            baselineData = await fetchData(
                `/api/getTrafficLightData?parentId=${baselineBuild}&buildType=test`
            );
        }

        testData.forEach((element) => {
            element.buildType = 'test';
        });
        baselineData.forEach((element) => {
            element.buildType = 'baseline';
        });

        const metricPropsJSON = await fetchData(`/api/getBenchmarkMetricProps`);
        if (metricPropsJSON) {
            setMetricsProps(metricPropsJSON);
        }

        const modifiedData = [...testData, ...baselineData]
            .map(
                ({
                    _id,
                    buildType,
                    buildName: parentBuildName,
                    aggregateInfo,
                }) => {
                    const { benchmarkName, benchmarkVariant, buildName } =
                        aggregateInfo;
                    const benchmark = benchmarkName.split('-')[0];

                    const {
                        jdkVersion,
                        jdkImpl,
                        level,
                        group,
                        platform,
                        rerun,
                    } = getInfoFromBuildName(buildName);
                    const buildNameTitle = parentBuildName.slice(
                        0,
                        parentBuildName.lastIndexOf('_')
                    );
                    return aggregateInfo.metrics.map(
                        ({ name: metricsName, statValues, rawValues }) => {
                            let higherbetter = true;
                            const benchmarchMetric = metricsProps[benchmark]
                                ? metricsProps[benchmark].metrics
                                : null;
                            if (
                                benchmarchMetric &&
                                benchmarchMetric[metricsName]
                            ) {
                                higherbetter =
                                    benchmarchMetric[metricsName].higherbetter;
                            }
                            return {
                                _id,
                                parentBuildName,
                                buildNameTitle,
                                buildType,
                                metricsName,
                                statValues,
                                rawValues,
                                benchmarkName,
                                benchmarkVariant,
                                buildName,
                                platform,
                                higherbetter,
                            };
                        }
                    );
                }
            )
            .flat();
        const regroupedData = _.groupBy(
            modifiedData,
            ({ benchmarkName, benchmarkVariant, metricsName }) => {
                return JSON.stringify({
                    benchmarkName,
                    benchmarkVariant,
                    metricsName,
                });
            }
        );
        settableData(
            Object.entries(regroupedData).map(([k, v]) => {
                return { ...JSON.parse(k), ...v };
            })
        );
    };

    const renderCell = (title, _, obj) => {
        const testBuild = Object.values(obj).find(
            ({ buildNameTitle, buildType }) =>
                buildNameTitle === title && buildType === 'test'
        );
        const baselineBuild = Object.values(obj).find(
            ({ buildNameTitle, buildType }) =>
                buildNameTitle === title && buildType === 'baseline'
        );
        if (testBuild && baselineBuild) {
            let percentage = -1;
            const testValues = testBuild.statValues;
            const baselineValues = baselineBuild.statValues;
            const testScore = Number(testValues.mean).toFixed(0);
            const baselineScore = Number(baselineValues.mean).toFixed(0);
            if (testBuild.higherbetter) {
                percentage = Number((testScore * 100) / baselineScore).toFixed(
                    2
                );
            } else {
                percentage = Number((baselineScore * 100) / testScore).toFixed(
                    2
                );
            }

            const testCI = Number(testValues.CI * 100).toFixed(2) + '%';
            const baselineCI = Number(baselineValues.CI * 100).toFixed(2) + '%';
            const totalCI =
                Number((testValues.CI + baselineValues.CI) * 100).toFixed(2) +
                '%';

            let icon = iconRed;
            if (percentage > 98) {
                icon = iconGreen;
            } else if (percentage > 90) {
                icon = iconYellow;
            }

            return (
                <Tooltip
                    title={
                        <pre>
                            Test Score: {testScore} <br />
                            Baseline Score: {baselineScore}
                            <br />
                            Test CI: {testCI} <br />
                            Baseline CI: {baselineCI} <br />
                            Total CI: {totalCI}
                        </pre>
                    }
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <Link
                            to={{
                                pathname: '/buildDetail',
                                search: params({ parentId: testBuild._id }),
                            }}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 5,
                                }}
                            >
                                {icon} {percentage}%
                            </div>
                        </Link>
                        <Divider type="vertical" />
                        <Link
                            to={{
                                pathname: '/metricsDetails',
                                search: params({
                                    testId: testBuild._id,
                                    baselineId: baselineBuild._id,
                                    benchmarkName: testBuild.benchmarkName,
                                }),
                            }}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <ProfileTwoTone />
                        </Link>
                    </div>
                </Tooltip>
            );
        } else {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {iconGrey} N/A
                </div>
            );
        }
    };

    const firstRow = first(tableData) ?? {};
    const groups = Object.values(firstRow) ?? [];
    const buildNameTitles = uniq(
        groups.map(({ buildNameTitle }) => buildNameTitle).filter(identity)
    );

    const columns = [
        {
            title: 'Benchmark Name',
            key: 'benchmarkName',
            render: (_, { benchmarkName, metricsName }) => {
                return (
                    <div>
                        {benchmarkName}
                        <br />
                        <b>{metricsName}</b>
                    </div>
                );
            },
        },
        ...buildNameTitles.map((title, i) => {
            return {
                title,
                key: i,
                render: renderCell.bind(null, title),
            };
        }),
    ];
    return (
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
            <Select
                style={{
                    width: '100%',
                }}
                defaultValue={testBuild}
                onChange={setTestBuild}
                options={buildOptions}
                placeholder="please select test build"
            />
            <Select
                style={{
                    width: '100%',
                }}
                defaultValue={baselineBuild}
                onChange={setBaselineBuild}
                options={buildOptions}
                placeholder="please select baseline build"
            />
            <Space direction="horizontal">
                <Button type="primary" onClick={handleCompare}>
                    Compare
                </Button>
            </Space>
            <br />
            {tableData ? (
                <Table dataSource={tableData} columns={columns} />
            ) : (
                ''
            )}
            <pre>
                Note: <br />{' '}
                <p style={{ display: 'flex' }}>
                    - Score {'>'} 98% - No Regression {iconGreen}
                </p>
                <p style={{ display: 'flex' }}>
                    - Score in 91% - 98% - Possible Regression {iconYellow}{' '}
                </p>
                <p style={{ display: 'flex' }}>
                    - Score {'<'} 90% - Regression {iconRed}
                </p>
                <p style={{ display: 'flex' }}>
                    - N/A - Missing data {iconGrey}
                </p>
            </pre>
        </Space>
    );
}
export default TrafficLight;
