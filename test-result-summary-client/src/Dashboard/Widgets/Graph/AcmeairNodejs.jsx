import React, { Component } from 'react';
import {
    HighchartsStockChart, Chart, XAxis, YAxis, Legend,
    LineSeries, Navigator, RangeSelector, Tooltip
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Radio } from 'antd';
import math from 'mathjs';

const map = {
    "AcmeairNodejs": "PerfNext-master-node13-s390x PerfNext-master-12LTS-s390x PerfNext-master-node13-ppc64le PerfNext-master-12LTS-ppc64le"
};

let display = {
    "AcmeairNodejs": true
}

let baselineValue = 100; 

export class AcemeairNodejsSetting extends Component {
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
            <Radio.Group onChange={this.onChange} values={map.keys} defaultValue={["AcmeairNodejs"]}>
                {Object.keys( map ).map( key => {
                    return <Radio key={key} value={key} checked={false}>{key}</Radio>;
                } )}
            </Radio.Group>
        </div>
    }
}

export default class AcemeairNodejs extends Component {
    static Title = props => Object.keys(map)[0] || ''; 
    static defaultSize = { w: 2, h: 4 }
    static Setting = AcemeairNodejsSetting;
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
        // when API ready => buildSelected will be list of builds
        const buildSelected  = Object.keys(map)[0];
        const buildName = encodeURIComponent( buildSelected );
        const buildsName = "buildName=" + map[buildName].split(" ").join("&buildName=");
        const response = await fetch( `/api/getBuildHistory?type=Perf&${buildsName}&status=Done&limit=100&asc`, {
            method: 'get'
        } );
        const results = await response.json();
        const resultsByJDKBuild = {};
        let globalThroughputs = {};
        let baseLine = [];
        let scale = baselineValue / 100;

        // combine results having the same JDK build date
        results.forEach(( t, i ) => {
            if ( t.buildResult !== "SUCCESS" || !t.validAggregateInfo) return;
            // TODO: current code only considers one interation. This needs to be updated
            for ( let element of t.aggregateInfo ) {
                // Example: "Node Version v13.3.1-nightly20191214b3ae532392\nRundate -20191216"
                const nodeVersion= t.nodeVersion.split(/\s+/)[2]; //Example: v13.3.1-nightly20191214b3ae532392
                const nodeRunDate = t.nodeRunDate; 
                if ( !t.validAggregateInfo || element.metrics[0].name !== "Throughput" ) {
                    return;
                }
                if(!resultsByJDKBuild[t.buildName]) {
                    resultsByJDKBuild[t.buildName] = {};
                }
                resultsByJDKBuild[t.buildName][nodeRunDate] = resultsByJDKBuild[nodeRunDate] || [];
                resultsByJDKBuild[t.buildName][nodeRunDate].push( {
                    globalThroughput: element.metrics[0].statValues["mean"],
                    additionalData: {
                        mean: element.metrics[0].statValues["mean"],
                        max: element.metrics[0].statValues["max"],
                        min: element.metrics[0].statValues["min"],
                        median: element.metrics[0].statValues["median"],
                        stddev: element.metrics[0].statValues["stddev"],
                        CI: element.metrics[0].statValues["CI"],
                        validIterations: element.metrics[0].statValues["validIterations"],
                        testId: (Array.isArray(t.tests) && t.tests.length > 0) ? t.tests[0]._id : null,
                        hasChildren: t.hasChildren,
                        parentId:t._id,
                        buildName: t.buildName,
                        buildNum: t.buildNum,
                        nodeVersion,
                        nodeRunDate
                    },
                } );
            }
        } );
        Object.keys( resultsByJDKBuild ).forEach(( k, i ) => {
            if(!globalThroughputs[k]) {
                globalThroughputs[k] = [];
            }
            math.sort(Object.keys(resultsByJDKBuild[k])).forEach((a, b) => {
                const date = a.substring(0,4) + "-" + a.substring(4,6) + "-" + a.substring(6,8) //Example: 2019-03-29
                globalThroughputs[k].push( [new Date(date).getTime(), math.mean( resultsByJDKBuild[k][a].map( x => x['globalThroughput'] ) / scale), resultsByJDKBuild[k][a].map( x => x['additionalData'] )] );
            });
        } );

        const displaySeries = baseLine;
        for ( let key in globalThroughputs ) {
            displaySeries.push( {
                visible: key,
                name: key,
                data: globalThroughputs[key],
                keys: ['x', 'y', 'additionalData']
            } );
        }

        this.setState( { displaySeries } );
    }

    formatter = function() {
        const x = this.x;
        if ( this.point.additionalData ) {
            let buildLinks = '';
            this.point.additionalData.forEach(( xy, i ) => {
                const { testId, parentId, buildName, buildNum, hasChildren } = xy;
                const childBuildLinks = ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
                const parentBuildLinks = ` <a href="/buildDetail?parentId=${parentId}">${buildName} #${buildNum}</a>`
                buildLinks = hasChildren ? parentBuildLinks : childBuildLinks;
            } );
            const lengthThis = this.point.additionalData.length;
            const point = this.point.additionalData[lengthThis - 1];
            const nodeVersion = point.nodeVersion;
            const mean = point.mean;
            const max = point.max;
            const min = point.min;
            const median = point.median;
            const stddev = point.stddev;
            const CI = point.CI;
            const validIterations = point.validIterations;
            const nodeRunDate = point.nodeRunDate
            const ret = `<br/> Node version: ${nodeVersion} <br/> Run Date: ${nodeRunDate} <br/>Link to builds: ${ buildLinks }<br/>mean: ${mean}<br/>max: ${max}<br/>min: ${min}<br/>median: ${median}<br/>stddev: ${stddev}<br/>CI: ${CI}<br/>validIterations: ${validIterations}`;

            return ret;
        } else {
            return `Baseline percentage: ${this.y}%<br/> Baseline mean: ${baselineValue}</br> Build: ${x}`
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
                    <XAxis.Title>Run Date</XAxis.Title>
                </XAxis>

                <YAxis id="gt">
                    <YAxis.Title>Throughput</YAxis.Title>
                    {displaySeries.map( s => {
                        return <LineSeries {...s} id={s.name} key={s.name} />
                    } )}
                </YAxis>

                <DateRangePickers axisId="xAxis" />
                <RangeSelector verticalAlign="bottom">
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
