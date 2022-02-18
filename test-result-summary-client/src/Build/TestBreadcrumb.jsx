import React, { Component } from 'react';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
import { fetchData } from '../utils/Utils';

export default class TestBreadcrumb extends Component {
    state = {};
    async componentDidMount() {
        const { buildId } = this.props;

        if (buildId) {
            const builds = await fetchData(`/api/getParents?id=${buildId} `);
            this.setState({ builds });
        }
    }
    async componentDidUpdate(prevProps) {
        if (prevProps.buildId !== this.props.buildId) {
            await this.componentDidMount();
        }
    }

    renderBreadcrumb(build, i) {
        if (build.hasChildren) {
            return (
                <Breadcrumb.Item key={i}>
                    <Link
                        to={{
                            pathname: '/buildDetail',
                            search: params({ parentId: build._id }),
                        }}
                    >
                        {build.buildName} #{build.buildNum}
                    </Link>
                </Breadcrumb.Item>
            );
        } else if (build.type === 'Test') {
            return (
                <Breadcrumb.Item key={i}>
                    <Link
                        to={{
                            pathname: '/allTestsInfo',
                            search: params({ buildId: build._id }),
                        }}
                    >
                        {build.buildName} #{build.buildNum}
                    </Link>
                </Breadcrumb.Item>
            );
        } else if (build.type === 'Build') {
            return (
                <Breadcrumb.Item key={i}>
                    <Link
                        to={{
                            pathname: '/output/build',
                            search: params({ id: build._id }),
                        }}
                    >
                        {build.buildName} #{build.buildNum}
                    </Link>
                </Breadcrumb.Item>
            );
        }
        return null;
    }

    render() {
        const { builds } = this.state;
        if (!builds) {
            return null;
        }

        const { testId, testName } = this.props;
        let renderTest = null;
        if (testId && testName) {
            renderTest = (
                <Breadcrumb.Item key={builds.length}>
                    <Link
                        to={{
                            pathname: '/output/test',
                            search: params({ id: testId }),
                        }}
                    >
                        {testName}
                    </Link>
                </Breadcrumb.Item>
            );
        }
        return (
            <Breadcrumb style={{ margin: '12px 0' }}>
                {builds.map((build, i) => this.renderBreadcrumb(build, i))}
                {renderTest}
            </Breadcrumb>
        );
    }
}
