# The W App — Web 🚀

A modern, responsive web application for connecting with people at your location. Built with Next.js, TypeScript, and Tailwind CSS, backed by the same Supabase project as the native W App iOS app.

## 🌟 Features

- **Interactive Map**: Real-time location-based social networking with Leaflet maps
- **Custom Locations**: Click anywhere on the map to add your own locations
- **Location Sharing**: Smart location permission handling on app startup
- **App Download Banner**: Encourages users to download the full mobile app
- **Progressive Web App**: Installable with offline capabilities
- **Real-time Updates**: Socket.io integration for live messaging
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🛠️ Tech Stack

- **Framework**: Next.js 15.4.7
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Maps**: Leaflet with React-Leaflet
- **State Management**: Zustand
- **Forms**: React Hook Form
- **Animations**: Framer Motion
- **Real-time**: Socket.io Client
- **Backend**: Supabase (auth, Postgres, storage) — shared with the iOS app
- **PWA**: Next-PWA

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/philms-org/w-app-web.git
cd w-app-web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see below), then run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🌐 Deployment

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

1. Push your code to GitHub
2. Import your repository on Vercel
3. Vercel will automatically detect Next.js and configure the build
4. Your app will be live at `https://your-project-name.vercel.app`

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📁 Project Structure

```
w-app-web/
├── app/                    # Next.js 13+ app directory
│   ├── auth/               # Authentication pages
│   ├── main/                # Main application
│   ├── profile/             # Profile pages
│   └── welcome/              # Onboarding
├── components/              # Reusable components
│   ├── tabs/                # Tab components
│   ├── TabBar.tsx            # Navigation
│   └── WMap.tsx               # Map component
├── lib/                     # Utilities and configuration
│   ├── supabase.ts           # Supabase client
│   ├── data.ts                # Data layer (profiles, locations, messages, etc.)
│   ├── constants.ts            # App constants
│   └── store.ts                # Zustand store
├── public/                  # Static assets
└── package.json              # Dependencies
```

## 🎯 Core Components

- **WMap**: Interactive Leaflet map with custom markers
- **TabBar**: Bottom navigation with 5 main tabs
- **LocationTab**: Detailed location view and interactions
- **MapTab**: Main map interface with search and filters

## 🔧 Configuration

### Tailwind CSS
The W App color palette and design tokens are configured in `tailwind.config.ts` (same brand colors as the iOS app).

### Next.js PWA
Progressive Web App features configured with `next-pwa` for offline functionality.

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. For access or contributions, please contact the team.

---

Built with ❤️ for connecting people at their locations.
