import { Suspense } from "react";
import EnergyProToolkitClient from "./energy-pro-toolkit-client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EnergyProToolkitClient />
    </Suspense>
  );
}
