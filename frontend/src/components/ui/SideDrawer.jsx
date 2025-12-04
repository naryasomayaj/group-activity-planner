import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const SideDrawer = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="side-drawer-overlay" onClick={onClose} />
            <div className={`side-drawer ${isOpen ? 'open' : ''}`}>
                <div className="side-drawer-header">
                    <h2 className="side-drawer-title">{title}</h2>
                    <button className="side-drawer-close" onClick={onClose}>&times;</button>
                </div>
                <div className="side-drawer-content">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
};

export default SideDrawer;
