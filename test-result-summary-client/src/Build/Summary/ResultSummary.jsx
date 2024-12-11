import React, { useState, useEffect } from 'react';
import { Divider } from 'antd';
import { useLocation } from 'react-router-dom';
import { params, getParams } from '../../utils/query';
import { fetchData } from '../../utils/Utils';
import { fetchTipVersion } from '../../utils/Utils';
import Checkboxes from './Checkboxes';
import ResultGrid from './ResultGrid';
import Overview from './Overview';
import TestBreadcrumb from '../TestBreadcrumb';
import {
    order,
    getInfoFromBuildName,
    setBuildsStatus,
} from '../../utils/Utils';

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

export default function ResultSummary() {
    const location = useLocation();
    const [state, setState] = useState({
        selectedPlatforms: [],
        allPlatforms: [],
        selectedJdkVersions: [],
        allJdkVersions: [],
        selectedJdkImpls: [],
        allJdkImpls: [],
        sdkBuilds: [],
        buildMap: {},
        summary: {},
        parentBuildInfo: {},
        childBuildsResult: 'UNDEFINED',
        javaVersion: null,
    });

    useEffect(() => {
        const updateData = async () => {
            const { parentId } = getParams(location.search);

            // get test summary (i.e., passed, failed, total numbers)
            const summaryRes = fetchData(`/api/getTotals?id=${parentId}`);

            // get build information
            const buildInfoRes = fetchData(`/api/getData?_id=${parentId}`);

            // get all SDK builds info
            const sdkBuildsRes = fetchData(
                `/api/getAllChildBuilds${params({
                    buildNameRegex: '^(jdk[0-9]{1,2}|Build_)',
                    parentId,
                })}`
            );
            // get all child builds info based on buildNameRegex
            const buildNameRegex = '^Test_openjdk.*';
            const testSummaryResult = undefined;
            const buildResult = undefined;

            const buildsRes = fetchData(
                `/api/getAllChildBuilds${params({
                    buildResult,
                    testSummaryResult,
                    buildNameRegex,
                    parentId,
                })}`
            );
            const [summary, buildInfo, sdkBuilds, builds] = await Promise.all([
                summaryRes,
                buildInfoRes,
                sdkBuildsRes,
                buildsRes,
            ]);
            const parentBuildInfo = buildInfo[0] || {};
            let childBuildsResult = 'UNDEFINED';
            let javaVersion = null;
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
                    // use non-capture group to ignore words evaluation and release if present
                    const regex =
                        /^jdk(\d*).?(?:-evaluation|-release)?-(\w+)-(\w+)-(\w+)/i;
                    const tokens = buildName.match(regex);
                    if (Array.isArray(tokens) && tokens.length > 4) {
                        jdkVersion = tokens[1];
                        if (jdkVersion == '') {
                            const callTipVersion = async () =>
                                (jdkVersion = await fetchTipVersion());
                        }
                        if (buildName.includes('alpine-linux')) {
                            platform = `${tokens[4]}_alpine-linux`;
                            if (buildName.includes('x64')) {
                                platform = `x86-64_alpine-linux`;
                            }
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
                    const regex =
                        /Build_JDK(.+?)_(.+?_.+?(_xl|_fips)?)(_.+)?$/i;
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
                        buildMap[platform][jdkVersion][jdkImpl][level][group] ||
                        {};

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

                childBuildsResult = setBuildsStatus(build, childBuildsResult);
            });
            builds.sort((a, b) => a.buildName.localeCompare(b.buildName));

            builds.forEach((build) => {
                const buildName = build.buildName.toLowerCase();
                if (getInfoFromBuildName(buildName)) {
                    const {
                        jdkVersion,
                        jdkImpl,
                        level,
                        group,
                        platform,
                        rerun,
                    } = getInfoFromBuildName(buildName);

                    const hasRerun = rerun ? rerun : false;
                    if (jdkVersion && jdkImpl && level && group && platform) {
                        buildMap[platform] = buildMap[platform] || {};
                        buildMap[platform][jdkVersion] =
                            buildMap[platform][jdkVersion] || {};
                        buildMap[platform][jdkVersion][jdkImpl] =
                            buildMap[platform][jdkVersion][jdkImpl] || {};
                        buildMap[platform][jdkVersion][jdkImpl][level] =
                            buildMap[platform][jdkVersion][jdkImpl][level] ||
                            {};
                        buildMap[platform][jdkVersion][jdkImpl][level][group] =
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ] || {};

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
                            } else if (build.testSummary && !hasRerun) {
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
                            if (
                                hasRerun &&
                                !buildMap[platform][jdkVersion][jdkImpl][level][
                                    group
                                ].rerunBuildUrl
                            ) {
                                buildMap[platform][jdkVersion][jdkImpl][level][
                                    group
                                ].rerunBuildUrl = build.buildUrl;
                            }
                        } else {
                            buildMap[platform][jdkVersion][jdkImpl][level][
                                group
                            ] = {
                                buildResult: build.buildResult,
                                testSummary: build.testSummary,
                                buildUrl: build.buildUrl,
                                buildId: build._id,
                                hasChildren: build.hasChildren,
                                rerunBuildUrl: hasRerun ? build.buildUrl : '',
                            };
                        }
                    }
                }

                if (!javaVersion && build.javaVersion) {
                    javaVersion = build.javaVersion;
                }

                childBuildsResult = setBuildsStatus(build, childBuildsResult);
            });

            const platformOpts = Object.keys(buildMap).sort();
            jdkVersionOpts = [...new Set(jdkVersionOpts)].sort(order);
            jdkImplOpts = [...new Set(jdkImplOpts)].sort(order);

            setState((prevState) => ({
                ...prevState,
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
                sdkBuilds,
                javaVersion,
            }));
        };

        updateData();
    }, [location.search]);

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
        sdkBuilds,
        javaVersion,
    } = state;

    const { parentId } = getParams(location.search);

    if (buildMap && parentBuildInfo) {
        return (
            <div>
                <TestBreadcrumb buildId={parentId} />
                <Overview
                    id={parentId}
                    parentBuildInfo={parentBuildInfo}
                    summary={summary}
                    childBuildsResult={childBuildsResult}
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
                        setState({ ...state, selectedPlatforms })
                    }
                    value={selectedPlatforms}
                    options={allPlatforms}
                />
                <Checkboxes
                    name="JDK Versions"
                    onChange={(selectedJdkVersions) =>
                        setState({ ...state, selectedJdkVersions })
                    }
                    value={selectedJdkVersions}
                    options={allJdkVersions}
                />
                <Checkboxes
                    name="JDK Impls"
                    onChange={(selectedJdkImpls) =>
                        setState({ ...state, selectedJdkImpls })
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
