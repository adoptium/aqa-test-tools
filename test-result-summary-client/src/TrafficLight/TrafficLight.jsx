import React, { useEffect, useState } from 'react';
import { Table, Space, Select, Tooltip, Divider, Tabs } from 'antd';
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
// Display order of benchmark groups; a benchmark belongs to the first group
// with a matching name prefix, and prefix order is kept within a group.
const BENCHMARK_GROUPS = [
    { label: 'Microbenchmarks', prefixes: ['specjbb', 'ilog'] },
    { label: 'Liberty', prefixes: ['liberty'] },
];
const OTHER_GROUP_LABEL = 'Other';

const getBenchmarkRank = (benchmarkName) => {
    const name = benchmarkName.toLowerCase();
    for (let group = 0; group < BENCHMARK_GROUPS.length; group++) {
        const prefix = BENCHMARK_GROUPS[group].prefixes.findIndex((p) =>
            name.startsWith(p)
        );
        if (prefix !== -1) return { group, prefix };
    }
    return { group: BENCHMARK_GROUPS.length, prefix: 0 };
};

const ALL_TAB_KEY = 'all';

// Returns rows with their group rank, sorted by group, prefix and name.
const rankAndSortRows = (rows) =>
    rows
        .map((row) => ({ row, rank: getBenchmarkRank(row.benchmarkName) }))
        .sort(
            (a, b) =>
                a.rank.group - b.rank.group ||
                a.rank.prefix - b.rank.prefix ||
                a.row.benchmarkName.localeCompare(
                    b.row.benchmarkName,
                    undefined,
                    { numeric: true, sensitivity: 'base' }
                )
        );

// Inserts a header row at the start of each group.
const addGroupHeaders = (ranked) => {
    const result = [];
    let lastGroup = -1;
    ranked.forEach(({ row, rank }) => {
        if (rank.group !== lastGroup) {
            lastGroup = rank.group;
            result.push({
                isGroupHeader: true,
                key: `group-${rank.group}`,
                groupLabel:
                    BENCHMARK_GROUPS[rank.group]?.label ?? OTHER_GROUP_LABEL,
            });
        }
        result.push(row);
    });
    return result;
};

function TrafficLight() {
    const [activeTab, setActiveTab] = useState(ALL_TAB_KEY);
    const [topBuild, setTopBuild] = useState();
    const [topBuildOptions, setTopBuildOptions] = useState([]);
    const [testBuild, setTestBuild] = useState();
    const [baselineBuild, setBaselineBuild] = useState();
    const [buildOptions, setBuildOptions] = useState([]);
    const [tableData, settableData] = useState([]);
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
        const data = await fetchData(`/api/getTopLevelBuildNames?type=Perf`);
        if (data) {
            setTopBuildOptions(
                data.map((value) => {
                    return { value: value._id.buildName };
                })
            );
        }
    }

    const buildJavaVersionMap = async (data) => {
        let javaVersionMap = new Map();
        for (const childData of data) {
            const buildNameWithPlatform = childData.buildName.slice(
                0,
                childData.buildName.lastIndexOf('_')
            );
            if (
                !javaVersionMap.has(buildNameWithPlatform) &&
                childData.aggregateInfo
            ) {
                if (childData.aggregateInfo.buildName) {
                    const grandchildrenData = await fetchData(
                        `/api/getChildBuilds?parentId=${childData._id}&buildName=${childData.aggregateInfo.buildName}`
                    );
                    for (const grandchildData of grandchildrenData) {
                        if (grandchildData.javaVersion) {
                            javaVersionMap.set(
                                buildNameWithPlatform,
                                grandchildData.javaVersion.replace(
                                    /\n/g,
                                    '\n    '
                                )
                            );
                            break;
                        }
                    }
                }
            }
        }
        return javaVersionMap;
    };

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

        const testJavaVersionMap = await buildJavaVersionMap(testData);
        const baselineJavaVersionMap = await buildJavaVersionMap(baselineData);

        const metricPropsJSON = await fetchData(`/api/getBenchmarkMetricProps`);
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
                    const { platform } = getInfoFromBuildName(buildName);
                    const originBuildNameTitle = parentBuildName.slice(
                        0,
                        parentBuildName.lastIndexOf('_')
                    );
                    const buildNameTitle = originBuildNameTitle.replace(
                        'Perf_open',
                        ''
                    );
                    const javaVersion =
                        buildType === 'test'
                            ? testJavaVersionMap.get(originBuildNameTitle)
                            : baselineJavaVersionMap.get(originBuildNameTitle);
                    return aggregateInfo.metrics.map(
                        ({ name: metricsName, statValues, rawValues, filteredStatValues, disabledIterations }) => {
                            let higherbetter = true;
                            const benchmarchMetric = metricPropsJSON[benchmark]
                                ? metricPropsJSON[benchmark].metrics
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
                                filteredStatValues,
                                disabledIterations,
                                buildName,
                                platform,
                                higherbetter,
                                javaVersion,
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
        if (obj.isGroupHeader) return null;
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
            const testValues = testBuild.filteredStatValues || testBuild.statValues;
            const baselineValues = baselineBuild.filteredStatValues || baselineBuild.statValues;
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
            const testCI = Number(testValues.CI).toFixed(2) + '%';
            const baselineCI = Number(baselineValues.CI).toFixed(2) + '%';
            const totalCI = Number(Number(testValues.CI) + Number(baselineValues.CI)).toFixed(2) + '%';
            const testJavaVersion = testBuild.javaVersion;
            const baselineJaveVersion = baselineBuild.javaVersion;
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
                            Total CI: {totalCI} <br />
                            Test JavaVersion: {testJavaVersion} <br />
                            Baseline JavaVersion: {baselineJaveVersion}
                        </pre>
                    }
                    overlayStyle={{ maxWidth: 850 }}
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

    const buildNameTitles = uniq(
        tableData
            .map((row = {}) =>
                Object.values(row)
                    .map(({ buildNameTitle }) => buildNameTitle)
                    .filter(identity)
            )
            .flat()
    );

    const groupHeaderStyle = { background: '#fafafa' };
    const columns = [
        {
            title: 'Benchmark Name',
            key: 'benchmarkName',
            width: '350px',
            fixed: 'left',
            // Group header rows span every column.
            onCell: (record) =>
                record.isGroupHeader
                    ? {
                          colSpan: buildNameTitles.length + 1,
                          style: groupHeaderStyle,
                      }
                    : {},
            render: (
                _,
                { isGroupHeader, groupLabel, benchmarkName, metricsName }
            ) => {
                if (isGroupHeader) {
                    return <b>{groupLabel}</b>;
                }
                return (
                    <div>
                        {benchmarkName}
                        <br />
                        <b>{metricsName}</b>
                    </div>
                );
            },
        },
        ...buildNameTitles
            .sort((a, b) =>
                a.localeCompare(b, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                })
            )
            .map((title, i) => {
                return {
                    title,
                    key: i,
                    onCell: (record) =>
                        record.isGroupHeader ? { colSpan: 0 } : {},
                    render: renderCell.bind(null, title),
                };
            }),
    ];
    const setBuildOptionsOnChange = async (buildName) => {
        setTopBuild(buildName);
        setTestBuild();
        setBaselineBuild();
        const results = await fetchData(
            `/api/getBuildHistory?buildName=${buildName}&status=Done&limit=120`
        );
        setBuildOptions(
            results.map((result) => {
                const buildUrl = result.buildUrl;
                const buildId = result._id;
                return { value: buildId, label: buildUrl };
            })
        );
    };

    const defaultBuildValue = 'Perf_Pipeline';
    useEffect(() => {
        setBuildOptionsOnChange(defaultBuildValue);
    }, []);

    const rankedRows = rankAndSortRows(tableData);
    const countBenchmarks = (ranked) =>
        uniq(ranked.map(({ row }) => row.benchmarkName)).length;
    const groupTabs = [
        ...BENCHMARK_GROUPS.map(({ label }, i) => ({ key: String(i), label })),
        { key: String(BENCHMARK_GROUPS.length), label: OTHER_GROUP_LABEL },
    ]
        .map((tab) => ({
            ...tab,
            ranked: rankedRows.filter(
                ({ rank }) => String(rank.group) === tab.key
            ),
        }))
        // "Other" only appears when some benchmark falls outside the groups.
        .filter(
            ({ key, ranked }) =>
                ranked.length > 0 || key !== String(BENCHMARK_GROUPS.length)
        );
    const selectedGroupTab = groupTabs.find(({ key }) => key === activeTab);
    const visibleRanked = selectedGroupTab
        ? selectedGroupTab.ranked
        : rankedRows;
    const tableRows = selectedGroupTab
        ? visibleRanked.map(({ row }) => row)
        : addGroupHeaders(rankedRows);
    const tabItems = [
        {
            key: ALL_TAB_KEY,
            label: `All (${countBenchmarks(rankedRows)})`,
        },
        ...groupTabs.map(({ key, label, ranked }) => ({
            key,
            label: `${label} (${countBenchmarks(ranked)})`,
        })),
    ];
    return (
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
            <Select
                style={{
                    width: '100%',
                }}
                defaultValue={defaultBuildValue}
                onChange={setBuildOptionsOnChange}
                options={topBuildOptions}
                placeholder="please select the top level performance build"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Select
                    style={{ width: '100%' }}
                    value={testBuild}
                    onChange={setTestBuild}
                    options={buildOptions}
                    placeholder="please select test build"
                />
                {testBuild && (
                    <a
                        href={
                            buildOptions.find(
                                (option) => option.value === testBuild
                            )?.label
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Jenkins Link
                    </a>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Select
                    style={{ width: '100%' }}
                    value={baselineBuild}
                    onChange={setBaselineBuild}
                    options={buildOptions}
                    placeholder="please select baseline build"
                />
                {baselineBuild && (
                    <a
                        href={
                            buildOptions.find(
                                (option) => option.value === baselineBuild
                            )?.label
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Jenkins Link
                    </a>
                )}
            </div>

            <Space direction="horizontal">
                <Button type="primary" onClick={handleCompare}>
                    Compare
                </Button>
            </Space>
            <br />
            <Tabs
                activeKey={selectedGroupTab ? activeTab : ALL_TAB_KEY}
                onChange={setActiveTab}
                items={tabItems}
            />
            <div>
                Benchmarks visible: <b>{countBenchmarks(visibleRanked)}</b> (
                {visibleRanked.length} metric rows)
            </div>
            <Table
                pagination={{ defaultPageSize: 100 }}
                dataSource={tableRows}
                columns={columns}
                scroll={{ x: 'max-content' }}
            />
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
