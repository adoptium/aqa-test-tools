import React, { Component } from 'react';
import {
    CheckOutlined,
    CloseOutlined,
    InfoOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';

export default class BuildStatusIcon extends Component {
    render() {
        const { status } = this.props;
        if (status) {
            let icon = '';
            if (status === 'PROGRESSING') {
                icon = (
                    <LoadingOutlined
                        style={{ fontSize: 18, padding: 8, color: '#DAA520' }}
                    />
                );
            } else if (status === 'SUCCESS') {
                icon = (
                    <CheckOutlined
                        style={{ fontSize: 18, padding: 8, color: '#2cbe4e' }}
                    />
                );
            } else if (status === 'FAILURE') {
                icon = (
                    <CloseOutlined
                        style={{ fontSize: 18, padding: 8, color: '#f50' }}
                    />
                );
            } else {
                icon = (
                    <InfoOutlined
                        style={{ fontSize: 18, padding: 8, color: '#f50' }}
                    />
                );
            }
            return <Tooltip title={status}>{icon}</Tooltip>;
        }
        return null;
    }
}
