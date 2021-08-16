import React, { Component } from 'react';
import { Divider } from 'antd';
import { params, getParams } from '../../utils/query';
import { fetchData } from '../../utils/Utils';
import Checkboxes from './Checkboxes';
import ResultGrid from './ResultGrid';
import PieChart from './PieChart';
import Overview from './Overview';
import TestBreadcrumb from '../TestBreadcrumb';
import { order, getInfoFromBuildName } from '../../utils/Utils';

const hcvalues = {
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
        failedSdkBuilds : [],
    };
    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { parentId } = getParams(this.props.location.search);

        // get test summary (i.e., passed, failed, total numbers)
        const summary = await fetchData(`/api/getTotals?id=${parentId}`);

        // get build information
        const buildInfo = await fetchData(`/api/getData?_id=${parentId}`);
        const parentBuildInfo = buildInfo[0] || {};

        // get failed SDK build
        // need to support different SDK build names: jdk8u-linux-aarch64-openj9 and Build_JDK8_ppc64_aix_Nightly
        const failedSdkBuilds = await fetchData(`/api/getAllChildBuilds${params({
            buildResult: "!SUCCESS",
            buildNameRegex: "^(jdk[0-9]{1,2}|Build_)",
            parentId,
        })}`);

        // get all child builds info based on buildNameRegex
        const buildNameRegex = "^Test_openjdk.*";
        const testSummaryResult = undefined;
        const buildResult = undefined;

        const builds = await fetchData(`/api/getAllChildBuilds${params({ buildResult, testSummaryResult, buildNameRegex, parentId })}`);
        const buildMap = {};
        let jdkVersionOpts = [];
        let jdkImplOpts = [];
        builds.map((build, i) => {
            const buildName = build.buildName.toLowerCase();
            if ( getInfoFromBuildName(buildName) ) {
                const {jdkVersion, jdkImpl, level, group, platform} = getInfoFromBuildName(buildName);
                if (jdkVersion && jdkImpl && level && group && platform) {
                    buildMap[platform] = buildMap[platform] || {};
                    buildMap[platform][jdkVersion] = buildMap[platform][jdkVersion] || {};
                    buildMap[platform][jdkVersion][jdkImpl] = buildMap[platform][jdkVersion][jdkImpl] || {};
                    buildMap[platform][jdkVersion][jdkImpl][level] = buildMap[platform][jdkVersion][jdkImpl][level] || {};
                    buildMap[platform][jdkVersion][jdkImpl][level][group] = buildMap[platform][jdkVersion][jdkImpl][level][group] || {};
    
                    jdkVersionOpts.push(jdkVersion);
                    jdkImplOpts.push(jdkImpl);
                    // If there are multiple builds for one key, then this is a parallel build
                    // For parallel build, we only store the parent build info and loop child builds to get aggregated testSummary
                    if (Object.keys(buildMap[platform][jdkVersion][jdkImpl][level][group]).length !== 0) {
                        if (build.hasChildren) {
                            buildMap[platform][jdkVersion][jdkImpl][level][group].buildResult = build.buildResult;
                            buildMap[platform][jdkVersion][jdkImpl][level][group].buildUrl = build.buildUrl;
                            buildMap[platform][jdkVersion][jdkImpl][level][group].buildId = build._id;
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
            }
        });
        const platformOpts = Object.keys(buildMap).sort();
        jdkVersionOpts = [...new Set(jdkVersionOpts)].sort(order);
        jdkImplOpts = [...new Set(jdkImplOpts)].sort(order);


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
            failedSdkBuilds,
        });
    }

    render() {
        const { buildMap, selectedPlatforms, allPlatforms, selectedJdkVersions, allJdkVersions, selectedJdkImpls, allJdkImpls, summary, parentBuildInfo, failedSdkBuilds } = this.state;
        const { parentId } = getParams(this.props.location.search);
        if (buildMap && parentBuildInfo) {
            return <div>
                <TestBreadcrumb buildId={parentId} />
                <Overview id={parentId} parentBuildInfo={parentBuildInfo} summary={summary} failedSdkBuilds={failedSdkBuilds}/>
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