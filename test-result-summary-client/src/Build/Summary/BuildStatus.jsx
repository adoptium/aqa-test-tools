import React from 'react';
import { ApartmentOutlined } from '@ant-design/icons';
import { params } from '../../utils/query';
import { Link } from 'react-router-dom';
import { Tooltip } from 'antd';
import BuildStatusIcon from './BuildStatusIcon.jsx';

const BuildStatus = ({ status, id, buildNum }) => {
    if (status && id && buildNum) {
        return (
            <div>
                <Tooltip title="Build tree">
                    <Link
                        to={{
                            pathname: '/buildTreeView',
                            search: params({ parentId: id }),
                        }}
                    >
                        <ApartmentOutlined />
                    </Link>
                </Tooltip>
                <Link
                    to={{
                        pathname: '/buildDetail',
                        search: params({ parentId: id }),
                    }}
                    style={{
                        color:
                            status === 'SUCCESS'
                                ? '#2cbe4e'
                                : status === 'FAILURE'
                                ? '#f50'
                                : '#DAA520',
                    }}
                >
                    {' '}
                    Build #{buildNum}
                    <BuildStatusIcon status={status} />
                </Link>
            </div>
        );
    }
    return null;
};

export default BuildStatus;
