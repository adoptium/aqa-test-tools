import React from 'react';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
const BuildLink = ({
    id,
    label,
    link,
    buildResult,
    testSummaryResult,
    buildNameRegex,
}) => {
    if (id) {
        return (
            <span>
                {label}
                <Link
                    to={{
                        pathname: '/buildDetail',
                        search: params({
                            parentId: id,
                            buildResult,
                            testSummaryResult,
                            buildNameRegex,
                        }),
                    }}
                >
                    {link}{' '}
                </Link>
            </span>
        );
    }
    return null;
};

export default BuildLink;
