import React from 'react';
import Card from './ui/Card';

const GroupCard = ({ group, onClick }) => {
    return (
        <Card
            className="group-card cursor-pointer hover:shadow-md transition-shadow"
            onClick={onClick}
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            <div
                className="group-card-header"
                style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                    padding: '1.5rem',
                    color: 'white'
                }}
            >
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{group.name}</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-semibold">{(group.members || []).length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted-foreground">Events</span>
                    <span className="font-semibold">{(group.events || []).length}</span>
                </div>
            </div>
        </Card>
    );
};

export default GroupCard;
