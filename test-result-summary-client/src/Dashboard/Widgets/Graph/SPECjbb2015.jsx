import React, { Component } from 'react';
import {
    HighchartsStockChart, Chart, XAxis, YAxis, Legend,
    LineSeries, Navigator, RangeSelector, Tooltip
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Checkbox } from 'antd';
import math from 'mathjs';
import { parseSha } from './utils';

const map = {
    "Daily-SPECjbb2015": "Daily-SPECjbb2015-pxa64 | multi_2grp_gencon",
    "Daily-SPECjbb2015-Linux-PPCLE64": "Daily-SPECjbb2015-pxl64 | multi_2grp_gencon",
    "Daily-SPECjbb2015-zLinux": "Daily-SPECjbb2015-pxz64 | multi_2grp_gencon",
    "Daily-SPECjbb2015-zOS": "Daily-SPECjbb2015-pmz64 | multi_2grp_gencon",
};

let display = {
    "Daily-SPECjbb2015": true,
    "Daily-SPECjbb2015-Linux-PPCLE64": false,
    "Daily-SPECjbb2015-zLinux": false,
    "Daily-SPECjbb2015-zOS": false
};

export class SPECjbb2015Setting extends Component {
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
            <Checkbox.Group onChange={this.onChange} values={map.keys} defaultValue={["Daily-SPECjbb2015"]}>
                {Object.keys( map ).map( key => {
                    return <Checkbox key={key} value={key} checked={false}>{map[key]}</Checkbox>;
                } )}
            </Checkbox.Group>
        </div>
    }
}

export default class SPECjbb2015 extends Component {
    static Title = props => map[props.buildSelected] || '';
    static defaultSize = { w: 2, h: 4 }
    static Setting = SPECjbb2015Setting;
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

        /*let buildsName = '';
        for(let i in display) {
            if (display[i]) {
                buildsName += "buildName=" + i;
                if(i !== display.length - 1) {
                    buildsName += "&";
                }
            }
        }
        buildsName = buildsName.substring(0, buildsName.length - 1);
        const response = await fetch( `/api/getBuildHistory?type=Perf&${buildsName}&status=Done&limit=100&asc`, {
            method: 'get'
        } );*/
        const response = await fetch( `/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`, {
            method: 'get'
        } );
        const results = await response.json();
        const resultsByJDKBuild = {};
        const maxjOPSData = [];
        const maxjOPS = [];
        const maxjOPSStd = [];
        const maxjOPSMean = [];
        const maxjOPSMedian = [];
        const criticaljOPSData = [];
        const criticaljOPS = [];
        const criticaljOPSStd = [];
        const criticaljOPSMean = [];
        const criticaljOPSMedian = [];

        // combine results having the same JDK build date
        results.forEach(( t, i ) => {
            if ( t.buildResult !== "SUCCESS" ) return;

            // TODO: current code only considers one interation. This needs to be updated
            if ( t.tests[0].testData && t.tests[0].testData.metrics && t.tests[0].testData.metrics.length === 2 ) {
                const jdkDate = t.jdkDate;
                let maxjOPS = null;
                let criticaljOPS = null;
                for ( let i = 0; i < t.tests[0].testData.metrics.length; i++ ) {
                    if ( t.tests[0].testData.metrics[i].name === "max_jOPS" ) {
                        maxjOPS = t.tests[0].testData.metrics[i].value;
                    }
                    if ( t.tests[0].testData.metrics[i].name === "critical_jOPS" ) {
                        criticaljOPS = t.tests[0].testData.metrics[i].value;
                    }
                }
                if ( !maxjOPS || !criticaljOPS ) {
                    return;
                }
                resultsByJDKBuild[jdkDate] = resultsByJDKBuild[jdkDate] || [];
                resultsByJDKBuild[jdkDate].push( {
                    maxjOPS,
                    criticaljOPS,
                    additionalData: {
                        testId: t.tests[0]._id,
                        buildName: t.buildName,
                        buildNum: t.buildNum,
                        javaVersion: t.tests[0].javaVersion,
                    },
                } );
            }
        } );

        math.sort( Object.keys( resultsByJDKBuild ) ).forEach(( k, i ) => {
            maxjOPSData.push( math.mean( resultsByJDKBuild[k].map( x => x['maxjOPS'] ) ) );
            maxjOPS.push( [Number( k ), math.mean( resultsByJDKBuild[k].map( x => x['maxjOPS'] ) ), resultsByJDKBuild[k].map( x => x['additionalData'] )] );

            criticaljOPSData.push( math.mean( resultsByJDKBuild[k].map( x => x['criticaljOPS'] ) ) );
            criticaljOPS.push( [Number( k ), math.mean( resultsByJDKBuild[k].map( x => x['criticaljOPS'] ) ), resultsByJDKBuild[k].map( x => x['additionalData'] )] );

            maxjOPSStd.push( [Number( k ), math.std( maxjOPSData )] );
            maxjOPSMean.push( [Number( k ), math.mean( maxjOPSData )] );
            maxjOPSMedian.push( [Number( k ), math.median( maxjOPSData )] );

            criticaljOPSStd.push( [Number( k ), math.std( criticaljOPSData )] );
            criticaljOPSMean.push( [Number( k ), math.mean( criticaljOPSData )] );
            criticaljOPSMedian.push( [Number( k ), math.median( criticaljOPSData )] );
        } );

        const series = { maxjOPS, maxjOPSStd, maxjOPSMean, maxjOPSMedian, criticaljOPS, criticaljOPSStd, criticaljOPSMean, criticaljOPSMedian };
        const displaySeries = [];
        for ( let key in series ) {
            displaySeries.push( {
                visible: key === "maxjOPS",
                name: key,
                data: series[key],
                keys: ['x', 'y', 'addtionalData']
            } );
        }
        this.setState( { displaySeries } );
    }
    formatter = function() {
        const x = new Date( this.x );
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
            let ret = `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )} <br/>Link to builds: ${buildLinks}`;

            prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
            javaVersion = parseSha(javaVersion, 'OpenJ9');

            if (prevJavaVersion && javaVersion) {
                let githubLink = `<a href="https://github.com/eclipse/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
                ret += `<br/> Compare Builds: ${githubLink}`;
            }
            return ret;
        } else {
            return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )}`
        }
    }
    render() {
        const { displaySeries } = this.state;
        return <div className="app">
            <HighchartsStockChart>
                <Chart zoomType="x" />
                <Legend />
                <Tooltip formatter={this.formatter} useHTML={true} style={{ pointerEvents: 'auto' }} />

                <XAxis>
                    <XAxis.Title>Time</XAxis.Title>
                </XAxis>

                <YAxis id="value">
                    <YAxis.Title>SPECjbb2015</YAxis.Title>
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
                    {displaySeries.map( s => {
                        return <Navigator.Series seriesId={s.name} key={s.name} />
                    } )}
                </Navigator>

            </HighchartsStockChart>
        </div>
    }
}