import React, { Component } from 'react';
import {
    HighchartsStockChart, Chart, XAxis, YAxis, Legend,
    LineSeries, Navigator, RangeSelector, Tooltip
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Checkbox } from 'antd';
import BenchmarkMath from '../../../PerfCompare/lib/BenchmarkMath';
import math from 'mathjs';
import utils from './utils';

const map = {
    "Test_openjdk8_j9_sanity.perf_x86-64_linux_Liberty": "Test_openjdk8_j9_sanity.perf_x86-64_linux_Liberty",
};
let display = {
    "Test_openjdk8_j9_sanity.perf_x86-64_linux_Liberty": true,
};
//currently no baseline runs are made we use hard coded baseline values for scaling graph

//baseline value for footprints
//baseline value for startup time
const startupBaseLineValue = 13000;
const startupScale = startupBaseLineValue/100;

export class DayTrader7Setting extends Component {
    onChange = obj => {
        for (let i in display) {
            display[i] = false;
        }
        for (let j in obj) {
            display[obj[j]] = true;
        }
        this.props.onChange( { buildSelected: obj[obj.length -1] } );
    }

    render() {
        return <div style={{ maxWidth: 400 }}>
            <Checkbox.Group onChange={this.onChange} values={map.keys} defaultValue={["Test_openjdk8_j9_sanity.perf_x86-64_linux_Liberty"]}>
                {Object.keys( map ).map( key => {
                    return <Checkbox key={key} value={key} checked={false}>{map[key]}</Checkbox>;
                } )}
            </Checkbox.Group>
        </div>
    }
}

export default class DayTrader7 extends Component {
    static Title = props => map[props.buildSelected] || '';
    static defaultSize = { w: 2, h: 4 }
    static Setting = DayTrader7Setting;
    static defaultSettings = {
        buildSelected: Object.keys( map )[0]
    }

    state = {
        displaySeries: [],
    };

    async componentDidMount() {
        await this.updateData();
    }


    async componentDidUpdate( prevProps ) {
        if ( prevProps.buildSelected !== this.props.buildSelected ) {
            await this.updateData();
        }
    }

    async updateData() {

        const { buildSelected } = this.props;
        const buildName = encodeURIComponent( buildSelected );
        const response = await fetch( `/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`, {
            method: 'get'
        } );
        const results = await response.json();
        const resultsByJDKBuild = [];
        let baseLine = [];
        let jdkDate = "";

        //Colelct all test data to 1 object according to its JDK date
        results.forEach(( t, i ) => {
            if (t.buildResult == "SUCCESS" || t.validAggregateInfo) {
                for ( let element of t.aggregateInfo ) {
                    //convert date from YYYYMMDD format to Unix timestamp for graph mapping
                    let new_jdkDate = new Date(t.jdkDate.slice(0,5)+"-"+t.jdkDate.slice(5,7)+"-"+t.jdkDate.slice(7,9)).getTime();
                    jdkDate = new_jdkDate;
                    if(!resultsByJDKBuild[t.buildName]) {
                        resultsByJDKBuild[t.buildName] = {} ;
                    }
                    for( let metric of element.metrics) {
                        if(!resultsByJDKBuild[t.buildName][metric.name]) {
                            resultsByJDKBuild[t.buildName][metric.name] = {};
                        }
                        resultsByJDKBuild[t.buildName][metric.name][jdkDate] = resultsByJDKBuild[t.buildName][metric.name][jdkDate] || [];
                        resultsByJDKBuild[t.buildName][metric.name][jdkDate].push( {
                            [metric.name]: metric.statValues["mean"],
                            additionalData: {
                                mean: metric.statValues["mean"],
                                max: metric.statValues["max"],
                                min: metric.statValues["min"],
                                median: metric.statValues["median"],
                                stddev: metric.statValues["stddev"],
                                CI: metric.statValues["CI"],
                                validIterations: metric.statValues["validIterations"],
                                testId: (Array.isArray(t.tests) && t.tests.length > 0) ? t.tests[0]._id : null,
                                hasChildren: t.hasChildren,
                                parentId:t._id,
                                buildName: t.buildName,
                                buildNum: t.buildNum,
                                javaVersion: t.javaVersion,
                            },
                        } );
                    }
                }
            }
        } );
        let baseLineData = [];
        let metricLineSeriesData = [];
        //sort all tests by its jdkDate & collapse all tests with same JDK to single value for graph mapping
        for ( let buildName in resultsByJDKBuild) {
            if (!metricLineSeriesData[buildName]){
                metricLineSeriesData[buildName] = [];
            }
            for ( let metricName in resultsByJDKBuild[buildName]){
                if (!metricLineSeriesData[buildName][metricName]){
                    metricLineSeriesData[buildName][metricName] = [];
                }
                math.sort(Object.keys(resultsByJDKBuild[buildName][metricName])).forEach((a, b) => {
                    metricLineSeriesData[buildName][metricName].push( [Number(a),math.mean( resultsByJDKBuild[buildName][metricName][a].map( x => x[metricName] / startupScale) ), resultsByJDKBuild[buildName][metricName][a].map( x => x['additionalData'] )] );
                    baseLineData.push([Number( a ), 2000]);
                });
            }
        }
        
        //Map all data points from above using the metric name
        const displaySeries = baseLine;
        for ( let testName in metricLineSeriesData) {
            for ( let metricName in metricLineSeriesData[testName] ) {
                displaySeries.push( {
                    visible: testName.concat("-"+[metricName]),
                    name: testName.concat("-"+[metricName]),
                    data: metricLineSeriesData[testName][metricName],
                    keys: ['x', 'y', 'additionalData']
                } );
            }
        }
        displaySeries.push({
                visible: 'baseLine-startup',
                name: 'BaseLine-startup',
                data: baseLineData,
                keys: ['x', 'y']
            })
        this.setState( { displaySeries } );
    }

    formatter = function() {
        const x = new Date( this.x );
        const CIstr = this.point.CI ? `CI = ${this.point.CI}` : "";
        if ( this.point.additionalData ) {
            let buildLinks = '';
            const i = this.series.data.indexOf(this.point);
            const prevPoint = i === 0 ? null : this.series.data[i - 1];
            this.point.additionalData.forEach(( xy, i ) => {
                const { testId, buildName, buildNum } = xy;
                buildLinks = buildLinks + ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
            } );

            const lengthThis = this.point.additionalData.length;
            const lengthPrev = prevPoint ? prevPoint.additionalData.length : 0;

            let javaVersion = this.point.additionalData[lengthThis - 1].javaVersion;
            let prevJavaVersion = prevPoint ? prevPoint.additionalData[lengthPrev - 1].javaVersion : null;
            let ret = `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )} <pre>${javaVersion}</pre><br/>Link to builds: ${buildLinks}<br /> ${CIstr}`;

            prevJavaVersion = utils.parseSha(prevJavaVersion, 'OpenJ9');
            javaVersion = utils.parseSha(javaVersion, 'OpenJ9');

            if (prevJavaVersion && javaVersion) {
                const githubLink = `<a href="https://github.com/eclipse/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
                ret += `<br/> Compare Builds: ${githubLink}`;
            }
            return ret;
        } else {
            return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )}<br /> ${CIstr}`;
        }
    }

    render() {
        const { displaySeries } = this.state;
        return <HighchartsStockChart>
            <Chart zoomType="x" height="50%" />

            <Legend />
            <Tooltip formatter={this.formatter} useHTML={true} style={{ pointerEvents: 'auto' }} />

            <XAxis>
                <XAxis.Title>Time</XAxis.Title>
            </XAxis>

            <YAxis id="gt">
                <YAxis.Title>Startup Metrics</YAxis.Title>
                {displaySeries.map( s => {
                    return <LineSeries {...s} id={s.name} key={s.name} />
                } )}
            </YAxis>

            <DateRangePickers axisId="xAxis" />
            <RangeSelector>
                <RangeSelector.Button count={1} type="day">1d</RangeSelector.Button>
                <RangeSelector.Button count={7} type="day">7d</RangeSelector.Button>
                <RangeSelector.Button count={1} type="month">1m</RangeSelector.Button>
                <RangeSelector.Button type="all">All</RangeSelector.Button>
            </RangeSelector>

            <Navigator>
                <Navigator.Series seriesId="startup Time" />
                <Navigator.Series seriesId="mean" />
            </Navigator>
        </HighchartsStockChart>
    }
}
