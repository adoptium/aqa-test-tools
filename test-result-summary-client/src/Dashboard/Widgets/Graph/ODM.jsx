import React, { Component } from 'react';
import {
    HighchartsStockChart, Chart, XAxis, YAxis, Legend,
    LineSeries, Navigator, RangeSelector, Tooltip
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Radio } from 'antd';
import math from 'mathjs';

const map = {
    "Daily-ODM": "Daily-ODM-pxa64 | 881-4way-Seg5FastpathRVEJB",
    "Daily-ODM-Linux-PPCLE64": "Daily-ODM-pxl64 | 881-4way-Seg5FastpathRVEJB",
    "Daily-ODM-openJ9": "Daily-ODM-openJ9-pxa64 | 881-4way-Seg5FastpathRVEJB",
    "Daily-ODM-zLinux": "Daily-ODM-pxz64 | 881-4way-Seg5FastpathRVEJB",
    "Daily-ODM-zOS": "Daily-ODM-pmz64 | 881-4way-Seg5FastpathRVEJB"
};
export class ODMSetting extends Component {
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

export default class ODM extends Component {
    static Title = props => map[props.buildSelected] || '';
    static defaultSize = { w: 2, h: 4 }
    static Setting = ODMSetting;
    static defaultSettings = {
        buildSelected: Object.keys( map )[0]
    }

    state = {
        displaySeries: [],
        allDisplaySeries: {},
        globalThroughputBL: 7000
    };

    async componentDidMount() {
        await this.updateData();
    }

    async componentDidUpdate( prevProps ) {
        if ( prevProps.buildSelected !== this.props.buildSelected ) {
            await this.updateData();
        }
    }

    async getDisplaySeriesForBuild(build) {
        const { globalThroughputBL } = this.state;

        const buildName = encodeURIComponent( build );
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
                    || t.tests[0].testData.metrics[0].name !== "Global Throughput" ) {
                    return;
                }
                resultsByJDKBuild[JDKBuildTimeConvert] = resultsByJDKBuild[JDKBuildTimeConvert] || [];
                resultsByJDKBuild[JDKBuildTimeConvert].push( {
                    globalThroughput: (t.tests[0].testData.metrics[0].value[0] / globalThroughputBL) * 100,
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
        return displaySeries;
    }

    async updateData() {
        const { buildSelected } = this.props;
        const allDisplaySeries = {};

        for (let key in map) {
            allDisplaySeries[key] = await this.getDisplaySeriesForBuild(key);
        }

        console.log(allDisplaySeries);

        this.setState({ displaySeries: allDisplaySeries[buildSelected], allDisplaySeries: allDisplaySeries});
    }

    formatter = function() {
        const x = new Date( this.x );
        if ( this.point.additionalData ) {
            let buildLinks = '';
            this.point.additionalData.forEach(( xy, i ) => {
                const { testId, buildName, buildNum } = xy;
                buildLinks = buildLinks + ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`
            } );
            return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )} <br/>Link to builds: ${buildLinks}`
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

                <YAxis id="gt">
                    <YAxis.Title>Global Throughput (% to baseline)</YAxis.Title>
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
        </div>
    }
}