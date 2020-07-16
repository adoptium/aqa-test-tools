import React, { Component } from 'react';
import { Route } from 'react-router';
import { Link } from 'react-router-dom';
import { ConfigProvider, Layout, Menu } from 'antd';
import enUS from 'antd/lib/locale-provider/en_US';

import { Dashboard } from './Dashboard/';
import ErrorBoundary from './ErrorBoundary';
import { Output } from './Build/Output/';
import { TestCompare } from './TestCompare/';
import { ThirdPartyAppView } from './ThirdPartyAppView/';
import { PerfCompare } from './PerfCompare/';
import { TabularView } from './TabularView/';
import { AllTestsInfo, BuildDetail, DeepHistory, GitNewIssue, TestPerPlatform, PossibleIssues, TopLevelBuilds, ResultSummary } from './Build/';
import { SearchResult } from './Search/';
import { Settings } from './Settings/';

import './App.css';
import  { ReactComponent as AdoptLogo } from './Adoptlogo.svg';

const { SubMenu } = Menu;
const { Header, Content, Sider } = Layout;

export default class App extends Component {
    render() {
        return <ConfigProvider locale={enUS}>
            <Layout>
                <Header className="header" style={{ background: '#152935' }}>
                    <div className="logo" />
                    <Menu
                        theme="dark"
                        mode="horizontal"
                        defaultSelectedKeys={['2']}
                        style={{ lineHeight: '64px', background: '#152935' }}
                    >
                    <Menu.Item key="1"><a href="https://adoptopenjdk.net/" style={{lineHeight: '250%'}}><AdoptLogo/></a></Menu.Item>
                    <Menu.Item key="2"><Link to="/dashboard">Test Results Summary Service</Link></Menu.Item>
                    </Menu>
                </Header>
                <Layout>
                    <Sider width={200} style={{ background: '#fff' }}>
                        <Menu
                            mode="inline"
                            defaultSelectedKeys={['1']}
                            defaultOpenKeys={['3']}
                            style={{ height: '100%', borderRight: 0 }}
                        >
                            <Menu.Item key="1"><Link to="/tests/Test">By Pipeline</Link></Menu.Item>
                            <Menu.Item key="2"><Link to="/testCompare">Test Compare</Link></Menu.Item>
                            <SubMenu key="3" title={<span>Perf Related</span>}>
                                <Menu.Item key="sub1"><Link to="/tests/Perf">Perf Test</Link></Menu.Item>
                                <Menu.Item key="sub2"><Link to="/perfCompare">Perf Compare</Link></Menu.Item>
                                <Menu.Item key="sub3"><Link to="/tabularView">Tabular View</Link></Menu.Item>
                            </SubMenu>
                            <Menu.Item key="4"><Link to="/dashboard">Dashboard</Link></Menu.Item>
                            <Menu.Item key="5"><Link to="/ThirdPartyAppView">Third Party Applications</Link></Menu.Item>
                        </Menu>
                    </Sider>
                    <Layout style={{ padding: '0 24px 24px' }}>
                        <ErrorBoundary>
                            <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
                                <Route exact path="/" component={TopLevelBuilds} />
                                <Route path="/admin/settings" component={Settings} />
                                <Route path="/dashboard" component={Dashboard} />
                                <Route path="/tests/:type" component={TopLevelBuilds} />
                                <Route path="/output/:outputType" component={Output} />
                                <Route path="/deepHistory" component={DeepHistory} />
                                <Route path="/gitNewIssue" component={GitNewIssue} />
                                <Route path="/testCompare" component={TestCompare} />
                                <Route path="/perfCompare" component={PerfCompare} />
                                <Route path="/tabularView" component={TabularView} />
                                <Route path="/buildDetail" component={BuildDetail} />
                                <Route path="/allTestsInfo" component={AllTestsInfo} />
                                <Route path="/testPerPlatform" component={TestPerPlatform} />
                                <Route path="/possibleIssues" component={PossibleIssues} />
                                <Route path="/searchResult" component={SearchResult} />
                                <Route path="/resultSummary" component={ResultSummary} />
                                <Route path="/ThirdPartyAppView" component={ThirdPartyAppView} />
                            </Content>
                        </ErrorBoundary>
                    </Layout>
                </Layout>
            </Layout>
        </ConfigProvider>
    }
}