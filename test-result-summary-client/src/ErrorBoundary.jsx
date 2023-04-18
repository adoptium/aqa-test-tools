import React, { useState, useEffect } from 'react';

const ErrorBoundary = (props) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const errorListener = (error) => {
            setHasError(true);
        };

        window.addEventListener('error', errorListener);

        return () => {
            window.removeEventListener('error', errorListener);
        };
    }, []);

    if (hasError) {
        return <h1>Something went wrong.</h1>;
    }
    return props.children;
};

export default ErrorBoundary;
