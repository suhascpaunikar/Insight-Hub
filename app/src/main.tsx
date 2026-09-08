import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { CampaignsPage } from "@/components/campaigns-page"
import "@/index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CampaignsPage />
  </StrictMode>,
)
