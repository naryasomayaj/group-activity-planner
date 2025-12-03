import React from 'react';
import Card from './ui/Card';

const EventCard = ({ event, onClick }) => {
    return (
        <Card
            className="event-card cursor-pointer hover:shadow-md transition-shadow"
            onClick={onClick}
            style={{ padding: '1.5rem' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem' }}>{event.name}</h3>
                    <p className="text-muted-foreground text-sm">{event.location || 'No location'}</p>
                    {event.date && <p className="text-muted-foreground text-sm">{new Date(event.date).toLocaleString()}</p>}
                </div>
                {/* Status badge could go here */}
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                <div className="bg-muted px-2 py-1 rounded">
                    Budget: {event.budget ? `$${event.budget}` : 'N/A'}
                </div>
                <div className="bg-muted px-2 py-1 rounded">
                    {event.participants?.length || 0} Going
                </div>
            </div>
        </Card>
    );
};

export default EventCard;
