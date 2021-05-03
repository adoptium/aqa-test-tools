import React, { Component } from 'react';
import {
    HighchartsStockChart, Chart, XAxis, YAxis, Legend,
    SplineSeries, Navigator, RangeSelector, Tooltip
} from 'react-jsx-highstock';
import DateRangePickers from '../../DateRangePickers';
import { parseSha } from '../utils';

export default class StockChart extends Component {

    async componentDidUpdate(prevProps) {
        if (prevProps.displaySeries !== this.props.displaySeries) {
            this.setState({
                displaySeries: this.props.displaySeries,
            });
        }
    }

    formatter = function () {
        const x = new Date(this.x);
        const CIstr = (typeof this.point.CI === 'undefined') ? `` : `CI = ${this.point.CI}`;
        if (this.point.additionalData) {
            let buildLinks = '';
            let i = this.series.data.indexOf(this.point);
            let prevPoint = i === 0 ? null : this.series.data[i - 1];
            this.point.additionalData.forEach((xy, i) => {
                const { testId, buildName, buildNum } = xy;
                buildLinks = buildLinks + ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
            });

            let lengthThis = this.point.additionalData.length;
            let lengthPrev = prevPoint ? prevPoint.additionalData.length : 0;
            let jdkDate = this.point.additionalData[lengthThis - 1].jdkDate;

            let javaVersion = this.point.additionalData[lengthThis - 1].javaVersion;
            let prevJavaVersion = prevPoint ? prevPoint.additionalData[lengthPrev - 1].javaVersion : null;
            let ret = `${this.series.name}: ${this.y}<br/> Build: ${jdkDate} <pre>${javaVersion}</pre><br/>Link to builds: ${buildLinks}<br /> ${CIstr}`;

            prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
            javaVersion = parseSha(javaVersion, 'OpenJ9');

            if (prevJavaVersion && javaVersion) {
                let githubLink = `<a href="https://github.com/eclipse-openj9/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
                ret += `<br/> Compare Builds:${githubLink}`;
            }
            return ret;
        } else {
            return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice(0, 10)}<br /> ${CIstr}`;
        }
    }

    render() {
        const displaySeries = this.props.displaySeries;
        if (!displaySeries) return null;
        return <HighchartsStockChart>
            <Chart zoomType="x" />

            <Legend />
            { this.props.showTooltip && <Tooltip formatter={this.formatter} useHTML style={{ pointerEvents: 'auto' }} />}

            <XAxis >
                <XAxis.Title>Time</XAxis.Title>
            </XAxis>

            <YAxis id="gt">
                <YAxis.Title>msec</YAxis.Title>
                {displaySeries.map(s => {
                    return <SplineSeries {...s} id={s.name} key={s.name} showInNavigator />
                })}
            </YAxis>

            <DateRangePickers axisId="xAxis" />
            <RangeSelector verticalAlign="bottom">
                <RangeSelector.Button count={1} type="day">1d</RangeSelector.Button>
                <RangeSelector.Button count={7} type="day">7d</RangeSelector.Button>
                <RangeSelector.Button count={1} type="month">1m</RangeSelector.Button>
                <RangeSelector.Button type="all">All</RangeSelector.Button>
            </RangeSelector>

            <Navigator>
                {displaySeries.map(s => {
                    return <Navigator.Series seriesId={s.name} key={s.name} />
                })}
            </Navigator>
        </HighchartsStockChart>
    }
}

StockChart.defaultProps = {
    showTooltip: true,
}
