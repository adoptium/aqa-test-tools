import React, { Component } from 'react';
import { Divider } from 'antd';
import { params, getParams } from '../../utils/query';
import Checkboxes from './Checkboxes';
import ResultGrid from './ResultGrid';
import PieChart from './PieChart';
import Overview from './Overview';
import TestBreadcrumb from '../TestBreadcrumb';

const hcvalues = {
    hcjdkImpls: ["j9", "hs", "Upstream"],
    hclevels: ["sanity", "extended", "special"],
    hcgroups: ["functional", "openjdk", "system", "external", "perf", "jck"]
}

export default class ResultSummary extends Component {
    state = {
        selectedPlatforms: [],
        allPlatforms: [],
        selectedJdkVersions: [],
        allJdkVersions: [],
        selectedJdkImpls: [],
        allJdkImpls: [],
    };
    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { parentId } = getParams(this.props.location.search);

        // get test summary (i.e., passed, failed, total numbers)
        let fetchBuild = {};
        fetchBuild = await fetch(`/api/getTotals?id=${parentId}`, {
            method: 'get'
        });
        const summary = await fetchBuild.json();

        // get build information
        fetchBuild = await fetch(`/api/getData?_id=${parentId}`, {
            method: 'get'
        });
        const buildInfo = await fetchBuild.json();
        const parentBuildInfo = buildInfo[0] || {};

        // get all child builds info based on buildNameRegex
        const buildNameRegex = "^Test_openjdk.*";
        const testSummaryResult = undefined;
        const buildResult = undefined;

        fetchBuild = await fetch(`/api/getAllChildBuilds${params({ buildResult, testSummaryResult, buildNameRegex, parentId })}`, {
            method: 'get'
        });

        const builds = await fetchBuild.json();
        const regex = /^Test_openjdk(\d+)_(\w+)_(\w+).(.+?)_(.+?)(_(Nightly|Personal))?$/;
        const buildMap = {};
        let jdkVersionOpts = [];
        builds.map((build, i) => {
            const tokens = build.buildName.match(regex);
            if (tokens.length > 5) {
                let [_, jdkVersion, jdkImpl, level, group, platform] = tokens;

                buildMap[platform] = buildMap[platform] || {};
                buildMap[platform][jdkVersion] = buildMap[platform][jdkVersion] || {};
                buildMap[platform][jdkVersion][jdkImpl] = buildMap[platform][jdkVersion][jdkImpl] || {};
                buildMap[platform][jdkVersion][jdkImpl][level] = buildMap[platform][jdkVersion][jdkImpl][level] || {};
                buildMap[platform][jdkVersion][jdkImpl][level][group] = buildMap[platform][jdkVersion][jdkImpl][level][group] || {};

                jdkVersionOpts.push(jdkVersion);

                // If there are multiple builds for one key, then this is a parallel build
                // For parallel build, we only store the parent build info and loop child builds to get aggregated testSummary
                if (Object.keys(buildMap[platform][jdkVersion][jdkImpl][level][group]).length !== 0) {
                    if (build.hasChildren) {
                        buildMap[platform][jdkVersion][jdkImpl][level][group].buildResult = build.buildResult;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].buildUrl = build.buildUrl;
                        buildMap[platform][jdkVersion][jdkImpl][level][group]._id = build._id;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].hasChildren = build.hasChildren;

                    } else if (build.testSummary) {
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary = buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary
                            || { passed: 0, failed: 0, disabled: 0, skipped: 0, executed: 0, total: 0 };
                        const { passed = 0, failed = 0, disabled = 0, skipped = 0, executed = 0, total = 0 } = build.testSummary;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary.passed += passed;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary.failed += failed;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary.disabled += disabled;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary.skipped += skipped;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary.executed += executed;
                        buildMap[platform][jdkVersion][jdkImpl][level][group].testSummary.total += total;
                    }
                } else {
                    buildMap[platform][jdkVersion][jdkImpl][level][group] = {
                        buildResult: build.buildResult,
                        testSummary: build.testSummary,
                        buildUrl: build.buildUrl,
                        buildId: build._id,
                        hasChildren: build.hasChildren
                    };
                }
            }
        });
        const platformOpts = Object.keys(buildMap).sort();
        jdkVersionOpts = [...new Set(jdkVersionOpts)].sort((a, b) => { return a - b });
        const jdkImplOpts = hcvalues.hcjdkImpls;


        this.setState({
            buildMap,
            summary,
            parentBuildInfo,
            selectedPlatforms: platformOpts,
            allPlatforms: platformOpts,
            selectedJdkVersions: jdkVersionOpts,
            allJdkVersions: jdkVersionOpts,
            selectedJdkImpls: jdkImplOpts,
            allJdkImpls: jdkImplOpts,
        });
    }

    render() {
        const { buildMap, selectedPlatforms, allPlatforms, selectedJdkVersions, allJdkVersions, selectedJdkImpls, allJdkImpls, summary, parentBuildInfo } = this.state;
        const { parentId } = getParams(this.props.location.search);
        if (buildMap && parentBuildInfo) {
            return <div>
                <TestBreadcrumb buildId={parentId} />
                <Overview id={parentId} parentBuildInfo={parentBuildInfo} summary={summary} />
                <Divider />
                <div style={{ display: "flex" }}>
                    <PieChart buildMap={buildMap} dataKey="passed" selectedPlatforms={selectedPlatforms} selectedJdkVersions={selectedJdkVersions} selectedJdkImpls={selectedJdkImpls} hcvalues={hcvalues} name="Passed Tests" showInLegend={true} dataLabels={true} />
                    <PieChart buildMap={buildMap} dataKey="failed" selectedPlatforms={selectedPlatforms} selectedJdkVersions={selectedJdkVersions} selectedJdkImpls={selectedJdkImpls} hcvalues={hcvalues} name="Failed Tests" showInLegend={true} dataLabels={true} />
                </div>
                <Divider />
                <ResultGrid buildMap={buildMap} selectedPlatforms={selectedPlatforms} selectedJdkVersions={selectedJdkVersions} selectedJdkImpls={selectedJdkImpls} hcvalues={hcvalues} />
                <Divider />
                <Checkboxes name="Platforms" onChange={selectedPlatforms => this.setState({ selectedPlatforms })} value={selectedPlatforms} options={allPlatforms} />
                <Checkboxes name="JDK Versions" onChange={selectedJdkVersions => this.setState({ selectedJdkVersions })} value={selectedJdkVersions} options={allJdkVersions} />
                <Checkboxes name="JDK Impls" onChange={selectedJdkImpls => this.setState({ selectedJdkImpls })} value={selectedJdkImpls} options={allJdkImpls} />
            </div>;
        } else {
            return null;
        }
    }
}