# Wing Me Web 🚀

A modern, responsive web application for connecting with people at your location. Built with Next.js, TypeScript, and Tailwind CSS.

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
- **PWA**: Next-PWA

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Sasuke1x/wings.git
cd wings
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
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
NEXT_PUBLIC_API_URL=your_api_url_here
NEXT_PUBLIC_SOCKET_URL=your_socket_url_here
```

## 🎨 Key Features Implemented

### 1. **Location Permission Prompt**
- Beautiful modal that appears on first app launch
- Persistent user preference storage
- Graceful fallback to default location

### 2. **Interactive Map with Custom Locations**
- Click anywhere on the map to add custom locations
- Real-time location filtering and search
- Category-based organization
- Custom Wing Me markers with user counts

### 3. **App Download Banner**
- Prominent banner encouraging mobile app download
- Positioned strategically on the map view
- Wing Me branded design

## 📁 Project Structure

```
wings/
├── app/                    # Next.js 13+ app directory
│   ├── auth/              # Authentication pages
│   ├── main/              # Main application
│   ├── profile/           # Profile pages
│   └── welcome/           # Onboarding
├── components/            # Reusable components
│   ├── tabs/             # Tab components
│   ├── TabBar.tsx        # Navigation
│   └── WingMeMap.tsx     # Map component
├── lib/                  # Utilities and configuration
│   ├── api.ts           # API functions
│   ├── constants.ts     # App constants
│   └── store.ts         # Zustand store
├── public/              # Static assets
└── package.json         # Dependencies
```

## 🎯 Core Components

- **WingMeMap**: Interactive Leaflet map with custom markers
- **TabBar**: Bottom navigation with 5 main tabs
- **LocationTab**: Detailed location view and interactions
- **MapTab**: Main map interface with search and filters

## 🔧 Configuration

### Tailwind CSS
Custom Wing Me color palette and design tokens configured in `tailwind.config.ts`.

### Next.js PWA
Progressive Web App features configured with `next-pwa` for offline functionality.

## 📄 License

This project is private and proprietary to Wing Me.

## 🤝 Contributing

This is a private project. For access or contributions, please contact the Wing Me team.

---

Built with ❤️ for connecting people at their locations.