import React, { Component } from 'react';
import {
    HighchartsStockChart,
    Chart,
    XAxis,
    YAxis,
    Legend,
    LineSeries,
    Navigator,
    RangeSelector,
    Tooltip,
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Radio } from 'antd';
import { sort, mean, round } from 'mathjs';
import { parseSha } from './utils';
import { fetchData } from '../../../utils/Utils';

const map = {
    'Daily-ODM-all':
        'PerfNext-ODM-Child PerfNext-ODM-Parent Daily-ODM Daily-ODM-Linux-PPCLE64 Daily-ODM-openJ9 Daily-ODM-zLinux Daily-ODM-zOS',
};

let display = {
    'Daily-ODM-all': true,
};

let baselineValue = 9000;

export class ODMSetting extends Component {
    onChange = (obj) => {
        for (let i in display) {
            display[i] = false;
        }
        for (let j in obj) {
            display[obj[j]] = true;
        }
        this.props.onChange({ buildSelected: obj[obj.length - 1] });
    };

    render() {
        return (
            <div style={{ maxWidth: 400 }}>
                <Radio.Group
                    onChange={this.onChange}
                    values={map.keys}
                    defaultValue={'Daily-ODM-all'}
                >
                    {Object.keys(map).map((key) => {
                        return (
                            <Radio key={key} value={key} checked={false}>
                                {key}
                            </Radio>
                        );
                    })}
                </Radio.Group>
            </div>
        );
    }
}

export default class ODM extends Component {
    static Title = (props) => props.buildSelected || '';
    static defaultSize = { w: 2, h: 4 };
    static Setting = ODMSetting;
    static defaultSettings = {
        buildSelected: Object.keys(map)[0],
    };

    state = {
        displaySeries: [],
    };

    async componentDidMount() {
        await this.updateData();
    }

    async componentDidUpdate(prevProps) {
        if (prevProps.buildSelected !== this.props.buildSelected) {
            await this.updateData();
        }
    }

    async updateData() {
        // when API ready => buildSelected will be list of builds
        const { buildSelected } = this.props;
        const buildName = encodeURIComponent(buildSelected);
        const buildsName =
            'buildName=' + map[buildName].split(' ').join('&buildName=');
        const results = await fetchData(
            `/api/getBuildHistory?type=Perf&${buildsName}&status=Done&limit=100&asc`
        );
        const resultsByJDKBuild = {};
        let globalThroughputs = {};
        let baseLine = [];
        let scale = baselineValue / 100;

        // combine results having the same JDK build date
        results.forEach((t, i) => {
            if (t.buildResult !== 'SUCCESS' || !t.validAggregateInfo) return;
            // TODO: current code only considers one interation. This needs to be updated
            for (let element of t.aggregateInfo) {
                const jdkDate = t.jdkDate;
                if (
                    !t.validAggregateInfo ||
                    element.metrics[0].name !== 'Global Throughput'
                ) {
                    return;
                }
                if (!resultsByJDKBuild[t.buildName]) {
                    resultsByJDKBuild[t.buildName] = {};
                }
                resultsByJDKBuild[t.buildName][jdkDate] =
                    resultsByJDKBuild[jdkDate] || [];
                resultsByJDKBuild[t.buildName][jdkDate].push({
                    globalThroughput: element.metrics[0].statValues['mean'],
                    additionalData: {
                        mean: element.metrics[0].statValues['mean'],
                        max: element.metrics[0].statValues['max'],
                        min: element.metrics[0].statValues['min'],
                        median: element.metrics[0].statValues['median'],
                        stddev: element.metrics[0].statValues['stddev'],
                        CI: element.metrics[0].statValues['CI'],
                        validIterations:
                            element.metrics[0].statValues['validIterations'],
                        testId:
                            Array.isArray(t.tests) && t.tests.length > 0
                                ? t.tests[0]._id
                                : null,
                        hasChildren: t.hasChildren,
                        parentId: t._id,
                        buildName: t.buildName,
                        buildNum: t.buildNum,
                        javaVersion: t.javaVersion,
                    },
                });
            }
        });
        let baseLineData = [];
        Object.keys(resultsByJDKBuild).forEach((k, i) => {
            if (!globalThroughputs[k]) {
                globalThroughputs[k] = [];
            }
            sort(Object.keys(resultsByJDKBuild[k])).forEach((a, b) => {
                globalThroughputs[k].push([
                    Number(a),
                    mean(
                        resultsByJDKBuild[k][a].map(
                            (x) => x['globalThroughput']
                        ) / scale
                    ),
                    resultsByJDKBuild[k][a].map((x) => x['additionalData']),
                ]);
                baseLineData.push([Number(a), 100]);
            });
        });

        const displaySeries = baseLine;
        for (let key in globalThroughputs) {
            displaySeries.push({
                visible: key,
                name: key,
                data: globalThroughputs[key],
                keys: ['x', 'y', 'additionalData'],
            });
        }

        displaySeries.push({
            visible: 'baseLine',
            name: 'BaseLine',
            data: baseLineData,
            keys: ['x', 'y'],
        });

        this.setState({ displaySeries });
    }

    formatter = function () {
        const x = this.x;
        if (this.point.additionalData) {
            let buildLinks = '';
            let i = this.series.data.indexOf(this.point);
            let prevPoint = i === 0 ? null : this.series.data[i - 1];
            this.point.additionalData.forEach((xy, i) => {
                const { testId, parentId, buildName, buildNum, hasChildren } =
                    xy;
                const childBuildLinks = ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
                const parentBuildLinks = ` <a href="/buildDetail?parentId=${parentId}">${buildName} #${buildNum}</a>`;
                buildLinks = hasChildren ? parentBuildLinks : childBuildLinks;
            });

            let lengthThis = this.point.additionalData.length;
            let lengthPrev = prevPoint ? prevPoint.additionalData.length : 0;

            let point = this.point.additionalData[lengthThis - 1];
            let javaVersion = point.javaVersion;
            let prevJavaVersion = prevPoint
                ? prevPoint.additionalData[lengthPrev - 1].javaVersion
                : null;
            let mean = point.mean;
            let max = point.max;
            let min = point.min;
            let median = point.median;
            let stddev = point.stddev;
            let CI = point.CI;
            let validIterations = point.validIterations;
            let ret = `Test vs Baseline: ${round(
                this.y,
                3
            )}%<br/> Build: ${x} <br/>Link to builds: ${buildLinks}<br/>mean: ${mean}<br/>max: ${max}<br/>min: ${min}<br/>median: ${median}<br/>stddev: ${stddev}<br/>CI: ${CI}<br/>validIterations: ${validIterations}`;

            prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
            javaVersion = parseSha(javaVersion, 'OpenJ9');

            if (prevJavaVersion && javaVersion) {
                let githubLink = `<a href="https://github.com/eclipse-openj9/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
                ret += `<br/> Compare Builds: ${githubLink}`;
            }
            return ret;
        } else {
            return `Baseline percentage: ${this.y}%<br/> Baseline mean: ${baselineValue}</br> Build: ${x}`;
        }
    };

    render() {
        const { displaySeries } = this.state;
        return (
            <div className="app">
                <HighchartsStockChart>
                    <Chart zoomType="x" />
                    <Legend />
                    <Tooltip
                        formatter={this.formatter}
                        useHTML={true}
                        style={{ pointerEvents: 'auto' }}
                    />

                    <XAxis>
                        <XAxis.Title>Time</XAxis.Title>
                    </XAxis>

                    <YAxis id="gt">
                        <YAxis.Title>
                            Global Throughput (% to baseline)
                        </YAxis.Title>
                        {displaySeries.map((s) => {
                            return (
                                <LineSeries {...s} id={s.name} key={s.name} />
                            );
                        })}
                    </YAxis>

                    <DateRangePickers axisId="xAxis" />
                    <RangeSelector verticalAlign="bottom">
                        <RangeSelector.Button count={1} type="day">
                            1d
                        </RangeSelector.Button>
                        <RangeSelector.Button count={7} type="day">
                            7d
                        </RangeSelector.Button>
                        <RangeSelector.Button count={1} type="month">
                            1m
                        </RangeSelector.Button>
                        <RangeSelector.Button type="all">
                            All
                        </RangeSelector.Button>
                    </RangeSelector>

                    <Navigator>
                        <Navigator.Series seriesId="globalThroughput" />
                        <Navigator.Series seriesId="mean" />
                    </Navigator>
                </HighchartsStockChart>
            </div>
        );
    }
}
