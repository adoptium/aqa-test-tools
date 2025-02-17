import { Button as AntdButton, Spin } from 'antd';
import { useState } from 'react';
export const Button = ({ children, ...props }) => {
    const [loading, setLoading] = useState(false);
    const onClick = async (...args) => {
        try {
            setLoading(true);
            await props.onClick(...args);
        } finally {
            setLoading(false);
        }
    };
    return (
        <>
            <AntdButton {...props} onClick={onClick}>
                {children}
            </AntdButton>
            {loading && <Spin />}
        </>
    );
};
