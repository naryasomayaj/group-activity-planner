import React from "react"

function ActivitiesViewer({ rawLLMtext, voting, isParticipant, currentUserId, onVote }) {
    // Parse the AI response with error handling
    let activities = [];
    try {
        const match = rawLLMtext.match(/\{[\s\S]*\}/);
        if (!match) {
            return <div style={{ color: '#ef4444', padding: '12px' }}>Error: Could not parse AI response</div>;
        }
        const data = JSON.parse(match[0]);
        activities = data.activities || [];
    } catch (e) {
        console.error('Failed to parse AI result:', e);
        return <div style={{ color: '#ef4444', padding: '12px' }}>Error: Invalid AI response format</div>;
    }

    if (activities.length === 0) {
        return <div style={{ padding: '12px', color: '#6b7280' }}>No activities found</div>;
    }

    // Calculate vote counts
    const voteCounts = {};
    const votes = voting?.votes || {};
    Object.values(votes).forEach(activityIndex => {
        voteCounts[activityIndex] = (voteCounts[activityIndex] || 0) + 1;
    });

    // Check if user has voted
    const userVote = currentUserId ? votes[currentUserId] : null;
    const hasVoted = userVote !== null && userVote !== undefined;

    // Display winner if voting is closed
    if (voting?.winner) {
        return (
            <div style={{ margin: "12px", padding: "12px" }}>
                <div style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: '#fff',
                    padding: '20px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏆</div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Winner!</h3>
                    <h4 style={{ margin: '0 0 8px 0' }}>{voting.winner.title}</h4>
                    <p style={{ margin: '0', opacity: 0.95 }}>{voting.winner.description}</p>
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', opacity: 0.9 }}>
                        {voting.winner.voteCount} vote{voting.winner.voteCount !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Show all activities with final vote counts */}
                <details style={{ marginTop: '16px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: '600', padding: '8px 0' }}>
                        View All Options & Results
                    </summary>
                    <div style={{ marginTop: '12px' }}>
                        {activities.map((item, idx) => (
                            <div key={idx} style={{
                                border: idx === voting.winner.index ? "2px solid #fbbf24" : "1px solid #e5e7eb",
                                borderRadius: "8px",
                                padding: "12px",
                                marginBottom: "12px",
                                background: idx === voting.winner.index ? '#fffbeb' : '#fff'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: "0 0 4px 0", display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {item.title}
                                            {idx === voting.winner.index && <span>🏆</span>}
                                        </h4>
                                        <p style={{ margin: "0", color: '#6b7280', fontSize: '0.9rem' }}>{item.description}</p>
                                    </div>
                                    <div style={{
                                        background: '#f3f4f6',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginLeft: '12px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {voteCounts[idx] || 0} vote{(voteCounts[idx] || 0) !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            </div>
        );
    }

    // Voting is open
    if (voting?.isOpen) {
        const totalParticipants = Object.keys(votes).length; // This will be updated when we pass participant count

        return (
            <div style={{ margin: "12px", padding: "12px" }}>
                <div style={{
                    background: '#eef2ff',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontWeight: '600', color: '#4f46e5', marginBottom: '4px' }}>
                        🗳️ Voting in Progress
                    </div>
                    {hasVoted ? (
                        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                            You voted for: <strong>{activities[userVote]?.title}</strong>
                            <div style={{ fontSize: '0.85rem', marginTop: '4px', fontStyle: 'italic' }}>
                                Click another option to change your vote
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                            Click on an activity to vote
                        </div>
                    )}
                </div>

                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {activities.map((item, idx) => {
                        const voteCount = voteCounts[idx] || 0;
                        const isUserChoice = userVote === idx;

                        return (
                            <div
                                key={idx}
                                onClick={() => isParticipant && onVote && onVote(idx)}
                                style={{
                                    border: isUserChoice ? "2px solid #6366f1" : "1px solid #e5e7eb",
                                    borderRadius: "8px",
                                    padding: "14px",
                                    marginBottom: "12px",
                                    cursor: isParticipant ? 'pointer' : 'default',
                                    background: isUserChoice ? '#eef2ff' : '#fff',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    boxShadow: isUserChoice ? '0 2px 8px rgba(99, 102, 241, 0.2)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (isParticipant) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (isParticipant) {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = isUserChoice ? '0 2px 8px rgba(99, 102, 241, 0.2)' : 'none';
                                    }
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: "0 0 6px 0", display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {isUserChoice && <span style={{ color: '#6366f1' }}>✓</span>}
                                            {item.title}
                                        </h4>
                                        <p style={{ margin: "0", color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                            {item.description}
                                        </p>
                                    </div>
                                    {voteCount > 0 && (
                                        <div style={{
                                            background: isUserChoice ? '#6366f1' : '#f3f4f6',
                                            color: isUserChoice ? '#fff' : '#374151',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            marginLeft: '12px',
                                            minWidth: '45px',
                                            textAlign: 'center'
                                        }}>
                                            {voteCount}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // No voting yet - just display activities
    return (
        <div style={{ border: "1px solid #ccc", borderRadius: "6px", maxHeight: "300px", overflowY: "auto", margin: "12px", padding: "12px" }}>
            {activities.map((item, idx) => (
                <div key={idx} style={{ border: "1px solid #ccc", borderRadius: "12px", padding: "16px", marginBottom: "16px", marginTop: "16px", marginLeft: "auto", marginRight: "auto" }}>
                    <h3 style={{ margin: "0 0 4px 0" }}>{item.title}</h3>
                    <p style={{ margin: "0" }}>{item.description}</p>
                </div>
            ))}
        </div>
    );
}

export default ActivitiesViewer;