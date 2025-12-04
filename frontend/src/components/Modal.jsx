import React from 'react';
import { createPortal } from 'react-dom';
import Card from './ui/Card'; // Assuming Card is in ui folder, but Modal is in components. 
// Wait, Modal is in `src/components`, Card is in `src/components/ui`. So path is `./ui/Card`.

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
                <Card className="modal-content">
                    <div className="modal-header">
                        <h2 className="modal-title">{title}</h2>
                        <button className="modal-close" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        {children}
                    </div>
                </Card>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
