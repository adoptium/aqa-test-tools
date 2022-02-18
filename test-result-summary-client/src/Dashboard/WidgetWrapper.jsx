import React, { Component } from 'react';
import ToolBar from './ToolBar';

export default class WidgetWrapper extends Component {
    render() {
        const { Widget, ...props } = this.props;
        const { style, ...widget } = Widget;

        return (
            <div className="widget" style={style}>
                <ToolBar {...props} {...widget} />
                <div className="widget--content">
                    <Widget {...props} />
                </div>
            </div>
        );
    }
}
