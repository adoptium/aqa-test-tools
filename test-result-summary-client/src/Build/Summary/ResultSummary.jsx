import React, { Component } from 'react';
import { Divider } from 'antd';
import { params, getParams } from '../../utils/query';
import { fetchData } from '../../utils/Utils';
import Checkboxes from './Checkboxes';
import ResultGrid from './ResultGrid';
import Overview from './Overview';
import TestBreadcrumb from '../TestBreadcrumb';
import { order, getInfoFromBuildName } from '../../utils/Utils';

const hcvalues = {
    hclevels: ['dev', 'sanity', 'extended', 'special'],
    hcgroups: [
        'build',
        'functional',
        'openjdk',
        'system',
        'external',
        'perf',
        'jck',
    ],
};

export default class ResultSummary extends Component {
    state = {
        selectedPlatforms: [],
        allPlatforms: [],
        selectedJdkVersions: [],
        allJdkVersions: [],
        selectedJdkImpls: [],
        allJdkImpls: [],
        sdkBuilds: [],
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

        // get all SDK builds info
        const sdkBuilds = await fetchData(
            `/api/getAllChildBuilds${params({
                buildNameRegex: '^(jdk[0-9]{1,2}|Build_)',
                parentId,
            })}`
        );
        // get all child builds info based on buildNameRegex
        const buildNameRegex = '^Test_openjdk.*';
        const testSummaryResult = undefined;
        const buildResult = undefined;

        const builds = await fetchData(
            `/api/getAllChildBuilds${params({
                buildResult,
                testSummaryResult,
                buildNameRegex,
                parentId,
            })}`
        );
        let childBuildsResult = 0;
        let javaVersion = null;
        const buildResultPriority = {
            ABORT: 3,
            FAILIURE: 2,
            UNSTABLE: 1,
            SUCCESS: 0,
        };
        const buildMap = {};
        let jdkVersionOpts = [];
        let jdkImplOpts = [];

        sdkBuilds.forEach((build) => {
            const buildName = build.buildName.toLowerCase();
            let level = 'sanity';
            let group = 'build';
            if (buildName.includes('_smoketests')) {
                level = 'extended';
            }

            let jdkVersion, platform, jdkImpl;

            if (buildName.startsWith('jdk')) {
                // SDK build and Smoke test platform format does not match with test build. Need to match the platform value.
                // For example, jdk18-linux-aarch64-openj9
                // jdk18-linux-s390x-openj9_SmokeTests
                // jdk11u-alpine-linux-aarch64-temurin
                // jdk11u-aix-ppc64-openj9-ibm
                // jdk11u-linux-x64-openj9-criu
                // jdk17u-linux-x64-openj9-criu_SmokeTests
                const temp = buildName.split('-');
                let suffix = temp[temp.length - 1];
                suffix = suffix.replace('_smoketests', '');
                jdkImpl = suffix;
                if (suffix === 'openj9') {
                    jdkImpl = 'j9';
                } else if (suffix === 'temurin') {
                    jdkImpl = 'hs';
                }
                if (buildName.includes('openj9')) {
                    jdkImpl = 'j9';
                }
                const regex = /^jdk(\d+).?-(\w+)-(\w+)-(\w+)/i;
                const tokens = buildName.match(regex);
                if (Array.isArray(tokens) && tokens.length > 4) {
                    jdkVersion = tokens[1];
                    if (buildName.includes('alpine-linux')) {
                        platform = `${tokens[4]}_alpine-linux`;
                    } else if (buildName.includes('-x64')) {
                        platform = `x86-64_${tokens[2]}`;
                    } else if (buildName.includes('x86-32')) {
                        platform = `x86-32_${tokens[2]}`;
                    } else {
                        platform = `${tokens[3]}_${tokens[2]}`;
                    }
                    if (buildName.includes('-criu')) {
                        platform = platform + '_criu';
                    }
                }
            } else if (buildName.startsWith('build')) {
                const regex = /Build_JDK(.+?)_(.+?_.+?(_xl|_fips)?)(_.+)?$/i;
                const tokens = buildName.match(regex);
                if (Array.isArray(tokens) && tokens.length > 3) {
                    jdkVersion = tokens[1];
                    platform = tokens[2];
                }
                if (buildName.includes('zos')) {
                    jdkImpl = 'ibm';
                } else {
                    jdkImpl = 'j9';
                }
            }

            if (jdkVersion && jdkImpl && level && group && platform) {
                buildMap[platform] = buildMap[platform] || {};
                buildMap[platform][jdkVersion] =
                    buildMap[platform][jdkVersion] || {};
                buildMap[platform][jdkVersion][jdkImpl] =
                    buildMap[platform][jdkVersion][jdkImpl] || {};
                buildMap[platform][jdkVersion][jdkImpl][level] =
                    buildMap[platform][jdkVersion][jdkImpl][level] || {};
                buildMap[platform][jdkVersion][jdkImpl][level][group] =
                    buildMap[platform][jdkVersion][jdkImpl][level][group] || {};

                jdkVersionOpts.push(jdkVersion);
                jdkImplOpts.push(jdkImpl);

                buildMap[platform][jdkVersion][jdkImpl][level][group] = {
                    buildResult: build.buildResult,
                    testSummary: build.testSummary,
                    buildUrl: build.buildUrl,
                    buildId: build._id,
                    hasChildren: build.hasChildren,
                };
            } else {
                console.warn(`Cannot match ${buildName}`);
            }

            if (build.status != 'Done') {
                childBuildsResult = 'PROGRESSING';
            } else {
                childBuildsResult = Math.max(
                    buildResultPriority[build.buildResult],
                    childBuildsResult
                );
            }
        });
        builds.forEach((build) => {
            const buildName = build.buildName.toLowerCase();
            if (getInfoFromBuildName(buildName)) {
                const { jdkVersion, jdkImpl, level, group, platform } =
                    getInfoFromBuildName(buildName);
                if (jdkVersion && jdkImpl && level && group && platform) {
                    buildMap[platform] = buildMap[platform] || {};
                    buildMap[platform][jdkVersion] =
                        buildMap[platform][jdkVersion] || {};
                    buildMap[platform][jdkVersion][jdkImpl] =
                        buildMap[platform][jdkVersion][jdkImpl] || {};
                    buildMap[platform][jdkVersion][jdkImpl][level] =
                        buildMap[platform][jdkVersion][jdkImpl][level] || {};
                    buildMap[platform][jdkVersion][jdkImpl][level][group] =
                        buildMap[platform][jdkVersion][jdkImpl][level][group] ||
                        {};

                    jdkVersionOpts.push(jdkVersion);
                    jdkImplOpts.push(jdkImpl);
                    // If there are multiple builds for one key, then this is a parallel build
                    // For parallel build, we only store the parent build info and loop child builds to get aggregated testSummary
                    if (
                        Object.keys(
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ]
                        ).length !== 0
                    ) {
                        if (build.hasChildren) {
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].buildResult = build.buildResult;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].buildUrl = build.buildUrl;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].buildId = build._id;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].hasChildren = build.hasChildren;
                        } else if (build.testSummary) {
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary = buildMap[platform][jdkVersion][
                                jdkImpl
                            ][level][group].testSummary || {
                                passed: 0,
                                failed: 0,
                                disabled: 0,
                                skipped: 0,
                                executed: 0,
                                total: 0,
                            };
                            const {
                                passed = 0,
                                failed = 0,
                                disabled = 0,
                                skipped = 0,
                                executed = 0,
                                total = 0,
                            } = build.testSummary;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary.passed += passed;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary.failed += failed;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary.disabled += disabled;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary.skipped += skipped;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary.executed += executed;
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ].testSummary.total += total;
                        }
                    } else {
                        buildMap[platform][jdkVersion][jdkImpl][level][group] =
                            {
                                buildResult: build.buildResult,
                                testSummary: build.testSummary,
                                buildUrl: build.buildUrl,
                                buildId: build._id,
                                hasChildren: build.hasChildren,
                            };
                    }
                }
            }

            if (!javaVersion && build.javaVersion) {
                javaVersion = build.javaVersion;
            }

            if (build.status != 'Done') {
                childBuildsResult = 'PROGRESSING';
            } else {
                childBuildsResult = Math.max(
                    buildResultPriority[build.buildResult],
                    childBuildsResult
                );
            }
        });

        if (childBuildsResult == '') {
            childBuildsResult = 'SUCCESS';
        }

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
            childBuildsResult,
            buildResultPriority,
            sdkBuilds,
            javaVersion,
        });
    }

    render() {
        const {
            buildMap,
            selectedPlatforms,
            allPlatforms,
            selectedJdkVersions,
            allJdkVersions,
            selectedJdkImpls,
            allJdkImpls,
            summary,
            parentBuildInfo,
            childBuildsResult,
            buildResultPriority,
            sdkBuilds,
            javaVersion,
        } = this.state;

        const getKeyByValue = (object, value) => {
            return Object.keys(object).find((key) => object[key] === value);
        };

        const { parentId } = getParams(this.props.location.search);

        if (buildMap && parentBuildInfo) {
            const childBuildsResultString = getKeyByValue(
                buildResultPriority,
                childBuildsResult
            );
            return (
                <div>
                    <TestBreadcrumb buildId={parentId} />
                    <Overview
                        id={parentId}
                        parentBuildInfo={parentBuildInfo}
                        summary={summary}
                        childBuildsResult={childBuildsResultString}
                        sdkBuilds={sdkBuilds}
                        javaVersion={javaVersion}
                    />
                    <Divider />
                    <ResultGrid
                        buildMap={buildMap}
                        selectedPlatforms={selectedPlatforms}
                        selectedJdkVersions={selectedJdkVersions}
                        selectedJdkImpls={selectedJdkImpls}
                        hcvalues={hcvalues}
                    />
                    <Divider />
                    <Checkboxes
                        name="Platforms"
                        onChange={(selectedPlatforms) =>
                            this.setState({ selectedPlatforms })
                        }
                        value={selectedPlatforms}
                        options={allPlatforms}
                    />
                    <Checkboxes
                        name="JDK Versions"
                        onChange={(selectedJdkVersions) =>
                            this.setState({ selectedJdkVersions })
                        }
                        value={selectedJdkVersions}
                        options={allJdkVersions}
                    />
                    <Checkboxes
                        name="JDK Impls"
                        onChange={(selectedJdkImpls) =>
                            this.setState({ selectedJdkImpls })
                        }
                        value={selectedJdkImpls}
                        options={allJdkImpls}
                    />
                </div>
            );
        } else {
            return null;
        }
    }
}
