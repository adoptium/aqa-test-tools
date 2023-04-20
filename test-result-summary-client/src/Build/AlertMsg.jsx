import React from 'react';
import { Alert } from 'antd';

const AlertMsg = ({ error }) => {
    if (!error) return null;
    return <Alert message="Error" description={error} type="error" showIcon />;
};

export default AlertMsg;
