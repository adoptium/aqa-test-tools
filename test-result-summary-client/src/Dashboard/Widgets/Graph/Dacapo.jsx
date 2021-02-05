import React, { Component } from 'react';
import {
	HighchartsStockChart, Chart, XAxis, YAxis, Legend,
	SplineSeries, Navigator, RangeSelector, Tooltip, Series
} from 'react-jsx-highstock';
import DateRangePickers from '../DateRangePickers';
import { Radio } from 'antd';
import BenchmarkMath from '../../../PerfCompare/lib/BenchmarkMath';
import math from 'mathjs';
import { parseSha, getEpochTime } from './utils';

const map = {
	"dacapo-jdk11": "Test_openjdk11_j9_sanity.perf_x86-64_linux",
	"dacapo-jdk8": "Test_openjdk8_j9_sanity.perf_x86-64_linux"
};

let servers = ['AdoptOpenJDK', 'CustomizedJenkins'];

export class DacapoSetting extends Component {
	onChange = obj => {
		this.props.onChange({ buildSelected: obj.target.value });
	}

	onServerChange = obj => {
		this.props.onChange({ serverSelected: obj.target.value });
	}

	render() {
		const { buildSelected, serverSelected } = this.props;
		return <div style={{ maxWidth: 400 }}>
			<Radio.Group onChange={this.onServerChange} value={serverSelected} defaultValue={'AdoptOpenJDK'}>
				{servers.map( server => {
					return <Radio key={server} value={server}>{server}</Radio>;
				} )}
			</Radio.Group>
			<Radio.Group onChange={this.onChange} values={buildSelected} defaultValue={'dacapo-jdk11'}>
				{Object.keys(map).map(key => {
					return <Radio key={key} value={key}>{map[key]}</Radio>;
				})}
			</Radio.Group>
		</div>
	}
}

export default class Dacapo extends Component {
	static Title = props => props.buildSelected || '';
	static defaultSize = { w: 2, h: 4 }
	static Setting = DacapoSetting;
	static defaultSettings = {
		buildSelected: Object.keys(map)[0],
		serverSelected: 'AdoptOpenJDK'
	}

	state = {
		displaySeries: [],
	};

	async componentDidMount() {
		await this.updateData();
	}


	async componentDidUpdate(prevProps) {
		if (prevProps.buildSelected !== this.props.buildSelected 
			|| prevProps.serverSelected !== this.props.serverSelected) {
			await this.updateData();
		}
	}

	async updateData() {
		const { buildSelected, serverSelected } = this.props;
		const buildName = encodeURIComponent(map[buildSelected]);
		const response = await fetch(`/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`, {
			method: 'get'
		});
		const results = await response.json();

		const res = await fetch(`/api/getDashboardBuildInfo`, {
			method: 'get'
		});
		const buildInfoMap = await res.json();
		
		if ( serverSelected ){
			if ( serverSelected === 'AdoptOpenJDK') {
				results = results.filter(result => result.buildUrl.includes(buildInfoMap['AdoptOpenJDK'].url));
			} else {
				results = results.filter(result => !result.buildUrl.includes(buildInfoMap['AdoptOpenJDK'].url));
			}
		} 
		
		const resultsByJDKBuild = {};
		let eclipseData = [];
		let eclipseGtValues = [];
		let eclipseStd = [];
		let eclipseMean = [];
		let eclipseMedian = [];

		let h2Data = [];
		let h2GtValues = [];
		let h2Std = [];
		let h2Mean = [];
		let h2Median = [];

		let lusearchData = [];
		let lusearchGtValues = [];
		let lusearchStd = [];
		let lusearchMean = [];
		let lusearchMedian = [];

		// combine results having the same JDK build date
		results.forEach(( t, i ) => {
			const jdkDate = t.jdkDate;	
			if ( t.buildResult !== "SUCCESS" || !jdkDate ) return;
			resultsByJDKBuild[jdkDate] = resultsByJDKBuild[jdkDate] || [];
			t.tests.forEach(( test, i ) => {
				let eclipse = null;
				let h2 = null;
				let lusearch = null;

				if ( !test.testName.startsWith("dacapo") || !test.testData || !test.testData.metrics ) return;

				test.testData.metrics.forEach(( metric, i)=> {
					if ( metric.name === "eclipse" ) {
						eclipse = metric.value[0];
					}
					if ( metric.name === "h2" ) {
						h2 = metric.value[0];
					}
					if ( metric.name === "lusearch-fix" ) {
						lusearch = metric.value[0];
					}
				});

				if ( !eclipse && !h2 && !lusearch ) {
					return;
				}
                 // TODO: current code only considers one interation. This needs to be updated
				resultsByJDKBuild[jdkDate].push( {
					eclipse,
					h2,
					lusearch,
					additionalData: {
						testId: test._id,
						buildName: t.buildName,
						buildNum: t.buildNum,
						javaVersion: t.javaVersion,
						jdkDate: t.jdkDate,
					},
				} );
			});
		} );

		math.sort( Object.keys( resultsByJDKBuild ) ).forEach(( k, i ) => {
			const date = getEpochTime(k);

			let eclipseGroup = resultsByJDKBuild[k].map( x => x['eclipse']).filter(function (el) {
				return el != null;
			});
			if (eclipseGroup.length > 0) {
				eclipseGtValues.push( math.mean( eclipseGroup ) );
				let myCi = 'N/A';
				if (eclipseGroup.length > 1){
					myCi = BenchmarkMath.confidence_interval(eclipseGroup);
				}
				eclipseData.push( [date, math.mean( eclipseGroup ), resultsByJDKBuild[k].map( x => x['additionalData'] ), myCi] );
				eclipseStd.push( [date, math.std( eclipseGtValues )] );
				eclipseMean.push( [date, math.mean( eclipseGtValues )] );
				eclipseMedian.push( [date, math.median( eclipseGtValues )] );	
			}

			let h2Group = resultsByJDKBuild[k].map( x => x['h2']).filter(function (el) {
				return el != null;
			});
			if (h2Group.length > 0) {
				h2GtValues.push( math.mean( h2Group ) );
				let myCi = 'N/A';
				if (h2Group.length > 1){
					myCi = BenchmarkMath.confidence_interval(h2Group);
				}
				h2Data.push( [date, math.mean( h2Group ), resultsByJDKBuild[k].map( x => x['additionalData'] ), myCi] );
				h2Std.push( [date, math.std( h2GtValues )] );
				h2Mean.push( [date, math.mean( h2GtValues )] );
				h2Median.push( [date, math.median( h2GtValues )] );
			}

			let lusearchGroup = resultsByJDKBuild[k].map( x => x['lusearch']).filter(function (el) {
				return el != null;
			});
			if (lusearchGroup.length > 0) {
				lusearchGtValues.push( math.mean( lusearchGroup ) );
				let myCi = 'N/A';
				if (lusearchGroup.length > 1){
					myCi = BenchmarkMath.confidence_interval(lusearchGroup);
				}
				lusearchData.push( [date, math.mean( lusearchGroup ), resultsByJDKBuild[k].map( x => x['additionalData'] ), myCi] );
				lusearchStd.push( [date, math.std( lusearchGtValues )] );
				lusearchMean.push( [date, math.mean( lusearchGtValues )] );
				lusearchMedian.push( [date, math.median( lusearchGtValues )] );
			}
		} );

		const series = { eclipseData, eclipseStd, eclipseMean, eclipseMedian, h2Data, h2Std, h2Mean, h2Median, lusearchData, lusearchStd, lusearchMean, lusearchMedian };
		const displaySeries = [];
		for ( let key in series ) {
			displaySeries.push( {
				visible: key === "h2Data",
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
			let jdkDate = this.point.additionalData[lengthThis - 1].jdkDate;

			let javaVersion = this.point.additionalData[lengthThis - 1].javaVersion;
			let prevJavaVersion = prevPoint ? prevPoint.additionalData[lengthPrev - 1].javaVersion : null;
			let ret = `${this.series.name}: ${this.y}<br/> Build: ${jdkDate} <pre>${javaVersion}</pre><br/>Link to builds: ${buildLinks}<br /> ${CIstr}`;

			prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
			javaVersion = parseSha(javaVersion, 'OpenJ9');

			if (prevJavaVersion && javaVersion) {
				let githubLink = `<a href="https://github.com/eclipse/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
				ret += `<br/> Compare Builds:${githubLink}`;
			}
			return ret;
		} else {
			return `${this.series.name}: ${this.y}<br/> Build: ${x.toISOString().slice( 0, 10 )}<br /> ${CIstr}`;
		}
	}

	render() {
		const { displaySeries } = this.state;
		return <HighchartsStockChart>
			<Chart zoomType="x"/>

			<Legend/>
			<Tooltip formatter={this.formatter} useHTML={true} style={{ pointerEvents: 'auto' }} />

			<XAxis >
				<XAxis.Title>Time</XAxis.Title>
			</XAxis>

			<YAxis id="gt">
				<YAxis.Title>msec</YAxis.Title>
				{displaySeries.map( s => {
					return <SplineSeries {...s} id={s.name} key={s.name} showInNavigator/>
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
				{displaySeries.map( s => {
					return <Navigator.Series seriesId={s.name} key={s.name} />
				} )}
			</Navigator>
		</HighchartsStockChart>
	}
}