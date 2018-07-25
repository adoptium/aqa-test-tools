import React, { Component } from 'react';
import {
    HighchartsStockChart, Chart, XAxis, YAxis, Legend,
    LineSeries, Navigator, RangeSelector, Tooltip
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Radio } from 'antd';
import math from 'mathjs';

const map = {
    "Daily-Liberty-DayTrader3": "Daily-Liberty-DayTrader3-pxa64 | 9dev-4way-LargeThreadPool",
};

export class DayTrader3Setting extends Component {
    onChange = obj => {
        this.props.onChange( { buildSelected: obj.target.value } );
    }

    render() {
        const { buildSelected } = this.props;

        return <div style={{ maxWidth: 400 }}>
            <Radio.Group onChange={this.onChange} value={buildSelected}>
                {Object.keys( map ).map( key => {
                    return <Radio key={key} value={key}>{map[key]}</Radio>;
                } )}
            </Radio.Group>
        </div>
    }
}

export default class DayTrader3 extends Component {
    static Title = props => map[props.buildSelected] || '';
    static defaultSize = { w: 2, h: 4 }
    static Setting = DayTrader3Setting;
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
        const resultsByJDKBuild = {};
        let globalThroughput = [];
        let gtValues = [];
        let std = [];
        let mean = [];
        let median = [];

        // combine results having the same JDK build date
        results.forEach(( t, i ) => {
            if ( t.buildResult !== "SUCCESS" ) return;
            // TODO: current code only considers one interation. This needs to be updated
            if ( t.tests[0].testData && t.tests[0].testData.metrics && t.tests[0].testData.metrics.length > 0 ) {
                const JDKBuildTimeConvert = t.tests[0].testData.jdkBuildDateUnixTime;
                if ( !t.tests[0].testData.metrics[0].value
                    || t.tests[0].testData.metrics[0].value.length === 0
                    || t.tests[0].testData.metrics[0].name !== "Throughput" ) {
                    return;
                }
                resultsByJDKBuild[JDKBuildTimeConvert] = resultsByJDKBuild[JDKBuildTimeConvert] || [];
                resultsByJDKBuild[JDKBuildTimeConvert].push( {
                    globalThroughput: t.tests[0].testData.metrics[0].value[0],
                    additionalData: {
                        testId: t.tests[0]._id,
                        buildName: t.buildName,
                        buildNum: t.buildNum,
                        javaVersion: t.tests[0].testData.javaVersion,
                    },
                } );
            }
        } );

        math.sort( Object.keys( resultsByJDKBuild ) ).forEach(( k, i ) => {
            gtValues.push( math.mean( resultsByJDKBuild[k].map( x => x['globalThroughput'] ) ) );
            globalThroughput.push( [Number( k ), math.mean( resultsByJDKBuild[k].map( x => x['globalThroughput'] ) ), resultsByJDKBuild[k].map( x => x['additionalData'] )] );

            std.push( [Number( k ), math.std( gtValues )] );
            mean.push( [Number( k ), math.mean( gtValues )] );
            median.push( [Number( k ), math.median( gtValues )] );
        } );

        const series = { globalThroughput, std, mean, median };
        const displaySeries = [];
        for ( let key in series ) {
            displaySeries.push( {
                visible: key === "globalThroughput",
                name: key,
                data: series[key],
                keys: ['x', 'y', 'additionalData']
            } );
        }
        this.setState( { displaySeries } );
    }

    formatter = function() {
        const x = new Date( this.x );
        if ( this.point.additionalData ) {
            let buildLinks = '';
            this.point.additionalData.forEach(( xy, i ) => {
                const { testId, buildName, buildNum } = xy;
                buildLinks = buildLinks + ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`
            } );
            const { javaVersion } = this.point.additionalData[0];
            return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )} <pre>${javaVersion}</pre><br/>Link to builds: ${buildLinks}`
        } else {
            return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )}`
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
                <Navigator.Series seriesId="globalThroughput" />
                <Navigator.Series seriesId="mean" />
            </Navigator>
        </HighchartsStockChart>
    }
}