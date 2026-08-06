import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "Web4Firm | Lead Intelligence Workspace",
  description: "Find local businesses without listed websites, qualify leads and create thoughtful outreach.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
