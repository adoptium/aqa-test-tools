import React, { Component, cloneElement, isValidElement } from 'react';
import { CloseOutlined, SettingOutlined } from '@ant-design/icons';
import { Popover, Button } from 'antd';

class Settings extends Component {
    render() {
        const { Setting, ...props } = this.props;
        const SettingComponent = isValidElement(Setting) ? cloneElement(Setting, props) : <Setting {...props} />;
        return (
            <Popover content={SettingComponent} trigger="click" placement="bottomLeft">
                <Button size="small"><SettingOutlined /></Button>
            </Popover>
        );
    }
}

export default class ToolBar extends Component {
    render() {
        const { Setting, Title, onRemove, ...props } = this.props;
        return (
            <div className="widget--header" style={{ position: 'relative', borderBottom: '1px solid #eceef7', height: 26 }}>
                <div className="widget--header-info"><Title {...props} /></div>
                {Setting && <Settings Setting={Setting} {...props} />}
                <Button size="small" onClick={onRemove}><CloseOutlined /></Button>
            </div>
        );
    }
}
