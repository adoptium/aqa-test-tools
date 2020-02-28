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
    "IdleMicrobenchmark": "Test_openjdk11_j9_sanity.perf_x86-64_linux",
};

let display = {
    "IdleMicrobenchmark": true,
};

export class IdleMicrobenchmarkSetting extends Component {
    onChange = obj => {
        for (let i in display) {
            display[i] = false;
        }
        for (let j in obj) {
            display[obj[j]] = true;
        }
        this.props.onChange({ buildSelected: obj[obj.length - 1] });
    }

    render() {
        return <div style={{ maxWidth: 400 }}>
            <Checkbox.Group onChange={this.onChange} values={map.keys} defaultValue={["IdleMicrobenchmark"]}>
                {Object.keys(map).map(key => {
                    return <Checkbox key={key} value={key} checked={false}>{map[key]}</Checkbox>;
                })}
            </Checkbox.Group>
        </div>
    }
}

export default class IdleMicrobenchmark extends Component {
    static Title = props => props.buildSelected || '';
    static defaultSize = { w: 2, h: 4 }
    static Setting = IdleMicrobenchmarkSetting;
    static defaultSettings = {
        buildSelected: Object.keys(map)[0]
    }

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
        const { buildSelected } = this.props;
        const buildName = encodeURIComponent(map[buildSelected]);
        const response = await fetch(`/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`, {
            method: 'get'
        });
        const results = await response.json();
        const resultsByJDKBuild = {};
        let activeMax = [];
        let gtValues = [];
        let std = [];
        let mean = [];
        let median = [];
        console.log("results", results);
        // combine results having the same JDK build date
        results.forEach(( t, i ) => {
            if ( t.buildResult !== "SUCCESS" ) return;
            const jdkDate = t.jdkDate;
            resultsByJDKBuild[jdkDate] = resultsByJDKBuild[jdkDate] || [];
            t.tests.forEach(( test, i ) => {
                if ( !test.testName.startsWith("IdleMicrobenchmark") || !test.testData || !test.testData.metrics ) return;
                 // TODO: current code only considers one interation. This needs to be updated
                 const metrics = test.testData.metrics[0];
                if (metrics.name !== "ACTIVE MAX") return;
                resultsByJDKBuild[jdkDate].push( {
                    activeMax: metrics.value[0],
                    additionalData: {
                        testId: test._id,
                        buildName: t.buildName,
                        buildNum: t.buildNum,
                        javaVersion: t.javaVersion,
                    },
                } );
            });
        } );

        math.sort( Object.keys( resultsByJDKBuild ) ).forEach(( k, i ) => {
	    let activeMaxGroup = resultsByJDKBuild[k].map( x => x['activeMax'] );
            gtValues.push( math.mean( activeMaxGroup ) );
            let myCi = 'N/A';
            if (activeMaxGroup.length > 1){
              myCi = BenchmarkMath.confidence_interval(activeMaxGroup);
            }
            activeMax.push( [Number( k ), math.mean( activeMaxGroup ), resultsByJDKBuild[k].map( x => x['additionalData'] ), myCi] );

            std.push( [Number( k ), math.std( gtValues )] );
            mean.push( [Number( k ), math.mean( gtValues )] );
            median.push( [Number( k ), math.median( gtValues )] );
        } );

        const series = { activeMax, std, mean, median };
        const displaySeries = [];
        for ( let key in series ) {
            displaySeries.push( {
                visible: key === "activeMax",
                name: key,
                data: series[key],
                keys: ['x', 'y', 'additionalData', 'CI']
            } );
        }
        this.setState( { displaySeries } );
    }

    formatter = function() {
        const x = new Date( this.x );
        const CIstr = (typeof this.point.CI === 'undefined') ? ``: `CI = ${this.point.CI}`;
        if ( this.point.additionalData ) {
            let buildLinks = '';
            let i = this.series.data.indexOf(this.point);
            let prevPoint = i === 0 ? null : this.series.data[i - 1];
            this.point.additionalData.forEach(( xy, i ) => {
                const { testId, buildName, buildNum } = xy;
                buildLinks = buildLinks + ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
            } );

            let lengthThis = this.point.additionalData.length;
            let lengthPrev = prevPoint ? prevPoint.additionalData.length : 0;

            let javaVersion = this.point.additionalData[lengthThis - 1].javaVersion;
            let prevJavaVersion = prevPoint ? prevPoint.additionalData[lengthPrev - 1].javaVersion : null;
            let ret = `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )} <pre>${javaVersion}</pre><br/>Link to builds: ${buildLinks}<br /> ${CIstr}`;

            prevJavaVersion = utils.parseSha(prevJavaVersion, 'OpenJ9');
            javaVersion = utils.parseSha(javaVersion, 'OpenJ9');

            if (prevJavaVersion && javaVersion) {
                let githubLink = `<a href="https://github.com/eclipse/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
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
                <YAxis.Title>Global Throughput</YAxis.Title>
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
                <Navigator.Series seriesId="activeMax" />
                <Navigator.Series seriesId="mean" />
            </Navigator>
        </HighchartsStockChart>
    }
}
