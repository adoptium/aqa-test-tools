import React, { Component } from 'react';
import { Route } from 'react-router';
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
                                        key: '6',
                                        label: (
                                            <Link to="/tests/AQAvitCert">
                                                AQAvit Verification
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '2',
                                        label: (
                                            <Link to="/testCompare">
                                                Test Compare
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '3',
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
                                        ],
                                    },
                                    {
                                        key: '4',
                                        label: (
                                            <Link to="/dashboard">
                                                Dashboard
                                            </Link>
                                        ),
                                    },
                                    {
                                        key: '5',
                                        label: (
                                            <Link to="/ThirdPartyAppView">
                                                Third Party Applications
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
                                    <Route
                                        exact
                                        path="/"
                                        component={TopLevelBuilds}
                                    />
                                    <Route
                                        path="/admin/settings"
                                        component={Settings}
                                    />
                                    <Route
                                        path="/dashboard"
                                        component={Dashboard}
                                    />
                                    <Route
                                        path="/tests/:type"
                                        component={TopLevelBuilds}
                                    />
                                    <Route
                                        path="/output/:outputType"
                                        component={Output}
                                    />
                                    <Route
                                        path="/deepHistory"
                                        component={DeepHistory}
                                    />
                                    <Route
                                        path="/gitNewIssue"
                                        component={GitNewIssue}
                                    />
                                    <Route
                                        path="/testCompare"
                                        component={TestCompare}
                                    />
                                    <Route
                                        path="/perfCompare"
                                        component={PerfCompare}
                                    />
                                    <Route
                                        path="/tabularView"
                                        component={TabularView}
                                    />
                                    <Route
                                        path="/buildDetail"
                                        component={BuildDetail}
                                    />
                                    <Route
                                        path="/buildTreeView"
                                        component={BuildTreeView}
                                    />
                                    <Route path="/builds" component={Builds} />
                                    <Route
                                        path="/allTestsInfo"
                                        component={AllTestsInfo}
                                    />
                                    <Route
                                        path="/testPerPlatform"
                                        component={TestPerPlatform}
                                    />
                                    <Route
                                        path="/possibleIssues"
                                        component={PossibleIssues}
                                    />
                                    <Route
                                        path="/searchResult"
                                        component={SearchResult}
                                    />
                                    <Route
                                        path="/resultSummary"
                                        component={ResultSummary}
                                    />
                                    <Route
                                        path="/ThirdPartyAppView"
                                        component={ThirdPartyAppView}
                                    />
                                    <Route
                                        path="/releaseSummary"
                                        component={ReleaseSummary}
                                    />
                                </Content>
                            </ErrorBoundary>
                        </Layout>
                    </Layout>
                </Layout>
            </ConfigProvider>
        );
    }
}
