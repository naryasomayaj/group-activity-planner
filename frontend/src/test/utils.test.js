import { describe, it, expect } from 'vitest'

/**
 * Utility function tests
 * Testing pure functions extracted from SinglePage.jsx
 */

// Test generateAccessCode logic
describe('generateAccessCode', () => {
    const generateAccessCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase()
    }

    it('should return a 6-character string', () => {
        const code = generateAccessCode()
        expect(code).toHaveLength(6)
    })

    it('should return uppercase characters', () => {
        const code = generateAccessCode()
        expect(code).toBe(code.toUpperCase())
    })

    it('should generate different codes on subsequent calls', () => {
        const codes = new Set()
        for (let i = 0; i < 10; i++) {
            codes.add(generateAccessCode())
        }
        // Should have at least 5 unique codes out of 10 attempts
        expect(codes.size).toBeGreaterThanOrEqual(5)
    })
})

// Test buildLLMPrompt structure
describe('buildLLMPrompt', () => {
    const buildLLMPrompt = (event, groupName, nameOfFn) => {
        const lines = []
        lines.push(`You are an assistant that suggests group activity ideas.`)
        lines.push(`Group: ${groupName || "(unnamed group)"}`)
        lines.push(`Event name: ${event?.name || "—"}`)
        lines.push(`Location: ${event?.location || "—"}`)
        lines.push(`\nParticipant preferences (per user):`)

        const prefs = event?.preferences || {}
        if (Object.keys(prefs).length === 0) {
            lines.push(`  (none yet)`)
        } else {
            Object.entries(prefs).forEach(([uid, p]) => {
                const nm = nameOfFn(uid)
                const budget = (p?.budget ?? "—")
                const vibes = Array.isArray(p?.vibes) && p.vibes.length ? p.vibes.join(", ") : "—"
                const interests = Array.isArray(p?.interests) && p.interests.length ? p.interests.join(", ") : "—"
                lines.push(`  - ${nm}: budget=${budget}, vibes=${vibes}, interests=${interests}`)
            })
        }
        lines.push(`Please propose 3–5 concrete, feasible activity ideas.`)
        return lines.join("\n")
    }

    it('should include group name in prompt', () => {
        const prompt = buildLLMPrompt({}, 'Test Group', () => 'User')
        expect(prompt).toContain('Group: Test Group')
    })

    it('should include event name and location', () => {
        const event = { name: 'Weekend Hangout', location: 'Boston' }
        const prompt = buildLLMPrompt(event, 'Friends', () => 'User')
        expect(prompt).toContain('Event name: Weekend Hangout')
        expect(prompt).toContain('Location: Boston')
    })

    it('should show "(none yet)" when no preferences', () => {
        const prompt = buildLLMPrompt({}, 'Group', () => 'User')
        expect(prompt).toContain('(none yet)')
    })

    it('should include participant preferences when provided', () => {
        const event = {
            name: 'Dinner',
            preferences: {
                'user123': { budget: 50, vibes: ['chill', 'fun'], interests: ['food'] }
            }
        }
        const prompt = buildLLMPrompt(event, 'Foodies', (uid) => 'John')
        expect(prompt).toContain('John')
        expect(prompt).toContain('budget=50')
        expect(prompt).toContain('vibes=chill, fun')
    })

    it('should handle missing preferences gracefully', () => {
        const event = {
            name: 'Trip',
            preferences: {
                'user456': { budget: null, vibes: [], interests: [] }
            }
        }
        const prompt = buildLLMPrompt(event, 'Travelers', () => 'Jane')
        expect(prompt).toContain('vibes=—')
        expect(prompt).toContain('interests=—')
    })
})

// Test access code validation
describe('Access Code Validation', () => {
    it('should normalize access code to uppercase', () => {
        const code = 'abc123'
        const normalized = code.trim().toUpperCase()
        expect(normalized).toBe('ABC123')
    })

    it('should handle whitespace in codes', () => {
        const code = '  XYZ789  '
        const normalized = code.trim().toUpperCase()
        expect(normalized).toBe('XYZ789')
    })
})
