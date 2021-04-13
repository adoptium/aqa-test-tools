import React, { Component } from 'react';
import Settings from '../Settings';
import StockChart from './ChartComponent/StockChart';
import { fetchData } from '../../../utils/Utils';
import { getStatisticValues, handlePointClick, formatDate } from './utils';

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
	static Title = props => 'Dacapo';
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
		let results = await fetchData(`/api/getBuildHistory?type=Perf&buildName=${buildName}&status=Done&limit=100&asc`);

		const buildInfoMap = await fetchData(`/api/getDashboardBuildInfo`);

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
			jdkDate = formatDate(jdkDate.trim());
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
					click: (event) => handlePointClick(event)
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