import { useState, useEffect } from 'react';
import { Table } from 'antd';
import { fetchData } from '../utils/Utils';

const PossibleIssuesByAI = ({
    buildName,
    buildUrl,
    testName,
    testOutputId,
}) => {
    const [builds, setBuilds] = useState(null);
    useEffect(() => {
        const fetchBuilds = async () => {
            if (buildUrl && buildName && testName && testOutputId) {
                if (
                    buildUrl.includes('hyc-runtimes') &&
                    !buildName.includes('jck') &&
                    !testName.includes('jck')
                ) {
                    const build = await fetchData(
                        `/api/getPossibleIssuesByAI?testName=${testName}&testOutputId=${testOutputId}`
                    );
                    setBuilds(build);
                }
            }
        };

        fetchBuilds();
    }, [buildName]);

    if (!builds) {
        return null;
    }
    const columns = [
        {
            title: 'Possible Issues',
            dataIndex: 'title',
            key: 'title',
            render: (value, row, index) => {
                return (
                    <a
                        href={row.issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {row.issue_number}: {value}
                    </a>
                );
            },
        },
        {
            title: 'Relevance Level',
            dataIndex: 'relevance_level',
            key: 'relevance_level',
        },
        {
            title: 'Rationale',
            dataIndex: 'rationale',
            key: 'rationale',
        },
    ];

    return builds && builds.length > 0 ? (
        <Table
            columns={columns}
            dataSource={builds}
            bordered
            title={() => 'AI Recommended Possible Issues (Openj9 issues only)'}
            pagination={{ pageSize: 5 }}
        />
    ) : (
        <span>
            No Possible Issues Recommended by AI.{' '}
            {builds && builds.error ? `Error: ${builds.error}` : ''}
        </span>
    );
};

export default PossibleIssuesByAI;
