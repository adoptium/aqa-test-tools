import { useState } from 'react';
import { VisibilityObserver } from 'reactjs-visibility';

export const ShowWhenVisible = (props) => {
    const [visible, setVisible] = useState(false);
    return (
        <VisibilityObserver
            onChangeVisibility={(newVisibility) => {
                setVisible((v) => {
                    return v || newVisibility;
                });
            }}
        >
            {visible && props.children}
            {!visible && <div style={{ height: 1000 }} />}
        </VisibilityObserver>
    );
};
