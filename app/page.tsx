import type { Metadata } from "next";

import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = {
  title: "Utility Engineering Toolkit",
  description: "Fast engineering screening for gas demand, customer energy, CHP, facility loads, and emissions.",
};

export default function HomePage() {
  return <HomeDashboard />;
}
