import React, { Component } from 'react';
import { Popover, Button, Icon } from 'antd';

class Settings extends Component {
    render() {
        const { Setting, ...props } = this.props;

        return <Popover content={<Setting {...props} />} trigger="click" placement="bottomLeft">
            <Button size="small"><Icon type="setting" /></Button>
        </Popover>
    }
}

export default class ToolBar extends Component {
    render() {
        const { Setting, Title, onRemove, ...props } = this.props;
        return <div className="widget--header" style={{ position: 'relative', borderBottom: '1px solid #eceef7', height: 26 }}>
            <div className="widget--header-info"><Title {...props} /></div>
            {Setting && <Settings Setting={Setting} {...props} />}
            <Button size="small" onClick={onRemove}><Icon type="close" /></Button>
        </div>
    }
}
