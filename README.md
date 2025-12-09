# Group-Activity-Planner

‘Group Activity Planner’ is a full-stack web application that helps groups of friends plan activities together by matching their interests and schedules. It aims to make planning easy by suggesting the most suitable activities for a given day. 

## Features
- Create and join groups using access codes
- Plan events with location, date, and budget
- AI-powered activity suggestions via Gemini
- Group voting on activity ideas
- User profiles with interests

## Tech Stack
- **Frontend:** React 19, Vite
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **AI:** Google Gemini API

## Project Structure
```
group-activity-planner/
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Main app page
│   │   ├── ai/           # Gemini API client
│   │   └── test/         # Unit tests
│   └── tests/            # E2E tests
└── README.md
```

## Dependencies

- Node

#### For MacOS:
Install Node via brew:
```bash
brew install node
```

#### For Windows:
Install Node.JS via their website:  
[Node JS](https://nodejs.org/en)

## Running this project on your machine

### First time setup
```bash
cd frontend
npm install
```

### Start local web server
```bash
cd frontend
npm run dev
```
  
Navigate to the url specified in the terminal.

## Testing

### Run Unit Tests
```bash
cd frontend
npm run test
```

### Run End-to-End Tests
```bash
cd frontend
npm run test:e2e
```

**Test Coverage:** 27 tests total (13 unit, 14 E2E) covering utility functions, component rendering, authentication UI, responsive design, and form interactions.
