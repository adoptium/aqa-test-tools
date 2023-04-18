import React, { useState, useEffect } from 'react';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
import { fetchData } from '../utils/Utils';

const TestBreadcrumb = ({ buildId, testId, testName }) => {
    const [builds, setBuilds] = useState(null);

    useEffect(() => {
        const fetchBuilds = async () => {
            if (buildId) {
                const fetchedBuilds = await fetchData(
                    `/api/getParents?id=${buildId}`
                );
                setBuilds(fetchedBuilds);
            }
        };

        fetchBuilds();
    }, [buildId]);

    const createItem = (build, i) => {
        let path, searchParams;
        if (build.hasChildren) {
            path = '/buildDetail';
            searchParams = { parentId: build._id };
        } else if (build.type === 'Test') {
            path = '/allTestsInfo';
            searchParams = { buildId: build._id };
        } else if (build.type === 'Build') {
            path = '/output/build';
            searchParams = { id: build._id };
        } else if (build.type === 'Perf') {
            path = '/output/perf';
            searchParams = { id: build._id };
        }

        return {
            key: i,
            title: (
                <Link to={{ pathname: path, search: params(searchParams) }}>
                    {build.buildName} #{build.buildNum}
                </Link>
            ),
        };
    };

    if (!builds) {
        return null;
    }

    const breadcrumbItems = builds.map((build, i) => createItem(build, i));

    if (testId && testName) {
        breadcrumbItems.push({
            key: builds.length,
            title: (
                <Link
                    to={{
                        pathname: '/output/test',
                        search: params({ id: testId }),
                    }}
                >
                    {testName}
                </Link>
            ),
        });
    }

    return <Breadcrumb style={{ margin: '12px 0' }} items={breadcrumbItems} />;
};

export default TestBreadcrumb;
