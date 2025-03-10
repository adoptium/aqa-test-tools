import React, { Component } from 'react';
import { Route, Routes } from 'react-router';
import { Link } from 'react-router-dom';
import { ConfigProvider, Layout, Menu } from 'antd';
import enUS from 'antd/es/calendar/locale/en_US';

import { Dashboard } from './Dashboard/';
import ErrorBoundary from './ErrorBoundary';
import { Output } from './Build/Output/';
import { TestCompare } from './TestCompare/';
import { ThirdPartyAppView } from './ThirdPartyAppView/';
import { PerfCompare } from './PerfCompare/';
import { TabularView } from './TabularView/';
import { TrafficLight, MetricsDetails } from './TrafficLight/';
import { AdvancedSearch } from './AdvancedSearch/';

import {
    AllTestsInfo,
    BuildDetail,
    Builds,
    DeepHistory,
    GitNewIssue,
    TestPerPlatform,
    PossibleIssues,
    TopLevelBuilds,
    ResultSummary,
    ReleaseSummary,
    BuildTreeView,
} from './Build/';
import { SearchResult } from './Search/';
import { Settings } from './Settings/';

import './App.css';
import { ReactComponent as AdoptiumLogo } from './AdoptiumLogo.svg';

const { SubMenu } = Menu;
const { Header, Content, Sider } = Layout;

export default class App extends Component {
    render() {
        return (
            <ConfigProvider locale={enUS}>
                <Layout>
                    <Header
                        className="header"
                        style={{ background: '#14003c' }}
                    >
                        <div className="logo" />
                        <Menu
                            theme="dark"
                            mode="horizontal"
                            defaultSelectedKeys={['2']}
                            style={{
                                lineHeight: '40px',
                                background: '#14003c',
                            }}
                            items={[
                                {
                                    key: '1',
                                    style: { lineHeight: '250%' },
                                    icon: (
                                        <AdoptiumLogo
                                            style={{
                                                height: '3.5em',
                                                paddingTop: '1em',
                                            }}
                                        />
                                    ),
                                },
                                {
                                    key: '2',
                                    label: (
                                        <Link to="/dashboard">
                                            Test Results Summary Service
                                        </Link>
                                    ),
                                    style: {
                                        background: '#14003C',
                                        paddingTop: '1em',
                                    },
                                },
                            ]}
                        />
                    </Header>
                    <Layout>
                        <Sider width={200} style={{ background: '#fff' }}>
                            <Menu
                                mode="inline"
                                defaultSelectedKeys={['1']}
                                defaultOpenKeys={['3']}
                                style={{ height: '100%', borderRight: 0 }}
                                items={[
                                    {
                                        key: '1',
                                        label: (
                                            <Link to="/tests/Test">
                                                By Pipeline
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '2',
                                        label: (
                                            <Link to="/tests/AQAvitCert">
                                                AQAvit Verification
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '3',
                                        label: (
                                            <Link to="/testCompare">
                                                Test Compare
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '4',
                                        label: 'Perf Related',
                                        children: [
                                            {
                                                key: 'sub1',
                                                label: (
                                                    <Link to="/tests/Perf">
                                                        Perf Test
                                                    </Link>
                                                ),
                                            },
                                            {
                                                key: 'sub2',
                                                label: (
                                                    <Link to="/perfCompare">
                                                        Perf Compare
                                                    </Link>
                                                ),
                                            },
                                            {
                                                key: 'sub3',
                                                label: (
                                                    <Link to="/tabularView">
                                                        Tabular View
                                                    </Link>
                                                ),
                                            },
                                            {
                                                key: 'sub4',
                                                label: (
                                                    <Link to="/trafficLight">
                                                        Traffic Light
                                                    </Link>
                                                ),
                                            },
                                        ],
                                    },
                                    {
                                        key: '5',
                                        label: (
                                            <Link to="/dashboard">
                                                Dashboard
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '6',
                                        label: (
                                            <Link to="/ThirdPartyAppView">
                                                Third Party Applications
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '7',
                                        label: (
                                            <Link to="/AdvancedSearch">
                                                Advanced Search
                                            </Link>
                                        ),
                                    },
                                ]}
                            />
                        </Sider>
                        <Layout style={{ padding: '0 24px 24px' }}>
                            <ErrorBoundary>
                                <Content
                                    style={{
                                        background: '#fff',
                                        padding: 24,
                                        margin: 0,
                                        minHeight: 280,
                                    }}
                                >
                                    <Routes>
                                        <Route
                                            path="/"
                                            element={<TopLevelBuilds />}
                                        />
                                        <Route
                                            path="/admin/settings"
                                            element={<Settings />}
                                        />
                                        <Route
                                            path="/dashboard"
                                            element={<Dashboard />}
                                        />
                                        <Route
                                            path="/tests/:type"
                                            element={<TopLevelBuilds />}
                                        />
                                        <Route
                                            path="/output/:outputType"
                                            element={<Output />}
                                        />
                                        <Route
                                            path="/deepHistory"
                                            element={<DeepHistory />}
                                        />
                                        <Route
                                            path="/gitNewIssue"
                                            element={<GitNewIssue />}
                                        />
                                        <Route
                                            path="/testCompare"
                                            element={<TestCompare />}
                                        />
                                        <Route
                                            path="/perfCompare"
                                            element={<PerfCompare />}
                                        />
                                        <Route
                                            path="/tabularView"
                                            element={<TabularView />}
                                        />
                                        <Route
                                            path="/trafficLight"
                                            element={<TrafficLight />}
                                        />
                                        <Route
                                            path="/buildDetail"
                                            element={<BuildDetail />}
                                        />
                                        <Route
                                            path="/buildTreeView"
                                            element={<BuildTreeView />}
                                        />
                                        <Route
                                            path="/builds"
                                            element={<Builds />}
                                        />
                                        <Route
                                            path="/allTestsInfo"
                                            element={<AllTestsInfo />}
                                        />
                                        <Route
                                            path="/testPerPlatform"
                                            element={<TestPerPlatform />}
                                        />
                                        <Route
                                            path="/possibleIssues"
                                            element={<PossibleIssues />}
                                        />
                                        <Route
                                            path="/searchResult"
                                            element={<SearchResult />}
                                        />
                                        <Route
                                            path="/resultSummary"
                                            element={<ResultSummary />}
                                        />
                                        <Route
                                            path="/ThirdPartyAppView"
                                            element={<ThirdPartyAppView />}
                                        />
                                        <Route
                                            path="/releaseSummary"
                                            element={<ReleaseSummary />}
                                        />
                                        <Route
                                            path="/advancedSearch"
                                            element={<AdvancedSearch />}
                                        />
                                        <Route
                                            path="/metricsDetails"
                                            element={<MetricsDetails />}
                                        />
                                    </Routes>
                                </Content>
                            </ErrorBoundary>
                        </Layout>
                    </Layout>
                </Layout>
            </ConfigProvider>
        );
    }
}
