import React, { Component } from 'react';
import Swal from 'sweetalert2'
import Settings from '../Settings';
import StockChart from './ChartComponent/StockChart';
import { getStatisticValues, parseSha } from './utils';
import './Dacapo.css';

const builds = ["Test_openjdk8_j9_sanity.perf_x86-64_linux",
				"Test_openjdk11_j9_sanity.perf_x86-64_linux",
				"Test_openjdk8_j9_sanity.perf_x86-64_mac",
				"Test_openjdk11_j9_sanity.perf_x86-64_mac",
				"Test_openjdk8_hs_sanity.perf_x86-64_linux",
				"Test_openjdk11_hs_sanity.perf_x86-64_linux",
				"Test_openjdk8_hs_sanity.perf_x86-64_mac",
				"Test_openjdk11_hs_sanity.perf_x86-64_mac"];

const servers = ['AdoptOpenJDK', 'CustomizedJenkins'];
export default class Dacapo extends Component {
	static Title = props => props.buildSelected || '';
	static defaultSize = { w: 2, h: 4 }
	static Setting = <Settings servers={servers} builds={builds} />;

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
		const buildName = encodeURIComponent(buildSelected);
		const response = await fetch(`/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`, {
			method: 'get'
		});
		let results = await response.json();

		const res = await fetch(`/api/getDashboardBuildInfo`, {
			method: 'get'
		});
		const buildInfoMap = await res.json();

		if (serverSelected) {
			if (serverSelected === 'AdoptOpenJDK') {
				results = results.filter(result => result.buildUrl.includes(buildInfoMap['AdoptOpenJDK'].url));
			} else {
				results = results.filter(result => !result.buildUrl.includes(buildInfoMap['AdoptOpenJDK'].url));
			}
		}

		const resultsByJDKBuild = {};

		// combine results having the same JDK build date
		results.forEach((t, i) => {
			let jdkDate = t.jdkDate;
			if (t.buildResult !== "SUCCESS" || !jdkDate) return;
			jdkDate = jdkDate.replaceAll('-', '');
			resultsByJDKBuild[jdkDate] = resultsByJDKBuild[jdkDate] || [];
			t.tests.forEach((test, i) => {
				let eclipse = null;
				let h2 = null;
				let lusearch = null;

				if (!test.testName.startsWith("dacapo") || !test.testData || !test.testData.metrics) return;

				test.testData.metrics.forEach((metric, i) => {
					if (metric.name === "eclipse") {
						eclipse = metric.value[0];
					}
					if (metric.name === "h2") {
						h2 = metric.value[0];
					}
					if (metric.name === "lusearch-fix") {
						lusearch = metric.value[0];
					}
				});

				if (!eclipse && !h2 && !lusearch) {
					return;
				}
				// TODO: current code only considers one interation. This needs to be updated
				resultsByJDKBuild[jdkDate].push({
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
				});
			});
		});

		const [eclipseData, eclipseStd, eclipseMean, eclipseMedian] = getStatisticValues(resultsByJDKBuild, 'eclipse');
		const [h2Data, h2Std, h2Mean, h2Median] = getStatisticValues(resultsByJDKBuild, 'h2');
		const [lusearchData, lusearchStd, lusearchMean, lusearchMedian] = getStatisticValues(resultsByJDKBuild, 'lusearch');

		const series = { eclipseData, eclipseStd, eclipseMean, eclipseMedian, h2Data, h2Std, h2Mean, h2Median, lusearchData, lusearchStd, lusearchMean, lusearchMedian };
		const displaySeries = [];
		for (let key in series) {
			displaySeries.push({
				visible: key === "h2Data",
				name: key,
				data: series[key],
				keys: ['x', 'y', 'additionalData', 'CI'],
				events: {
					click: async function (event) {
						const { buildName, buildNum, javaVersion, jdkDate, testId } = event.point.additionalData[0];

						const buildLinks = ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
						const CIstr = (typeof event.point.CI === 'undefined') ? `` : `CI = ${event.point.CI}`;

						let ret = `<b>${'NAME'}:</b> ${event.y}<br/> <b>Build: </b> ${jdkDate} <pre>${javaVersion}</pre><br/><b>Link to builds:</b> ${buildLinks}<br /> ${CIstr}`;
						
						let i = event.point.series.data.indexOf(event.point);
						let prevPoint = i === 0 ? null : event.point.series.data[i - 1];
						let lengthPrev = prevPoint ?
						prevPoint.additionalData.length : 0;
						let prevJavaVersion = prevPoint ? prevPoint.additionalData[lengthPrev - 1].javaVersion : null;

						prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
            			javaVersion = parseSha(javaVersion, 'OpenJ9');

						if (prevJavaVersion && javaVersion) {
							let githubLink = `<a href="https://github.com/eclipse/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
							ret += `<br/> <b> Compare Builds: </b>${githubLink}`;
						}

						Swal.fire({
							html: ret,
							showCloseButton: true,
							showConfirmButton: false,
							width: '50%',
							customClass: {
								htmlContainer: 'text-align: left !important;',
								container: 'text-align: left !important;',
  								content: 'text-align: left !important;',
  								input: 'text-align: left !important;',

							}
						});
					}
				}
			});
		}
		this.setState({ displaySeries });
	}

	render() {
		const { displaySeries } = this.state;
		return <StockChart showTooltip={false} displaySeries={displaySeries} />;
	}
}