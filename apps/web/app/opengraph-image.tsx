/* eslint-disable @next/next/no-img-element -- Satori rasterises this to a PNG; next/image has no meaning in a generated image */
import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

// One image for every shared link. It is generated from the real wordmark rather than a redrawn
// one, and carries no green, so it stays inside the same palette as the site.
export const alt = "Contexta — your documents, understood by AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoPath = path.join(process.cwd(), "public", "contexta-neon-logo.png");
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          backgroundColor: "#f3efe4",
          color: "#1b1710"
        }}
      >
        <img src={logo} width={520} height={191} alt="Contexta" />
        <div
          style={{
            marginTop: 44,
            width: 96,
            height: 8,
            backgroundColor: "#ffea3a"
          }}
        />
        <div style={{ marginTop: 40, fontSize: 56, fontWeight: 700, letterSpacing: -1.2 }}>
          Your documents, understood by AI
        </div>
        <div style={{ marginTop: 22, fontSize: 30, color: "#5b4a28" }}>
          Chat with PDF and DOCX files. Answers cite the page they came from.
        </div>
      </div>
    ),
    size
  );
}
