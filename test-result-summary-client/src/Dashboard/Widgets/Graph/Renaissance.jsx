import React, { Component } from 'react';
import {
    HighchartsStockChart,
    Chart,
    XAxis,
    YAxis,
    Legend,
    SplineSeries,
    Navigator,
    RangeSelector,
    Tooltip,
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Radio } from 'antd';
import BenchmarkMath from '../../../PerfCompare/lib/BenchmarkMath';
import { sort, std, mean, size, median } from 'mathjs';
import { parseSha, getEpochTime } from './utils';
import { fetchData } from '../../../utils/Utils';

const map = {
    'renaissance-jdk11': 'Test_openjdk11_j9_sanity.perf_x86-64_linux',
    'renaissance-jdk8': 'Test_openjdk8_j9_sanity.perf_x86-64_linux',
    'renaissance-jdk17': 'Test_openjdk17_hs_sanity.perf_arm_linux',
    'renaissance-jdk21': 'Test_openjdk21_hs_sanity.perf_x86-64_linux'
};

let servers = ['AdoptOpenJDK', 'CustomizedJenkins'];

export class RenaissanceSetting extends Component {
    onChange = (obj) => {
        this.props.onChange({ buildSelected: obj.target.value });
    };

    onServerChange = (obj) => {
        this.props.onChange({ serverSelected: obj.target.value });
    };

    render() {
        const { buildSelected, serverSelected } = this.props;
        return (
            <div style={{ maxWidth: 400 }}>
                <Radio.Group
                    onChange={this.onServerChange}
                    value={serverSelected}
                    defaultValue={'AdoptOpenJDK'}
                >
                    {servers.map((server) => {
                        return (
                            <Radio key={server} value={server}>
                                {server}
                            </Radio>
                        );
                    })}
                </Radio.Group>
                <Radio.Group
                    onChange={this.onChange}
                    values={buildSelected}
                    defaultValue={'renaissance-jdk11'}
                >
                    {Object.keys(map).map((key) => {
                        return (
                            <Radio key={key} value={key}>
                                {map[key]}
                            </Radio>
                        );
                    })}
                </Radio.Group>
            </div>
        );
    }
}

export default class Renaissance extends Component {
    static Title = (props) => props.buildSelected || '';
    static defaultSize = { w: 2, h: 4 };
    static Setting = RenaissanceSetting;
    static defaultSettings = {
        buildSelected: Object.keys(map)[0],
        serverSelected: 'AdoptOpenJDK',
    };

    state = {
        displaySeries: [],
    };

    async componentDidMount() {
        await this.updateData();
    }

    async componentDidUpdate(prevProps) {
        if (
            prevProps.buildSelected !== this.props.buildSelected ||
            prevProps.serverSelected !== this.props.serverSelected
        ) {
            await this.updateData();
        }
    }

    async updateData() {
        const { buildSelected, serverSelected } = this.props;
        const buildName = encodeURIComponent(map[buildSelected]);
        let results = await fetchData(
            `/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`
        );

        const buildInfoMap = await fetchData(`/api/getDashboardBuildInfo`);

        if (serverSelected) {
            if (serverSelected === 'AdoptOpenJDK') {
                results = results.filter((result) =>
                    result.buildUrl.includes(buildInfoMap['AdoptOpenJDK'].url)
                );
            } else {
                results = results.filter(
                    (result) =>
                        !result.buildUrl.includes(
                            buildInfoMap['AdoptOpenJDK'].url
                        )
                );
            }
        }

        const resultsByJDKBuild = {};
        let akkaUctData = [];
        let akkaUctGtValues = [];
        let akkaUctStd = [];
        let akkaUctMean = [];
        let akkaUctMedian = [];

        let fjData = [];
        let fjGtValues = [];
        let fjStd = [];
        let fjMean = [];
        let fjMedian = [];

        let futureGeneticData = [];
        let futureGeneticGtValues = [];
        let futureGeneticStd = [];
        let futureGeneticMean = [];
        let futureGeneticMedian = [];

        let bayesData = [];
        let bayesGtValues = [];
        let bayesStd = [];
        let bayesMean = [];
        let bayesMedian = [];

        let scalaData = [];
        let scalaGtValues = [];
        let scalaStd = [];
        let scalaMean = [];
        let scalaMedian = [];

        // combine results having the same JDK build date
        results.forEach((t) => {
            const jdkDate = t.jdkDate.trim();
            if (t.buildResult !== 'SUCCESS' || !jdkDate) return;
            resultsByJDKBuild[jdkDate] = resultsByJDKBuild[jdkDate] || [];
            t.tests.forEach((test) => {
                let akkaUct = null;
                let fj = null;
                let futureGenetic = null;
                let bayes = null;
                let scala = null;

                if (
                    !test.testName.startsWith('renaissance') ||
                    !test.testData ||
                    !test.testData.metrics
                )
                    return;

                test.testData.metrics.forEach((metric) => {
                    if (metric.name === 'akka-uct') {
                        if (metric.value.length > 0) {
                            akkaUct = mean(metric.value);
                        }
                    }
                    if (metric.name === 'fj-kmeans') {
                        if (metric.value.length > 0) {
                            fj = mean(metric.value);
                        }
                    }
                    if (metric.name === 'future-genetic') {
                        if (metric.value.length > 0) {
                            futureGenetic = mean(metric.value);
                        }
                    }
                    if (metric.name === 'naive-bayes') {
                        if (metric.value.length > 0) {
                            bayes = mean(metric.value);
                        }
                    }
                    if (metric.name === 'scala-kmeans') {
                        if (metric.value.length > 0) {
                            scala = mean(metric.value);
                        }
                    }
                });

                if (!akkaUct && !fj && !futureGenetic && !bayes && !scala) {
                    return;
                }
                // TODO: current code only considers one interation. This needs to be updated
                resultsByJDKBuild[jdkDate].push({
                    akkaUct,
                    fj,
                    futureGenetic,
                    bayes,
                    scala,
                    additionalData: {
                        testId: test._id,
                        buildName: t.buildName,
                        buildNum: t.buildNum,
                        javaVersion: t.javaVersion,
                        jdkDate: t.jdkDate,
                    },
                });
            });
        });

        const sortedDates = Object.keys(resultsByJDKBuild).sort((a, b) => {
            return new Date(a) - new Date(b);
        });

        sortedDates.forEach((k) => {
            const date = new Date(k).getTime();
            let akkaUctGroup = resultsByJDKBuild[k]
                .map((x) => x['akkaUct'])
                .filter(function (el) {
                    return el != null;
                });
            if (akkaUctGroup.length > 0) {
                akkaUctGtValues.push(mean(akkaUctGroup));
                let myCi = 'N/A';
                if (akkaUctGroup.length > 1) {
                    myCi = BenchmarkMath.confidence_interval(akkaUctGroup);
                }
                akkaUctData.push([
                    date,
                    mean(akkaUctGroup),
                    resultsByJDKBuild[k].map((x) => x['additionalData']),
                    myCi,
                ]);
                akkaUctStd.push([date, std(akkaUctGtValues)]);
                akkaUctMean.push([date, mean(akkaUctGtValues)]);
                akkaUctMedian.push([date, median(akkaUctGtValues)]);
            }

            let fjGroup = resultsByJDKBuild[k]
                .map((x) => x['fj'])
                .filter(function (el) {
                    return el != null;
                });
            if (fjGroup.length > 0) {
                fjGtValues.push(mean(fjGroup));
                let myCi = 'N/A';
                if (fjGroup.length > 1) {
                    myCi = BenchmarkMath.confidence_interval(fjGroup);
                }
                fjData.push([
                    date,
                    mean(fjGroup),
                    resultsByJDKBuild[k].map((x) => x['additionalData']),
                    myCi,
                ]);
                fjStd.push([date, std(fjGtValues)]);
                fjMean.push([date, mean(fjGtValues)]);
                fjMedian.push([date, median(fjGtValues)]);
            }

            let futureGeneticGroup = resultsByJDKBuild[k]
                .map((x) => x['futureGenetic'])
                .filter(function (el) {
                    return el != null;
                });
            if (futureGeneticGroup.length > 0) {
                futureGeneticGtValues.push(mean(futureGeneticGroup));
                let myCi = 'N/A';
                if (futureGeneticGroup.length > 1) {
                    myCi =
                        BenchmarkMath.confidence_interval(futureGeneticGroup);
                }
                futureGeneticData.push([
                    date,
                    mean(futureGeneticGroup),
                    resultsByJDKBuild[k].map((x) => x['additionalData']),
                    myCi,
                ]);
                futureGeneticStd.push([date, std(futureGeneticGtValues)]);
                futureGeneticMean.push([date, mean(futureGeneticGtValues)]);
                futureGeneticMedian.push([date, median(futureGeneticGtValues)]);
            }

            let bayesGroup = resultsByJDKBuild[k]
                .map((x) => x['bayes'])
                .filter(function (el) {
                    return el != null;
                });
            if (bayesGroup.length > 0) {
                bayesGtValues.push(mean(bayesGroup));
                let myCi = 'N/A';
                if (bayesGroup.length > 1) {
                    myCi = BenchmarkMath.confidence_interval(bayesGroup);
                }
                bayesData.push([
                    date,
                    mean(bayesGroup),
                    resultsByJDKBuild[k].map((x) => x['additionalData']),
                    myCi,
                ]);
                bayesStd.push([date, std(bayesGtValues)]);
                bayesMean.push([date, mean(bayesGtValues)]);
                bayesMedian.push([date, median(bayesGtValues)]);
            }

            let scalaGroup = resultsByJDKBuild[k]
                .map((x) => x['scala'])
                .filter(function (el) {
                    return el != null;
                });
            if (scalaGroup.length > 0) {
                scalaGtValues.push(mean(scalaGroup));
                let myCi = 'N/A';
                if (scalaGroup.length > 1) {
                    myCi =
                        BenchmarkMath.confidence_interval(futureGeneticGroup);
                }
                scalaData.push([
                    date,
                    mean(scalaGroup),
                    resultsByJDKBuild[k].map((x) => x['additionalData']),
                    myCi,
                ]);
                scalaStd.push([date, std(scalaGtValues)]);
                scalaMean.push([date, mean(scalaGtValues)]);
                scalaMedian.push([date, median(scalaGtValues)]);
            }
        });

        const series = {
            akkaUctData,
            akkaUctStd,
            akkaUctMean,
            akkaUctMedian,
            fjData,
            fjStd,
            fjMean,
            fjMedian,
            futureGeneticData,
            futureGeneticStd,
            futureGeneticMean,
            futureGeneticMedian,
            bayesData,
            bayesStd,
            bayesMean,
            bayesMedian,
            scalaData,
            scalaStd,
            scalaMean,
            scalaMedian,
        };
        const displaySeries = [];
        for (let key in series) {
            displaySeries.push({
                visible: key === 'fjData',
                name: key,
                data: series[key].sort((a, b) => a[0] - b[0]),
                keys: ['x', 'y', 'additionalData', 'CI'],
            });
        }
        this.setState({ displaySeries });
    }

    formatter = function () {
        const x = new Date(this.x);
        const CIstr =
            typeof this.point.CI === 'undefined' ? `` : `CI = ${this.point.CI}`;
        if (this.point.additionalData) {
            let buildLinks = '';
            let i = this.series.data.indexOf(this.point);
            let prevPoint = i === 0 ? null : this.series.data[i - 1];
            this.point.additionalData.forEach((xy) => {
                const { testId, buildName, buildNum } = xy;
                buildLinks =
                    buildLinks +
                    ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
            });

            let lengthThis = this.point.additionalData.length;
            let lengthPrev = prevPoint ? prevPoint.additionalData.length : 0;
            let jdkDate = this.point.additionalData[lengthThis - 1].jdkDate;

            let javaVersion =
                this.point.additionalData[lengthThis - 1].javaVersion;
            let prevJavaVersion = prevPoint
                ? prevPoint.additionalData[lengthPrev - 1].javaVersion
                : null;
            let ret = `${this.series.name}: ${this.y}<br/> Build: ${jdkDate} <pre>${javaVersion}</pre><br/>Link to builds: ${buildLinks}<br /> ${CIstr}`;

            prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
            javaVersion = parseSha(javaVersion, 'OpenJ9');

            if (prevJavaVersion && javaVersion) {
                let githubLink = `<a href="https://github.com/eclipse-openj9/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
                ret += `<br/> Compare Builds:${githubLink}`;
            }
            return ret;
        } else {
            return `${this.series.name}: ${this.y}<br/> Build: ${x
                .toISOString()
                .slice(0, 10)}<br /> ${CIstr}`;
        }
    };

    render() {
        const { displaySeries } = this.state;
        return (
            <HighchartsStockChart>
                <Chart zoomType="x" />

                <Legend verticalAlign="bottom" />
                <Tooltip
                    formatter={this.formatter}
                    useHTML={true}
                    style={{ pointerEvents: 'auto' }}
                />

                <XAxis type="datetime">
                    <XAxis.Title>Time</XAxis.Title>
                </XAxis>

                <YAxis id="gt">
                    <YAxis.Title>msec</YAxis.Title>
                    {displaySeries.map((s) => {
                        const data = s.data.map((point) => {
                            return [point[0], point[1]];
                        });
                        return (
                            <SplineSeries
                                {...s}
                                id={s.name}
                                data={data}
                                key={s.name}
                                showInNavigator
                            />
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
                    <RangeSelector.Button type="all">All</RangeSelector.Button>
                </RangeSelector>

                <Navigator>
                    {displaySeries.map((s) => {
                        return (
                            <Navigator.Series seriesId={s.name} key={s.name} />
                        );
                    })}
                </Navigator>
            </HighchartsStockChart>
        );
    }
}
