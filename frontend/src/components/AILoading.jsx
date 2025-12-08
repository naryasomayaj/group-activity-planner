import React from 'react';

const AILoading = () => {
    return (
        <div className="ai-loading-container">
            <div className="ai-robot">🤖</div>
            <div className="ai-loading-text">
                <span>Generating Ideas</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
            </div>
        </div>
    );
};

export default AILoading;
