import React, { Component } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import drilldown from "highcharts/modules/drilldown.js";
import './Graph.css';

drilldown(Highcharts);
export default class PieChart extends Component {
    allowChartUpdate = true;
    state = {
        pieChartData: {},
    };
    categoryClicked() {
        this.allowChartUpdate = false;
    }

    componentDidMount() {
        this.updateData();
    }

    componentDidUpdate(prevProps) {
        const { buildMap, selectedPlatforms, selectedJdkVersions, selectedJdkImpls } = this.props;
        if (prevProps.buildMap !== buildMap
            || prevProps.selectedPlatforms !== selectedPlatforms
            || prevProps.selectedJdkVersions !== selectedJdkVersions
            || prevProps.selectedJdkImpls !== selectedJdkImpls) {
            this.updateData();
        }
    }

    updateData() {
        const { buildMap, selectedPlatforms, selectedJdkVersions, selectedJdkImpls, hcvalues, dataKey } = this.props;
        const { hclevels, hcgroups } = hcvalues;
        if (buildMap) {
            const buildData = {};
            const initialValues = {
                total: 0,
                executed: 0,
                passed: 0,
                failed: 0,
                disabled: 0,
                skipped: 0,
            };
            selectedPlatforms.forEach(platform => {
                if (!buildMap[platform]) return;
                selectedJdkVersions.forEach(version => {
                    if (!buildMap[platform][version]) return;
                    selectedJdkImpls.forEach(impl => {
                        if (!buildMap[platform][version][impl]) return;
                        hclevels.forEach(level => {
                            if (!buildMap[platform][version][impl][level]) return;
                            hcgroups.sort().forEach(group => {
                                if (!buildMap[platform][version][impl][level][group]) return;
                                const newData = buildMap[platform][version][impl][level][group];
                                if (!newData.testSummary) return;
                                const { total, executed, passed, failed, disabled, skipped } = newData.testSummary;

                                buildData[group] = buildData[group] || { ...initialValues };
                                buildData[group].total += total;
                                buildData[group].executed += executed;
                                buildData[group].passed += passed;
                                buildData[group].failed += failed;
                                buildData[group].disabled += disabled;
                                buildData[group].skipped += skipped;

                                buildData[group][level] = buildData[group][level] || { ...initialValues };
                                const value = buildData[group][level];
                                buildData[group][level] = {
                                    total: value.total + total,
                                    executed: value.executed + executed,
                                    passed: value.passed + passed,
                                    failed: value.failed + failed,
                                    disabled: value.disabled + disabled,
                                    skipped: value.skipped + skipped,
                                }
                            });
                        });
                    });
                });
            });

            const drilldownSeries = [];
            const pieChartData = Object.keys(buildData).sort().map(key => {
                const drilldownData = hclevels.map(level => {
                    buildData[key][level] = buildData[key][level] || {};
                    buildData[key][level][dataKey] = buildData[key][level][dataKey] || 0;
                    return [level, buildData[key][level][dataKey]];
                });
                if (drilldownData.length > 0) {
                    drilldownSeries.push({
                        name: key,
                        id: key,
                        data: drilldownData
                    });
                }
                return {
                    name: key,
                    y: buildData[key][dataKey],
                    drilldown: key
                }

            });
            this.setState({ pieChartData, drilldownSeries });
        }
    }
    render() {
        const { pieChartData, drilldownSeries } = this.state;
        const { name, showInLegend = false, dataLabels = false, colors = undefined, dataKey } = this.props;

        if (!pieChartData) return null;

        const options = {
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false,
                type: 'pie'
            },
            title: {
                text: name
            },
            subtitle: {
                text: 'Click the slices to view levels',
            },
            tooltip: {
                formatter: function () {
                    return this.point.name + '<b> ' + this.point.percentage.toFixed(2) + '% </b><br/><b> ' + this.y + `</b> ${dataKey} tests`;
                }
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: dataLabels,
                        formatter: function () {
                            if (this.y > 0) {
                                return this.point.name + ': ' + Highcharts.numberFormat(this.point.percentage, 2) + ' %'
                            }
                        }
                    },
                    colors,
                    shadow: true,
                    showInLegend
                }
            },
            series: [
                {
                    events: {
                        click: e => {
                            this.categoryClicked(e);
                        }
                    },
                    name: "Test Groups",
                    colorByPoint: true,
                    data: pieChartData

                }],
            drilldown: {
                series: drilldownSeries
            }
        }
        return <div className="chart">
            <HighchartsReact
                allowChartUpdate={this.allowChartUpdate}
                highcharts={Highcharts}
                options={options}
            />
        </div>;
    }
}